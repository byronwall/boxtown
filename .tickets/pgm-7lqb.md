---
id: pgm-7lqb
status: open
deps: []
links: []
created: 2026-10-02T01:15:54Z
type: feature
priority: 2
assignee: GPT-6.1 Sol
external-ref: pgm:task-allow-filtering-on-last-editor-human-vs-agent
parent: pgm-o8hh
tags: [grid-backlog, core]
---
# Derive each node latest known editor

## Outcome

Derive the latest known human or agent editor for each node from existing project operation history. The UI can filter without adding stored node fields.

## Scope

Own one concise projection in lib/projects and one focused check. ProjectRecord.operationLog is newest-first. Each operation has actor.kind and nodeIds. Current retained history is capped at 250 entries. The first matching retained operation owns the latest known actor. A node without matching history stays unknown; never default it to human.

Reuse an existing projection/helper if available. Keep the result contract simple for the Opus filter ticket. No database/schema change, normalization layer, cache, new actor kind, or backfill. Do not change source attribution.

## Proof

Use one controlled operation log with human and agent edits, repeated node edits, several node IDs, and a node with no matching history. Assert newest actor wins and unknown remains unknown. Use the existing Vitest setup. Run the focused test, pnpm --dir app type-check, and git diff --check. No browser or production mutation is required.

## Ready Gate

Current type shape and retention limit are confirmed. Confirm helper reuse and provide the projection contract to the filter worker. This is independently provable core behavior.

## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Source: task-allow-filtering-on-last-editor-human-vs-agent. The title requests human versus agent; no persistent history requirement is stated. The dependent Opus packet owns controls and URL state.

