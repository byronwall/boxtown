---
name: product-grid-context
description: Use when working in or around a Product Grid Management project and you need project, node, image, or graph context through the pgm CLI. This skill helps agents query context from a running Product Grid server without scraping the UI.
---

# Product Grid Context

Use the `pgm` CLI to inspect and update Product Grid projects before changing code or answering project-specific questions.

## URL Fast Path

If the user provides a Product Grid URL with `project=...` and `node=...`, do not start with broad discovery. Resolve the issue context directly:

```bash
pgm issue view '<product-grid-url>' --json
```

If `pgm issue view` is not available, use the IDs from the URL:

```bash
pgm node view <node-id> --project <project-id> --with-context --compact --json
```

After implementation, prefer a compact status update:

```bash
pgm node resolve <node-id> --project <project-id> --status implemented --note "What changed." --json
```

## Install

Install the CLI from npm when `pgm` is not already available:

```bash
npm install -g @byronwallrus/product-grid-cli
```

Install this skill for Codex globally:

```bash
pgm skill install --agent codex --global
```

Install this skill into the current project:

```bash
pgm skill install --agent codex
```

Inspect the bundled skill:

```bash
pgm skill path
pgm skill print
```

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

After selecting a project, inspect the compact schema early so you know the available statuses, node types, and metadata fields:

```bash
pgm project schema --json
```

Metadata keys must be declared in the project schema. Writes with an unknown key fail before anything is saved, and the error lists the fields the project already has. Reuse one of those when it fits. Add a field only when none does:

```bash
pgm project schema ensure-field solution --label "Solution" --json   # safe to repeat; keeps every other field
```

## Gather Context

Start small. Do not begin by dumping the full project into context.

Recommended first pass:

```bash
pgm project schema --json
pgm node list --roots --compact --preset tree --json
pgm node list --status planned --type task --with-ancestors --preset status --json
pgm node list --search "checkout" --preset compact --json
```

Use `--with-ancestors` when a node title is terse; it returns the root-to-leaf path without pulling every node's full body.

When a specific node looks relevant, pull the inherited context projection:

```bash
pgm node view <node-id> --with-context --compact --json
```

For implementation handoff or deeper work, export only that node context:

```bash
pgm node export-context <node-id> --output ./tmp/node-context.md
```

When you need a parent node plus all descendant context, metadata, and image files in one local bundle, export a context pack:

```bash
pgm node context-pack <parent-node-id> --output ./tmp/context-pack --json
```

Use filters before expanding context:

```bash
pgm node list --status working --with-ancestors --preset status --json
pgm node list --type task --search "layout" --with-context --compact --json
pgm node list --status blocked --preset status --json
pgm node list --priority urgent --with-ancestors --preset status --json   # most important open work first
pgm node list --type page --preset compact --json
```

To see what changed and who changed it, page through project history (newest first). Every entry is kept, so pass `nextCursor` back as `--before` to keep reading older entries:

```bash
pgm project history --limit 50 --json
pgm project history --node <node-id> --json
pgm project history --before <nextCursor> --json
```

Archived nodes and their descendants are left out of `node list` results. Pass `--include-archived` when you need them.

Avoid `pgm project view --json` as a default first step. It returns the full graph, all links, metadata, context, and images, which can be very large and usually wastes context. Use it only when you explicitly need the complete project record.

Use `pgm project export-markdown` when another process needs broad project context, but prefer node context exports for ordinary implementation work.

## Hierarchical Node Context

Product Grid hierarchy carries requirements. Parent nodes often contain the product area, constraints, and shared intent; leaf nodes may intentionally be short.

Prefer commands that preserve this hierarchy:

```bash
pgm node list --with-ancestors --preset status --json
pgm node list --with-context --compact --json
pgm node view <node-id> --with-context --compact --json
pgm node export-context <node-id> --output ./tmp/node-context.md
pgm node context-pack <parent-node-id> --output ./tmp/context-pack --json
```

When reading node context, respect provenance:

- Use `path` / `titlePath` to understand the node's product area.
- Treat parent metadata/context/images as inherited requirements, not as text owned by the leaf node.
- Check `inheritedContext.hasDirectContext`, `hasInheritedContext`, and `missingContext` before deciding whether to implement or ask for clarification.
- If `missingContext` is true, inspect nearby siblings with `pgm node list --search ... --with-ancestors --json` instead of falling back to full project JSON.

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
pgm node update <node-id> --priority high --json   # urgent|high|medium|low; `none` clears it
pgm node complete <node-id> --note "Implemented the requested change." --json
pgm node context set <node-id> --file ./context.md --json
pgm node metadata set <node-id> purpose "Checkout entry point" --json
pgm node metadata unset <node-id> purpose --json
pgm node move <node-id> --parent <parent-node-id> --json
pgm node move <node-id> --root --json
pgm node delete <node-id> --yes --json   # irreversible; add --with-children to remove descendants
pgm node archive <node-id...> --json      # hide finished work; reversible with `pgm node unarchive`
```

## Record Outcomes Safely

Each update below is one request: the status and fields are saved together, or nothing is saved.

```bash
pgm node resolve <node-id> --note "What changed in code." --solution "What was proven to fix it." --json
pgm node resolve <node-id> --note-file ./tmp/impl.md --solution-file ./tmp/solution.md --json
pgm node metadata set <node-id> verification --value-file ./tmp/verification.md --json
cat ./tmp/notes.md | pgm node context set <node-id> --file - --json
```

- Log failed attempts, corrections, and observations with `pgm node note add <node-id> --text-file ./tmp/note.md --heading "Attempt 2"`. The server adds the note to the end of the node's context, so notes from several agents are all kept, and the text is also saved in the history entry. Keep the `solution` field for the current answer.
- Put Markdown, backticks, `$` syntax, or multiple lines in a file (or stdin with `-`) instead of a quoted argument. The shell never runs file text. Metadata values are trimmed; context is stored as read.
- `--note` writes the `implementation` field. `--solution` writes `solution`. Both fields must exist in the project schema.
- The JSON receipt shows what the server saved (`changedFields`, `savedFields`, `revision`, `operationId`), so you don't need to read the node again.
- To replace prose you read earlier without overwriting someone else's newer edit, pass the node's `revision` as `--expected-revision`. A conflict means re-read and merge.
- `node batch-update` and `node agent-update` report every item as `applied`, `rejected`, `conflict`, or `unknown`, and exit with code 8 when any item was not applied. Successful items stay saved. For `unknown`, run the `readback` command before retrying.
- `agent-update` keys `blockedBy` and `filesChanged` write the `blocked-by` and `files-changed` fields.

## Audit Completeness

Use the audit report instead of writing scripts that check fields node by node. It is read-only.

```bash
pgm project audit --json                                   # whole project, archived nodes left out
pgm project audit --subtree <node-id> --require solution,verification --output ./tmp/audit.md
pgm project audit --fail-on warning --json                  # exits 9 when warnings or errors exist
```

Findings list the rule, severity, node id, and a short reason. `open-with-solution` is informational: an open node with a workaround or partial fix is allowed, so review it rather than marking it complete. `duplicate-title` flags possible duplicates only. `graph-integrity` reports broken parents, links, or cycles in the stored files, even ones the loader repaired in memory.

## Link Related Nodes

Use relation links for blockers and overlaps. Don't put a node under another just to show a dependency.

```bash
pgm relation list <node-id> --json
pgm relation add <blocked-node-id> <blocker-node-id> --relationship dependency --json
pgm relation add <duplicate-node-id> <canonical-node-id> --json   # related; add a note naming the canonical node
pgm relation remove <source-id> <target-id> --relationship dependency --json
```

When two findings overlap, keep both records. Link the duplicate to the canonical node and add a `pgm node note add` correction that names it. Never merge records just because their titles match.

## Attach Images To Nodes

Use `image add` when the agent creates screenshots or local image artifacts, such as Playwright screenshots, and needs to attach them to specific nodes.

```bash
pgm image add <node-id> ./screenshots/home-desktop.png ./screenshots/home-mobile.png --json
pgm image list <node-id> --json
pgm image remove <node-id> <image-id> --json
pgm image download <node-id> --output ./tmp/images --json          # all images on the node
pgm image download <node-id> <image-id> --output ./tmp/shot.png --json
```

The JSON response includes the stored image IDs and URLs. Prefer attaching screenshots to the most specific matching node.

## Export Project Markdown

Use `project export-markdown` only before broad edits or when another LLM process needs compact whole-project context. For scoped work, prefer `node export-context`.

```bash
pgm project export-markdown --output ./project-context.md
pgm node export-context <node-id> --output ./node-context.md
pgm node context-pack <parent-node-id> --output ./context-pack-dir --json
```

## Rules

- Prefer `--json` for parsing.
- Prefer targeted list/search/context commands over `pgm project view --json`.
- Do not scrape the browser UI when `pgm` can provide the data.
- Do not mutate project data unless the user explicitly asks.
- Before creating nodes or adding images, inspect the project and choose the target project/node deliberately.
- After `project create`, keep using the returned `projectId`; if `--link` was passed, the CLI is already linked to it.
- After `node create`, keep using the returned `nodeId`.
- After `node import-markdown`, keep using the returned node IDs.
- After `image add`, keep using the returned image IDs/URLs.
- Before writing, confirm the target with `pgm target inspect --json` (or `pgm target inspect --local <folder> --project <id> --json`). It shows the server or data folder, where each setting came from, and whether it is reachable. It never starts a viewer or prints the token. Write receipts include the same `target`.
- If `pgm` cannot reach the server, read the reason in the error. A blocked connection (`EPERM`/`EACCES`) means local network access is denied. A refused connection means no server is running.
- The default local server is `http://localhost:3000`.
- Use `--server <url>` when the project is not on the default server.
- Use `--project <project-id>` when no project is linked.

## Useful Commands

```bash
pgm project list --json
pgm project create "Product Site" --link --json
pgm project link <project-id>
pgm project schema --project <project-id> --json
pgm node list --project <project-id> --json
pgm node list --project <project-id> --roots --compact --json
pgm node view <node-id> --project <project-id> --with-context --json
pgm node create --project <project-id> --title "Checkout" --type page --json
pgm node update <node-id> --project <project-id> --status working --json
pgm node complete <node-id> --project <project-id> --note "Implemented the requested change." --json
pgm node context set <node-id> --project <project-id> --file ./context.md --json
pgm node metadata set <node-id> purpose "Purpose text" --project <project-id> --json
pgm node move <node-id> --project <project-id> --parent <parent-node-id> --json
pgm node import-markdown --project <project-id> --file ./brief.md --title "Brief" --split-headings --json
pgm image add <node-id> ./screenshot.png --project <project-id> --json
pgm image list <node-id> --project <project-id> --json
pgm image remove <node-id> <image-id> --project <project-id> --json
pgm image download <node-id> [image-id...] --project <project-id> --output ./tmp/images --json
pgm node list --project <project-id> --search "checkout" --with-ancestors --json
pgm node export-context <node-id> --project <project-id> --output ./node-context.md
pgm project export-markdown --project <project-id> --output ./project-context.md
```
