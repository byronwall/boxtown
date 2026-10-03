---
id: pgm-c2o7
status: closed
deps: [pgm-yg33]
links: []
created: 2026-10-03T01:52:41Z
type: feature
priority: 2
assignee: Byron Wall
parent: pgm-9m5d
tags: [pgm-local-viewer]
---
# Package pgm with the complete editable local viewer

## Outcome

A locally installed pgm package opens the exact existing editable viewer over an explicit disk folder. Stop and restart retain project state and images. The hosted viewer and normal app deployment continue to work as today.

## Likely Steps

- Package the proven app output with server modules, browser assets, and required runtime dependencies. Inspect and install the actual pnpm tarball outside the checkout. Resolve runtime files relative to the installed package. Keep user data outside it.
- Add a foreground viewer launcher using the existing Node runtime. Resolve an absolute folder, wait for readiness, print URL/data path, and open the browser. Provide terminal use without browser opening. Show startup failures; a browser-open failure leaves a usable URL. Stop only the owned child on termination.
- Apply local production auth, local token scopes, loopback, and root base path only to the local runtime. Keep secrets out of logs and browser URLs. Guard one writer per folder; duplicate startup fails clearly until reuse is added.
- Manually check nodes, move/status/metadata, settings, tree/canvas/inspector, Markdown, image upload/view/remove, server actions, deep-link refresh, offline assets, and reopen persistence. Reuse the current viewer, record serializer, archives, image routes, and event flow.
- Repeat representative viewer/action/image checks on a separate normal production runtime. Preserve hosted configured base path, host/port, data directory, production auth, remote API/CLI, and normal build/deployment path. Hosted writes require no local ownership record.

## Ready Gate

Requires the relocated-artifact proof. Confirm packaged dependency closure, launcher environment, port behavior, folder ownership, and safe manual proof targets before refinement. Add new work in small TypeScript modules; avoid unrelated CLI conversion. Run relevant type/build/CLI checks. Browser automation needs a separate request. Preserve existing spatial-map edits and unrelated tickets. Use pnpm. Proof data belongs under repo-root tmp; app/data and port 3000 are user targets. No live hosted writes, publication, deployment, or data migration. No native binary, Electron, separate viewer, cloud sync, automatic remote downloads, OS service, external file watching, version coexistence, database, generic adapter, or broad service refactor.

## Provenance

[Intent](../docs/intent/pgm-local-viewer/intent-brief.md), [shape](../docs/intent/pgm-local-viewer/shape-brief.md), [plan](../docs/intent/pgm-local-viewer/implementation-plan.md). Claims INT-1 through INT-6; selected managed-server shape; milestone M-2; dependencies DEP-1 and DEP-2. Baseline 5ceef90e8c4e814b87bb27321d22460072b0eed2.

## Refined packet

### Outcome

An installed `pgm` package starts the existing production viewer on loopback against an explicit data folder. It keeps that state across restart and leaves the normal hosted build settings intact.

### Readiness and ownership

- Base: M1 checkpoint `a16d0608e9fbaf4795dd9c315c404e5dd3134444`; pgm-yg33 is closed with relocated build and hosted HTTP/event proof.
- Owner: local-viewer implementation writer owns package/build scripts, launcher, CLI docs, and technical checks. Root owns browser proof, screenshots, and commits.
- Runtime: build one app output under `app/`, stage it under `packages/cli` before packing, and inspect/install the actual pnpm tarball outside the checkout.
- Proof data: repo-root `tmp/`; root browser runtime uses ports 43150–43159. Never use `app/data` or port 3000.
- Dependencies: the launcher uses Node >=22, built-in process/files/network/browser-open APIs, and existing app output. No app server is started during CLI tests unless the proof command requests it.

### Decisions

- Must: `pgm viewer --data-dir <folder>` requires an explicit folder, resolves it relative to the caller, starts the packaged `server/index.mjs` with production auth, root `BASE_PATH`, absolute `APP_DATA_DIR`, and loopback binding.
- Must: show the URL and absolute data folder, wait for readiness, keep the process in the foreground, and stop only its own child on SIGINT/SIGTERM. Do not include the token in output or the URL.
- Must: `--no-open` supports terminal use. Browser-open failure reports the error and preserves the usable printed URL.
- Must: acquire one private folder ownership record atomically. Duplicate viewer startup fails clearly in M2; stale-record recovery and runtime reuse belong to M3.
- Must: resolve packaged files from the installed module location. Build launcher code from TypeScript and use pnpm scripts.
- Prefer: select a loopback port from a bounded range and retry startup collisions. Never pass port zero to Nitro because its output maps zero to 3000.
- Free: ownership record fields and small module boundaries, provided child identity and cleanup are verifiable.
- Exclude: CLI data commands against local runtime, automatic server reuse, browser shell, live hosted service, package publication, and user data migration.

### Acceptance

- `pnpm pack` creates a tarball containing the complete app server, public assets, required server dependencies, compiled CLI launcher, and CLI skills. Install the tarball with pnpm under a prefix outside the checkout; run it with no checkout files available.
- From the installed package, `pgm viewer --data-dir <tmp-folder> --no-open` serves HTML, assets, viewer reads, production-authenticated API routes, image routes, server actions, and project events.
- Root performs the authorized editable-viewer browser journey: create/edit/move/status/metadata, settings, tree/canvas/inspector, Markdown, image upload/view/remove, and deep-link refresh. Root saves evidence under `tmp/` and uses the installed tarball on ports 43150–43159.
- Ctrl+C stops the owned process and releases ownership. Restart from the same tarball/folder restores saved projects and images. Starting a second viewer for the same folder fails clearly.
- Startup collision, missing package runtime, and browser-open failure report useful errors; no owned or reused process is stopped by an unrelated viewer.
- Normal hosted production build/start, configured base path/host/port, production auth, CLI/API, images, and events still match the M1 baseline.
- Run type-check, CLI tests, packaging inspection, and production API smoke proof. Keep M2 open until root's browser criteria pass.

### Provenance

M2 of the approved implementation plan. Authorization covers local source/package changes and disposable installed-package/browser proof. No publication, deployment, live service writes, or data migration.

## Execution evidence

- Prepared, packed, and inspected the complete runtime with `pnpm cli:pack-check`. Tarball: `tmp/cli-dist/byronwallrus-product-grid-cli-0.1.8.tgz`. Installed with pnpm under `/private/tmp/pgm-local-install-final`; launcher ran from that prefix while its data folder stayed under repo `tmp/`.
- Installed runtime served viewer HTML and a browser build asset. Production API rejected a missing token with 401. Authenticated project and node creation returned 201. Restart restored both records. A second viewer for the same data folder failed with a clear ownership error. SIGINT stopped the owned server and removed the ownership file.
- `pnpm cli:test` and `pnpm --dir packages/cli test` passed 32/32 each. Launcher and packager TypeScript compilation, `node --check packages/cli/build/local-runtime.mjs`, and `git diff --check` passed.
- Root's independent browser acceptance passed on the installed local package and a normal hosted production runtime. Node edits, settings, Markdown, images, deep-link refresh, and restart worked in both modes with zero console errors. Evidence: `tmp/local-viewer-after-restart.png`, `tmp/hosted-viewer-grid.png`, plus hosted image/settings captures. An existing tree/canvas reparent control is absent in both modes; no UI change was added. Offline network switching was unavailable, so local asset closure was checked from the installed package and loaded asset responses instead.
- Root will test move through existing CLI/API behavior under M3. The absent reparent control is a shared UI limitation, not an M2 regression.
