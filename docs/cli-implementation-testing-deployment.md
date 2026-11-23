# CLI Implementation, Testing, and Deployment Plan

This document is the build plan for the CLI recommended in [Agentic LLM Interface Plan](./agentic-llm-interface.md). It focuses only on implementation, verification, packaging, and npm deployment.

## Implementation Review

The CLI-first recommendation is sound, but the build should be stricter than a normal internal tool because the intended users include autonomous agents. The CLI must have stable JSON output, deterministic exit codes, explicit write commands, scoped auth, and no hidden dependency on browser state.

The best implementation path is:

1. Add a shared API contract package with Zod schemas and TypeScript types.
2. Add `/api/v1` server routes that wrap existing project services.
3. Add a standalone Node CLI package published to npm.
4. Test the contract, server routes, client, CLI command behavior, and publish artifact separately.
5. Deploy the server API first, then publish the CLI.
6. Add MCP later by reusing the same API client.

The first CLI should be useful before it is complete. Ship read-only project/node/task commands first, then add safe node writes, images, and long-running runs.

## Key Decisions

- Binary name: use `boxtown` locally unless npm package naming conflicts force a package name like `boxtown`. The npm package name and executable name do not have to match.
- Runtime: Node `>=22.14.0` for the CLI. The app already targets Node `>=22`, and npm trusted publishing currently requires Node `22.14.0+` with npm `11.5.1+`.
- Module format: ESM.
- CLI framework: `commander` for command parsing. It is boring, stable, and clear enough for nested commands.
- HTTP client: native `fetch`, `FormData`, `Blob`, and `File` from Node 22 where possible.
- Validation: Zod schemas in a shared package.
- Build: `tsup` for the CLI package so npm receives a small `dist/` with a preserved shebang.
- Test runner: Vitest, matching the current app.
- Publishing: npm public package with trusted publishing through GitHub Actions once the package exists. Use `npm pack --dry-run` locally before the first release to inspect the published artifact.

## Repository Layout

Move toward a top-level pnpm workspace while preserving the existing `app/` package.

```text
product-grid-mgmt/
  package.json
  pnpm-workspace.yaml
  app/
    package.json
    src/
      routes/api/v1/...
      lib/agent-api/...
  packages/
    api-contract/
      package.json
      src/
        index.ts
        project.schemas.ts
        node.schemas.ts
        task.schemas.ts
        image.schemas.ts
        run.schemas.ts
        error.schemas.ts
    cli/
      package.json
      tsconfig.json
      tsup.config.ts
      src/
        index.ts
        command.ts
        config/
        output/
        client/
        commands/
        errors.ts
      tests/
```

Add root workspace files:

```yaml
# pnpm-workspace.yaml
packages:
  - app
  - packages/*
```

```json
{
  "private": true,
  "type": "module",
  "scripts": {
    "lint": "pnpm --filter ./app lint && pnpm --filter boxtown lint",
    "type-check": "pnpm --filter ./app type-check && pnpm --filter boxtown type-check",
    "test": "pnpm --filter ./app test && pnpm --filter boxtown test",
    "build": "pnpm --filter ./app build && pnpm --filter boxtown build"
  },
  "packageManager": "pnpm@10.0.0"
}
```

The exact pnpm version can be adjusted to the developer machine, but pinning `packageManager` makes CI and local installs more predictable.

## Package Naming

Recommended package naming order:

1. `boxtown` for the npm package and `boxtown` for the executable.
2. `@byronwallrus/product-grid-mgmt-cli` if the package should mirror the repository name more explicitly.
3. `product-grid-cli` if an unscoped public package is preferred.

Use a scoped public package if possible. It lowers collision risk and leaves room for later packages like `@byronwallrus/boxtown-api-contract` or `@byronwallrus/boxtown-mcp`.

Before first publish:

```bash
npm view boxtown
npm view @byronwallrus/product-grid-mgmt-cli
npm view @byronwallrus/boxtown-api-contract
npm view @byronwallrus/boxtown-mcp
npm view product-grid-cli
npm view boxtown
```

Treat a 404 as available. If the name exists, choose a different package name but keep the binary as `boxtown` if that command name is not likely to conflict for users.

## API Contract Package

Create `packages/api-contract` as the source of truth for public API payloads. This package should contain only schemas, inferred types, constants, and lightweight helpers. It should not import SolidStart, server code, filesystem code, or UI modules.

