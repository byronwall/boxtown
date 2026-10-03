---
id: pgm-yg33
status: closed
deps: []
links: []
created: 2026-10-03T01:52:41Z
type: feature
priority: 2
assignee: Byron Wall
parent: pgm-9m5d
tags: [pgm-local-viewer]
---
# Prove relocated app persistence and preserve hosted baseline

## Outcome

A fresh production app build operates outside the checkout and persists disposable project records and image bytes. Normal hosted startup and remote API behavior retain their baseline. This is the decision-changing proof for bundling the existing app.

## Likely Steps

- Add one repeatable local smoke workflow. Use real disk files and production HTTP/auth behavior; no fake can prove artifact closure.
- Check relocated server modules, dependency resolution, browser scripts and CSS, viewer read routes, node title/context edits, image byte round-trip, and restart persistence. Reuse existing record parsing and operation-log serialization; keep images under the selected data folder.
- Inspect omitted modules or assets. Repair tracing or stage required runtime dependencies if needed. Do not change frameworks or ship development dependencies.
- Capture and repeat project/node/image, assets, auth, and event checks on a separate normal production runtime. Preserve configured hosted host/port, base path, data directory, production tokens, and remote CLI behavior. Root base path and loopback overrides apply only to the local proof.

## Ready Gate

Confirm current build/configuration and a disposable data target before refinement. The existing generated output is unverified. The inspected runtime treats port zero as port 3000; recheck fresh output and use an unused port with bounded retries. Check occupied-port, malformed-record, and non-writable-folder failures. Keep credentials out of output. Run relevant build/type and disk/API checks. HTML/asset success is not proof of hydration or server-action transport; manual viewer parity follows in M-2. Preserve existing spatial-map edits and unrelated tickets. Use pnpm. Proof data belongs under repo-root tmp; app/data and port 3000 are user targets. No live hosted writes, publication, deployment, or data migration. No native binary, Electron, separate viewer, cloud sync, automatic remote downloads, OS service, external file watching, version coexistence, database, generic adapter, or broad service refactor.

## Provenance

[Intent](../docs/intent/pgm-local-viewer/intent-brief.md), [shape](../docs/intent/pgm-local-viewer/shape-brief.md), [plan](../docs/intent/pgm-local-viewer/implementation-plan.md). Claims INT-1, INT-2, INT-3, INT-4, INT-6; selected complete-app/local-runtime shape; milestone M-1; dependencies DEP-1 and DEP-2. Baseline 5ceef90e8c4e814b87bb27321d22460072b0eed2.

## Refined packet

### Outcome

Prove that one fresh production app build serves viewer routes and writes the current project and image format from a relocated directory. Preserve the normal production server path.

### Readiness and ownership

- Base: integrated checkout at `b59e671f6af13fa00f03719d63b40638904fa52b`.
- Prerequisites: none. `app/app.config.ts` reads `BASE_PATH` at build time and registers `/ws/jobs`; disk storage reads `APP_DATA_DIR`; production API auth reads scoped `AGENT_API_TOKENS`.
- Owner: local-viewer implementation writer owns the smoke script, its disposable fixtures, and this ticket. Root owns the unrelated spatial-map edits and the later browser proof.
- Proof target: repo-root `tmp/`, with a fresh isolated runtime and data folder. Use only ports 43120–43139. Never use `app/data` or port 3000.
- Shared resources: pnpm build output. Do not overlap smoke runs with another local runtime using these ports.

### Decisions

- Must: use the built Nitro server, production token auth, existing `/api/v1` routes, current disk services, and image routes. Build local proof with root `BASE_PATH` and loopback host/port overrides.
- Must: run the normal hosted production build/start path on a separate disposable data folder with its configured base path and host/port behavior.
- Must: keep the fixture and logs under `tmp/`; leave existing user data untouched.
- Prefer: one Node-based script that builds, copies the full output, starts, checks, restarts, and stops each runtime.
- Free: script module format and helper layout, if the repeatable command remains small and uses real HTTP and files.
- Exclude: CLI local flags, browser interaction proof, publication, data migration, and changes to unrelated tickets.

### Acceptance

- A fresh build copied outside the checkout serves HTML, browser JS/CSS assets, project reads, and production-authenticated project/node/image API calls without resolving modules or assets from the checkout.
- Create and edit a project/node through the API, upload and download an image, compare bytes, restart the relocated process, and confirm saved records and image bytes remain.
- Confirm missing/invalid auth fails, an occupied port fails without selecting port 3000, malformed data returns a visible error, and an unwritable data target fails without touching another folder.
- Repeat representative HTML/assets, auth, project/node/image, and event checks on the unchanged normal production configuration using another disposable data folder. Record any pre-existing baseline limit separately.
- Run relevant app type/build and disk/API checks. Browser actions and hydration remain M2 proof and cannot be marked pass here.

### Provenance

M1 of the approved implementation plan. Authorization covers repository changes and disposable local proof only; no live service, deployment, publication, or data migration.

## Notes

**2026-10-03T02:19:55Z**

Execution checkpoint — 2026-10-02

Owner/session: local-viewer implementation writer. Root owns commits and later independent browser proof.
Base and checked state: HEAD b59e671f6af13fa00f03719d63b40638904fa52b plus this ticket's owned uncommitted source changes. Existing root-stashed spatial-map edits are untouched.
Implemented: `pnpm local:smoke` builds hosted and local-root production outputs, stages runtimes under `os.tmpdir()` outside the checkout, and tests them with disposable data under `tmp/`. Added Nitro v2 `experimental.websocket` so the existing `/ws/jobs` route upgrades on the Node server. The script compiles from TypeScript with the app's existing tsc.
Evidence: `pnpm local:smoke` passed on fixture `tmp/local-viewer-smoke-1790993866160`. Both hosted and relocated runtimes served HTML and JS/CSS assets, rejected missing and invalid production tokens, created/edited project and node data, uploaded/downloaded identical PNG bytes, wrote the current operation-log format, and delivered `project:changed`. The relocated process restarted and restored node title/context and image bytes. The relocated failure checks passed for malformed project JSON (visible 5xx), an occupied port (EADDRINUSE, no fallback), and APP_DATA_DIR set to a regular file (visible write failure). Runtime copy was outside the checkout. Fresh generated Nitro source confirms port `0` falls back to 3000; all smoke servers use only ports 43120–43139.
Hosted baseline: same app build path with inherited BASE_PATH and production token auth passed the same HTTP, assets, API, image, and event checks using its own disposable fixture. First event probe failed before enabling the Nitro v2 websocket option; both baseline and relocated event checks pass after that config fix.
Checks: `pnpm --dir app build` passed; `pnpm local:smoke` passed after the harness split; TypeScript compilation of both smoke source modules passed. Root reports changed-state app type-check passed after the config change.
Acceptance map:
- Relocated server, assets, routes, and production auth: pass — external `os.tmpdir()` runtime and HTTP checks above.
- Project/node edits, image byte round-trip, and restart: pass — CLI API HTTP calls, data files, and second process.
- Failure behavior: pass — missing/invalid auth, malformed record, occupied port, and invalid data-directory checks.
- Hosted production baseline: pass — separate production artifact, folder, and API/event checks.
- Required M1 browser hydration/actions: excluded from M1 and still required under M2; no M1 claim made for it.

Next action: close M1 and refine/start pgm-c2o7. Root owns staging/commit of these M1 files.
