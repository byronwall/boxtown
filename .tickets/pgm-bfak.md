---
id: pgm-bfak
status: open
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: feature
priority: 2
assignee: Opus
external-ref: pgm:page-really-want-to-be-able-to-peek-at-structure
parent: pgm-o8hh
tags: [grid-backlog, ui]
---
# Peek at the selected node structure

## Outcome

A compact structure peek helps the user inspect the selected hierarchy without losing the current map view.

## Scope

Source says “Really want to be able to peek at structure”, with no trigger or scope. The provisional reversible default is a selected-node tree popover. This is an orchestrator choice, not a source quote. Update scope if the user gives a later answer.

Reuse existing spatial-map-tree projections and tree navigation. Choose a small trigger and dismissal flow consistent with shared popover controls. Preserve selection and camera. Do not rebuild full project navigation, restore removed AI/Q&A flows, or add a new hierarchy model.

## Ready Gate and Proof

Confirm the provisional choice still fits current UI and user steering before ready status. Use a nested disposable node fixture. Open peek, read children/structure, dismiss with keyboard and pointer, and return to the unchanged view. Prove selection/camera remain stable. Exact control design stays Opus discretion.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Source: page-really-want-to-be-able-to-peek-at-structure. Provisional selected-node tree default follows optional clarification timeout; it does not block other packets.
