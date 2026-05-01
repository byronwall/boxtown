---
name: product-grid-context
description: Use when working in or around a Product Grid Management project and you need project, node, task, image, or graph context through the pgm CLI. This skill helps agents query context from a running Product Grid server without scraping the UI.
---

# Product Grid Context

Use the `pgm` CLI to inspect and update Product Grid projects before changing code or answering project-specific questions.

## First Checks

Check whether `pgm` is configured:

```bash
pgm auth status --json
pgm project current --json
```

If no project is linked, list projects:

```bash
pgm project list --json
```

When the user identifies a project, link it:

```bash
pgm project link <project-id>
```

If the user asks to start a new product grid, create and link a project:

```bash
pgm project create "Product Site" --link --json
```

Use `projectId` or `project.id` from the JSON response in subsequent commands.

## Gather Context

Use JSON output for agent work:

```bash
pgm project view --json
pgm node list --json
pgm task list --json
```

For a specific node:

```bash
pgm node view <node-id> --json
```

Filter when possible:

```bash
pgm node list --status blocked --json
pgm node list --type page --json
pgm node list --search "checkout" --json
pgm task list --status working --json
```

## Create Context Nodes From Markdown

Use `node import-markdown` when the user wants a markdown document, LLM-generated brief, or research note captured in the product grid.

Create one context node:

```bash
pgm node import-markdown --file ./brief.md --title "Product Brief" --json
```

Split markdown headings into a parent-child node hierarchy:

```bash
pgm node import-markdown --file ./brief.md --title "Product Brief" --split-headings --max-heading-depth 2 --json
```

The JSON response includes:

- `import.rootNodeId`
- `import.createdNodeIds`
- `import.createdNodeCount`
- `nodes`
- `links`

Use those returned IDs directly in the next step instead of re-discovering them by search.

Add metadata at import time when useful:

```bash
pgm node import-markdown --file ./brief.md --title "Product Brief" --metadata-json '{"purpose":"Imported source context"}' --json
```

## Create And Update Product Nodes

Use `node create` for normal product structure nodes such as pages, regions, components, states, and implementation themes.

```bash
pgm node create --title "Checkout" --type page --parent <parent-node-id> --json
pgm node create --title "Payment Form" --type component --parent <checkout-node-id> --context-file ./payment-form.md --metadata-json '{"purpose":"Collects payment details"}' --json
```

Use the returned `nodeId` or `node.id` immediately in later commands.

Update existing nodes when the agent learns more:

```bash
pgm node update <node-id> --title "Checkout" --status working --type page --json
pgm node context set <node-id> --file ./context.md --json
pgm node metadata set <node-id> purpose "Checkout entry point" --json
pgm node metadata unset <node-id> purpose --json
pgm node move <node-id> --parent <parent-node-id> --json
pgm node move <node-id> --root --json
```

## Attach Images To Nodes

Use `image add` when the agent creates screenshots or local image artifacts, such as Playwright screenshots, and needs to attach them to specific nodes.

```bash
pgm image add <node-id> ./screenshots/home-desktop.png ./screenshots/home-mobile.png --json
pgm image list <node-id> --json
pgm image remove <node-id> <image-id> --json
```

The JSON response includes the stored image IDs and URLs. Prefer attaching screenshots to the most specific matching node.

## Export Project Markdown

Use `project export-markdown` before large edits or when another LLM process needs compact context.

```bash
pgm project export-markdown --output ./project-context.md
pgm project export-markdown --json
```

## Rules

- Prefer `--json` for parsing.
- Do not scrape the browser UI when `pgm` can provide the data.
- Do not mutate project data unless the user explicitly asks.
- Before creating nodes or adding images, inspect the project and choose the target project/node deliberately.
- After `project create`, keep using the returned `projectId`; if `--link` was passed, the CLI is already linked to it.
- After `node create`, keep using the returned `nodeId`.
- After `node import-markdown`, keep using the returned node IDs.
- After `image add`, keep using the returned image IDs/URLs.
- If `pgm` cannot reach the server, ask whether the Product Grid server is running.
- The default local server is `http://localhost:3000`.
- Use `--server <url>` when the project is not on the default server.
- Use `--project <project-id>` when no project is linked.

## Useful Commands

```bash
pgm project list --json
pgm project create "Product Site" --link --json
pgm project view <project-id> --json
pgm project export-markdown --project <project-id> --output ./project-context.md
pgm project link <project-id>
pgm node list --project <project-id> --json
pgm node view <node-id> --project <project-id> --json
pgm node create --project <project-id> --title "Checkout" --type page --json
pgm node update <node-id> --project <project-id> --status working --json
pgm node context set <node-id> --project <project-id> --file ./context.md --json
pgm node metadata set <node-id> purpose "Purpose text" --project <project-id> --json
pgm node move <node-id> --project <project-id> --parent <parent-node-id> --json
pgm node import-markdown --project <project-id> --file ./brief.md --title "Brief" --split-headings --json
pgm image add <node-id> ./screenshot.png --project <project-id> --json
pgm image list <node-id> --project <project-id> --json
pgm image remove <node-id> <image-id> --project <project-id> --json
pgm task list --project <project-id> --json
```
