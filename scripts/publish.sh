#!/usr/bin/env bash
# scripts/publish.sh
#
# Everything between "it compiles on my machine" and "a stranger can install it".
# Run from the repo root:
#
#   ./scripts/publish.sh --dry-run          # every check, stops before publishing
#   ./scripts/publish.sh                    # checks, then asks, then publishes
#   ./scripts/publish.sh --yes              # no prompt, for CI
#
# Set PDFCRAFT_BASE_URL and PDFCRAFT_API_KEY to also render a real PDF through
# the packed tarball. Without them that one check is skipped and says so.
set -euo pipefail

DRY_RUN=0
ASSUME_YES=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes | -y) ASSUME_YES=1 ;;
    *)
      echo "unknown argument: $arg" >&2
      exit 2
      ;;
  esac
done

cd "$(dirname "${BASH_SOURCE[0]}")/.."
SDK_DIR="$PWD"
WORK="$(mktemp -d)"
# Absolute paths: the trap fires from whatever directory the script died in.
trap 'rm -rf "$WORK"; rm -f "$SDK_DIR"/*.tgz' EXIT

step() { printf '\n\033[1m%s\033[0m\n' "$1"; }
ok() { printf '  \033[32mok\033[0m   %s\n' "$1"; }
skip() { printf '  \033[33mskip\033[0m %s\n' "$1"; }
die() {
  printf '  \033[31mfail\033[0m %s\n' "$1" >&2
  exit 1
}

NAME="$(node -p 'require("./package.json").name')"
VERSION="$(node -p 'require("./package.json").version')"
printf '\033[1m%s@%s\033[0m\n' "$NAME" "$VERSION"

step '1 · Repository state'
if git rev-parse --git-dir >/dev/null 2>&1; then
  DIRTY="$(git status --porcelain -- . 2>/dev/null)"
  if [ -n "$DIRTY" ]; then
    # Name the files and the directory. "Uncommitted changes" on its own sends
    # you to run git status somewhere else and find nothing.
    printf '  \033[31mfail\033[0m uncommitted changes in %s:\n%s\n' \
      "$PWD" "$(printf '%s\n' "$DIRTY" | sed 's/^/         /')" >&2
    printf '\n         commit them, or add them to .gitignore if they are build junk.\n' >&2
    exit 1
  fi
  ok "clean at $(git rev-parse --short HEAD)"
else
  skip 'not a git checkout'
fi

# npm renders repository.url as the "Repository" link on the package page. Your
# visitors are not logged in to GitHub, so a private repo and a nonexistent one
# look identical to them: a 404 on a package nobody has heard of. Check it the
# same way they will — unauthenticated.
REPO_URL="$(node -p 'require("./package.json").repository?.url ?? ""')"
if [ -z "$REPO_URL" ]; then
  skip 'no repository field — the npm page will show no source link'
elif ! command -v curl >/dev/null 2>&1; then
  skip 'curl not installed, cannot check the repository link'
else
  WEB_URL="${REPO_URL#git+}"
  WEB_URL="${WEB_URL%.git}"
  CODE="$(curl -s -o /dev/null -w '%{http_code}' -L --max-time 15 "$WEB_URL" || echo 000)"
  case "$CODE" in
    200) ok "repository link resolves — $WEB_URL" ;;
    # 404 is the one unambiguous answer: gone, or private, which look identical
    # to a logged-out visitor. Everything else — a proxy returning 403, GitHub
    # rate-limiting with 429, a 5xx, no network at all — says nothing about the
    # repo, so it must not block a release.
    404) die "repository.url 404s for a logged-out visitor: $WEB_URL
       Either point it at a public repo, or remove repository and bugs from
       package.json. No link is honest; a dead one reads as abandoned." ;;
    000) skip "could not reach $WEB_URL — no network" ;;
    *) skip "$WEB_URL answered HTTP $CODE, which proves nothing — check it by hand" ;;
  esac
fi

step '2 · Registry'
# This version must not already exist. npm never lets you replace one.
PUBLISHED="$(npm view "$NAME@$VERSION" version 2>/dev/null || true)"
[ -z "$PUBLISHED" ] || die "$NAME@$VERSION is already on the registry — bump the version"
ok "$VERSION is unclaimed"

if [ "$DRY_RUN" -eq 0 ]; then
  WHO="$(npm whoami 2>/dev/null || true)"
  [ -n "$WHO" ] || die 'not logged in — run "npm login", or put a token in ~/.npmrc'
  ok "logged in as $WHO"
  ACCESS="$(node -p 'require("./package.json").publishConfig?.access ?? ""')"
  [ "$ACCESS" = 'public' ] || die 'publishConfig.access is not "public" — a scoped publish would be billed as private'
  ok 'scoped package will publish public'
else
  skip 'login check (--dry-run)'
fi

step '3 · Build from clean'
# A fresh clone has no node_modules, so `tsc` is not on PATH and the build dies
# with "command not found". One command should mean one command — install them.
if [ ! -x node_modules/.bin/tsc ]; then
  printf '  installing devDependencies (first run in this checkout)\n'
  npm install --no-audit --no-fund >/dev/null 2>&1 || die 'npm install failed — run it by hand to see why'
fi
npm run clean >/dev/null 2>&1
npm run build >/dev/null || die 'build failed'
if [ ! -f dist/esm/index.d.ts ] || [ ! -f dist/cjs/index.js ]; then
  die 'build produced no dist'
fi
ok 'esm + cjs emitted'

