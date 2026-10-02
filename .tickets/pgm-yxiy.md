---
id: pgm-yxiy
status: open
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: task
priority: 2
assignee: Opus
external-ref: pgm:task-green-colors-are-not-helpful-need-to-go-more-neutral
parent: pgm-o8hh
tags: [grid-backlog, ui]
---
# Use neutral controls and compact search highlights

## Outcome

Workspace chrome uses neutral tones. Cmd+K highlighted matches keep normal word spacing.

## Scope

Use existing Panda tokens and local spatial-map component styles. Replace green workspace chrome where it prevents a neutral control treatment. Preserve useful node type/status colors and readable selection/focus states. No broad redesign or generated styled-system edits.

The supplied highlight image shows Cmd+K mark padding inserting horizontal gaps within matched words. SpatialMapCommandMenu uses p="0 2px". Remove added match spacing without weakening visible emphasis.

## Ready Gate and Proof

Review the source highlight image under tmp/grid-highlight-context/images. Confirm current theme and local control states before ready status. Check canvas/tree/grid, inspector, and portalled menus. Prove neutral control consistency and readable keyboard focus. Compare highlighted word spacing before/after using the same query.

Keep component styles with markup. Do not add decorative accent bars, SVG/CSS filters, blur, forced compositing, or broad spatial-map stylesheets. Retain actual status/type distinctions.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Sources: task-green-colors-are-not-helpful-need-to-go-more-neutral; page-revise-highlight-to-avoid-extra-padding. Highlight image fixes its surface; neutral note does not request removal of all semantic color.
