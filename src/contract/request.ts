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

export const FIELD_TYPES = ['string', 'number', 'boolean', 'date', 'currency'] as const;
export type FieldType = (typeof FIELD_TYPES)[number];

export interface FieldSpec {
  type: FieldType;
  /** The label as printed on the page. Defaults to the field's own name. */
  match?: string;
}

/**
 * One field in a schema.
 *
 * The shorthand is the string form — `{ total: "currency" }` — which is what
 * you want nine times out of ten. Reach for the object form only when the key
 * you want in the response is not the label printed on the page:
 * `{ total: { type: "currency", match: "Amount Due" } }`.
 */
export type FieldSchemaEntry = FieldType | FieldSpec;

export interface ExtractOptions {
  /** "1-5", "2", "1,4-6". Omit for the whole document. Billed per page read. */
  pages?: string;
  /** Table reconstruction. On by default. */
  tables?: boolean;
  /** Full text per page. Off by default — it is the bulkiest part of a response. */
  text?: boolean;
  /**
   * Also return each row keyed by its header, as `rows_as_objects`. Off by
   * default: it repeats every column name on every row, roughly tripling the
   * response for the same information.
   */
  rows_as_objects?: boolean;
  /**
   * The bar a block must clear to be returned as a table, 0-1. Defaults to 0.5.
   *
   * A page is a grid of boxes and not everything in a grid is a table — a
   * two-column form, an address beside a logo, a row of footer links. Lower
   * this to see every block the geometry found; raise it on a dense form where
   * only the real data tables matter. `tables_suppressed` always says how many
   * fell below whatever bar was in force.
   */
  min_confidence?: number;
}

export interface ExtractRequest {
  /** Exactly one of file, html or url. Base64 PDF bytes, or an https URL to one. */
  file?: string;
  html?: string;
  url?: string;
  /** Omit to get every labelled field on the page, keyed by the label as printed. */
  schema?: Record<string, FieldSchemaEntry>;
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
  /**
   * ISO 4217 code, for `type: "currency"` only.
   *
   * Null when the document gave no unambiguous signal. A bare "$" is used by
   * the US, Canada, Australia, New Zealand, Singapore, Hong Kong, Mexico and a
   * dozen more, so it is reported as null rather than guessed at — the same
   * rule the date coercion follows, and for the same reason: an invoice
   * silently relabelled from AUD to USD is not a recoverable error. Write
   * "USD 1,234.56" or "$1,234.56 USD" in the document and you get "USD".
   */
  currency?: string | null;
  /**
   * 0-1. How much of this pairing was read off the page and how much inferred.
   *
   * An inline "Total: 1,200.00" is the document's own punctuation saying the
   * two belong together. A value taken from the next column along, or
   * reassembled across a line wrap, rests on a judgement that can be wrong —
   * and a schema type that failed to parse lowers it further.
   */
  confidence: number;
  page: number;
  bbox: Bbox;
}

export interface ExtractedTable {
  page: number;
  /** Null when the evidence does not reach the bar, rather than a guessed row. */
  header: string[] | null;
  /**
   * 0-1. How much evidence there was that `header` is a header.
   *
   * Reported rather than hidden because the honest answer is often "probably".
   * 1.0 is a numeric column under a textual label, repeated across a page break;
   * 0.5 is a row in a different font and nothing more. Below 0.5 no header is
   * promoted at all and this says how close it came.
   */
  header_confidence: number;
  rows: string[][];
  /** Only when options.rows_as_objects was set AND a header was found. */
  rows_as_objects?: Record<string, string>[];
  /** 0-1. How sure we are this block is a table rather than a layout artifact. */
  confidence: number;
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
  /** Blocks that scored below min_confidence. Present only when some were dropped. */
  tables_suppressed?: number;
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
