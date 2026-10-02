# @pdfcraft-dev/pdf

**HTML to PDF, PDF back to JSON, and accessibility triage.** The official TypeScript client
for [PDFCraft](https://pdfcraft.dev) — POST some HTML or a URL and get a PDF rendered by real
Chromium, POST a PDF and get its tables and labelled fields back as structured data, or point
it at a domain and get every PDF on it checked against PDF/UA and WCAG 2.1 AA.

[![npm](https://img.shields.io/npm/v/@pdfcraft-dev/pdf.svg)](https://www.npmjs.com/package/@pdfcraft-dev/pdf)
[![zero dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](#what-you-are-installing)
[![license](https://img.shields.io/npm/l/@pdfcraft-dev/pdf.svg)](./LICENSE)

```bash
npm install @pdfcraft-dev/pdf
```

```ts
import { Renderer } from '@pdfcraft-dev/pdf';

const pdfcraft = new Renderer(process.env.PDFCRAFT_API_KEY!);

const pdf = await pdfcraft.render({ html: '<h1>Invoice 1042</h1>' });
await writeFile('invoice.pdf', pdf);
```

That is the whole product. No browser to install, no Chromium in your Docker image, no
`--disable-dev-shm-usage` to discover the hard way. Get a key at
[pdfcraft.dev](https://pdfcraft.dev) — the free tier is 100 renders a month and needs no
card.

## What you are installing

**Zero runtime dependencies.** 24 kB packed — about half of which is source maps, so stack
traces from inside the client point at real TypeScript — and nothing beneath it in your
lockfile. The client is `fetch` plus a retry loop; the types are generated from the same
source file the API validates requests against, so they cannot drift from the server.

Ships ESM and CommonJS. Works on Node 18+, Bun, Deno, Cloudflare Workers, Vercel Edge —
anywhere there is a global `fetch`.

## The methods

```ts
// HTML or a URL, out as a PDF
const pdf = await pdfcraft.render({ html });            // Uint8Array (a Buffer in Node)
const res = await pdfcraft.renderToUrl({ html });       // { url, expires_at, pages, bytes }
const job = await pdfcraft.renderAsync({ html, callback_url });
const sta = await pdfcraft.getRender(job.id);

// A PDF, out as JSON
const doc = await pdfcraft.extractPdf(bytes);           // { fields, tables, usage }
const via = await pdfcraft.extract({ file, schema });   // same, with base64 or a URL
const ref = await pdfcraft.extractToUrl({ file });      // { url, expires_at, pages }
const ejb = await pdfcraft.extractAsync({ file, callback_url });
const est = await pdfcraft.getExtraction(ejb.id);

// A domain, out as a ranked accessibility report
const scn = await pdfcraft.scan({ source: { domain } }); // { id, status, discovered }
const rep = await pdfcraft.getScan(scn.id);             // { checked, failing, documents }

const use = await pdfcraft.usage();                     // { used, limit, resets_at }
```

`render` streams the bytes back on the same connection — one round trip, typically under
a second. `renderToUrl` uploads to storage and hands you a signed link instead, which is
what you want when the PDF is large or the caller is a browser. Both take the same input;
the method you call decides the output, so there is no `output` field to get wrong.

## Page options

Every option the API accepts, fully typed, with autocomplete on the enums.

```ts
const pdf = await pdfcraft.render({
  html: invoiceHtml,
  options: {
    format: 'A4',                                   // A4 A3 A5 Letter Legal Tabloid
    landscape: false,
    margin: { top: '20mm', right: '15mm', bottom: '20mm', left: '15mm' },
    scale: 1.0,                                     // 0.1 – 2.0
    printBackground: true,                          // on by default here, unlike a browser
    pageRanges: '1-5',
    headerHtml: '<div style="font-size:9px;width:100%;text-align:center">Acme Ltd</div>',
    footerHtml: '<div style="font-size:9px"><span class="pageNumber"></span></div>',
    waitFor: { selector: '#ready', networkIdle: true, delayMs: 0 },
    emulateMedia: 'print',                          // print | screen
    timeoutMs: 30_000,                              // ceiling 120_000
  },
  filename: 'invoice-1042.pdf',
});
```

`headerHtml` and `footerHtml` support Chromium's print classes — `pageNumber`, `totalPages`,
`date`, `title`, `url`. A footer needs a bottom margin big enough to sit in, or it will not
appear at all.

### Rendering a page behind a login

```ts
const { url } = await pdfcraft.renderToUrl({
  url: 'https://app.example.com/reports/42',
  headers: { Authorization: `Bearer ${token}` },
  cookies: [{ name: 'session', value: sessionId }],
});
```

### Waiting for the page to be ready

A chart that renders from JavaScript is not finished when the DOM loads. Use whichever
signal your page actually gives you:

```ts
options: { waitFor: { selector: '#chart-rendered' } }   // best: explicit
options: { waitFor: { networkIdle: true } }             // good: no requests for 500ms
options: { waitFor: { delayMs: 1500 } }                 // last resort: a guess
```

## PDF to JSON

The other direction. Hand it a PDF and get back the tables it reconstructed and the
labelled fields it found — each with a bounding box saying where on the page it came from.

```ts
const doc = await pdfcraft.extractPdf(await readFile('invoice.pdf'));

doc.fields['Invoice Number'];
// { value: 'INV-2026-0417', raw: 'INV-2026-0417', page: 1, bbox: [115, 55, 176, 64] }

doc.tables[0];
// { page: 1,
//   header: ['DESCRIPTION', 'QUANTITY', 'UNIT PRICE', 'TOTAL'],
//   rows: [['Professional Services', '10', '1,000.00', '10,000.00'], …],
//   bbox: [30, 133, 565, 230] }
```

**No OCR, and no model.** Extraction is geometric: text runs are grouped into lines, lines
are split into columns on horizontal whitespace, and a table is a run of consecutive lines
sharing a column count. The same document always produces the same JSON. A scan has no text
layer to read, so it comes back as `extraction_failed` — and is not billed, because
charging for a *no* that took twenty milliseconds to determine would be rude.

A table broken across pages is stitched back together: consecutive pages whose header
matches become one table and the repeated header rows are dropped, so a fourteen-page bank
statement arrives as one table of 560 rows rather than fourteen tables and thirteen stray
headers.

### Asking for specific fields

```ts
const doc = await pdfcraft.extract({
  file: base64Pdf,                                 // or an https URL to a PDF
  schema: {
    invoice_number: { type: 'string', match: 'Invoice Number' },
    issued:         { type: 'date',   match: 'Invoice Date' },
    total:          { type: 'number', match: 'Total' },
  },
  options: { pages: '1-5', tables: true, text: false },
});

doc.fields.issued;   // { value: '2026-08-21', raw: '21/08/2026', page: 1, bbox: […] }
doc.fields.missing;  // null — the document does not contain it. Still a 200.
```

Matching ignores case and punctuation, so `invoice_number` finds `Invoice Number:` without
being told. Numbers accept thousands separators, Indian digit grouping, a currency symbol
and accounting negatives in parentheses.

Ambiguous dates are deliberately **not** guessed. `03/04/2026` is two different days
depending on who printed it, so it stays a string; `raw` always holds the text exactly as
printed, which is how you decide.

### Straight from a URL or from HTML

```ts
const doc = await pdfcraft.extract({
  url: 'https://app.example.com/invoices/1042',
  schema: { total: { type: 'number', match: 'Total' } },
});
```

The page is rendered with the same Chromium as `render()`, then extracted. One call, one
charge.

### What it will not do

- **No OCR.** No scans, no photographs, no handwriting.
- **No encrypted PDFs.** Decrypt first — the API deliberately accepts no password, so it
  never holds one.
- **PDF in only.** Not DOCX, not XLSX. If your source is a web page, send `url` or `html`.
- **500 pages per request.** Use `options.pages` beyond that.

Extraction is billed **per page read**, not per call, so a page range narrows the bill as
well as the work. `usage()` counts pages and renders in the same allowance.

## Accessibility

Point it at a domain and it finds every PDF, checks each against PDF/UA and WCAG 2.1 AA, and
returns a report ranked by severity weighted by reach, with a remediation cost range.

```ts
let scan = await pdfcraft.scan({
  source: { domain: 'example.gov' },
  options: { max_documents: 500 },
});

while (scan.status !== 'succeeded' && scan.status !== 'failed') {
  await new Promise((r) => setTimeout(r, 10_000));
  scan = await pdfcraft.getScan(scan.id);
}

for (const doc of scan.documents?.slice(0, 10) ?? []) {
  // already ranked — this is the fix list, not an alphabetical dump
  console.log(doc.severity, `${doc.score}/100`, doc.url);
  console.log(`  $${doc.cost_low_usd}-$${doc.cost_high_usd} to remediate`);
}
```

Exactly one of `source.domain`, `source.sitemap` or `source.urls`. A scan runs for minutes —
one request per second per host is a rule we do not break — so `scan()` returns an id
immediately and you poll `getScan()`.

`max_documents` is **clamped to your plan rather than refused**. `discovered` minus `checked`
is what was found and never looked at, which is also the upgrade prompt.

`report_url` on a finished scan is a **share token**, not a path. Anyone holding it can read the
full HTML report at `/r/<token>` with no account at all, and `/r/<token>/pdf` renders that same
report to PDF through the render API. Treat it as a credential.

Each finding carries `severity` (`'blocker' | 'major' | 'minor'`), the `wcag` criteria it
breaks, a `message` written for whoever approves the budget, and `technical_detail` for whoever
does the work. `occurrences` is volume, not severity — one check failing 1,535 times is one
thing wrong, fixed once, so never sort on it.

```ts
import type { A11yFinding, A11yScanResponse, A11ySeverity } from '@pdfcraft-dev/pdf';
```

Half of what it checks is not machine-checkable by a conformance validator: whether the reading
order stored in the file matches the page, whether a tagged table is really a grid, whether alt
text describes anything or is just a filename. Those arrive with `layer: 'geometric'`.

Accessibility is a **separate subscription** from rendering — an account can hold either, both
or neither, and the free tier is a real scan of 25 documents with full findings.

## Errors

Every failure is a `PDFCraftError` with a stable `.code` you can branch on. The codes are
part of the contract and will not be renamed inside a major version.

```ts
import { PDFCraftError } from '@pdfcraft-dev/pdf';

try {
  await pdfcraft.render({ html });
} catch (error) {
  if (error instanceof PDFCraftError) {
    if (error.code === 'quota_exceeded') return showUpgradePrompt();
    if (error.retryable) return queueForLater();
    throw error;
  }
}
```

| `.code`            | HTTP | Means                                    | Billed?                                 |
| ------------------ | ---- | ---------------------------------------- | --------------------------------------- |
| `invalid_request`  | 400  | Bad option, or both/neither html and url | no                                      |
| `invalid_api_key`  | 401  | Missing, malformed or revoked key        | no                                      |
| `payment_required` | 402  | Subscription past due                    | no                                      |
| `not_found`        | 404  | Unknown render id                        | no                                      |
| `render_timeout`   | 408  | The page exceeded `timeoutMs`            | no                                      |
| `render_failed`    | 422  | Navigation failed, selector never showed | **yes** — Chromium ran, your HTML broke |
| `rate_limited`     | 429  | Too many requests per second             | no                                      |
| `quota_exceeded`   | 429  | Monthly plan limit reached               | no                                      |
| `unsupported_file` | 415  | Not a PDF, encrypted, or corrupt         | no                                      |
| `extraction_failed`| 422  | Parsed, but no text layer — likely a scan| no                                      |
| `internal_error`   | 500  | Our fault                                | no                                      |

`error.retryable` is true for `network_error`, `429` and `5xx`. Retries on those happen
automatically — up to three retries with exponential backoff, honouring `Retry-After`. Other
`4xx` are never retried, because they fail identically however often you ask.

## Idempotency

Pass a key as the second argument. The same key inside 24 hours returns the original
render instead of billing you twice — which matters when the thing calling you is a
webhook handler or a job queue that retries.

```ts
await pdfcraft.render({ html }, `invoice-${invoiceId}`);
await pdfcraft.extract({ file }, `parse-${invoiceId}`);
```

Keys are per account and shared across both endpoints, so use distinct ones for a render
and an extraction of the same document.

## Async renders and extractions

For documents that take a while, or when you do not want to hold a connection open.
`extractAsync` is the same shape as `renderAsync` and signs its callback the same way.

```ts
const { id } = await pdfcraft.renderAsync({
  html,
  callback_url: 'https://example.com/hooks/pdf',
});

// later, if you would rather poll than receive
const { status, url } = await pdfcraft.getRender(id);

// extraction is identical, with its own id space
const job = await pdfcraft.extractAsync({ file, callback_url });
const { status: s, url: u } = await pdfcraft.getExtraction(job.id);
```

An extraction id is not a render id: `getRender` returns 404 on one and `getExtraction`
returns 404 on a render id, deliberately, so neither can be probed with the other's ids.

The callback is a POST with an `x-signature` header: HMAC-SHA256 of the **raw** request
body, hex-encoded, keyed with your webhook secret from the dashboard. Verify it before
trusting the payload.

```ts
import { createHmac, timingSafeEqual } from 'node:crypto';

const expected = createHmac('sha256', process.env.PDFCRAFT_WEBHOOK_SECRET!)
  .update(rawBody) // the raw bytes, not the parsed object
  .digest('hex');

const given = Buffer.from(req.headers['x-signature'] as string);
const ok = given.length === expected.length && timingSafeEqual(Buffer.from(expected), given);
```

## Client options

```ts
new Renderer(apiKey, {
  baseUrl: 'https://api.pdfcraft.dev', // point at a test double in your test suite
  maxRetries: 3,
  timeoutMs: 130_000,                  // just past the API's own 120s ceiling
  fetch: myInstrumentedFetch,          // inject your own for logging or mocking
});
```

Testing against a fake is the reason `fetch` is injectable — you should not need network
access to run your unit tests.

## Links

- **Docs and live playground** — <https://pdfcraft.dev>
- **Error reference** — <https://pdfcraft.dev/errors>
- **Pricing** — <https://pdfcraft.dev/pricing>
- **Status and support** — <mailto:support@pdfcraft.dev>

## Contributing

Issues and pull requests are welcome.

One exception: `src/contract/` is generated from the API's own option, plan and error
definitions, so the client and the server cannot disagree about them. A change there has to
start on the server side — open an issue and it will come back through as a release.
Everything else is ordinary source.

## License

MIT © Gaurav Singh. See [LICENSE](./LICENSE).
