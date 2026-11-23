# CLI npm Publish Runbook

This runbook describes exactly how to publish the local CLI package at `packages/cli` to npm as `boxtown`.

The npm package installs a global executable named `boxtown`.

## Current Package

Package path:

```bash
packages/cli
```

Package name:

```bash
boxtown
```

Global install command after publish:

```bash
npm install -g boxtown
boxtown --help
```

## 1. Confirm npm Account

Log in with the npm account that owns the `byronwallrus` scope:

```bash
npm whoami
```

If this does not print `byronwallrus`, log in:

```bash
npm login
npm whoami
```

## 2. Confirm Package Name Is Still Available

```bash
npm view boxtown
```

Expected before first publish:

```text
npm ERR! 404 Not Found
```

A 404 means the package name is available.

## 3. Run Local Checks

From the repo root:

```bash
npm run cli:test
pnpm --dir app type-check
npm run cli:pack-check
```

Known current caveat: full `pnpm --dir app test` has unrelated existing failures in `src/lib/projects/data.server.test.ts` around expected `depth` fields on context note nodes. Do not block the CLI publish on those unless you want a fully green app suite first.

## 4. Test Local Global Install

From the repo root:

```bash
npm install -g ./packages/cli
boxtown --version
boxtown --help
```

With your dev app running at `http://localhost:3000`:

```bash
boxtown project list
boxtown project link recipe-architecture-grid
boxtown node view page-ai-recipes
boxtown task list
```

Uninstall the local global package when done:

```bash
npm uninstall -g boxtown
```

## 5. Review Package Contents

From the repo root:

```bash
cd packages/cli
npm pack --dry-run
```

Expected package contents should be limited to:

```text
README.md
bin/boxtown.mjs
package.json
src/client.mjs
src/config.mjs
src/errors.mjs
src/main.mjs
src/output.mjs
```

If npm cache permissions fail locally, use a temp cache:

```bash
npm_config_cache=/private/tmp/product-grid-npm-cache npm pack --dry-run
```

## 6. First Publish

From `packages/cli`:

```bash
npm publish --access public
```

The `--access public` flag is required for the first publish of a public scoped package.

## 7. Verify Published Package

After publish:

```bash
npm view boxtown name version bin
npm install -g boxtown
boxtown --version
boxtown --help
boxtown project list --server http://localhost:3000
```

Then uninstall if desired:

```bash
npm uninstall -g boxtown
```

## 8. Future Releases

For a patch release:

```bash
cd packages/cli
npm version patch
npm publish
```

For minor or major releases:

```bash
npm version minor
npm version major
```

The `npm version` command updates `packages/cli/package.json` and creates a git tag by default. If you do not want it to create a tag:

```bash
npm version patch --no-git-tag-version
```

## 9. Recommended Trusted Publishing Setup

Manual publishing is fine for the first release. After that, set up npm trusted publishing so GitHub Actions can publish without storing an `NPM_TOKEN`.

High-level steps:

1. Publish `boxtown` manually once.
2. Go to the package settings on npm.
3. Add a trusted publisher for this GitHub repository.
4. Use a GitHub Actions workflow with `id-token: write`.
5. Publish from `packages/cli` on version tags.

Workflow sketch:

```yaml
name: Publish CLI

on:
  push:
    tags:
      - "cli-v*"

permissions:
  contents: read
  id-token: write

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: "24"
          registry-url: "https://registry.npmjs.org"
      - run: corepack enable
      - run: pnpm install --frozen-lockfile
      - run: npm run cli:test
      - run: npm run cli:pack-check
      - run: npm publish
        working-directory: packages/cli
```

## 10. If Something Goes Wrong

Prefer publishing a patch release:

```bash
cd packages/cli
npm version patch
npm publish
```

Deprecate a bad version:

```bash
npm deprecate boxtown@0.1.0 "Use 0.1.1 or later."
```

Avoid unpublishing unless the package accidentally contains secrets or legally sensitive content.
