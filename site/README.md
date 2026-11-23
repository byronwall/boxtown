# Boxtown site

The landing page at <https://byronwall.github.io/prod-mgmt-grid/>. It is static: `site/public/` is the whole site, with no build step. `.github/workflows/pages.yml` deploys it when `site/public/` changes on `main`.

## Files

- `public/index.html`, `public/site.css`, `public/site.js`: the page, its styles (tokens from `DESIGN.md`), and the tabs, copy buttons and lightbox.
- `public/images/*.webp`: screenshots of the fictional Harbor Bikes demo. Captured at 1440 × 900, 2× scale.
- `public/llms.txt`: the short version for agents.
- `public/og.png`, `public/apple-touch-icon.png`: written by the check script with `--og`.
- `scripts/seed-demo.mjs`: builds the Harbor Bikes project through the `boxtown` CLI.
- `scripts/capture.mjs`: seeds a fresh demo in `tmp/site/demo-data`, starts the packaged viewer on it, and writes the screenshots.
- `scripts/check-site.mjs`: checks the page under `/prod-mgmt-grid/` and writes review screenshots to `tmp/site/shots/`.

## Reshoot the screenshots

From the repo root (about 1 minute after the first build):

```bash
pnpm install
pnpm cli:prepare-package
pnpm --dir site capture
```

`cli:prepare-package` builds the app into the CLI. Run it again after app changes. Playwright is pinned to 1.58.0, which uses the cached `chromium_headless_shell-1208`; run `pnpm --dir site exec playwright install chromium` if it is missing.

The camera and selection for each shot come from URL parameters in `capture.mjs` (`node`, `view`, `isolate`, `edges`, `inspector`). Check each image after a reshoot: the layout can move when the app changes.

## Check the page

Serve `site/public` under the Pages base path, then run the checks:

```bash
mkdir -p tmp/site/serve && ln -sfn ../../../site/public tmp/site/serve/prod-mgmt-grid
pnpm dlx http-server@14.1.1 tmp/site/serve -p 4173 -c-1
node site/scripts/check-site.mjs http://localhost:4173/prod-mgmt-grid/ --og
```

The checks cover sideways scroll at 1440, 1100, 800 and 390 px, failed requests and console errors, every image, link and anchor, the tab keys and `#tour/<id>` deep links, the copy button, and the lightbox.
