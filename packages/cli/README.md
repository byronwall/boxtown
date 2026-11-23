# Boxtown CLI

Local first-slice CLI for Boxtown.

## Local Install

From the repo root:

```bash
pnpm add --global ./packages/cli
```

Then use `boxtown` from any terminal:

```bash
boxtown --help
boxtown project list --server http://localhost:3000
```

The CLI defaults to `http://localhost:3000`, so `--server` is optional when your dev server runs there.
When `boxtown` reports that a newer CLI version is available, run:

```bash
boxtown update
```

## Local Viewer

Start the packaged viewer from your project directory:

```bash
boxtown viewer
```

The viewer uses `./boxtown/data` in the current directory and creates it if needed. Use `--data-dir <folder>` to select another folder.

The command opens the viewer in your browser and stays open in the terminal. It prints the local URL and data folder. Press Ctrl+C to stop it; project files and images stay in the folder.

For terminal use, pass `--no-open`. Pass `--port <port>` to choose a loopback port:

```bash
boxtown viewer --data-dir ./boxtown-data --no-open --port 43210
```

Use a separate folder for each set of local projects. One viewer process can own a folder at a time.

Project, node, and image commands use the same folder with `--local`. They reuse an open viewer. If no viewer is open, boxtown starts a temporary local runtime and stops it after the command.

```bash
boxtown project list --local ./boxtown/data --json
boxtown project create "New Product Site" --local ./boxtown-data --json
boxtown node list --local ./boxtown-data --project <project-id> --json
boxtown node update <node-id> --local ./boxtown-data --project <project-id> --title "Updated title" --json
boxtown image list <node-id> --local ./boxtown-data --project <project-id> --json
```

Use `--project <id>` for project-scoped local commands. Local mode does not use the remote project's saved default. Do not pass `--server` or `--token` with `--local`. Project linking changes the remote CLI setting, so use `--project` for local projects.

If boxtown cannot prove that a startup child stopped, it keeps the ownership record and refuses to start another writer. Check `<folder>/.boxtown-local-runtime.json` and its recorded URL and process IDs. Stop the server only after you verify it belongs to that folder. Then remove that record and retry only after both recorded processes have stopped and the URL no longer responds.

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
boxtown auth login --token local-token
```

For write commands such as project creation, markdown import, and image upload, include write scopes:

```bash
AGENT_API_TOKENS='local-token:project:read|project:write|node:read|node:write|image:write' pnpm dev
```

## First Commands

```bash
boxtown project list
boxtown project create "New Product Site" --link --json
boxtown project link <project-id>
boxtown project schema --json
boxtown node list --roots --compact --json
boxtown node list --type task --status planned --with-ancestors --json
boxtown node list --search "checkout" --json
boxtown node view <node-id> --with-context --json
boxtown node export-context <node-id> --output ./node-context.md
boxtown node context-pack <parent-node-id> --output ./context-pack-dir --json
boxtown node create --title "Checkout" --type page --json
boxtown node update <node-id> --status working --json
boxtown node complete <node-id> --note "Implemented the requested change." --json
boxtown node move <node-id> --parent <parent-node-id> --json
boxtown node delete <node-id...> --yes --json
boxtown node archive <node-id...> --json
boxtown node import-markdown --file ./brief.md --title "Product Brief" --split-headings --json
boxtown image add <node-id> ./screenshot.png --json
boxtown image list <node-id> --json
boxtown project export-markdown --output ./project-context.md
boxtown update --dry-run
```

Avoid starting with `boxtown project view --json` for agent work; it returns the full graph and can be much larger than the schema and node context needed for a scoped change.

## Agent Write Commands

Create a new project and link it as the current project:

```bash
boxtown project create "New Product Site" --link --json
```

The JSON response includes `project.id`, `project.name`, `projectId`, `name`, `server`, and `linked`. Agents should use `projectId` or `project.id` in the next command.

Create a context node from markdown:

```bash
boxtown node import-markdown --file ./notes.md --title "Imported Notes" --json
```

Split markdown into a hierarchy of context nodes using heading structure:

```bash
boxtown node import-markdown --file ./notes.md --title "Imported Notes" --split-headings --max-heading-depth 2 --json
```

The JSON response includes the root node ID, every created node ID, the created node records, and the created parent-child links so an agent can use them immediately.

Create or update product structure nodes:

```bash
boxtown node create --title "Checkout" --type page --parent <parent-node-id> --context-file ./context.md --json
boxtown node update <node-id> --title "Checkout" --status working --type page --json
boxtown node update <node-id> --priority high --json
boxtown node complete <node-id> --note "Implemented the requested change." --json
boxtown node context set <node-id> --file ./context.md --json
boxtown node metadata set <node-id> purpose "Checkout entry point" --json
boxtown node move <node-id> --parent <parent-node-id> --json
```

Delete nodes (cannot be undone; `--yes` is required). Children of a deleted node become top-level nodes unless `--with-children` is passed:

```bash
boxtown node delete <node-id> <node-id> --yes --json
boxtown node delete <node-id> --yes --with-children --json
```

Archive finished work instead of deleting it. An archived node and its descendants are hidden in the app and left out of `node list` unless you pass `--include-archived`:

```bash
boxtown node archive <node-id> <node-id> --json
boxtown node unarchive <node-id> --json
boxtown node list --include-archived --json
boxtown node list --priority urgent --json   # priority: urgent|high|medium|low|none
```

Attach one or more screenshots/images to a node:

```bash
boxtown image add <node-id> ./desktop.png ./mobile.png --json
boxtown image list <node-id> --json
boxtown image remove <node-id> <image-id> --json
boxtown image download <node-id> [image-id...] --output ./images --json
```

Export scoped node context as LLM-ready markdown:

```bash
boxtown node export-context <node-id> --output ./node-context.md
```

Export full project context only for broad handoffs:

```bash
boxtown project export-markdown --output ./project-context.md
```

## Agent Skill

The package includes a `boxtown-context` agent skill that teaches agents when and how to use `boxtown`.

Install it for Codex globally:

```bash
boxtown skill install --agent codex --global
```

Install it into the current project:

```bash
boxtown skill install --agent codex
```

Inspect the bundled skill:

```bash
boxtown skill path
boxtown skill print
```
