# Issue Triage — 2026-09-29

Triage of the `project-mgmt-grid` project on https://prod-mgmt.apps.byroni.us after deciding the
tool is an **issue tracker**, not a product/feature map.

Snapshot at triage time: 103 nodes, 77 links. A full JSON + markdown export was taken before any
change.

## What changed in prod already

Verified fixed in code and marked `implemented` with a resolution note:

| Node | Evidence |
| --- | --- |
| `task-filter-needs-to-do-an-and-when-combining-status-and-type` | `filterSpatialMapDataByGlobalFilter` ANDs type + status |
| `task-allow-dragging-an-image-on-the-image-list-to-add-one-more` | `SpatialMapImages.tsx` drop handlers |
| `page-click-opens-the-zoom-modal` | `imageUi.openImage` from canvas, scene, grid |
| `page-project-root-picker-…-cmd-k-menu` | `SpatialMapReparentControl.tsx` search picker |
| `feature-error-with-web-sockets` | `/ws/jobs` probe + fallback |
| `task-add-command-to-update-pgm` | `pgm update` |
| `page-add-check-for-using-latest-version-of-cli-show-update-command` | `update-check.mjs` |
| `task-pgm-cli-bug-report-metadata-persistence-and-stdout-edge-cases` | linked project honored, unknown keys → 400, EPIPE ignored |
| `page-make-a-flat-view-for-editing-meta-data-quickly` | Grid view editable metadata columns |
| `page-likely-need-web-sockets-so-cli-updates-are-immediate-in-client` | `project-events.client.ts` |

Marked `deprecated` (obsolete after the pivot): `page-how-to-convert-tasks-into-features`.

## Feature info to remove

These nodes describe product areas or shipped capabilities rather than problems to fix. They are
removed with `pgm node delete` (added on this branch; needs a deploy + CLI publish). Deleting
**without** `--with-children` keeps any issues underneath; they become top-level nodes.

Content worth keeping was archived first:

- `page-guidance-from-codex`, `page-additional-feedback-from-codex` → `docs/archive/pgm-codex-feedback.md`
- `page-layout-algorith` → `docs/archive/layout-algorithm-notes.md`
- `note-cli-hierarchical-task-context` → already in `docs/cli-hierarchical-task-context.md`

Area/description nodes: `page-tree-viewer`, `page-rich-markdown-like-viewer`,
`page-breadcrumbs-with-toc`, `page-canvas-viewer`, `page-shows-image-previews`,
`page-layout-algorith`, `page-metadata`, `page-node-type`, `page-key-value-pairs`,
`page-project-settings`, `page-project-index-page`, `page-inspector-side-bar`,
`page-agentic-data-flows`, `page-image-decomp`, `page-add-node-via-questions`,
`page-question-and-answer-process`, `page-ingest-via-cli`, `page-view-filters`,
`page-goal-is-to-quickly-focus-canvas-on-relevant-stuff`, `page-top-nav`, `page-common-comps`,
`page-drop-drop-menu-picker`, `page-image-zoom-modal`, `page-image-preview`, `page-data-flows`,
`page-data-structures`, `page-global-search`, `page-activated-via-cmd-k`,
`page-overall-app-flows`, `page-grid-view`, `page-global-state`, `feature-global-design`.

Shipped-capability nodes: `page-incorporate-pattern-fills`, `page-quickly-create-new-nodes`,
`page-default-to-100-do-not-zoom-more-center-if-smaller`, `page-need-to-convert-to-an-op-log`,
`page-agent-can-send-project-context`, `page-agent-can-load-context-for-a-node`,
`page-agent-can-search-for-nodes`, `page-available-on-npm`,
`page-allow-an-agent-to-provide-status-updates`, `page-filter-by-status-type-etc`,
`note-cli-hierarchical-task-context`, `page-guidance-from-codex`,
`page-additional-feedback-from-codex`.

One-shot command once the delete endpoint is deployed:

