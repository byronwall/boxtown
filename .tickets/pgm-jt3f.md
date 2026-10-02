---
id: pgm-jt3f
status: in_progress
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: feature
priority: 2
assignee: Opus
external-ref: pgm:page-show-active-header-in-toc-view
parent: pgm-o8hh
tags: [grid-backlog, ui]
---
# Show the active tree header in the TOC

## Outcome

The tree table of contents shows the current header as the user scrolls. Its entries still navigate to the intended heading.

## Scope

SpatialMapTreeNavigation already computes activePath for breadcrumbs. TocEntry does not receive it and uses transparent background. Pass the current path into the existing recursive TOC. Apply subtle fill/text and accessible current state. Preserve existing breadcrumb and scroll behavior.

Do not add another scroll observer, accent stripe, or new navigation surface. Use local Panda markup styles and the existing popover wrapper. Keep nested entries clear and keyboard-operable.

## Ready Gate and Proof

The disposable target and source scope are confirmed. Observed baseline: current path is Agentic data flow; its TOC entry has transparent background and no aria-current/selected. Keyboard focus alone does not prove current-header indication.

Scroll through a nested tree, open TOC, and verify the correct current row. Navigate using a TOC entry; verify destination and updated indication. Prove current state separately from hover/focus. Capture the required focused screenshot.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Source: page-show-active-header-in-toc-view. Baseline: tmp/grid-toc-baseline.jpg and tmp/grid-proof-baseline.md. Breadcrumb praise is an observation, not additional scope.
