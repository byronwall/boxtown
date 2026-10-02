---
id: pgm-7x9e
status: open
deps: [pgm-7lqb]
links: []
created: 2026-10-02T01:12:24Z
type: feature
priority: 2
assignee: Opus
external-ref: pgm:task-allow-filtering-on-last-editor-human-vs-agent
parent: pgm-o8hh
tags: [grid-backlog, ui]
---
# Filter by last editor and retain complete filter state

## Outcome

Human/agent last-editor filters combine with current filters and survive refresh. Existing child-inclusion and archived state also persist.

## Scope

Use the GPT-6.1 Sol projection contract from the prerequisite ticket. Missing retained history is unknown, never assumed human. Add controls through current global filter state, menu, and canvas URL sync. Reuse AND combination, parent/child inclusion, archived visibility, and reset.

PR #12 already merged URL persistence. Repository review found includeChildren/showArchived omitted; verify current behavior and fill these gaps. Do not recreate the whole filter system, add persistent node fields, or alter useful existing type/status distinctions.

## Ready Gate and Proof

Wait for the editor projection contract. Confirm latest-actor fixtures and current URL omissions. Prove human/agent AND type/status/priority; ancestor/descendant inclusion; reset; zero matches; refresh/back state. Use a node with no retained operation to prove it is not mislabeled.

Use only the disposable server at http://localhost:3001, APP_DATA_DIR under tmp/grid-backlog-proof-data. Port 3000 is the user server; do not write there. Run pnpm --dir app type-check and git diff --check. Keep one focused runnable check for changed logic. Each visible PR needs tmp screenshots uploaded with gh --attach. Update CHANGELOG for behavior. 
## Provenance

Baseline main 5c19677; working branch codex/grid-backlog-tickets. Sources: task-allow-filtering-on-last-editor-human-vs-agent (title only); feature-ideally-all-filters-are-in-the-url-so-they-persist-through-refresh. PR #12 is delivered baseline with a remaining coverage gap. No new actor taxonomy is requested.
