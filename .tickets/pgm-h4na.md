---
id: pgm-h4na
status: open
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: bug
priority: 2
assignee: Opus
external-ref: pgm:feature-mutations-are-too-slow-waiting-for-server-need-optimistic-that-syncs-bumplessly-with-websocket
parent: pgm-o8hh
tags: [grid-backlog, core]
---
# Preserve pending edits through server and websocket updates

## Outcome

Local edits remain immediate. Server responses and websocket updates preserve other pending edits and accept current server history. Existing node creation stays stable.

## Scope

Own ProjectDetailPage and its small optimistic helper. Existing controls already send optimistic whole-project snapshots and clientMutationId. Matching acknowledgements currently skip server bookkeeping. Nonmatching responses and failures can replace another pending edit. Preserve pending values while accepting server corrections and remote changes. Do not suppress all socket updates during requests.

Verify root, child, and isolated-child creation before changing motion. Canonical IDs already exist. No pending-* IDs or replacement sync framework. Concurrent persistent writes are a separate server risk; verify before promising overlap support. Context import/upload wait paths require focused evidence before adding scope.

## Proof

One focused check covers delayed title plus pending status, external change while pending, failed action, and equivalent child acknowledgement. Accept updated operationLog without a needless spatial-map replacement. Browser proof confirms one entrance, stable selection/ID, and no confirmation restart. Record necessary layout motion separately.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Sources: feature-mutations-are-too-slow-waiting-for-server-need-optimistic-that-syncs-bumplessly-with-websocket; task-odd-animation-when-adding-a-node-things-move-too-much. Titles only; no required cache, protocol, timing threshold, or animation duration. Investigation: tmp/mutation-investigation.md. Targeted disk-read optimization is separate pgm-u3ce; no prerequisite edge is needed.
