# Publishing `@pdfcraft-dev/pdf`

This repo is the SDK and nothing else. It publishes to npm; it never deploys anywhere.
Nothing you do here touches the API or the docs site.

```bash
./scripts/publish.sh --dry-run     # every check, stops before publishing
./scripts/publish.sh               # the same checks, then asks, then publishes
```

Export `PDFCRAFT_BASE_URL` and `PDFCRAFT_API_KEY` first and it also renders a real PDF
through the packed tarball. Without them that check is skipped and says so.

---

## One-time setup

**1 · The npm organization.** Create `pdfcraft-dev` at <https://www.npmjs.com/org/create>,
free plan. The name is why `@pdfcraft-dev/*` is yours.

The scope is `pdfcraft-dev`, not `pdfcraft`, because npm keeps packages, users and
organizations in one namespace — and a package called `pdfcraft` was published in
December 2023 and abandoned, which reserves the string against everything else.

**2 · Two-factor auth.** <https://www.npmjs.com/settings/~/tfa> → _Authorization and
Publishing_. npm then asks for a code on every publish.

**3 · Log in.** `npm login`, then `npm whoami`.

`package.json` carries `"publishConfig": { "access": "public" }`. Leave it — a scoped
package is private by default and publishing one privately needs a paid plan, so removing
that line turns your first publish into `402 Payment Required`.

---

## What the preflight checks

| # | Check | Why |
| --- | --- | --- |
| 1 | Clean tree, and `repository.url` does not 404 for a logged-out visitor | npm shows that link on your package page; a dead one reads as abandoned |
| 2 | Version unclaimed, logged in, access `public` | npm never lets you replace a published version |
| 3 | Clean build, ESM and CJS | A stale `dist/` cannot ship |
| 4 | Tarball has README, LICENSE and both builds; no `src/` or `scripts/` | The `files` field breaks silently |
| 5 | Install the tarball into an empty project, `import` and `require` it, assert zero dependencies | The only check that exercises what a customer receives |
| 6 | Typecheck a TypeScript consumer under `NodeNext` | **See below** |
| 7 | Render a real PDF through the installed package | End to end, over HTTP |
| 8 | Confirm, then `npm publish` | |

### Why step 6 exists

The first build of this package shipped types that silently evaporated. `src/contract/index.ts`
re-exported with extensionless specifiers — `export * from './request'` — which is legal
under `moduleResolution: bundler` and illegal under `NodeNext`, what a modern Node consumer
uses. TypeScript does not error on a failed re-export inside a dependency. It quietly
resolves every type behind it to `any`.

That would have been an SDK where `render({ format: 'A9' })` typechecks, autocomplete is
empty, and nothing is validated — indistinguishable from having no types, except that
`package.json` claims otherwise.

Two things stop it now: this repo compiles with `module`/`moduleResolution: NodeNext`, so an
extensionless relative import fails the build; and step 6 installs the tarball and
typechecks a consumer against it with `@ts-expect-error` on three calls that must not
compile. The first catches it while writing, the second catches anything that reaches the
tarball.

---

## Where `src/contract/` comes from

Those four files are generated. They hold the option, plan and error definitions the
PDFCraft API validates requests against, so the SDK's types match the server by
construction rather than by memory.

They are regenerated from the API's private repo:

```bash
# from the pdfcraft monorepo
node packages/contract/scripts/sync-sdk.mjs ../pdfcraft-dev
```

You do not need to think about this when publishing. The monorepo's own test suite fails
when the contract changes and tells you to run it — that is the only trigger.

---

## Releasing a new version

npm never lets you republish a version number, and unpublishing is only allowed within 72
hours. Bump deliberately.

```bash
npm version patch     # 1.0.0 -> 1.0.1   bug fix, no API change
npm version minor     # 1.0.0 -> 1.1.0   new option or method, backward compatible
npm version major     # 1.0.0 -> 2.0.0   something existing behaves differently
./scripts/publish.sh
```

"Backward compatible" is judged from the caller's side. Adding a render option is minor.
Changing what `render()` returns, renaming an error code, or raising the minimum Node
version is major, however small the diff looks.

A release candidate keeps `latest` clean:

```bash
npm version 1.1.0-rc.1
npm publish --tag next     # installs only via @pdfcraft-dev/pdf@next
```

---

## When it goes wrong

| Message | Cause and fix |
| --- | --- |
| `402 Payment Required` | `publishConfig.access` was removed. Put it back, or `npm publish --access public` once. |
| `403 Forbidden` on the scope | Not a member of the `pdfcraft-dev` org, or logged in as the wrong user. `npm whoami`. |
| `403 cannot publish over previously published version` | Already on the registry. Bump; you cannot overwrite. |
| `ENEEDAUTH` | `npm login` again — the token expired. |
| `EOTP` | The 2FA code was wrong or stale. Codes last 30 seconds. |
| `uncommitted changes in …` | The preflight names the files. Commit them, or add build junk to `.gitignore`. |
| Tarball is missing `dist/` | The build did not run. `npm run build`, then re-check. |

---

## Later: publishing from CI

Once releases are routine, move them off your laptop. A GitHub Actions job publishing with
[npm provenance](https://docs.npmjs.com/generating-provenance-statements) attaches a signed
link from the tarball back to the exact commit and workflow that built it — a green
Provenance badge on the npm page that hand-publishing cannot produce.

It needs `id-token: write`, an npm **automation** token in `NPM_TOKEN` (which bypasses the
2FA prompt), and `npm publish --provenance`. Do not try `--provenance` from your own
machine; it requires an OIDC token only CI has.
