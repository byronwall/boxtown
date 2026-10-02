---
id: pgm-wfww
status: open
deps: []
links: []
created: 2026-10-02T01:12:24Z
type: bug
priority: 2
assignee: Opus
external-ref: pgm:page-deleting-an-image-seemed-to-hang
parent: pgm-o8hh
tags: [grid-backlog, core]
---
# Delete viewer images immediately and restore on failure

## Outcome

Deleting an image updates the open viewer immediately. Pending state finishes and failure restores usable viewer state.

## Scope

Own SpatialMapImages and its viewer helpers. Project images already update optimistically, but the viewer keeps a separate image snapshot until server success. Apply deletion to both views together. Retain the prior viewer state for failure. Reuse current useAction and mutation callback.

Delete the selected image among several images; show the next valid image. Deleting the last image closes the viewer. A failed action restores the image and enables retry. Do not rebuild upload or shared reconciliation in this PR.

Server metadata/event save currently precedes file removal. A file-removal failure can reject after metadata changed. Coordinate a GPT-6.1 Sol investigation for that boundary before changing order or retry behavior. Never treat successful deletion plus failed readback as a failed write, or silently swallow arbitrary filesystem errors.

## Ready Gate and Proof

Use disposable nodes with one image and several images. Prove immediate viewer change, acknowledgement, failed action, and retry. Confirm the current partial-success result before final ready status. Shared reconciliation is a dependency only if its callback contract changes.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Source: page-deleting-an-image-seemed-to-hang, title only. Investigation: tmp/mutation-investigation.md. No evidence establishes an indefinite server hang.
