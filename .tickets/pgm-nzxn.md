---
id: pgm-nzxn
status: in_progress
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: feature
priority: 2
assignee: Opus
external-ref: pgm:feature-archive-implemented-should-in-the-side-bar-too
parent: pgm-o8hh
tags: [grid-backlog, ui]
---
# Keep inspector title and archive action available

## Outcome

Archive implemented is available from the sidebar in canvas, tree, and grid. The inspector title remains visible while its body scrolls.

## Scope

Reuse SpatialMapArchiveImplementedButton in selected and empty inspector states as appropriate. It already owns optimistic bulk archive, pending state, and errors. Keep one action implementation. Use a sticky title/actions area within the existing inspector scroll layout. Preserve resize and close controls.

Source context: “Currently only on the grid view?!?! We should generally have all functionality in all places.” The title task is terse, but local baseline confirms the inspector title scrolls out of view.

## Ready Gate and Proof

The disposable target is confirmed. Observed baseline: title y=54 moves to y=-603 after +657px sidebar scroll. Empty sidebar has no Archive implemented; grid has the existing control. These positions/counts are observations, not invariants.

Prove long context/activity keeps title/actions usable; archive works in each map view; no implemented nodes, pending, and failure states are clear. Use disposable nodes. Preserve existing body scrolling and title editing.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Sources: feature-archive-implemented-should-in-the-side-bar-too; task-needs-to-make-the-title-sticky. PR #13 supplies the action. Baseline: tmp/grid-proof-baseline.md and title/sidebar screenshots.
