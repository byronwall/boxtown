# Agent Grid Buildout State

> Historical review. In-app AI workflows and their routes have been removed.
> CLI APIs, project events, and image attachments remain.

## Question

Can an LLM agent use the current CLI and bundled skills to build out a Product Grid hierarchy from a markdown document or another LLM-generated artifact, while attaching arbitrary context to nodes?

## Short Answer

The smallest required slice is now available through the CLI.

An agent can create a project, create/update/move product nodes, create a context node from markdown, optionally split that markdown into the same heading-based context-node hierarchy used by the app's context node creation flow, receive the created node IDs/records/links immediately, attach/list/remove local images such as Playwright screenshots, and export the project as LLM-ready markdown.

The broader graph-editing surface is still incomplete. The CLI still does not expose batch import, relationship-link editing beyond parent-child moves, run creation/watching, or accepting generated candidate nodes.

## Current CLI Surface

The CLI package is in `packages/cli`.

Current resource commands:

- `pgm auth login|status|logout`
- `pgm project list|create|view|export-markdown|link|current|unlink`
- `pgm node list|view|create|update|move|context|metadata`
- `pgm node import-markdown`
- `pgm image add|list|remove`
- `pgm task list`
- `pgm skill path|print|install`

The client wraps these read endpoints:

- `GET /api/v1/projects`
- `GET /api/v1/projects/:projectId`
- `GET /api/v1/projects/:projectId/nodes`
- `GET /api/v1/projects/:projectId/nodes/:nodeId`
- `GET /api/v1/projects/:projectId/tasks`

The client now also wraps:

- `POST /api/v1/projects`
- `POST /api/v1/projects/:projectId/nodes`
- `PATCH /api/v1/projects/:projectId/nodes/:nodeId`
- `GET /api/v1/projects/:projectId/nodes/:nodeId/context`
- `PUT /api/v1/projects/:projectId/nodes/:nodeId/context`
- `GET /api/v1/projects/:projectId/nodes/:nodeId/metadata`
- `PATCH /api/v1/projects/:projectId/nodes/:nodeId/metadata`
- `POST /api/v1/projects/:projectId/nodes/:nodeId/move`
- `POST /api/v1/projects/:projectId/imports/markdown`
- `GET /api/v1/projects/:projectId/nodes/:nodeId/images`
- `POST /api/v1/projects/:projectId/nodes/:nodeId/images`
- `DELETE /api/v1/projects/:projectId/nodes/:nodeId/images`
- `GET /api/v1/projects/:projectId/exports/markdown`

There are still no CLI methods for batch apply, non-hierarchy relationship links, run creation, run polling, run events, or accepting generated candidate nodes.

## Current Skill Surface

The bundled skill is `product-grid-context`, present both at:

- `skills/product-grid-context/SKILL.md`
- `packages/cli/skills/product-grid-context/SKILL.md`

Its guidance now covers the first write workflow:

- Check CLI config.
- Create a new project with `project create`.
- Link a project.
- Gather context with `project view`, `node list`, `node view`, and `task list`.
- Import markdown with `node import-markdown`.
- Split markdown headings with `--split-headings` and `--max-heading-depth`.
- Use returned node IDs immediately.
- Create/update/move nodes with `node create`, `node update`, and `node move`.
- Update context and metadata with `node context set` and `node metadata set`.
- Attach local screenshots/images with `image add`.
- List/remove images with `image list` and `image remove`.
- Export markdown with `project export-markdown`.
- Prefer `--json`.
- Avoid browser scraping when `pgm` can provide data.
- Do not mutate project data unless explicitly asked.

The skill does not yet cover broader graph editing, because the CLI does not expose those operations yet.

## Existing App Capabilities

The app side is much further along than the CLI.

Already available in server/data code:

- Update node context.
- Update node title, status, and type.
- Replace/sanitize node metadata.
- Add/delete node images.
- Create context-note nodes.
- Split a markdown document by headings into a tree of linked note nodes.
- Create a child node under an existing parent.
- Delete nodes and relationship links.
- Move/reparent nodes while preventing cycles.

Already available in app-specific HTTP routes:

- Start the add-nodes LLM flow.
- Submit add-nodes answers.
- Subscribe to add-nodes events.
- Start context-note conversion from an existing context-only note.
- Accept generated context-note conversion candidates.
- Start source decomposition flows.
- Accept source decomposition candidates.