Initial exports:

```ts
export * from "./error.schemas";
export * from "./project.schemas";
export * from "./node.schemas";
export * from "./task.schemas";
export * from "./image.schemas";
export * from "./run.schemas";
```

Core schemas:

- `ApiErrorResponseSchema`
- `ProjectSummarySchema`
- `ProjectDetailSchema`
- `MapNodeSchema`
- `MapNodeStatusSchema`
- `MapLinkSchema`
- `TaskSummarySchema`
- `NodeUpdateRequestSchema`
- `NodeContextSetRequestSchema`
- `NodeMetadataSetRequestSchema`
- `ImageSummarySchema`
- `RunSnapshotSchema`

Keep the contract narrower than internal records. If internal project records later gain private fields, the CLI contract should not expose them accidentally.

## Server API Implementation

Add versioned routes under `app/src/routes/api/v1`. Keep handlers thin:

```text
app/src/routes/api/v1/projects.ts
app/src/routes/api/v1/projects/[projectId].ts
app/src/routes/api/v1/projects/[projectId]/nodes.ts
app/src/routes/api/v1/projects/[projectId]/nodes/[nodeId].ts
app/src/routes/api/v1/projects/[projectId]/nodes/[nodeId]/context.ts
app/src/routes/api/v1/projects/[projectId]/nodes/[nodeId]/metadata.ts
app/src/routes/api/v1/projects/[projectId]/nodes/[nodeId]/images.ts
app/src/routes/api/v1/projects/[projectId]/tasks.ts
```

Route handler structure:

```ts
export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["project:read"] }, async ({ params }) => {
    const project = await readProjectByIdFromDisk(params.projectId);
    if (!project) {
      throw new ApiError("project_not_found", "Project not found.", 404);
    }
    return json(projectToProjectDetail(project));
  });
}
```

Create `app/src/lib/agent-api/`:

```text
agent-api/
  auth.server.ts
  errors.server.ts
  response.server.ts
  projections.server.ts
  scopes.ts
  idempotency.server.ts
```

Responsibilities:

- `auth.server.ts`: parse bearer tokens, validate scopes, identify actor.
- `errors.server.ts`: standardize API errors.
- `response.server.ts`: JSON helpers and request IDs.
- `projections.server.ts`: map internal records to public API shapes.
- `scopes.ts`: central scope names.
- `idempotency.server.ts`: initially no-op or in-memory for prototype, later durable.

Do not put CLI-specific behavior in server routes. The API should be clean enough for MCP and future clients.

## Auth Implementation

Phase 1 can support static service tokens from environment/config to unblock local development:

```text
AGENT_API_TOKENS=local-dev-token:project:read,node:read,node:write,image:write,run:start
```

This is not enough for production, but it lets the CLI and route tests move quickly.

Production path:

- Personal tokens created in the web UI.
- Service tokens scoped to project and operation.
- Later OAuth device flow for `boxtown auth login`.
- Tokens stored hashed server-side.
- CLI stores tokens in OS credential storage where possible, with a plaintext config fallback only for local development.

CLI auth config should support:

```bash
boxtown auth login --token <token> --server https://example.com
boxtown auth status
boxtown auth logout
```

Do not use browser cookies or Solid Router actions as CLI auth.

## CLI Package Implementation

### Package Manifest

Example `packages/cli/package.json`:

```json
{
  "name": "boxtown",
  "version": "0.1.0",
  "description": "CLI for Boxtown.",
  "type": "module",
  "bin": {
    "boxtown": "./dist/index.js"
  },
  "files": [
    "dist",
    "README.md",
    "LICENSE"
  ],
  "engines": {
    "node": ">=22.14.0"
  },
  "scripts": {
    "build": "tsup src/index.ts --format esm --target node22 --dts --clean",
    "dev": "tsx src/index.ts",
    "lint": "eslint .",
    "type-check": "tsc --noEmit",
    "test": "vitest run",
    "pack:check": "pnpm build && npm pack --dry-run"
  },
  "publishConfig": {
    "access": "public",
    "registry": "https://registry.npmjs.org"
  },
  "dependencies": {
    "@byronwallrus/boxtown-api-contract": "workspace:*",
    "commander": "^14.0.0",
    "zod": "^4.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsup": "^8.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.0.0",
    "vitest": "^2.0.0"
  }
}
```

