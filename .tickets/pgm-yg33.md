---
id: pgm-yg33
status: open
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

