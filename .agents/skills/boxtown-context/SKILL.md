---
name: boxtown-context
description: Use when working in or around a Boxtown project and you need project, node, image, or graph context through the boxtown CLI. This skill helps agents query context from a running Boxtown server without scraping the UI.
---

# Boxtown Context

Use the `boxtown` CLI to inspect and update Boxtown projects before changing code or answering project-specific questions.

## URL Fast Path

If the user provides a Boxtown URL with `project=...` and `node=...`, do not start with broad discovery. Resolve the issue context directly:

```bash
boxtown issue view '<boxtown-url>' --json
```

If `boxtown issue view` is not available, use the IDs from the URL:

```bash
boxtown node view <node-id> --project <project-id> --with-context --compact --json
```

After implementation, prefer a compact status update:

```bash
boxtown node resolve <node-id> --project <project-id> --status implemented --note "What changed." --json
```

## Install

Install the CLI from npm when `boxtown` is not already available:

```bash
npm install -g boxtown
```

Install this skill for Codex globally:

```bash
boxtown skill install --agent codex --global
```

Install this skill into the current project:

```bash
boxtown skill install --agent codex
```

Inspect the bundled skill:

```bash
boxtown skill path
boxtown skill print
```

## First Checks

Check whether `boxtown` is configured:

```bash
boxtown auth status --json
boxtown project current --json
```

If no project is linked, list projects:

```bash
boxtown project list --json
```

When the user identifies a project, link it:

```bash
boxtown project link <project-id>
```

If the user asks to start a new Boxtown project, create and link a project:

```bash
boxtown project create "Product Site" --link --json
```

Use `projectId` or `project.id` from the JSON response in subsequent commands.

After selecting a project, inspect the compact schema early so you know the available statuses, node types, and metadata fields:

```bash
boxtown project schema --json
```

## Gather Context

Start small. Do not begin by dumping the full project into context.

Recommended first pass:

```bash
boxtown project schema --json
boxtown node list --roots --compact --preset tree --json
boxtown node list --status planned --type task --with-ancestors --preset status --json
boxtown node list --search "checkout" --preset compact --json
```

Use `--with-ancestors` when a node title is terse; it returns the root-to-leaf path without pulling every node's full body.

When a specific node looks relevant, pull the inherited context projection:

```bash
boxtown node view <node-id> --with-context --compact --json
```

For implementation handoff or deeper work, export only that node context:

```bash
boxtown node export-context <node-id> --output ./tmp/node-context.md
```

Use filters before expanding context:

```bash
boxtown node list --status working --with-ancestors --preset status --json
boxtown node list --type task --search "layout" --with-context --compact --json
boxtown node list --status blocked --preset status --json
boxtown node list --type page --preset compact --json
```

Avoid `boxtown project view --json` as a default first step. It returns the full graph, all links, metadata, context, and images, which can be very large and usually wastes context. Use it only when you explicitly need the complete project record.

Use `boxtown project export-markdown` when another process needs broad project context, but prefer node context exports for ordinary implementation work.

## Hierarchical Node Context

Boxtown hierarchy carries requirements. Parent nodes often contain the product area, constraints, and shared intent; leaf nodes may intentionally be short.

Prefer commands that preserve this hierarchy:

```bash
boxtown node list --with-ancestors --preset status --json
boxtown node list --with-context --compact --json
boxtown node view <node-id> --with-context --compact --json
boxtown node export-context <node-id> --output ./tmp/node-context.md
```

When reading node context, respect provenance:

- Use `path` / `titlePath` to understand the node's product area.
- Treat parent metadata/context/images as inherited requirements, not as text owned by the leaf node.
- Check `inheritedContext.hasDirectContext`, `hasInheritedContext`, and `missingContext` before deciding whether to implement or ask for clarification.
- If `missingContext` is true, inspect nearby siblings with `boxtown node list --search ... --with-ancestors --json` instead of falling back to full project JSON.

## Create Context Nodes From Markdown

Use `node import-markdown` when the user wants a markdown document, LLM-generated brief, or research note captured in Boxtown.

Create one context node:

```bash
boxtown node import-markdown --file ./brief.md --title "Product Brief" --json
```

