// src/contract/request.ts — generated; see index.ts
import { type OptionField, type RenderOptions } from './render-options.js';

export const OUTPUT_MODES = ['binary', 'url'] as const;
export type OutputMode = (typeof OUTPUT_MODES)[number];

export const RENDER_STATUSES = ['queued', 'rendering', 'succeeded', 'failed'] as const;
export type RenderStatus = (typeof RENDER_STATUSES)[number];

export const RENDER_SOURCES = ['html', 'url'] as const;
export type RenderSource = (typeof RENDER_SOURCES)[number];

export const ACCOUNT_STATUSES = ['active', 'past_due', 'cancelled'] as const;
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];

export interface Cookie {
  name: string;
  value: string;
  domain?: string;
  path?: string;
}

export interface RenderRequest {
  /** Exactly one of html or url. */
  html?: string;
  url?: string;
  options?: RenderOptions;
  output?: OutputMode;
  filename?: string;
  /** url input only: extra request headers, so an authenticated page can be rendered. */
  headers?: Record<string, string>;
  /** url input only: cookies to seed the context with. */
  cookies?: Cookie[];
}

export interface AsyncRenderRequest extends RenderRequest {
  callback_url: string;
}

export interface RenderUrlResponse {
  id: string;
  url: string;
  expires_at: string;
  pages: number;
  bytes: number;
  duration_ms: number;
}

export interface AsyncRenderAccepted {
  id: string;
  status: 'queued';
}

export interface RenderStatusResponse {
  id: string;
  status: RenderStatus;
  url?: string;
  expires_at?: string;
  pages?: number;
  bytes?: number;
  duration_ms?: number;
  error?: { code: string; message: string };
}

export interface UsageResponse {
  used: number;
  limit: number;
  overage_count: number;
  period_start: string;
  resets_at: string;
}

/** Body sent to callback_url when an async render settles. */
export interface WebhookPayload {
  id: string;
  status: 'succeeded' | 'failed';
  url?: string;
  pages?: number;
  bytes?: number;
  duration_ms: number;
  error?: { code: string; message: string };
}

// ── extraction ───────────────────────────────────────────────────────────────
// PDF in, structured JSON out. Shares the renders table and every piece of
// request machinery with rendering, but the shapes are its own.

export const EXTRACT_OUTPUT_MODES = ['inline', 'url'] as const;
export type ExtractOutputMode = (typeof EXTRACT_OUTPUT_MODES)[number];

export const FIELD_TYPES = ['string', 'number', 'boolean', 'date'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldSpec {
  type: FieldType;
  /** The label as printed on the page. Defaults to the field's own name. */
  match?: string;
}

export interface ExtractOptions {
  /** "1-5", "2", "1,4-6". Omit for the whole document. Billed per page read. */
  pages?: string;
  /** Table reconstruction. On by default. */
  tables?: boolean;
  /** Full text per page. Off by default — it is the bulkiest part of a response. */
  text?: boolean;
}

export interface ExtractRequest {
  /** Exactly one of file, html or url. Base64 PDF bytes, or an https URL to one. */
  file?: string;
  html?: string;
  url?: string;
  /** Omit to get every labelled field on the page, keyed by the label as printed. */
  schema?: Record<string, FieldSpec>;
  options?: ExtractOptions;
  output?: ExtractOutputMode;
}

export interface AsyncExtractRequest extends ExtractRequest {
  callback_url: string;
}

/** [x0, y0, x1, y1] in PDF points, origin top-left — the origin a browser uses. */
export type Bbox = [number, number, number, number];

/**
 * A found value and where it came from.
 *
 * `raw` is always the text exactly as printed; `value` is that text coerced to
 * the type asked for, or null when it could not be. Both are present because an
 * ambiguous date is deliberately not guessed — 03/04/2026 is two different days
 * depending on who printed it, and `raw` is how the caller decides.
 */
export interface FoundValue {
  value: string | number | boolean | null;
  raw: string;
  page: number;
  bbox: Bbox;
}

export interface ExtractedTable {
  page: number;
  /** Null when the geometry does not prove a header, rather than a guessed row. */
  header: string[] | null;
  rows: string[][];
  bbox: Bbox;
}

export interface ExtractResponse {
  id: string;
  /** Pages actually read, and what you are billed for. */
  pages: number;
  /** Pages in the whole document, which is not the same thing. */
  page_count: number;
  /** A field the document does not contain is null, not an error. */
  fields: Record<string, FoundValue | null>;
  tables: ExtractedTable[];
  /** Present only when options.text was set. */
  text?: string[];
  /** Present only when some page had no text layer. */
  pages_without_text?: number[];
  usage: { pages: number };
  duration_ms: number;
}

/** What `output: "url"` returns instead of the document itself. */
export interface ExtractUrlResponse {
  id: string;
  url: string;
  expires_at: string;
  pages: number;
  duration_ms: number;
}

export interface ExtractionStatusResponse {
  id: string;
  status: RenderStatus;
  pages?: number | null;
  duration_ms?: number | null;
  created_at: string;
  url?: string;
  expires_at?: string;
  error_code?: string;
}

/** Top-level request fields, for the generated docs reference. */
export const REQUEST_FIELDS_SPEC = [
  {
    name: 'html',
    type: { kind: 'string', maxLength: 5_000_000 },
    description: 'The document to render. Mutually exclusive with url; exactly one is required.',
  },
  {
    name: 'url',
    type: { kind: 'string', maxLength: 2000 },
    description: 'A public http(s) URL to render. Mutually exclusive with html.',
  },
  {
    name: 'output',
    type: { kind: 'enum', values: OUTPUT_MODES },
    default: 'binary',
    description: '"binary" streams application/pdf back; "url" uploads and returns a signed link.',
  },
  {
    name: 'filename',
    type: { kind: 'string', maxLength: 255 },
    default: 'document.pdf',
    description: 'Used for Content-Disposition on binary output and in the signed URL.',
  },
  {
    name: 'headers',
    type: { kind: 'object', fields: [] },
    description: 'url input only. Extra request headers, e.g. an Authorization header.',
  },
  {
    name: 'cookies',
    type: { kind: 'object', fields: [] },
    description: 'url input only. Array of {name, value, domain?, path?} seeded into the context.',
  },
] as const satisfies readonly OptionField[];
