// packages/sdk/src/errors.ts
import type { ErrorCode } from './contract/index.js';

/** Every failure from the API arrives as one of these. Branch on `.code`. */
export class PDFCraftError extends Error {
  readonly code: ErrorCode | 'network_error';
  readonly status: number;
  readonly docsUrl: string | null;
  readonly retryable: boolean;

  constructor(
    code: ErrorCode | 'network_error',
    message: string,
    status: number,
    docsUrl: string | null = null,
  ) {
    super(message);
    this.name = 'PDFCraftError';
    this.code = code;
    this.status = status;
    this.docsUrl = docsUrl;
    this.retryable = code === 'network_error' || status === 429 || status >= 500;
  }
}

interface WireError {
  error?: { code?: string; message?: string; docs_url?: string };
}

export function toError(status: number, body: string): PDFCraftError {
  let parsed: WireError = {};
  try {
    parsed = JSON.parse(body) as WireError;
  } catch {
    // Non-JSON body (a proxy error page, say) — fall through to the defaults.
  }
  return new PDFCraftError(
    (parsed.error?.code as ErrorCode) ?? 'internal_error',
    parsed.error?.message ?? `PDFCraft responded ${status}`,
    status,
    parsed.error?.docs_url ?? null,
  );
}
