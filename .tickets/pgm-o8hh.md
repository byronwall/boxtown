---
id: pgm-o8hh
status: open
deps: [pgm-h4na, pgm-wfww, pgm-tvb6, pgm-7x9e, pgm-j2fc, pgm-nzxn, pgm-jt3f, pgm-yxiy, pgm-3aal, pgm-anif, pgm-bfak, pgm-u3ce, pgm-7lqb]
links: []
created: 2026-10-02T01:12:24Z
type: epic
priority: 2
assignee: orchestrator
tags: [grid-backlog]
---
# Complete the current Product Grid backlog

## Outcome

Complete current actionable Product Grid requests through small PRs. Preserve existing merged outcomes. Use Opus through installed OMP for UI work. Use GPT-6.1 Sol for non-UI work.

## Delivery

Start with pgm-u3ce, the ready disjoint server-write slice. Inspector pgm-nzxn and TOC pgm-jt3f have settled local baseline and ready proof. Refine remaining open packets before execution. Filter controls depend only on editor projection pgm-7lqb. Other packet order is advisory; shared files require coordination, not invented edges.

Use the disposable server at http://localhost:3001 and tmp/grid-backlog-proof-data. Port 3000 is the user server. No production writes. Children contain their own required source facts, scope, checks, and cut line.

Each visible PR requires tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. Keep targeted checks. Do not restore removed AI/Q&A flows, duplicate already merged work, add enterprise layers, or mutate production data.

## Source reconciliation

Full export has 68 nodes: 42 already implemented/archived and 26 current. Current disposition: eight delivered merged sources, one partially delivered URL-filter source, two obsolete sources, one breadcrumb observation, and fourteen remaining actionable sources. The remaining work uses thirteen child tickets because server-write latency and latest-editor projection have distinct core ownership/proof.

Source snapshots were read on 2026-10-02 UTC. Baseline main 5c19677. Input exports: tmp/grid-project-full-source.json and tmp/grid-all-node-inventory.json. Stale “open PR” notes do not override verified merge status. Q&A obsolete closure and optional Mahjong were later user decisions. Peek uses a provisional selected-node popover choice; update it if later steering differs.