```bash
pgm node delete --project project-mgmt-grid --yes --json \
  feature-global-design \
  note-cli-hierarchical-task-context \
  page-activated-via-cmd-k \
  page-add-node-via-questions \
  page-additional-feedback-from-codex \
  page-agent-can-load-context-for-a-node \
  page-agent-can-search-for-nodes \
  page-agent-can-send-project-context \
  page-agentic-data-flows \
  page-allow-an-agent-to-provide-status-updates \
  page-available-on-npm \
  page-breadcrumbs-with-toc \
  page-canvas-viewer \
  page-common-comps \
  page-data-flows \
  page-data-structures \
  page-default-to-100-do-not-zoom-more-center-if-smaller \
  page-drop-drop-menu-picker \
  page-filter-by-status-type-etc \
  page-global-search \
  page-global-state \
  page-goal-is-to-quickly-focus-canvas-on-relevant-stuff \
  page-grid-view \
  page-guidance-from-codex \
  page-image-decomp \
  page-image-preview \
  page-image-zoom-modal \
  page-incorporate-pattern-fills \
  page-ingest-via-cli \
  page-inspector-side-bar \
  page-key-value-pairs \
  page-layout-algorith \
  page-metadata \
  page-need-to-convert-to-an-op-log \
  page-node-type \
  page-overall-app-flows \
  page-project-index-page \
  page-project-settings \
  page-question-and-answer-process \
  page-quickly-create-new-nodes \
  page-rich-markdown-like-viewer \
  page-shows-image-previews \
  page-top-nav \
  page-tree-viewer \
  page-view-filters
```

Closed issues (`implemented` tasks) are kept as history.

## Still-open issues

33 nodes remain open in prod (items 33–34 below are new follow-ups). Grouped by the work they need; ✅ = verified still reproducible/absent in
code, ❓ = needs a manual repro before work starts.

### A. Issue-tracker fundamentals (do first — the pivot depends on these)

1. ✅ `feature-need-to-support-archiving-things-when-done` — no node-level archive exists (only
   project ZIP archive).
2. ✅ `feature-need-to-support-multi-select-so-bulk-archive-is-easier…` and
   `page-allow-for-multiple-selection` — no multi-select in canvas/grid. Treat as one issue.
3. ✅ `feature-creating-ids-from-titles-leads-to-long-file-names…` — real bug:
   `createUniqueNodeId` slugs the full title, producing `ENAMETOOLONG` on image upload.
4. ✅ `note-the-whole-raw-context-stuff-is-odd` — `rawContext` + "make proper node" still exist.
5. ✅ `page-need-some-sense-of-relevance-so-most-important-stuff-is-visible` — no priority field.
6. ✅ `page-allow-setting-the-default-type` — new nodes inherit the parent's type
   (`SpatialMapChildNodePlaceholder.tsx`).

### B. Filters and navigation

7. ✅ `task-provide-option-to-show-all-children-on-filtered-nodes-too` — only `includeParents`.
8. ✅ `task-allow-filtering-on-last-editor-human-vs-agent` — op log records `actor.kind`; filter
   UI does not use it.
9. ✅ `task-add-a-quick-project-changer-to-cmd-k-or-top-near-the-back`
10. ✅ `page-breadcrumb-is-really-nice-in-the-tree-view` — bring tree breadcrumbs to the top nav.
11. ✅ `page-i-really-want-to-type-to-filter-in-here` — `SimpleSelect` has no type-to-filter.
12. ❓ `page-revise-highlight-to-avoid-extra-padding` (Cmd+K result highlight) — visual check.
13. ✅ `page-show-active-header-in-toc-view` — no scroll-spy in `SpatialMapTreeNavigation.tsx`.

### C. Inspector and canvas polish

