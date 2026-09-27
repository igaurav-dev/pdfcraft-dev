// src/contract/errors.ts — generated; see index.ts
//
// Every error the API can return. The exception filter maps domain errors onto
// this table, the SDK exposes `.code` from it, and the docs error reference is
// generated from it — each anchor matches the docs_url the API hands back.

export const DOCS_ORIGIN = 'https://pdfcraft.dev';

export const ERROR_CODES = [
  'invalid_request',
  'invalid_api_key',
  'payment_required',
  'not_found',
  'render_timeout',
  'render_failed',
  'rate_limited',
  'quota_exceeded',
  'demo_busy',
  'unsupported_file',
  'extraction_failed',
  'internal_error',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ErrorSpec {
  readonly code: ErrorCode;
  readonly status: number;
  /** True when Chromium actually ran, which is what makes a render billable. */
  readonly billable: boolean;
  readonly when: string;
  readonly whatToDo: string;
}

export const ERROR_TABLE = [
  {
    code: 'invalid_request',
    status: 400,
    billable: false,
    when: 'Both html and url were supplied, or neither, or an option is out of range.',
    whatToDo: 'Read the message — it names the offending field. Send exactly one of html or url.',
  },
  {
    code: 'invalid_api_key',
    status: 401,
    billable: false,
    when: 'The Authorization header is missing, malformed, or the key has been revoked.',
    whatToDo: 'Send "Authorization: Bearer sk_live_…". Issue a fresh key from the dashboard.',
  },
  {
    code: 'payment_required',
    status: 402,
    billable: false,
    when: 'The last subscription payment failed, so the account is past_due.',
    whatToDo: 'Update the card on the billing portal. Rendering resumes the moment payment clears.',
  },
  {
    code: 'not_found',
    status: 404,
    billable: false,
    when: 'No render with that id belongs to your account.',
    whatToDo:
      'Check the id. Ids from another account also return 404, never 403, so they cannot be probed.',
  },
  {
    code: 'render_timeout',
    status: 408,
    billable: false,
    when: 'The page did not finish within timeoutMs and was force-closed.',
    whatToDo:
      'Raise timeoutMs (max 120000), or relax waitFor — networkIdle on a page with a long-poll never settles.',
  },
  {
    code: 'render_failed',
    status: 422,
    billable: true,
    when: 'Chromium ran but the page threw, navigation failed, or waitFor.selector never appeared.',
    whatToDo:
      'Load the same HTML in a browser. This one is billable because the browser did the work.',
  },
  {
    code: 'rate_limited',
    status: 429,
    billable: false,
    when: 'More requests per second than the plan allows.',
    whatToDo: 'Honour the Retry-After header and back off. Paid plans allow 20 req/s.',
  },
  {
    code: 'quota_exceeded',
    status: 429,
    billable: false,
    when: 'A free-plan account has used all 100 renders in the current period.',
    whatToDo:
      'Upgrade, or wait for resets_at from GET /v1/usage. Paid plans never hard-stop; they accrue overage.',
  },
  {
    // The playground is a shared, unauthenticated resource paid for out of the
    // same pocket as everything else, so it has a ceiling that is nothing to do
    // with any one visitor's behaviour. Distinct from rate_limited on purpose:
    // "you are going too fast" and "the free demo is saturated right now" need
    // different words, and only one of them is fixed by signing up.
    code: 'demo_busy',
    status: 429,
    billable: false,
    when: 'The docs playground hit its per-IP or site-wide hourly ceiling. Never returned to an API key.',
    whatToDo:
      'Create a free account — 100 renders a month, no shared ceiling. The playground is a shop window, not an API.',
  },
  {
    code: 'unsupported_file',
    status: 415,
    billable: false,
    when: 'The file is not a PDF, is password-protected, or is corrupt beyond parsing.',
    whatToDo:
      'Send an unencrypted PDF. Decrypt it first — we deliberately do not accept passwords, so we never hold one.',
  },
  {
    // NOT billable, unlike render_failed, and the difference is deliberate.
    // render_failed bills because Chromium spent real work on a page that
    // loaded and then threw. Detecting a missing text layer costs about 20ms
    // per page and returns nothing of value, so charging for it would be
    // charging for a "no". A schema field that simply isn't in the document is
    // not this error — that is a 200 with a null field.
    code: 'extraction_failed',
    status: 422,
    billable: false,
    when: 'The PDF parsed but carries no text layer, so there is nothing to extract. Usually a scan or a photo.',
    whatToDo:
      'Check pages_without_text in the response. A scanned document needs OCR, which this endpoint does not do.',
  },
  {
    code: 'internal_error',
    status: 500,
    billable: false,
    when: 'Something on our side broke.',
    whatToDo: 'Retry with backoff. Never billed. If it persists, send us the render id.',
  },
] as const satisfies readonly ErrorSpec[];

export const ERROR_SPEC_BY_CODE: Readonly<Record<ErrorCode, ErrorSpec>> = Object.fromEntries(
  ERROR_TABLE.map((spec) => [spec.code, spec]),
) as Record<ErrorCode, ErrorSpec>;

export function docsUrlFor(code: ErrorCode): string {
  return `${DOCS_ORIGIN}/errors#${code}`;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    docs_url: string;
  };
}
