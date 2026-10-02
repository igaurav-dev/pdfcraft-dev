// src/client.ts
import type {
  A11yScanAccepted,
  A11yScanRequest,
  A11yScanResponse,
  AsyncExtractRequest,
  AsyncRenderAccepted,
  AsyncRenderRequest,
  ExtractRequest,
  ExtractResponse,
  ExtractUrlResponse,
  ExtractionStatusResponse,
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
export type ExtractInput = Omit<ExtractRequest, 'output'>;
export type AsyncExtractInput = Omit<AsyncExtractRequest, 'output'>;

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

  // ── extraction ─────────────────────────────────────────────────────────────

  /**
   * A PDF in, its tables and labelled fields out, each with a bounding box.
   *
   * `file` takes base64 PDF bytes or an https URL to one; send `url` or `html`
   * instead and the page is rendered first, then extracted — one call, one
   * charge. Billed per page read, so `options.pages` narrows the bill as well as
   * the work.
   *
   * There is no OCR: a scan has no text layer and comes back as
   * `extraction_failed`, unbilled. Nothing here is guessed by a model, so the
   * same document always produces the same answer.
   */
  async extract(input: ExtractInput, idempotencyKey?: string): Promise<ExtractResponse> {
    const response = await this.send(
      '/v1/extract',
      { ...input, output: 'inline' },
      idempotencyKey,
    );
    return (await response.json()) as ExtractResponse;
  }

  /** Stores the JSON and returns a signed link instead of the document itself. */
  async extractToUrl(input: ExtractInput, idempotencyKey?: string): Promise<ExtractUrlResponse> {
    const response = await this.send('/v1/extract', { ...input, output: 'url' }, idempotencyKey);
    return (await response.json()) as ExtractUrlResponse;
  }

  /** Queues the extraction and calls back when it settles. */
  async extractAsync(
    input: AsyncExtractInput,
    idempotencyKey?: string,
  ): Promise<AsyncRenderAccepted> {
    const response = await this.send('/v1/extract/async', input, idempotencyKey);
    return (await response.json()) as AsyncRenderAccepted;
  }

  /**
   * Polls one extraction. An extraction id is not a render id — `getRender`
   * will 404 on one, and this will 404 on a render id, deliberately.
   */
  async getExtraction(id: string): Promise<ExtractionStatusResponse> {
    const response = await this.request(`/v1/extractions/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    return (await response.json()) as ExtractionStatusResponse;
  }

  // ── accessibility ───────────────────────────────────────────────────────

  /**
   * Starts an accessibility scan and returns at once with an id to poll.
   *
   * A scan of a thousand documents at one request per second per host has a
   * floor measured in minutes, so there is nothing to return but an id and
   * somewhere to look:
   *
   * ```ts
   * let scan = await client.scan({ source: { domain: 'example.gov' },
   *                                options: { max_documents: 500 } });
   * while (scan.status !== 'succeeded' && scan.status !== 'failed') {
   *   await new Promise((r) => setTimeout(r, 10_000));
   *   scan = await client.getScan(scan.id);
   * }
   * ```
   *
   * `max_documents` is clamped to your plan rather than refused; the gap turns
   * up as `discovered` minus `checked`, which is also the upgrade prompt.
   */
  async scan(input: A11yScanRequest): Promise<A11yScanAccepted> {
    const response = await this.send('/v1/a11y/scan', input);
    return (await response.json()) as A11yScanAccepted;
  }

  /**
   * Polls one scan: progress while it runs, then every document ranked by
   * priority with its findings and cost.
   *
   * `report_url` on a finished scan is a share token, not a path — anyone
   * holding it can read the report with no account at all, so treat it as a
   * credential rather than an identifier.
   */
  async getScan(id: string): Promise<A11yScanResponse> {
    const response = await this.request(`/v1/a11y/scans/${encodeURIComponent(id)}`, {
      method: 'GET',
    });
    return (await response.json()) as A11yScanResponse;
  }

  /**
   * Convenience for the common `file` case: hand it PDF bytes and it does the
   * base64 for you. Kept out of `extract` itself so the request stays a plain
   * JSON object you can log, diff or replay.
   */
  async extractPdf(
    pdf: Uint8Array,
    input: Omit<ExtractInput, 'file' | 'html' | 'url'> = {},
    idempotencyKey?: string,
  ): Promise<ExtractResponse> {
    return this.extract({ ...input, file: toBase64(pdf) }, idempotencyKey);
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
            // Bump with the package version. Not read from package.json: that
            // needs a JSON import, which resolves differently in the ESM and
            // CJS builds and is not worth a dual-build problem for a header.
            'user-agent': 'pdfcraft-sdk-js/1.4.0',
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

/**
 * Bytes to base64, in Node and in a browser, with no dependency either way.
 *
 * The browser path chunks rather than spreading the whole array into
 * `String.fromCharCode`: a spread of a few hundred thousand arguments overflows
 * the call stack, which for a PDF means the SDK works on your test file and
 * throws RangeError on a real one.
 */
function toBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
  let binary = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
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