step '4 · Pack'
rm -f ./*.tgz
TARBALL="$PWD/$(npm pack 2>/dev/null | tail -n 1)"
[ -f "$TARBALL" ] || die 'npm pack produced nothing'
FILES="$(tar -tzf "$TARBALL")"
for required in package/README.md package/LICENSE package/dist/esm/index.d.ts package/dist/cjs/index.js; do
  case "$FILES" in
    *"$required"*) ;;
    *) die "$required is missing from the tarball" ;;
  esac
done
case "$FILES" in
  *package/src/*) die 'src/ leaked into the tarball — check the files field' ;;
  *package/scripts/*) die 'scripts/ leaked into the tarball — check the files field' ;;
esac
ok "$(basename "$TARBALL"), $(du -h "$TARBALL" | cut -f1), $(printf '%s\n' "$FILES" | wc -l | tr -d ' ') entries"

step '5 · Install the tarball as a stranger would'
cd "$WORK"
npm init -y >/dev/null
npm pkg set type=module >/dev/null
npm install "$TARBALL" --no-audit --no-fund >/dev/null 2>&1 || die 'install from tarball failed'
DEPS="$(npm ls --all --parseable 2>/dev/null | grep -c node_modules || echo 0)"
[ "$DEPS" -eq 1 ] || die "expected zero transitive dependencies, found $((DEPS - 1))"
ok 'installs with zero dependencies'

# A static import, so a renamed or dropped export is a SyntaxError right here
# rather than a runtime surprise in someone else's app.
node --input-type=module -e "
import { Renderer, PDFCraftError } from '@pdfcraft-dev/pdf';
if (typeof Renderer !== 'function' || typeof PDFCraftError !== 'function') process.exit(1);
" || die 'ESM import failed'
ok 'import works'
node -e "const m=require('@pdfcraft-dev/pdf'); if(!m.Renderer) process.exit(1);" || die 'CJS require failed'
ok 'require works'

step '6 · Types as a TypeScript consumer sees them'
# The check that matters most. An extensionless re-export inside src/contract
# makes every type silently become `any` under NodeNext — no error anywhere,
# just an SDK that stops validating. The @ts-expect-error lines below fail
# loudly if that ever comes back.
npm install --no-save --no-audit --no-fund typescript@5.9.3 @types/node@22.18.9 >/dev/null 2>&1
cat >tsconfig.json <<'JSON'
{
  "compilerOptions": {
    "target": "ES2022", "module": "NodeNext", "moduleResolution": "NodeNext",
    "strict": true, "noEmit": true, "skipLibCheck": true, "types": ["node"]
  },
  "include": ["consumer.ts"]
}
JSON
cat >consumer.ts <<'TS'
import { Renderer, PDFCraftError, type RenderInput, type RenderOptions } from '@pdfcraft-dev/pdf';
const r = new Renderer('sk_live_x', { baseUrl: 'http://localhost' });
const options: RenderOptions = { format: 'A4', margin: { top: '20mm' }, scale: 1.2 };
const input: RenderInput = { html: '<h1>hi</h1>', options, filename: 'invoice.pdf' };
void r.render(input).then((bytes: Uint8Array) => bytes.byteLength);
void r.renderToUrl({ url: 'https://example.com' }).then((res) => res.url);
void r.renderAsync({ html: '<p>x</p>', callback_url: 'https://example.com/hook' });
void r.getRender('rnd_1').then((s) => s.status);
void r.usage().then((u) => u.limit);
void new PDFCraftError('quota_exceeded', 'over', 429).retryable;
// @ts-expect-error the method picks the output mode, not the caller
void r.render({ html: '<p>x</p>', output: 'url' });
// @ts-expect-error format is an enum, not any string
void r.render({ html: '<p>x</p>', options: { format: 'A9' } });
// @ts-expect-error callback_url is required on the async path
void r.renderAsync({ html: '<p>x</p>' });
TS
npx --no-install tsc -p tsconfig.json || die 'the shipped .d.ts files do not typecheck against a NodeNext consumer'
ok 'types resolve and constrain under NodeNext'

step '7 · Render a real PDF through the tarball'
if [ -n "${PDFCRAFT_API_KEY:-}" ] && [ -n "${PDFCRAFT_BASE_URL:-}" ]; then
  node --input-type=module -e "
    const { Renderer } = await import('@pdfcraft-dev/pdf');
    const r = new Renderer(process.env.PDFCRAFT_API_KEY, { baseUrl: process.env.PDFCRAFT_BASE_URL });
    const pdf = await r.render({ html: '<h1>preflight</h1>' });
    if (pdf.subarray(0, 5).toString('latin1') !== '%PDF-') { console.error('not a pdf'); process.exit(1); }
    console.error('    ' + pdf.length + ' bytes');
  " || die 'the packed SDK could not render against the API'
  ok "rendered against $PDFCRAFT_BASE_URL"
else
  skip 'set PDFCRAFT_BASE_URL and PDFCRAFT_API_KEY to render for real'
fi

cd "$SDK_DIR"

step '8 · Publish'
if [ "$DRY_RUN" -eq 1 ]; then
  printf '  every check passed. Re-run without --dry-run to publish %s@%s.\n' "$NAME" "$VERSION"
  exit 0
fi
if [ "$ASSUME_YES" -eq 0 ]; then
  printf '  publish %s@%s to the public registry? [y/N] ' "$NAME" "$VERSION"
  read -r answer </dev/tty
  case "$answer" in
    y | Y | yes) ;;
    *)
      printf '  nothing published.\n'
      exit 0
      ;;
  esac
fi
npm publish
ok "published — https://www.npmjs.com/package/$NAME/v/$VERSION"
printf '\n  tag the commit so this build is reproducible:\n    git tag -a sdk-v%s -m "%s %s" && git push origin sdk-v%s\n' \
  "$VERSION" "$NAME" "$VERSION" "$VERSION"