These routes are useful proof points, but they are not yet the clean agent API surface. They are UI workflow routes, not the `/api/v1` contract the CLI uses.

## Existing Markdown Export

The spatial map already has an LLM-ready markdown export. It includes:

- Project context.
- Metadata schema.
- Node type schema.
- Visible node records.
- Node IDs.
- Labels, status, type, context mode.
- Metadata and context.
- Image URLs.
- Visible relationships.

That means the read/export direction is conceptually solid. The missing half is the inverse operation: importing or applying a markdown/JSON plan back into the graph through agent-safe commands.

## What Is Possible Today

Possible today through `pgm`:

- Let an agent discover projects.
- Create a new project.
- Return the new project ID/name and optionally link it immediately.
- Link to a project.
- Inspect project details.
- List and filter nodes.
- View individual node context and metadata.
- List task-like node summaries.
- Create one context node from markdown.
- Split markdown headings into a linked context-node hierarchy.
- Get the root node ID, all created node IDs, created node records, and created links in the import response.
- Create arbitrary typed product nodes.
- Update node title, status, type, context, and metadata.
- Move/reparent nodes or move them to root.
- Attach one or more local image files to a specific node.
- List and remove node images.
- Export the full project graph as LLM-ready markdown.
- Install/print the context skill.

Possible today through internal app/UI flows:

- Use LLM-assisted add-nodes from the app.
- Convert a context-only note into structured candidate nodes from the app.
- Create child/context nodes through server functions used by UI actions.
- Persist markdown-heading splits as note-node trees through server code.
- Attach metadata/context/images through existing server functions.

Still not possible today through `pgm`:

- Apply an LLM-generated node/link batch.
- Start or accept the add-nodes workflow.
- Watch run events.
- Perform a dry-run/diff before writing.

## Recommended Capability Model

Add a write-capable, agent-safe layer to the existing `/api/v1` contract, then expose it through `pgm` and update the skill.

Minimum useful command set:

```bash
pgm node create --title "Checkout" --type page --parent root --json
pgm node update <node-id> --title "Checkout" --status working --type page --json
pgm node context set <node-id> --file ./context.md --json
pgm node metadata set <node-id> purpose "Customer checkout entry point" --json
pgm node move <node-id> --parent <parent-node-id> --json
pgm node delete <node-id> --confirm --json
```

Markdown/tree import commands:

```bash
pgm node import-markdown --file ./brief.md --title "Product Brief" --split-headings --json
pgm node apply-batch --file ./generated-grid.json --dry-run --json
pgm node apply-batch --file ./generated-grid.json --json
```

Run/workflow commands:

```bash
pgm run list --json
pgm run view <run-id> --json
pgm run watch <run-id>
pgm node add-from-brief --file ./brief.md --parent <node-id> --watch --json
pgm node convert-context <node-id> --watch --json
```

Image/file commands:

```bash
pgm image add <node-id> ./mockup.png --json
pgm image list <node-id> --json
pgm image remove <node-id> <image-id> --json
```

## API Work Needed

Add versioned agent API routes that call the existing server functions rather than duplicating graph mutation logic.

Suggested routes:

- `POST /api/v1/projects/:projectId/nodes`
- `PATCH /api/v1/projects/:projectId/nodes/:nodeId`
- `PUT /api/v1/projects/:projectId/nodes/:nodeId/context`
- `PUT /api/v1/projects/:projectId/nodes/:nodeId/metadata`
- `POST /api/v1/projects/:projectId/nodes/:nodeId/move`
- `DELETE /api/v1/projects/:projectId/nodes/:nodeId`
- `POST /api/v1/projects/:projectId/imports/markdown`
- `POST /api/v1/projects/:projectId/batches`
- `POST /api/v1/projects/:projectId/runs/add-nodes`
- `POST /api/v1/projects/:projectId/runs/context-note-conversion`
- `GET /api/v1/projects/:projectId/runs/:runId`
- `GET /api/v1/projects/:projectId/runs/:runId/events`
- `POST /api/v1/projects/:projectId/nodes/:nodeId/images`
- `DELETE /api/v1/projects/:projectId/nodes/:nodeId/images/:imageId`

Use narrow operations instead of a generic "replace project JSON" endpoint. Agents need enough power to build the graph, but writes should remain explicit, scoped, and auditable.

## Batch Import Shape

For LLM-generated plans, prefer a structured JSON batch over raw markdown as the final write format. Markdown can be the source material; JSON should be the mutation contract.