| Source node | Disposition |
| --- | --- |
| `note-meta-data-should-edit-in-place` | Delivered, archived before this work |
| `note-the-whole-raw-context-stuff-is-odd` | Delivered, archived before this work |
| `note-context-decomp-leaves-a-lot-of-detail-missing-in-new-nodes` | Delivered, archived before this work |
| `page-deleting-an-image-seemed-to-hang` | Remaining: pgm-wfww |
| `page-status-reporting-is-poor-needs-to-be-global` | Delivered, archived before this work |
| `page-allow-multiple-selection` | Obsolete: user closed removed Q&A scope; live source deprecated |
| `page-suggestions-after-processing` | Delivered, archived before this work |
| `page-initial-view-is-sometimes-askew` | Delivered, archived before this work |
| `page-make-the-nodes-bigger-so-image-is-better-aspect-ratio-prevent-text-shrinkage` | Delivered, archived before this work |
| `feature-make-it-easy-to-choose-node-type` | Delivered, archived before this work |
| `page-need-to-expose-add-node-flow-off-selected-item` | Delivered, archived before this work |
| `feature-consider-splitting-title-context` | Delivered, archived before this work |
| `page-make-a-flat-view-for-editing-meta-data-quickly` | Delivered, archived before this work |
| `page-show-context-existence-preview` | Delivered, archived before this work |
| `page-need-some-sense-of-relevance-so-most-important-stuff-is-visible` | Delivered: merged [PR #11](https://github.com/byronwall/prod-mgmt-grid/pull/11) |
| `page-breadcrumb-is-really-nice-in-the-tree-view` | Observation: praise for existing breadcrumb; no action |
| `page-show-active-header-in-toc-view` | Remaining: pgm-jt3f |
| `page-i-really-want-to-type-to-filter-in-here` | Remaining: pgm-j2fc |
| `page-likely-need-web-sockets-so-cli-updates-are-immediate-in-client` | Delivered, archived before this work |
| `page-really-want-to-be-able-to-peek-at-structure` | Remaining: pgm-bfak |
| `page-allow-setting-the-default-type` | Delivered: merged [PR #7](https://github.com/byronwall/prod-mgmt-grid/pull/7) |
| `feature-show-a-small-line-or-link-to-the-parent-task` | Delivered, archived before this work |
| `page-revise-highlight-to-avoid-extra-padding` | Remaining: pgm-yxiy |
| `page-click-opens-the-zoom-modal` | Delivered, archived before this work |
| `page-need-to-try-harder-to-render-a-useful-preview` | Remaining: pgm-3aal |
| `page-how-to-convert-tasks-into-features` | Obsolete: source deprecated |
| `page-needs-to-work-on-an-existing-node-image-some-picker` | Delivered, archived before this work |
| `page-double-click-should-isolate-not-go-to-canvas` | Delivered, archived before this work |
| `page-need-to-make-the-various-displays-editable` | Delivered, archived before this work |
| `page-ensure-color-is-conveyed-for-type-status` | Delivered, archived before this work |
| `page-allow-for-multiple-selection` | Delivered: merged [PR #10](https://github.com/byronwall/prod-mgmt-grid/pull/10) |
| `feature-ensure-new-node-is-added-to-isolated-if-no-selection` | Delivered, archived before this work |
| `task-add-a-quick-project-changer-to-cmd-k-or-top-near-the-back` | Delivered: merged [PR #9](https://github.com/byronwall/prod-mgmt-grid/pull/9) |
| `task-pgm-cli-bug-report-metadata-persistence-and-stdout-edge-cases` | Delivered, archived before this work |
| `task-odd-animation-when-adding-a-node-things-move-too-much` | Remaining: pgm-h4na |
| `task-app-should-expose-prompts-and-things-to-paste-into-agents` | Delivered, archived before this work |
| `task-allow-toggling-on-off-parent-context-on-map` | Delivered, archived before this work |
| `task-new-task-mode-should-do-button-group-instead-of-select-menu` | Delivered, archived before this work |
| `task-green-colors-are-not-helpful-need-to-go-more-neutral` | Remaining: pgm-yxiy |
| `task-allow-dragging-an-image-on-the-image-list-to-add-one-more` | Delivered, archived before this work |
| `page-i-want-to-resize-columns-and-get-longer-name` | Delivered, archived before this work |
| `feature-error-with-web-sockets` | Delivered, archived before this work |
| `page-project-root-picker-to-reassign-should-allow-searching-for-a-node-by-name-using-similar-interface-to-cmd-k-menu` | Delivered, archived before this work |
| `task-needs-to-make-the-title-sticky` | Remaining: pgm-nzxn |
| `page-add-check-for-using-latest-version-of-cli-show-update-command` | Delivered, archived before this work |
| `page-need-to-provide-a-command-to-download-image-without-curl` | Delivered, archived before this work |
| `page-need-to-show-depth-and-sort-order-to-prefer-top-level-nodes` | Delivered, archived before this work |
| `page-bug-report-from-codex` | Delivered, archived before this work |
| `page-add-nodes-flow-need-to-attribute-to-agent-not-human` | Delivered, archived before this work |
| `task-allow-filtering-on-last-editor-human-vs-agent` | Remaining: pgm-7x9e, pgm-7lqb |
| `task-add-command-to-update-pgm` | Delivered, archived before this work |
| `task-provide-option-to-show-all-children-on-filtered-nodes-too` | Delivered, archived before this work |
| `feature-mutations-are-too-slow-waiting-for-server-need-optimistic-that-syncs-bumplessly-with-websocket` | Remaining: pgm-h4na, pgm-u3ce |
| `task-filter-needs-to-do-an-and-when-combining-status-and-type` | Delivered, archived before this work |
| `feature-creating-ids-from-titles-leads-to-long-file-names-and-other-problems` | Delivered, archived before this work |
| `feature-need-to-support-archiving-things-when-done` | Delivered, archived before this work |
| `feature-need-to-support-multi-select-so-bulk-archive-is-easier-or-bulk-archive-on-grid-view-or-checkboxes` | Delivered: merged [PR #10](https://github.com/byronwall/prod-mgmt-grid/pull/10) |
| `feature-is-it-possible-actually-overlap-nodes-by-depth-mahjong-style` | Remaining: pgm-anif |
| `feature-delete-all-option-would-be-nice` | Delivered, archived before this work |
| `feature-ideally-all-filters-are-in-the-url-so-they-persist-through-refresh` | PR #12 merged; remaining includeChildren/showArchived proof: pgm-7x9e |
| `feature-need-a-distinct-clear-filters-or-reset-option` | Delivered: merged [PR #16](https://github.com/byronwall/prod-mgmt-grid/pull/16) |
| `feature-sidebar-visuals-are-just-a-mess-need-a-cleansing-pass` | Delivered, archived before this work |
| `feature-resize-thumb-should-be-in-the-gap-between-panes` | Delivered, archived before this work |
| `feature-add-an-archive-implemented-button-somewhere` | Delivered: merged [PR #13](https://github.com/byronwall/prod-mgmt-grid/pull/13) |
| `feature-grid-view-has-layout-shift-when-selecting-all` | Delivered: merged [PR #14](https://github.com/byronwall/prod-mgmt-grid/pull/14) |
| `feature-zoom-resets-when-tab-gets-focus-again` | Remaining: pgm-tvb6 |
| `feature-context-really-needs-to-be-edit-in-place` | Delivered, archived before this work |
| `feature-archive-implemented-should-in-the-side-bar-too` | Remaining: pgm-nzxn |
