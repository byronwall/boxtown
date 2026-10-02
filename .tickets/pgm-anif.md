---
id: pgm-anif
status: open
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: feature
priority: 2
assignee: Opus
external-ref: pgm:feature-is-it-possible-actually-overlap-nodes-by-depth-mahjong-style
parent: pgm-o8hh
tags: [grid-backlog, ui]
---
# Offer an optional depth overlap view

## Outcome

The user can choose a Mahjong-style depth overlap view. The current layout remains the default.

## Scope

Use existing spatial-map layout, depth, scene ordering, and view state. Add the minimum optional overlap treatment that makes hierarchy depth visible. User chose an optional view; do not replace the current default. Exact control placement and geometry remain executor choices.

Keep nodes selectable and preserve title/image usefulness. Current tree and grid behavior remain intact. Do not add a layout framework, new dependency, schema migration, or unrelated camera persistence changes.

## Ready Gate and Proof

Confirm the existing layout/view seams and a nested disposable fixture before ready status. Prove initial default, choosing overlap, visible depth treatment, node selection, and returning to the default. Use focused layout checks only if geometry logic needs them. Capture optional/default screenshots.

Preserve canonical optimistic node IDs and deterministic SSR state. Do not add SVG/CSS filters, blur, shadows, or forced compositing inside the scaled scene. Coordinate controller/scene edits with camera and preview workers; shared ownership is not a prerequisite edge.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Source: feature-is-it-possible-actually-overlap-nodes-by-depth-mahjong-style, title only. Later user decision: optional view; retain current layout default.