Example:

```json
{
  "nodes": [
    {
      "clientId": "checkout",
      "label": "Checkout",
      "type": "page",
      "status": "planned",
      "metadata": {
        "purpose": "Entry point for purchasing"
      },
      "context": "Owns cart review, shipping, payment, and confirmation."
    },
    {
      "clientId": "payment-form",
      "label": "Payment Form",
      "type": "component",
      "status": "planned",
      "metadata": {},
      "context": "Collects and validates payment details."
    }
  ],
  "links": [
    {
      "source": "checkout",
      "target": "payment-form",
      "parentChild": true
    }
  ]
}
```

The server should reserve final node IDs, validate types/statuses/metadata, dedupe or reject invalid links, and return a mapping from `clientId` to persisted node ID.

## Skill Updates Needed

Once write commands exist, update `product-grid-context` into a broader `product-grid` agent skill.

Add guidance for:

- Reading current graph state before writing.
- Choosing stable parent nodes.
- Creating a dry-run batch first.
- Preserving existing node IDs and context.
- Applying generated nodes with `apply-batch`.
- Attaching arbitrary node context from files.
- Setting metadata only through declared schema fields, unless the API intentionally supports ad hoc keys.
- Using explicit `--json` and checking returned IDs.
- Avoiding destructive operations unless the user explicitly asks.

The skill should include one canonical workflow:

```bash
pgm project current --json
pgm project view --json
pgm node list --json
pgm node apply-batch --file ./generated-grid.json --dry-run --json
pgm node apply-batch --file ./generated-grid.json --json
pgm node list --search "new node label" --json
```

## Security and Safety Requirements

Before enabling agent writes broadly:

- Add `node:write`, `image:write`, and `run:start` scopes.
- Keep local dev unauthenticated behavior read-only, or make write bypass explicitly development-only.
- Return typed API errors with stable codes.
- Add idempotency keys for create/import/batch operations.
- Add dry-run support for batch writes.
- Add optimistic conflict handling with project `updatedAt` or resource versions.
- Log agent writes with actor, command/API operation, project ID, resource IDs, and before/after summary.

## Implemented MVP Slice

The implemented MVP slice adds:

1. `POST /api/v1/projects`
2. `POST /api/v1/projects/:projectId/nodes`
3. `PATCH /api/v1/projects/:projectId/nodes/:nodeId`
4. `GET/PUT /api/v1/projects/:projectId/nodes/:nodeId/context`
5. `GET/PATCH /api/v1/projects/:projectId/nodes/:nodeId/metadata`
6. `POST /api/v1/projects/:projectId/nodes/:nodeId/move`
7. `POST /api/v1/projects/:projectId/imports/markdown`
8. `GET/POST/DELETE /api/v1/projects/:projectId/nodes/:nodeId/images`
9. `GET /api/v1/projects/:projectId/exports/markdown`
10. `pgm project create "Product Site" --link --json`
11. `pgm project export-markdown --output ./project-context.md`
12. `pgm node create --title "Checkout" --type page --json`
13. `pgm node update <node-id> --status working --json`
14. `pgm node context set <node-id> --file ./context.md --json`
15. `pgm node metadata set <node-id> purpose "Purpose text" --json`
16. `pgm node move <node-id> --parent <parent-node-id> --json`
17. `pgm node import-markdown --file ./brief.md --title "Brief" --split-headings --json`
18. `pgm image add/list/remove`
19. Skill/README/help updates for the workflows.

The project creation response includes:

- `project.id`
- `project.name`
- `projectId`
- `name`
- `server`
- `linked`

The markdown import response includes:

- `import.rootNodeId`
- `import.createdNodeIds`
- `import.createdNodeCount`
- `nodes`
- `links`

The image upload response includes:

- `nodeId`
- `imageCount`
- `images`

The project markdown export returns LLM-ready markdown for the full project graph.

## Recommended Next Milestone

Build the next useful write path after the MVP:

1. Add `pgm node apply-batch --dry-run` for LLM-generated structured graph plans.
2. Add relationship-link commands for `related`, `dependency`, and `reuse`.
3. Add run start/watch commands for add-nodes and context-note conversion flows.
4. Add audit/history commands for agent writes.
5. Add `pgm doctor` for setup diagnostics.

That would make the broader user goal possible: an LLM agent could read a markdown source, generate a graph plan, create or update a hierarchy, attach rich node context and screenshots, and then verify the result through the same CLI.