14. ✅ `task-needs-to-make-the-title-sticky` (inspector title)
15. ✅ `page-need-to-expose-add-node-flow-off-selected-item` — add-child only via the `c` key.
16. ✅ `task-new-task-mode-should-do-button-group-instead-of-select-menu`
17. ✅ `task-allow-toggling-on-off-parent-context-on-map`
18. ✅ `task-app-should-expose-prompts-and-things-to-paste-into-agents` — add "Copy as prompt"
    that emits the same markdown as `pgm issue view`.
19. ✅ `page-need-to-try-harder-to-render-a-useful-preview` (image aspect handling)
20. ✅ `task-green-colors-are-not-helpful-need-to-go-more-neutral` — `global-css.ts` still uses
    the green palette.
21. ❓ `page-deleting-an-image-seemed-to-hang`
22. ❓ `task-odd-animation-when-adding-a-node…` (needs-review) — optimistic ids now match server
    ids; confirm visually, then close.
23. ❓ `feature-mutations-are-too-slow…` — optimistic updates with `clientMutationId` are in
    place; confirm what is still slow, then close or narrow.
24. 💭 `page-really-want-to-be-able-to-peek-at-structure` — underspecified; needs a sentence of intent.
25. 💭 `feature-is-it-possible-actually-overlap-nodes-by-depth-mahjong-style` — exploration idea.

### D. AI flows (decide whether they survive the pivot)

These serve "decompose a product into structure", which matters less for an issue tracker.
Recommendation: freeze them and close as `deprecated` unless they're still used.

26. `note-context-decomp-leaves-a-lot-of-detail-missing-in-new-nodes`
27. `page-needs-to-work-on-an-existing-node-image-some-picker`
28. `page-status-reporting-is-poor-needs-to-be-global` (job status) — keep if AI flows stay.
29. `page-allow-multiple-selection` (Q&A answers)
30. `page-suggestions-after-processing`
31. `page-add-nodes-flow-need-to-attribute-to-agent-not-human` — cheap fix; do it if flows stay.

### E. CLI

32. ✅ `page-need-to-provide-a-command-to-download-image-without-curl` — `context-pack`
    downloads images, but there is no `pgm image download <node> <image>`.
33. Carry-over from the archived codex feedback: an "implementation packet" mode for
    `pgm issue view` that walks empty root nodes into actionable descendants.
34. New: `pgm node delete` (done on this branch; see below).

## Plan

**Phase 0 — cleanup (this branch)**

- Deploy the app so `DELETE /api/v1/projects/:projectId/nodes/:nodeId` exists, and publish CLI
  `0.1.8` (`docs/cli-npm-publish-runbook.md`).
- Run the feature-info delete list above with `pgm node delete … --yes`.
- UI: Delete removes only the selected node; Cmd/Ctrl+Delete opens a confirmation modal to remove
  the node and its descendants.

**Phase 1 — make it an issue tracker (A)**

1. Fix long ids: cap slugs at ~60 chars and append a short hash; keep the same id on the
   optimistic client path (`lib/projects/optimistic.ts`) so creation doesn't jump.
2. Archive: add an `archived` flag (or status) hidden by default, plus a filter toggle and a CLI
   `pgm node archive`.
3. Multi-select in grid (checkboxes) and canvas (shift-click) with bulk status/archive/delete.
4. Replace the node-type schema for this project with issue types (`bug`, `task`, `idea`, `note`)
   and add a `priority` field. That covers "relevance" and "default type".
5. Remove `rawContext` / "make proper node".

**Phase 2 — triage speed (B + C1)**

Filters (children, last editor), type-to-filter in `SimpleSelect`, project switcher in Cmd+K,
sticky inspector title, add-child button on the selected item, copy-as-prompt, neutral palette.

**Phase 3 — verify-and-close sweep (❓ items)**

A manual pass over items 12, 21, 22 and 23; close whatever no longer reproduces.

**Phase 4 — decide on AI flows (D)**

Keep or deprecate. If they're kept, fix attribution (31) and global job status (28) first.

**Phase 5 — CLI (E)**

`pgm image download`, and an implementation packet mode for `pgm issue view`.
