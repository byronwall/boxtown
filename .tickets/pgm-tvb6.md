---
id: pgm-tvb6
status: open
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: bug
priority: 2
assignee: GPT-6.1 Sol
external-ref: pgm:feature-zoom-resets-when-tab-gets-focus-again
parent: pgm-o8hh
tags: [grid-backlog, core]
---
# Keep zoom and pan through focus and reload

## Outcome

Manual camera state survives unchanged focus refresh. Zoom and pan can survive reload through current URL state.

## Scope

Trace useSpatialMapCanvasController transitionToLayout and project-events focus refresh. A fresh project object can refit the camera despite unchanged geometry. Fix that shared cause and preserve explicit Fit, isolation, and intentional focus actions.

Use the existing SpatialMapCanvas URL state flow for the source preference to retain zoom/pan on reload. Define the smallest finite valid camera shape. Malformed URL data must not produce invalid geometry. Do not add storage layers, new controls, or a compatibility system. Opus owns visual controls if any become necessary.

## Ready Gate and Proof

Confirm the focus reproduction on the disposable server before changing policy. Extend one existing controller check for identical data refresh after manual camera movement. Prove Fit still acts. If camera URL state is added, prove reload/back restore and invalid input handling. Coordinate shared controller edits with optional layout and filter work; file overlap is not a prerequisite.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Source feature-zoom-resets-when-tab-gets-focus-again: “Needs to be bumpless. Ideally zoom and pan are also in the URL so there is no shift on reload.”
