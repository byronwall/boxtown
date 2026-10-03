---
id: pgm-gydq
status: open
deps: [pgm-c2o7]
links: []
created: 2026-10-03T01:52:41Z
type: feature
priority: 2
assignee: Byron Wall
parent: pgm-9m5d
tags: [pgm-local-viewer]
---
# Share one local runtime between pgm commands and viewer

## Outcome

Local project, node, and image commands reuse the viewer server or start a temporary server. A folder has one writer. CLI edits reach the open viewer without reload. Hosted web and remote CLI behavior retain their current baseline.

## Likely Steps

- Resolve explicit local targeting before the existing HTTP client. Preserve payloads, JSON output, remote server/token/project precedence, and commands without local selection. Reject mixed local/remote flags and isolate local project selection from global remote state.
- Extend the folder ownership guard with atomic acquisition, private runtime discovery, and identity verification. Verify the same folder/runtime before reuse; an open port alone is insufficient. Remove stale ownership only after the owner is gone. A concurrent caller waits briefly or gets a clear retry error.
- Reuse active servers; start and stop an owned temporary child otherwise. Failure cleanup must never stop a reused server. Local startup uses production auth/loopback without changing hosted settings. Any local identity endpoint is inactive in hosted mode. Keep token secrets private, diagnostics on stderr, JSON stdout clean, and local commands independent of update requests.
- Prove concurrent independent edits persist through the existing mutation queue and project events. Check viewer refresh, duplicate startup, stale ownership, startup/command failure, shutdown, and restart with real disposable files/images. Read normalization can write outside the queue: reproduce a legacy-record overlap before any focused repair, and avoid nested queue calls.
- Repeat normal production token acceptance/rejection, project/node/image operations, remote CLI target resolution, viewer actions, and event checks. Local ownership rules must not affect hosted writes.

## Ready Gate

Requires the installed viewer and initial ownership guard. Confirm current CLI/runtime contracts and runnable local/normal production proof targets. Use a few focused lifecycle tests and existing disk/API tests; run relevant type/build/CLI checks. Manual event/viewer proof is required; browser automation needs a separate request. Preserve existing spatial-map edits and unrelated tickets. Use pnpm. Proof data belongs under repo-root tmp; app/data and port 3000 are user targets. No live hosted writes, publication, deployment, or data migration. No native binary, Electron, separate viewer, cloud sync, automatic remote downloads, OS service, external file watching, version coexistence, database, generic adapter, or broad service refactor.

## Provenance

[Intent](../docs/intent/pgm-local-viewer/intent-brief.md), [shape](../docs/intent/pgm-local-viewer/shape-brief.md), [plan](../docs/intent/pgm-local-viewer/implementation-plan.md). Claims INT-1 through INT-6; selected single-writer/managed-server shape; milestone M-3; dependencies DEP-1 and DEP-2. Baseline 5ceef90e8c4e814b87bb27321d22460072b0eed2.

