---
id: pgm-j2fc
status: open
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: feature
priority: 2
assignee: Opus
external-ref: pgm:page-i-really-want-to-type-to-filter-in-here
parent: pgm-o8hh
tags: [grid-backlog, ui]
---
# Type to filter selection options

## Outcome

Typing narrows options in the intended selection control. Keyboard choice preserves the selected value.

## Scope

The source says “I really want to type to filter in here”, with no location or image. Archived triage suggests selection menus. Confirm the actual surface at refinement. SimpleSelect is currently an Ark Select without search. SpatialMapNodeTypePicker uses existing attribute menus. These are candidates, not a chosen redesign.

Reuse an existing searchable control when it fits. Otherwise use the smallest installed Ark/platform control. Current grid node-name search already works; do not implement another grid search to satisfy this ambiguous note. Do not expand every selector by assumption.

## Ready Gate and Proof

Confirm the target surface from current context before ready status. Prove typing reduces options, keyboard navigation chooses a value, closing/reopening preserves selection, and empty results remain understandable. Keep server and first client output deterministic. A focused browser screenshot must show the selected control and filtered result.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Source: page-i-really-want-to-type-to-filter-in-here. Terse location remains unconfirmed; no guessed target is acceptance.
