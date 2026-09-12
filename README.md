# @pdfcraft-dev/pdf

**HTML to PDF in one call.** The official TypeScript client for [PDFCraft](https://pdfcraft.dev) —
POST some HTML or a URL, get back a PDF rendered by real Chromium.

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

## The four methods

```ts
const pdf = await pdfcraft.render({ html });            // Uint8Array (a Buffer in Node)
const res = await pdfcraft.renderToUrl({ html });       // { url, expires_at, pages, bytes }
const job = await pdfcraft.renderAsync({ html, callback_url });
const sta = await pdfcraft.getRender(job.id);
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
```

## Async renders

For documents that take a while, or when you do not want to hold a connection open.

```ts
const { id } = await pdfcraft.renderAsync({
  html,
  callback_url: 'https://example.com/hooks/pdf',
});

// later, if you would rather poll than receive
const { status, url } = await pdfcraft.getRender(id);
```

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
