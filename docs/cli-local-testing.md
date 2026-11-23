# Local CLI Testing

This is the fastest path for testing the first CLI slice without publishing to npm.

## 1. Run The App

From the repo root:

```bash
cd app
pnpm dev
```

The CLI defaults to `http://localhost:3000`.

## 2. Install The CLI Globally From This Checkout

From the repo root:

```bash
npm install -g ./packages/cli
```

This installs a global `boxtown` command from the local package folder. No npm registry publish is required.

## 3. Query The Dev Server

From any terminal:

```bash
boxtown project list
boxtown project list --json
boxtown project create "New Product Site" --link --json
boxtown project link <project-id>
boxtown project current
boxtown project export-markdown --output ./project-context.md
boxtown node list
boxtown node list --status blocked
boxtown node view <node-id>
boxtown node create --title "Checkout" --type page --json
boxtown node update <node-id> --status working --json
boxtown node context set <node-id> --file ./context.md --json
boxtown node metadata set <node-id> purpose "Checkout entry point" --json
boxtown node move <node-id> --parent <parent-node-id> --json
boxtown node import-markdown --file ./brief.md --title "Brief" --split-headings --json
boxtown image add <node-id> ./screenshot.png --json
boxtown image list <node-id> --json
boxtown image remove <node-id> <image-id> --json
boxtown task list
boxtown task list --json
```

Use explicit flags when needed:

```bash
boxtown node list --server http://localhost:3000 --project <project-id> --json
```

## 4. Optional Token Auth

By default, local dev read access works without a token when `AGENT_API_TOKENS` is unset and the app is not running in production mode.

To test token auth, start the app with:

```bash
AGENT_API_TOKENS='local-token:project:read|project:write|node:read|task:read|node:write|image:write' pnpm dev
```

Then store the token:

```bash
boxtown auth login --token local-token
boxtown auth status
```

You can also avoid local config and pass env vars:

```bash
BOXTOWN_TOKEN=local-token BOXTOWN_PROJECT=<project-id> boxtown node list
```

## 5. Uninstall The Local CLI

```bash
npm uninstall -g boxtown
```
