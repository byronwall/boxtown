---
id: pgm-gydq
status: closed
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

## Refined packet

### Outcome

Project, node, and image CLI commands can use `--local <folder>` to call the same app runtime that owns that folder. Commands reuse an open viewer or start a temporary server, then stop only that server. Remote commands keep their current resolution and output.

### Readiness and ownership

- Base: M2 installed package and one-writer foreground launcher. This ticket remains blocked by dependency until root accepts M2 browser and hosted proof.
- Owner: local-viewer writer owns CLI target resolution, runtime reuse, identity route if needed, storage race repair, focused tests, docs, and technical checks. Root owns the independent browser/event pass, evidence screenshots, and commits.
- Shared route: local commands call the existing authenticated `/api/v1` API. They do not read or mutate project files directly.
- Proof targets: installed package and disposable folders under repo `tmp/`; root viewer proof uses 43150–43159. Never use `app/data` or port 3000.
- Scope: local targeting covers the existing project, node, and image commands. No new storage format, daemon, or background process.

### Decisions

- Must: `--local <folder>` is explicit. Reject `--server` and `--token` with it. Ignore global remote server, token, and project defaults in local mode; require an explicit project ID for scoped operations. Do not update remote current-project config after local project creation.
- Must: verify runtime identity and canonical data path before reuse. A port response alone is insufficient. Keep identity lookup unavailable when the app has no local runtime identity environment.
- Must: hold the existing atomic folder record for the life of the writer. On collision, briefly wait for a `starting` record or report a retryable error. Remove a stale record only after checking its owner and rereading the record identity.
- Must: a temporary command starts the existing packaged app, calls the normal `/api/v1` operation, then stops its owned child in `finally`. A reused viewer is never stopped by a CLI command.
- Must: print command JSON to stdout only. Send startup and retry diagnostics to stderr. Local commands skip update checks before any network call.
- Must: preserve the existing API payloads, remote precedence, project linking, and app settings when local mode is absent.
- Must: reproduce the read-time normalization race before changing it. Repair only the demonstrated out-of-queue write, and preserve normalization/recovery backups.
- Prefer: use the existing local API token and server process ID fields; add one small identity route only if the existing app cannot prove runtime ID and canonical data directory.
- Exclude: direct-file CLI mutations, discovering arbitrary app servers, cross-folder linking, remote/local fallback, native binary, daemon, migrations, and generalized process management.

### Acceptance

- `pgm project|node|image ... --local <folder>` uses the same process and disk services as the viewer. It works with an open viewer and from a stopped folder.
- Local and remote selectors cannot mix. Remote server/token/project precedence is unchanged without `--local`. Local project operations do not read or change the global remote project selection.
- An existing viewer is reused only after the server proves its runtime ID and canonical folder. An unrelated server or stale PID is never adopted. A concurrent starter gets one writer and a clear wait/retry result.
- Temporary mode cleans its own record and child on success, startup failure, and command failure. Reuse mode never stops the viewer. Stale-record recovery verifies the same record before removal.
- A CLI node edit reaches the open viewer through `/ws/jobs` without reload. Concurrent edits to independent fields both persist. Folder state survives restart.
- Production auth accepts the local scoped token and rejects a missing or invalid token. Normal hosted actions, API, images, events, remote CLI, and configured build settings retain M1/M2 baseline.
- A regression test reproduces the legacy-reader lost-update race and passes after the minimal serialized repair. No nested mutation-queue deadlock occurs.
- Run a few lifecycle and target-resolution tests, storage regression, CLI tests, app type-check, and installed-package production proof. Keep the ticket open until root accepts manual browser/event evidence.

### Provenance

M3 of the approved implementation plan. Authorization covers local CLI/runtime source changes and disposable installed-package/browser proof. No publication, deployment, live service writes, or data migration.

### Accepted proof

- Installed tarball: `tmp/cli-dist/byronwallrus-product-grid-cli-0.1.8.tgz`. The external install at `/private/tmp/pgm-local-install-m3-final` reused an open viewer, ignored invalid remote defaults in local mode, wrote projects and nodes, moved a node, uploaded and listed an image, and preserved concurrent title and status edits.
- Production auth returned 401 for missing and invalid tokens. The identity route returned the runtime ID and canonical folder only with the local scoped token.
- A failed local command stopped its temporary child and removed its record. Successful temporary commands did the same. Two concurrent local project commands completed in sequence and left two saved projects.
- Killing a disposable viewer parent left its child active. The next local command verified the runtime identity, stopped that orphan, recovered project data, and removed the stale record. Unknown-child startup records remain in place for manual verification.
- Atomic ownership tests cover exclusive record creation, valid JSON during updates, reserved-port rejection, and admission-lock release after process death. `pnpm cli:test` passed 39/39, including with the packaged runtime absent. Storage and identity route tests passed 26/26; app type-check passed.
- Root accepted browser proof that CLI title, priority, and node move updates reached local and hosted viewers without reload. Restart retained local edits, image, and context; both modes had zero console errors. Screenshots: `tmp/local-viewer-cli-live-update.png`, `tmp/hosted-viewer-cli-live-update.png`, and `tmp/local-viewer-final-restart.png`.
- Final `pnpm local:smoke` passed for hosted and relocated output, including HTML, assets, auth, project/node edits, images, events, restart, and failure checks. Log: `tmp/local-viewer-final-smoke.log`; fixture: `tmp/local-viewer-smoke-1790998520166`.
- The existing app has no reparent control in either mode; the move proof used the existing CLI/API. Prefixed `/api/v1` HTML fallback was reproduced on the pre-change base and remains outside this change.
