# CLI Next Capabilities Roadmap

## Purpose

This document reviews the next CLI capabilities worth building for Boxtown. The focus is agent workflows: commands should make it easy for an LLM agent to create, inspect, modify, enrich, and verify product-grid projects without browser scraping or direct filesystem writes.

The current CLI can already:

- Authenticate and store a token.
- List, create, view, link, unlink, and inspect current projects.
- List and view nodes.
- Create, update, move, and reparent nodes.
- Get/set node context and metadata.
- List task-like node summaries.
- Import markdown as a context node, optionally splitting headings into a parent-child node hierarchy.
- Return created node IDs and created links from markdown import.
- Attach, list, and remove local screenshots/images on a node.
- Export the full project graph as LLM-ready markdown.
- Install/print the bundled `boxtown-context` skill.

Items 1, 2, 3, and 5 below are now implemented for the MVP. The next highest-leverage item is batch apply with dry run.

## 1. Node Update Commands

Proposed commands:

```bash
boxtown node update <node-id> --title "Checkout" --status working --type page --json
boxtown node context set <node-id> --file ./context.md --json
boxtown node context get <node-id> --json
boxtown node metadata set <node-id> purpose "Checkout entry point" --json
boxtown node metadata unset <node-id> purpose --json
```

Why it matters:

Agents need to iterate after initial creation. Markdown import gets content into the grid, but real agent work involves revising titles, statuses, contexts, and metadata after inspecting screenshots, implementation files, or product notes.

What it unlocks:

- Agents can mark nodes as `working`, `blocked`, `needs-review`, or `implemented`.
- Agents can attach refined context to existing nodes without creating duplicates.
- Agents can keep metadata useful for filtering and downstream generation.
- A user can ask an agent to "clean up these nodes" or "mark the finished screens implemented" and get precise writes.

Implementation notes:

- Reuse existing server functions: title, status, type, context, and metadata update helpers already exist.
- Keep `context set` file-based so large markdown payloads do not need shell quoting.
- Return the updated node projection after every write.

## 2. Arbitrary Node Create And Move

Proposed commands:

```bash
boxtown node create --title "Checkout" --type page --parent <parent-node-id> --json
boxtown node move <node-id> --parent <parent-node-id> --json
boxtown node move <node-id> --root --json
```

Why it matters:

Markdown import creates context-note nodes. Agents also need to create normal product structure nodes: pages, regions, blocks, components, states, implementation themes, and reusable patterns. Move/reparent is the natural correction command when the agent chooses the wrong place or learns more after inspection.

What it unlocks:

- Agents can build product-site hierarchy incrementally.
- Agents can correct hierarchy without deleting/recreating nodes.
- The CLI becomes useful for day-to-day graph editing, not only source-note import.
- Generated screenshots can be attached to specific page/component nodes instead of only imported notes.

Implementation notes:

- Reuse `createChildNodeOnDisk` and `moveProjectNodeOnDisk`.
- Consider adding `--context-file` and `--metadata-json` to `node create` once the base create path works.
- Preserve cycle checks in the server route.
- Return created/moved node plus affected parent-child link state.

## 3. Image List And Remove

Proposed commands:

```bash
boxtown image list <node-id> --json
boxtown image remove <node-id> <image-id> --json
```

Why it matters:

`image add` lets an agent attach Playwright screenshots, but agents also need to verify what is already attached and clean up bad captures. Without list/remove, image workflows are append-only and hard to manage.

What it unlocks:

- Agents can confirm screenshots landed on the intended node.
- Agents can replace stale or incorrect images.
- Agents can use image IDs in follow-up messages or audit summaries.
- Playwright-based visual QA can produce a clean final set of node references.

Implementation notes:

- `image list` can read from `node view` initially, but a first-class command is clearer for agents.
- `image remove` can reuse the existing image delete helper.
- Return the removed image ID and remaining image list.

## 4. Batch Apply With Dry Run

Proposed commands:

```bash
boxtown node apply-batch --file ./generated-grid.json --dry-run --json
boxtown node apply-batch --file ./generated-grid.json --json
```

Why it matters:

This is the command that turns an LLM-generated graph plan into a robust product feature. Markdown is good source material, but structured JSON is a better mutation contract for nodes, links, metadata, and context. Dry run gives the user and agent a safety checkpoint before changing the graph.

What it unlocks:

- Agents can generate a full hierarchy in one planned operation.
- Users can inspect a diff before accepting changes.
- Agents can map temporary `clientId` values to persisted node IDs.
- Future MCP tools can reuse the same contract.

Implementation notes:

- Accept `{ nodes, links }` with client-side IDs.
- Validate node types, statuses, metadata schema, link endpoints, duplicate labels, and cycles.
- Return `wouldCreate`, `wouldLink`, `warnings`, and `errors` in dry-run mode.
- On apply, return `clientIdToNodeId`, created nodes, created links, skipped items, and warnings.
- Do not add a generic "replace project" command.

## 5. Project Export And Markdown Context Export

Proposed commands:

```bash
boxtown project export --output ./project.zip
boxtown project export-markdown --output ./project-context.md
boxtown node export-markdown <node-id> --depth 2 --output ./node-context.md
```

Why it matters:

Agents need compact, portable context. The app already has LLM-ready markdown export logic for visible nodes; the CLI should expose server-backed exports so agents can feed context into other tools or save snapshots before mutating.

What it unlocks:

- Agents can create before/after project snapshots.
- Agents can hand off graph context to another LLM process.
- Users can archive or review product-grid state without opening the UI.
- Batch apply can recommend running an export before large writes.

Implementation notes:

- Reuse the existing project archive/export route where possible.
- For markdown, prefer a server-side projection rather than depending on browser visibility state.
- Add node-scoped export with depth and relationship filters.

## 6. Task Workflow Commands

Proposed commands:

```bash
boxtown task next --json
boxtown task start <node-id> --json
boxtown task block <node-id> --reason "Waiting on copy" --json
boxtown task review <node-id> --json
boxtown task done <node-id> --json
```

Why it matters:

Nodes already behave like tasks through status. Agents need a simple operational loop: find work, claim it, update status, attach context/screenshots, and mark it ready or done.

What it unlocks:

- A coding agent can use Boxtown as its task queue.
- Users can ask "work the next task" and the agent can resolve a node deterministically.
- Status changes become consistent instead of ad hoc `node update` calls.
- Future audit logs can group task transitions.

Implementation notes:

- These can be thin wrappers over node status updates.
- `task next` should use a deterministic priority order: blocked/working might be excluded by default, then planned or needs-review depending on mode.
- Return the full node/task summary after each status change.

## 8. Link Commands

Proposed commands:

```bash
boxtown link list --json
boxtown link add <source-node-id> <target-node-id> --relationship dependency --json
boxtown link remove <source-node-id> <target-node-id> --relationship dependency --json
boxtown link parent <parent-node-id> <child-node-id> --json
```

Why it matters:

Hierarchy is only one relationship. Product grids also need dependency, reuse, and related links. Agents need explicit link operations to encode product structure beyond parent-child nesting.

What it unlocks:

- Agents can express dependencies discovered from code or screenshots.
- Agents can mark reusable components and cross-page relationships.
- Graph queries become more useful because links are intentional, not only generated during imports.

Implementation notes:

- Parent-child changes may stay under `node move`; non-hierarchy links can live under `link`.
- Validate source/target existence.
- Return affected links and project link count.

## 9. Query Commands For Agent Context

Proposed commands:

```bash
boxtown query project-summary --json
boxtown query node-context <node-id> --depth 2 --json
boxtown query blockers --json
boxtown query open-work --json
boxtown query stale --days 14 --json
```

Why it matters:

Agents often need the right small context, not a whole project dump. Query commands can package common reasoning views without exposing a generic query language too early.

What it unlocks:

- Smaller prompts and faster agent loops.
- Better "what should I work on?" behavior.
- Focused context for image generation, implementation work, and review.
- Less need for agents to implement their own fragile filtering logic.

Implementation notes:

- Start with client-side transforms over stable read endpoints if that is cheaper.
- Move to server-backed queries once filtering needs project-scale performance.
- Keep names concrete and few.

## 10. Audit And History

Proposed commands:

```bash
boxtown audit list --limit 20 --json
boxtown audit view <audit-id> --json
boxtown node history <node-id> --json
```

Why it matters:

As soon as agents can write, users need visibility into what changed. Audit history makes agent changes reviewable and safer.

What it unlocks:

- Users can inspect agent-created projects, nodes, images, and status changes.
- Agents can summarize their own mutations accurately.
- Future rollback or approval flows have a foundation.

Implementation notes:

- Record actor, token suffix, command/API operation, project ID, resource IDs, before/after summary, and timestamp.
- Do not block near-term write commands on full audit browsing, but add audit fields before broad production use.

## 11. Config And Environment Helpers

Proposed commands:

```bash
boxtown config path
boxtown config get --json
boxtown config set server https://example.com
boxtown doctor --json
```

Why it matters:

Agents fail most often on setup: wrong server, no linked project, missing token, or missing dev server. A small `doctor` command can make failures recoverable.

What it unlocks:

- Agents can self-diagnose CLI setup before asking the user.
- Support docs can point to one command.
- CI and local development get clearer failure modes.

Implementation notes:

- `doctor` should check server reachability, auth status, current project, API version, and minimum CLI version.
- Keep secrets redacted.

## Recommended Order

1. Node update commands.
2. Arbitrary node create and move.
3. Image list and remove.
4. Batch apply with dry run.
5. Project/node markdown export.
6. Task workflow commands.
8. Link commands.
9. Query commands.
10. Audit/history.
11. Config/doctor helpers.

The reason to start with node update/create/move is simple: the current CLI can create projects, import source context, and attach screenshots. The next gap is controlled iteration on the resulting graph. Once agents can update, create, move, and remove/replace images, Boxtown becomes a practical working surface rather than a one-way import target.
