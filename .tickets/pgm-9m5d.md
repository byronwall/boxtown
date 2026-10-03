---
id: pgm-9m5d
status: open
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