Use the real published contract package name before publishing. If the contract package stays private, bundle its compiled code into the CLI or publish it under the same scope. The examples use `@byronwallrus/boxtown-api-contract` for consistency with the recommended CLI package name.

### Entrypoint

`src/index.ts` needs a shebang:

```ts
#!/usr/bin/env node
import { createCommand } from "./command";

await createCommand().parseAsync(process.argv);
```

Verify the built file preserves the shebang:

```bash
head -1 packages/cli/dist/index.js
```

### Command Tree

```text
boxtown
  auth
    login
    status
    logout
  config
    get
    set
  project
    list
    view
    link
    unlink
    current
    export
  node
    list
    view
    update
    context get
    context set
    metadata set
    metadata unset
  task
    list
    next
    view
    done
    block
    review
  image
    list
    add
    remove
  run
    view
    watch
```

Implement commands as small modules:

```text
src/commands/project.ts
src/commands/node.ts
src/commands/task.ts
src/commands/image.ts
src/commands/auth.ts
```

Each command module receives dependencies:

```ts
interface CommandContext {
  client: BoxtownClient;
  config: ConfigStore;
  output: OutputWriter;
  env: NodeJS.ProcessEnv;
}
```

Dependency injection makes command tests straightforward and avoids brittle process-level tests for every case.

## CLI Config

Use a config directory under the standard platform-specific location:

- macOS: `~/Library/Application Support/boxtown/cli.json`
- Linux: `$XDG_CONFIG_HOME/boxtown/cli.json` or `~/.config/boxtown/cli.json`
- Windows: `%APPDATA%\boxtown\cli.json`

Config shape:

```json
{
  "defaultServer": "https://app.example.com",
  "linkedProjects": {
    "/Users/byronwall/Projects/product-grid-mgmt": {
      "server": "https://app.example.com",
      "projectId": "checkout-redesign"
    }
  }
}
```

Token storage:

- Prefer keychain storage later.
- For the first implementation, support `BOXTOWN_TOKEN` and a local credential file with strict file permissions.
- Never print full tokens. `boxtown auth status` can show the server, actor, scopes, and token suffix.

## API Client

Build a typed API client in `packages/cli/src/client`.

Client responsibilities:

- Resolve base URL.
- Attach `Authorization: Bearer <token>`.
- Add `Accept: application/json`.
- Add `Idempotency-Key` for writes.
- Parse JSON through Zod response schemas.
- Convert API errors into typed CLI errors.
- Keep progress/event parsing separate from normal JSON requests.

Example method list:

```ts
listProjects(): Promise<ProjectSummary[]>
getProject(projectId: string): Promise<ProjectDetail>
listNodes(projectId: string, filters: NodeFilters): Promise<MapNode[]>
getNode(projectId: string, nodeId: string): Promise<MapNode>
updateNode(projectId: string, nodeId: string, input: NodeUpdateRequest): Promise<MapNode>
setNodeContext(projectId: string, nodeId: string, context: string): Promise<MapNode>
setNodeMetadata(projectId: string, nodeId: string, key: string, value: string): Promise<MapNode>
listTasks(projectId: string, filters: TaskFilters): Promise<TaskSummary[]>
addNodeImages(projectId: string, nodeId: string, paths: string[]): Promise<ImageSummary[]>
```

Avoid exposing raw `fetch` to command modules.

## Output Rules

This is the main agent-safety requirement.

- JSON mode writes only JSON to stdout.
- Human mode writes tables or short summaries to stdout.
- Progress, warnings, and debug messages go to stderr.
- Errors go to stderr and exit with a stable code.
- `--quiet` suppresses non-essential human output.
- `--json` must work without a TTY.
- No spinners in CI, JSON mode, or non-TTY output.

Exit codes:

```text
0 success
1 generic failure
2 usage or validation error
3 auth required
4 not found
5 conflict or stale resource version
6 permission denied
7 remote run failed
```

## Testing Strategy

Use five layers of tests. Do not rely only on end-to-end CLI tests; they are slower and make failures harder to diagnose.

### 1. Contract Tests

Location: `packages/api-contract/src/*.test.ts`

Test:

- Valid project, node, image, task, and error payloads parse.
- Invalid node statuses fail.
- Public schemas do not require internal-only fields.
- Error schemas preserve `code`, `message`, and `details`.

These tests protect CLI/server compatibility.

