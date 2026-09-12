// src/contract/render-options.ts — generated; see index.ts
//
// The one description of the render option surface. The API builds its validator
// from RENDER_OPTIONS_SPEC and the docs site builds its reference table from the
// same constant, so the two cannot drift. The SDK, which lives in its own repo,
// keeps a copy written by scripts/sync-sdk.mjs so it can stay dependency-free —
// apps/api/test/contract-sync.spec.ts fails when this file changes without it.

export type OptionKind =
  | { readonly kind: 'enum'; readonly values: readonly string[] }
  | { readonly kind: 'boolean' }
  | { readonly kind: 'number'; readonly min: number; readonly max: number }
  | { readonly kind: 'integer'; readonly min: number; readonly max: number }
  | { readonly kind: 'string'; readonly maxLength: number; readonly pattern?: string }
  | { readonly kind: 'css-length' }
  | { readonly kind: 'object'; readonly fields: readonly OptionField[] };

export interface OptionField {
  readonly name: string;
  readonly type: OptionKind;
  readonly default?: string | number | boolean;
  readonly description: string;
}

export const PAGE_FORMATS = ['A4', 'A3', 'A5', 'Letter', 'Legal', 'Tabloid'] as const;
export const EMULATE_MEDIA = ['print', 'screen'] as const;

export const MAX_TIMEOUT_MS = 120_000;
export const DEFAULT_TIMEOUT_MS = 30_000;
export const MAX_HTML_BYTES = 5_000_000;

export const RENDER_OPTIONS_SPEC = [
  {
    name: 'format',
    type: { kind: 'enum', values: PAGE_FORMATS },
    default: 'A4',
    description: 'Paper size. Ignored if the page CSS declares its own @page size.',
  },
  {
    name: 'landscape',
    type: { kind: 'boolean' },
    default: false,
    description: 'Rotate the paper to landscape orientation.',
  },
  {
    name: 'margin',
    type: {
      kind: 'object',
      fields: [
        { name: 'top', type: { kind: 'css-length' }, description: 'e.g. "20mm", "1in", "72px".' },
        { name: 'right', type: { kind: 'css-length' }, description: 'e.g. "15mm".' },
        { name: 'bottom', type: { kind: 'css-length' }, description: 'e.g. "20mm".' },
        { name: 'left', type: { kind: 'css-length' }, description: 'e.g. "15mm".' },
      ],
    },
    description: 'Page margins. Any side may be omitted; omitted sides default to 0.',
  },
  {
    name: 'scale',
    type: { kind: 'number', min: 0.1, max: 2 },
    default: 1,
    description: 'Rendering scale factor.',
  },
  {
    name: 'printBackground',
    type: { kind: 'boolean' },
    default: true,
    description:
      'Print background colours and images. Off by default in browsers; on by default here.',
  },
  {
    name: 'pageRanges',
    type: { kind: 'string', maxLength: 100, pattern: '^[0-9,\\-\\s]+$' },
    description: 'Subset of pages to keep, e.g. "1-5" or "1,4,7-9". Empty means all pages.',
  },
  {
    name: 'headerHtml',
    type: { kind: 'string', maxLength: 50_000 },
    description:
      'HTML for the running header. Supports Chromium print classes: date, title, url, pageNumber, totalPages. Needs a top margin to be visible.',
  },
  {
    name: 'footerHtml',
    type: { kind: 'string', maxLength: 50_000 },
    description: 'HTML for the running footer. Same classes as headerHtml; needs a bottom margin.',
  },
  {
    name: 'waitFor',
    type: {
      kind: 'object',
      fields: [
        {
          name: 'selector',
          type: { kind: 'string', maxLength: 500 },
          description: 'Wait until this CSS selector is attached to the DOM.',
        },
        {
          name: 'networkIdle',
          type: { kind: 'boolean' },
          default: false,
          description: 'Wait until there have been no network connections for 500 ms.',
        },
        {
          name: 'delayMs',
          type: { kind: 'integer', min: 0, max: 30_000 },
          default: 0,
          description: 'Fixed pause after the other wait conditions are satisfied.',
        },
      ],
    },
    description: 'Conditions to satisfy before the PDF is taken. All of them apply, in order.',
  },
  {
    name: 'emulateMedia',
    type: { kind: 'enum', values: EMULATE_MEDIA },
    default: 'print',
    description: 'Which CSS media type the page sees.',
  },
  {
    name: 'timeoutMs',
    type: { kind: 'integer', min: 1000, max: MAX_TIMEOUT_MS },
    default: DEFAULT_TIMEOUT_MS,
    description: 'Hard ceiling on the whole render. Exceeding it returns 408 render_timeout.',
  },
] as const satisfies readonly OptionField[];

export interface Margin {
  top?: string;
  right?: string;
  bottom?: string;
  left?: string;
}

export interface WaitFor {
  selector?: string;
  networkIdle?: boolean;
  delayMs?: number;
}

export interface RenderOptions {
  format?: (typeof PAGE_FORMATS)[number];
  landscape?: boolean;
  margin?: Margin;
  scale?: number;
  printBackground?: boolean;
  pageRanges?: string;
  headerHtml?: string;
  footerHtml?: string;
  waitFor?: WaitFor;
  emulateMedia?: (typeof EMULATE_MEDIA)[number];
  timeoutMs?: number;
}

type SpecFieldName = (typeof RENDER_OPTIONS_SPEC)[number]['name'];

// Compile-time drift guard: this assignment stops type-checking the moment
// RENDER_OPTIONS_SPEC and RenderOptions describe different sets of options.
const driftCheck: [Exclude<keyof RenderOptions, SpecFieldName>] extends [never]
  ? [Exclude<SpecFieldName, keyof RenderOptions>] extends [never]
    ? true
    : never
  : never = true;

export const SPEC_MATCHES_TYPES: boolean = driftCheck;