Split markdown headings into a parent-child node hierarchy:

```bash
boxtown node import-markdown --file ./brief.md --title "Product Brief" --split-headings --max-heading-depth 2 --json
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
boxtown node import-markdown --file ./brief.md --title "Product Brief" --metadata-json '{"purpose":"Imported source context"}' --json
```

## Create And Update Product Nodes

Use `node create` for normal product structure nodes such as pages, regions, components, states, and implementation themes.

```bash
boxtown node create --title "Checkout" --type page --parent <parent-node-id> --json
boxtown node create --title "Payment Form" --type component --parent <checkout-node-id> --context-file ./payment-form.md --metadata-json '{"purpose":"Collects payment details"}' --json
```

Use the returned `nodeId` or `node.id` immediately in later commands.

Update existing nodes when the agent learns more:

```bash
boxtown node update <node-id> --title "Checkout" --status working --type page --json
boxtown node complete <node-id> --note "Implemented the requested change." --json
boxtown node context set <node-id> --file ./context.md --json
boxtown node metadata set <node-id> purpose "Checkout entry point" --json
boxtown node metadata unset <node-id> purpose --json
boxtown node move <node-id> --parent <parent-node-id> --json
boxtown node move <node-id> --root --json
```

## Attach Images To Nodes

Use `image add` when the agent creates screenshots or local image artifacts, such as Playwright screenshots, and needs to attach them to specific nodes.

```bash
boxtown image add <node-id> ./screenshots/home-desktop.png ./screenshots/home-mobile.png --json
boxtown image list <node-id> --json
boxtown image remove <node-id> <image-id> --json
```

The JSON response includes the stored image IDs and URLs. Prefer attaching screenshots to the most specific matching node.

## Export Project Markdown

Use `project export-markdown` only before broad edits or when another LLM process needs compact whole-project context. For scoped work, prefer `node export-context`.

```bash
boxtown project export-markdown --output ./project-context.md
boxtown node export-context <node-id> --output ./node-context.md
```

## Rules

- Prefer `--json` for parsing.
- Prefer targeted list/search/context commands over `boxtown project view --json`.
- Do not scrape the browser UI when `boxtown` can provide the data.
- Do not mutate project data unless the user explicitly asks.
- Before creating nodes or adding images, inspect the project and choose the target project/node deliberately.
- After `project create`, keep using the returned `projectId`; if `--link` was passed, the CLI is already linked to it.
- After `node create`, keep using the returned `nodeId`.
- After `node import-markdown`, keep using the returned node IDs.
- After `image add`, keep using the returned image IDs/URLs.
- If `boxtown` cannot reach the server, ask whether the Boxtown server is running.
- The default local server is `http://localhost:3000`.
- Use `--server <url>` when the project is not on the default server.
- Use `--project <project-id>` when no project is linked.

## Useful Commands

```bash
boxtown project list --json
boxtown project create "Product Site" --link --json
boxtown project link <project-id>
boxtown project schema --project <project-id> --json
boxtown node list --project <project-id> --json
boxtown node list --project <project-id> --roots --compact --json
boxtown node view <node-id> --project <project-id> --with-context --json
boxtown node create --project <project-id> --title "Checkout" --type page --json
boxtown node update <node-id> --project <project-id> --status working --json
boxtown node complete <node-id> --project <project-id> --note "Implemented the requested change." --json
boxtown node context set <node-id> --project <project-id> --file ./context.md --json
boxtown node metadata set <node-id> purpose "Purpose text" --project <project-id> --json
boxtown node move <node-id> --project <project-id> --parent <parent-node-id> --json
boxtown node import-markdown --project <project-id> --file ./brief.md --title "Brief" --split-headings --json
boxtown image add <node-id> ./screenshot.png --project <project-id> --json
boxtown image list <node-id> --project <project-id> --json
boxtown image remove <node-id> <image-id> --project <project-id> --json
boxtown node list --project <project-id> --search "checkout" --with-ancestors --json
boxtown node export-context <node-id> --project <project-id> --output ./node-context.md
boxtown project export-markdown --project <project-id> --output ./project-context.md
```