### 2. Server Route Tests

Location: `app/src/lib/agent-api/*.test.ts` and route-level tests where practical.

Test:

- Missing bearer token returns 401.
- Token without scope returns 403.
- Project not found returns typed 404 JSON.
- Node update validates payload before mutating.
- Node update reuses project data service functions.
- Image upload rejects non-images and empty files.
- Responses include `cache-control: no-store`.

Use `APP_DATA_DIR` with a temporary directory so tests do not touch real local data.

### 3. API Client Tests

Location: `packages/cli/tests/client.test.ts`

Mock `fetch` and test:

- Authorization headers.
- Base URL joining.
- Query string encoding.
- JSON schema parsing.
- API error mapping to CLI exit categories.
- Multipart image upload request construction.
- SSE event parsing for run watch commands.

### 4. Command Unit Tests

Location: `packages/cli/tests/commands/*.test.ts`

Use injected fake clients and output writers.

Test:

- `project list --json` prints an exact JSON shape.
- `project link` writes expected config.
- `node list --status blocked` passes filters to the client.
- `node update` rejects empty updates.
- `node context set --file notes.md` reads the file and calls the client.
- `task done` maps to node status `implemented`.
- `image add` validates files before calling the client.
- Errors produce the expected exit code.

### 5. Packaged CLI Smoke Tests

Location: `packages/cli/tests/smoke/*.test.ts` or CI script.

Build and pack the CLI:

```bash
pnpm --filter boxtown build
npm pack --dry-run packages/cli
```

Smoke test:

```bash
node packages/cli/dist/index.js --version
node packages/cli/dist/index.js --help
node packages/cli/dist/index.js project list --json
```

For commands that need a server, run the app against fixture data and point the CLI to localhost.

## Local Development Workflow

Initial setup:

```bash
pnpm install
pnpm --filter ./app prepare
pnpm --filter boxtown build
```

Run the app:

```bash
pnpm --filter ./app dev
```

Run the CLI from source:

```bash
pnpm --filter boxtown dev -- project list --server http://localhost:3000
```

Run the built CLI:

```bash
node packages/cli/dist/index.js project list --server http://localhost:3000 --json
```

Link globally for manual testing:

```bash
pnpm --filter boxtown link --global
boxtown --help
```

Unlink when done:

```bash
pnpm --filter boxtown unlink --global
```

## CI Plan

Add GitHub Actions with separate jobs:

```text
ci
  install
  lint
  type-check
  test
  build
  cli-pack-check

publish
  runs only on version tags or GitHub releases
  builds package
  tests package
  publishes to npm
```

CI should use:

- Node `22.14.0` or newer.
- pnpm via Corepack.
- `pnpm install --frozen-lockfile`.
- `pnpm test`.
- `pnpm build`.
- `pnpm --filter boxtown pack:check`.

Add a matrix later only if Windows-specific CLI behavior becomes important. For the first milestone, run Linux CI and do local macOS smoke testing.

## npm Publishing

### npm Package Requirements

The CLI package must include:

- `name`
- `version`
- `description`
- `bin`
- `files`
- `engines`
- `repository`
- `license`
- `publishConfig.access`

npm always includes `package.json`, README, license files, and files referenced by `bin`, but the package should still use a `files` allowlist so test fixtures and source-only files do not leak into the tarball.

Verify package contents:

```bash
pnpm --filter boxtown build
cd packages/cli
npm pack --dry-run
```

Install the tarball locally before first publish:

```bash
npm pack
npm install -g ./byronwallrus-product-grid-cli-0.1.0.tgz
boxtown --version
boxtown --help
npm uninstall -g boxtown
```

### First Publish

For the first public scoped publish:

```bash
cd packages/cli
npm publish --access public
```

If publishing with provenance manually from a supported CI environment, use `npm publish --provenance --access public`. For local manual publish, provenance is not available because it requires a supported cloud CI environment.

### Trusted Publishing

Use npm trusted publishing for ongoing releases instead of a long-lived `NPM_TOKEN`.

High-level setup:

1. Publish the package once or reserve/create it on npm.
2. In npm package settings, add a trusted publisher for the GitHub repository and workflow filename.
3. Configure GitHub Actions with `permissions: id-token: write` and a GitHub-hosted runner.
4. Use Node `22.14.0+` and npm `11.5.1+`.
5. Run `npm publish` from the package directory.

