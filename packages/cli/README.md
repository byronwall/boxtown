# Product Grid CLI

Local first-slice CLI for Product Grid Management.

## Local Install

From the repo root:

```bash
npm install -g ./packages/cli
```

Then use `pgm` from any terminal:

```bash
pgm --help
pgm project list --server http://localhost:3000
```

The CLI defaults to `http://localhost:3000`, so `--server` is optional when your dev server runs there.
When `pgm` reports that a newer CLI version is available, run:

```bash
pgm update
```

## Local Dev Server

In another terminal:

```bash
cd app
pnpm dev
```

For local development, `/api/v1` allows read access without a token when `AGENT_API_TOKENS` is not set and `NODE_ENV` is not `production`.

To test token auth locally, start the app with:

```bash
AGENT_API_TOKENS='local-token:project:read|node:read' pnpm dev
```

Then log in:

```bash
pgm auth login --token local-token
```

For write commands such as project creation, markdown import, and image upload, include write scopes:

```bash
AGENT_API_TOKENS='local-token:project:read|project:write|node:read|node:write|image:write' pnpm dev
```

## First Commands

```bash
pgm project list
pgm project create "New Product Site" --link --json
pgm project link <project-id>
pgm project schema --json
pgm node list --roots --compact --json
pgm node list --type task --status planned --with-ancestors --json
pgm node list --search "checkout" --json
pgm node view <node-id> --with-context --json
pgm node export-context <node-id> --output ./node-context.md
pgm node context-pack <parent-node-id> --output ./context-pack-dir --json
pgm node create --title "Checkout" --type page --json
pgm node update <node-id> --status working --json
pgm node complete <node-id> --note "Implemented the requested change." --json
pgm node move <node-id> --parent <parent-node-id> --json
pgm node delete <node-id...> --yes --json
pgm node import-markdown --file ./brief.md --title "Product Brief" --split-headings --json
pgm image add <node-id> ./screenshot.png --json
pgm image list <node-id> --json
pgm project export-markdown --output ./project-context.md
pgm update --dry-run
```

Avoid starting with `pgm project view --json` for agent work; it returns the full graph and can be much larger than the schema and node context needed for a scoped change.

## Agent Write Commands

Create a new project and link it as the current project:

```bash
pgm project create "New Product Site" --link --json
```

The JSON response includes `project.id`, `project.name`, `projectId`, `name`, `server`, and `linked`. Agents should use `projectId` or `project.id` in the next command.

Create a context node from markdown:

```bash
pgm node import-markdown --file ./notes.md --title "Imported Notes" --json
```

Split markdown into a hierarchy of context nodes using heading structure:

```bash
pgm node import-markdown --file ./notes.md --title "Imported Notes" --split-headings --max-heading-depth 2 --json
```

The JSON response includes the root node ID, every created node ID, the created node records, and the created parent-child links so an agent can use them immediately.

Create or update product structure nodes:

```bash
pgm node create --title "Checkout" --type page --parent <parent-node-id> --context-file ./context.md --json
pgm node update <node-id> --title "Checkout" --status working --type page --json
pgm node complete <node-id> --note "Implemented the requested change." --json
pgm node context set <node-id> --file ./context.md --json
pgm node metadata set <node-id> purpose "Checkout entry point" --json
pgm node move <node-id> --parent <parent-node-id> --json
```

Delete nodes (cannot be undone; `--yes` is required). Children of a deleted node become top-level nodes unless `--with-children` is passed:

```bash
pgm node delete <node-id> <node-id> --yes --json
pgm node delete <node-id> --yes --with-children --json
```

Attach one or more screenshots/images to a node:

```bash
pgm image add <node-id> ./desktop.png ./mobile.png --json
pgm image list <node-id> --json
pgm image remove <node-id> <image-id> --json
pgm image download <node-id> [image-id...] --output ./images --json
```

Export scoped node context as LLM-ready markdown:

```bash
pgm node export-context <node-id> --output ./node-context.md
```

Export full project context only for broad handoffs:

```bash
pgm project export-markdown --output ./project-context.md
```

## Agent Skill

The package includes a `product-grid-context` agent skill that teaches agents when and how to use `pgm`.

Install it for Codex globally:

```bash
pgm skill install --agent codex --global
```

Install it into the current project:

```bash
pgm skill install --agent codex
```

Inspect the bundled skill:

```bash
pgm skill path
pgm skill print
```
