---
id: pgm-c2o7
status: open
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