Trusted publishing automatically generates provenance for public packages from public repositories, so the workflow does not need `--provenance` when trusted publishing is active.

Example publish workflow:

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
      - uses: pnpm/action-setup@v4
      - run: pnpm install --frozen-lockfile
      - run: pnpm --filter boxtown test
      - run: pnpm --filter boxtown build
      - run: npm publish
        working-directory: packages/cli
```

Use tag names like `cli-v0.1.0` if the app and CLI may eventually version independently. If the whole repo versions together, use `v0.1.0`.

## Release Process

Manual release checklist:

1. Confirm API deployed to production and compatible with the CLI.
2. Update `packages/cli/package.json` version.
3. Update CLI changelog.
4. Run `pnpm test`.
5. Run `pnpm build`.
6. Run `pnpm --filter boxtown pack:check`.
7. Install the packed tarball locally and run smoke commands.
8. Commit changes.
9. Tag release.
10. Let GitHub Actions publish to npm.
11. Install from npm on a clean machine or clean prefix.
12. Run `boxtown auth status`, `boxtown project list --json`, and one read command against production.

Rollback options:

- Publish a patch release with a fix.
- Deprecate a bad version:

```bash
npm deprecate boxtown@0.1.0 "Use 0.1.1 or later."
```

Avoid unpublishing unless the package contains secrets or legally sensitive content.

## Deployment Order

Deploy in this order:

1. API contract package and server projections.
2. Read-only `/api/v1` endpoints behind token auth.
3. Production server deployment.
4. CLI read-only commands.
5. npm prerelease tag, such as `0.1.0-alpha.0`.
6. Internal smoke tests against production.
7. Safe write endpoints and CLI commands.
8. Public `latest` npm release.
9. MCP adapter.

This avoids publishing a CLI that points at missing production endpoints.

## Version Compatibility

Add an API version endpoint:

```text
GET /api/v1/version
```

Response:

```json
{
  "apiVersion": "1",
  "minimumCliVersion": "0.1.0",
  "recommendedCliVersion": "0.1.2"
}
```

CLI behavior:

- Warn when below `recommendedCliVersion`.
- Exit with a clear error when below `minimumCliVersion`.
- Continue when the server is newer but compatible.

Do not silently fail when the API shape changes.

## Observability

Server should log:

- Request ID.
- Actor ID or token ID.
- Client version from `User-Agent`.
- Operation name.
- Project ID.
- Resource ID.
- Status code.
- Duration.

CLI should send a user agent:

```text
product-grid-cli/0.1.0 node/22.14.0 platform/darwin
```

Do not send command arguments containing file paths, prompts, or context text as telemetry unless the user explicitly opts in.

## Security Checklist

- Token auth required for every `/api/v1` route except version/health.
- Scopes checked per operation.
- Service tokens can be revoked.
- Tokens stored hashed server-side.
- CLI never prints full token values.
- JSON errors do not include stack traces.
- Image uploads enforce MIME type, size limits, and extension normalization.
- Write operations log actor and before/after summary.
- Destructive commands require `--confirm` in non-interactive mode.
- CI publishing uses trusted publishing, not long-lived npm publish tokens.
- `npm pack --dry-run` reviewed before first publish.

## First Build Slice

Build the smallest complete slice end to end:

1. `packages/api-contract` with project, node, task, and error schemas.
2. `/api/v1/projects`, `/api/v1/projects/:projectId`, `/api/v1/projects/:projectId/nodes`, and `/api/v1/projects/:projectId/tasks`.
3. Static bearer-token auth for local/prototype use.
4. CLI commands:
   - `boxtown auth login --token`
   - `boxtown auth status`
   - `boxtown project list`
   - `boxtown project view`
   - `boxtown project link`
   - `boxtown node list`
   - `boxtown node view`
   - `boxtown task list`
5. JSON output and exit codes.
6. Contract tests, client tests, command tests, and `npm pack --dry-run`.

After that slice works, add `node update --status`, `node context set`, and `image add`.

## References

- npm package `bin`, `files`, `private`, and `publishConfig`: [npm package.json docs](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)
- npm publish behavior and `--access public`: [npm publish docs](https://docs.npmjs.com/cli/v11/commands/npm-publish)
- npm provenance: [Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements)
- npm trusted publishing: [Trusted publishing for npm packages](https://docs.npmjs.com/trusted-publishers)
