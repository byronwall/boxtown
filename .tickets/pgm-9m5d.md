---
id: pgm-9m5d
status: closed
deps: [pgm-yg33, pgm-c2o7, pgm-gydq]
links: []
created: 2026-10-03T01:52:41Z
type: epic
priority: 2
assignee: Byron Wall
tags: [pgm-local-viewer]
---
# Include the current viewer in pgm with local disk data

## Outcome

Installed pgm manages a local server that provides the exact current editable viewer. Projects and image bytes stay in a selected local folder. The web/hosted app must work as well as today, including remote CLI access.

## Likely Steps

Prove a fresh relocated production app against disposable data. Package the foreground viewer command. Connect local CLI commands to that same runtime, or a temporary owned runtime when the viewer is closed. Use one writer per folder and preserve current disk format, actions, image routes, and events. Capture and repeat normal production regression checks after shared changes. No native binary, Electron, separate viewer, cloud sync, automatic remote downloads, OS service, external file watching, version coexistence, database, generic adapter, or broad service refactor.

## Ready Gate

All child outcomes and local/hosted proofs must be complete. Children stay open until frontier refinement. The local server decision is accepted. Confirm current repository state and evidence before execution. Preserve existing spatial-map edits and unrelated tickets. Use pnpm. Proof data belongs under repo-root tmp; app/data and port 3000 are user targets. No live hosted writes, publication, deployment, or data migration.

## Provenance

[Intent](../docs/intent/pgm-local-viewer/intent-brief.md), [shape](../docs/intent/pgm-local-viewer/shape-brief.md), [plan](../docs/intent/pgm-local-viewer/implementation-plan.md). Claims INT-1 through INT-6; selected managed-server shape; milestones M-1 through M-3. Repository baseline 5ceef90e8c4e814b87bb27321d22460072b0eed2.


## Notes

**2026-10-03T01:57:19Z**

Execution owner: root. User authorized implementation and PR with proof. One continuous Luna High worker owns source changes and child ticket checkpoints. Root owns commits, independent acceptance, and PR. Updated branch contains hosted origin/main fa600d4. Pre-existing UI edits are preserved in stash and tmp/preexisting-ui-edits, to restore after clean source proofs. All data disposable under tmp; no live data writes or deployment. Next: accept relocation proof, then packaged viewer and CLI runtime.

**2026-10-03T02:03:41Z**

Baseline on integrated hosted main b59e671, before runtime source changes: pnpm --dir packages/cli test passed 31/31; pnpm --dir app type-check passed. Existing UI edits temporarily saved so built proof matches PR source. Root acceptance will repeat affected checks after implementation.

**2026-10-03T02:06:46Z**

Independent storage review reproduced an existing same-process lost update on disposable legacy data: pause readProjectByIdFromDisk after capturing bytes, complete queued title mutation, release read; normalization writes stale label. One temporary Vitest passed (904 ms); harness removed. Writer must add a focused shared-queue repair/regression in the local-runtime ticket while preserving hosted normalization and recovery.

**2026-10-03T02:58:14Z**

M2 accepted on f9f6ed8. External installed tarball, restart, duplicate launch, signal cleanup, missing runtime, occupied port, and browser-open failure passed. Independent local and hosted browser checks covered nodes, status, metadata, context Markdown, project settings, images upload/view/delete, Canvas/Tree/Grid, navigation, deep-link reload, and local restart; zero console errors. Resource inventory had no external origins. Shared UI has no reparent control; existing CLI/API move proof remains in M3. Browser offline switch unavailable; complete package closure and local asset origins proved. Screenshots saved under tmp for PR. M3 owns final shared-runtime CLI/browser proof and storage race repair.

**2026-10-03T03:30:55Z**

Configured-base-path comparison: BASE_PATH=/pgm-proof build succeeded. Current normal production and archived pre-change b59e671 both returned HTML200 for /api/v1/projects and /pgm-proof/api/v1/projects; prefixed HTML and CSS returned200 in both. This is an existing hosted base-path API limitation, not a local-mode regression. The optional prefixed local:smoke failed its expected401 assertion, honestly retained under tmp/local-viewer-smoke-1790997768903. Default-root production API/viewer/auth/events proofs passed earlier and are repeated on final source. Baseline build log tmp/hosted-basepath-baseline-build.log. No deployment-config change or live write.

**2026-10-03T03:37:35Z**

Final acceptance: installed final tarball outside checkout; both local and normal hosted browser edits/settings/Markdown/images/deep-links passed. CLI moves and concurrent title/priority edits reached both open viewers without reload; zero console errors. Local restart retained title, priority, parent, context, image; HTTP image bytes match disk (56,794 bytes). Installed lifecycle proof passed temp success/failure cleanup, active reuse, simultaneous temp creates, production auth401, exact identity, stale-parent verified orphan cleanup, and target isolation. CLI39/39 (also without bundled runtime), storage+identity26/26, type-check passed. Final default-root pnpm local:smoke passed hosted and relocated assets/auth/project-node-image/events/restart/failures; tmp/local-viewer-final-smoke.log, fixtures tmp/local-viewer-smoke-1790998520166. Final screenshots tmp/local-viewer-cli-live-update.png, hosted-viewer-cli-live-update.png, local-viewer-final-restart.png. Existing BASE_PATH API limitation, absent viewer reparent control, and unavailable offline switch recorded honestly. Conservative unknown-child startup requires safe manual recovery per README. Next: commit and create requested PR with attachments.
