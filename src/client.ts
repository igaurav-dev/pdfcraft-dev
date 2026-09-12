// src/client.ts
import type {
  AsyncRenderAccepted,
  AsyncRenderRequest,
  RenderRequest,
  RenderStatusResponse,
  RenderUrlResponse,
  UsageResponse,
} from './contract/index.js';
import { PDFCraftError, toError } from './errors.js';

export interface RendererOptions {
  /** Override for testing or a self-hosted gateway. */
  baseUrl?: string;
  /** Retries on 429 and 5xx only. Default 3. */
  maxRetries?: number;
  /** Per-request timeout in milliseconds. Default 130000, just past the API's own ceiling. */
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
}

const DEFAULTS = {
  baseUrl: 'https://api.pdfcraft.dev',
  maxRetries: 3,
  timeoutMs: 130_000,
};

/**
 * The method you call decides the output mode, so passing `output` yourself
 * could only ever contradict it. Excluded from the type rather than ignored at
 * runtime: `render({ output: 'url' })` returning bytes is the kind of silent
 * surprise that costs someone an afternoon.
 */
export type RenderInput = Omit<RenderRequest, 'output'>;
export type AsyncRenderInput = Omit<AsyncRenderRequest, 'output'>;

export class Renderer {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly timeoutMs: number;
  private readonly doFetch: typeof globalThis.fetch;

  constructor(apiKey: string, options: RendererOptions = {}) {
    if (!apiKey) throw new PDFCraftError('invalid_api_key', 'An API key is required.', 401);
    this.apiKey = apiKey;
    this.baseUrl = (options.baseUrl ?? DEFAULTS.baseUrl).replace(/\/+$/, '');
    this.maxRetries = options.maxRetries ?? DEFAULTS.maxRetries;
    this.timeoutMs = options.timeoutMs ?? DEFAULTS.timeoutMs;
    this.doFetch = options.fetch ?? globalThis.fetch.bind(globalThis);
  }

  /** The PDF bytes. In Node this is a Buffer, which is a Uint8Array. */
  async render(input: RenderInput, idempotencyKey?: string): Promise<Uint8Array> {
    const response = await this.send('/v1/render', { ...input, output: 'binary' }, idempotencyKey);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return typeof Buffer === 'undefined' ? bytes : Buffer.from(bytes);
  }

  /** Uploads the PDF and returns a signed link instead of the bytes. */
  async renderToUrl(input: RenderInput, idempotencyKey?: string): Promise<RenderUrlResponse> {
    const response = await this.send('/v1/render', { ...input, output: 'url' }, idempotencyKey);
    return (await response.json()) as RenderUrlResponse;
  }

  /** Queues the render and calls back when it settles. */
  async renderAsync(
    input: AsyncRenderInput,
    idempotencyKey?: string,
  ): Promise<AsyncRenderAccepted> {
    const response = await this.send('/v1/render/async', input, idempotencyKey);
    return (await response.json()) as AsyncRenderAccepted;
  }

  async getRender(id: string): Promise<RenderStatusResponse> {
    const response = await this.request(`/v1/renders/${encodeURIComponent(id)}`, { method: 'GET' });
    return (await response.json()) as RenderStatusResponse;
  }

  async usage(): Promise<UsageResponse> {
    const response = await this.request('/v1/usage', { method: 'GET' });
    return (await response.json()) as UsageResponse;
  }

  private send(path: string, body: unknown, idempotencyKey?: string): Promise<Response> {
    return this.request(path, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(idempotencyKey ? { 'idempotency-key': idempotencyKey } : {}),
      },
      body: JSON.stringify(body),
    });
  }

  private async request(path: string, init: RequestInit): Promise<Response> {
    let lastError: PDFCraftError | null = null;
    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      let response: Response;
      try {
        response = await this.doFetch(`${this.baseUrl}${path}`, {
          ...init,
          headers: {
            authorization: `Bearer ${this.apiKey}`,
            'user-agent': 'pdfcraft-sdk-js/1.0.0',
            ...(init.headers as Record<string, string> | undefined),
          },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (cause) {
        lastError = new PDFCraftError('network_error', `Could not reach PDFCraft: ${cause}`, 0);
        if (attempt === this.maxRetries) throw lastError;
        await sleep(backoffMs(attempt));
        continue;
      }

      if (response.ok) return response;

      const error = toError(response.status, await response.text());
      // 4xx other than 429 will fail identically no matter how many times we ask.
      if (!error.retryable || attempt === this.maxRetries) throw error;
      lastError = error;
      await sleep(retryAfterMs(response) ?? backoffMs(attempt));
    }
    throw lastError ?? new PDFCraftError('internal_error', 'Request failed.', 500);
  }
}

function backoffMs(attempt: number): number {
  return Math.round(500 * 2 ** attempt * (0.75 + Math.random() * 0.5));
}

function retryAfterMs(response: Response): number | null {
  const header = response.headers.get('retry-after');
  if (!header) return null;
  const seconds = Number(header);
  return Number.isFinite(seconds) ? Math.max(0, seconds) * 1000 : null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
