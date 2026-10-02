---
id: pgm-3aal
status: open
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: feature
priority: 2
assignee: Opus
external-ref: pgm:page-need-to-try-harder-to-render-a-useful-preview
parent: pgm-o8hh
tags: [grid-backlog, ui]
---
# Show useful image previews across image shapes

## Outcome

Canvas image previews remain useful for portrait, square, and wide images across zoom levels. Labels remain useful.

## Scope

SpatialMapScene currently bounds image height by node geometry. Inspect the current preview and layout sizing together. Change the smallest sizing rule that improves aspect-ratio coverage. Layout helpers need edits only if node dimensions require them.

Source implementation note: “Consider aspect ratio range of zooms, allow width to vary some.” This supports modest sizing flexibility, not a new image viewer or general layout rewrite. Reuse current image rendering and local node geometry.

## Ready Gate and Proof

Confirm the canvas preview surface and existing baseline. Use disposable portrait/square/wide image fixtures at low, normal, and high zoom. Prove the preview is useful, text is readable, and node placement remains stable. If logic changes node dimensions, keep one focused existing layout check. Capture representative screenshots.

Preserve selection and image-open behavior. Never add filters, shadows, blur, filter transitions, will-change, or forced compositing to scaled SVG nodes or children. Coordinate with optional overlap work, but do not invent a dependency from shared files.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Source: page-need-to-try-harder-to-render-a-useful-preview. Exact visual treatment remains Opus discretion within canvas rules.
