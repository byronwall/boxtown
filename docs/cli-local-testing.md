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

This installs a global `pgm` command from the local package folder. No npm registry publish is required.

## 3. Query The Dev Server

From any terminal:

```bash
pgm project list
pgm project list --json
pgm project create "New Product Site" --link --json
pgm project link <project-id>
pgm project current
pgm project export-markdown --output ./project-context.md
pgm node list
pgm node list --status blocked
pgm node view <node-id>
pgm node create --title "Checkout" --type page --json
pgm node update <node-id> --status working --json
pgm node context set <node-id> --file ./context.md --json
pgm node metadata set <node-id> purpose "Checkout entry point" --json
pgm node move <node-id> --parent <parent-node-id> --json
pgm node import-markdown --file ./brief.md --title "Brief" --split-headings --json
pgm image add <node-id> ./screenshot.png --json
pgm image list <node-id> --json
pgm image remove <node-id> <image-id> --json
pgm task list
pgm task list --json
```

Use explicit flags when needed:

```bash
pgm node list --server http://localhost:3000 --project <project-id> --json
```

## 4. Optional Token Auth

By default, local dev read access works without a token when `AGENT_API_TOKENS` is unset and the app is not running in production mode.

To test token auth, start the app with:

```bash
AGENT_API_TOKENS='local-token:project:read|project:write|node:read|task:read|node:write|image:write' pnpm dev
```

Then store the token:

```bash
pgm auth login --token local-token
pgm auth status
```

You can also avoid local config and pass env vars:

```bash
PRODUCT_GRID_TOKEN=local-token PRODUCT_GRID_PROJECT=<project-id> pgm node list
```

## 5. Uninstall The Local CLI

```bash
npm uninstall -g @byronwallrus/product-grid-cli
```
