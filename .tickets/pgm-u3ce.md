---
id: pgm-u3ce
status: in_progress
deps: []
links: []
created: 2026-10-02T01:12:46Z
type: bug
priority: 1
assignee: GPT-6.1 Sol
external-ref: pgm:feature-mutations-are-too-slow-waiting-for-server-need-optimistic-that-syncs-bumplessly-with-websocket
parent: pgm-o8hh
tags: [grid-backlog, core]
---
# Read only the target project during scoped writes

## Outcome and Why

Project-scoped writes must read only the requested project. An unrelated corrupt project must not block a valid node edit.

Today, each scoped mutation parses the whole project library. Its write helper then saves only one project. Reuse the existing targeted reader to remove this unnecessary work. This is the first backend slice of the slow-mutation task. It does not complete client optimism or websocket reconciliation.

## Ready Gate

Repository inspection confirms the existing reader, all callers, and the proof seam. No product decision or prerequisite code is missing. The existing data-server suite passed: 22 tests. Type-check and diff checks passed. The orchestrator must confirm this ticket is on the unblocked frontier before starting it.

## Owned Context and Scope

Own `app/src/lib/projects/data.server.ts`, its existing test file, and one root `CHANGELOG.md` entry. Coordinate the changelog with other workers.

The private `writeProjectRecordsAndPublishProject` ignores its records argument. Reduce it to the changed project. Update its creation caller without changing creation's whole-library read.

Convert all sixteen scoped functions to `readProjectByIdFromDisk(input.projectId)`. Retain the current missing-project error. Remove their unused records/index assignments.

The functions are:

- `updateProjectNodeContextOnDisk`, `updateProjectNodeTitleOnDisk`, `updateProjectNodeStatusOnDisk`, `updateProjectNodeArchivedOnDisk`.
- `updateProjectNodesBulkOnDisk`, `updateProjectNodePriorityOnDisk`, `updateProjectNodeTypeOnDisk`, `updateProjectNodeMetadataOnDisk`.
- `updateProjectMetadataSchemaOnDisk`, `addProjectNodeImagesOnDisk`, `deleteProjectNodeImageOnDisk`.
- `createContextNodeOnDisk`, `createChildNodeOnDisk`, `deleteProjectNodeOnDisk`, `deleteProjectLinkOnDisk`, `moveProjectNodeOnDisk`.

## Decisions and Discretion

Must:

- Preserve public inputs, return values, validation, operation history, actor attribution, and clientMutationId metadata.
- Keep persistence before `publishProjectRecordChanged`.
- Preserve library reads for project listing, unique project creation, project deletion, and archive import.
- Preserve targeted-reader recovery and normalization.

Executor may choose a concise private helper name. Prefer direct calls and existing fixture helpers.

Do not add a cache, queue, lock, schema field, dependency, UI change, or compatibility layer. Do not change `archive.server.ts`, library writer semantics, or production data.

## Behavior and Failure Proof

Use one new regression in `data.server.test.ts`. Create a valid target with one node and an unrelated project with invalid `operationLog: {}`. Use the existing temporary-directory and fixture patterns. Update the target node's context. Reload only the target and assert the new value persisted. Read the corrupt file bytes and assert they stayed unchanged.

This test must fail before the change and pass afterward. The existing targeted-read test alone does not prove writes.

Preserve image deletion's current save/event/file-removal order. File removal can fail after metadata was saved. That partial-success contract belongs to a separate ticket. This slice must not change retry behavior or hide filesystem errors.

## Acceptance Checklist

- **Invariant:** all sixteen scoped writes use the targeted reader; library operations retain their full-library semantics.
- **Fixture:** context write and targeted reload succeed beside the malformed project. The malformed file stays unchanged.
- **Invariant:** missing-project errors, operation metadata, and save-before-event order remain intact.
- Run `pnpm --dir app exec vitest run src/lib/projects/data.server.test.ts`.
- Run `pnpm --dir app type-check` and `git diff --check`.
- Report the failing baseline for the new regression, passing checks, and the exact owned diff.

## Cut Line and Provenance

Source: `feature-mutations-are-too-slow-waiting-for-server-need-optimistic-that-syncs-bumplessly-with-websocket` in `project-mgmt-grid`.

Evidence: `tmp/mutation-investigation.md`; repository baseline `5c19677` on `codex/grid-backlog-tickets`.

Concurrent server writes, pending client edit reconciliation, camera movement, and immediate viewer deletion remain separate work. No browser proof or new infrastructure is required for this backend slice.


