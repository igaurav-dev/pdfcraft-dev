// packages/contract/src/request.ts
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
