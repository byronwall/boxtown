---
title: "PGM local viewer — implementation plan"
slug: "pgm-local-viewer"
phase: plan
status: current
last_updated: "2026-10-02"
---

# PGM local viewer — implementation plan

## Plan at a glance

Build local mode around the existing app. `pgm` starts a bundled Node server, opens the current viewer, and selects a local data folder. CLI commands use that server’s current API. Project files and images remain outside the installed package.

The web/hosted version must work as well as it does today. Local mode adds an installation and startup path. It must preserve hosted viewing, editing, images, live updates, production authentication, deployment configuration, and remote CLI access.

First prove that a fresh production app build works after relocation. This tests the largest uncertainty: whether server modules, browser assets, image handling, and routes travel together. A launcher cannot fix an incomplete artifact.

Next deliver a foreground viewer command from a locally installed package. Users can create and edit projects, attach images, stop the command, and reopen saved data. This is a useful intermediate product even before automatic server reuse exists.

Finally connect local CLI commands to the same runtime. A command reuses an open viewer server or starts a temporary server when needed. A small ownership mechanism prevents two processes from writing the same folder. Keep this mechanism specific to local startup.

You approved the managed local server. No further product decision blocks this plan. Command spelling and folder defaults are reversible implementation choices. Implementation is authorized. Registry publication and data migration remain outside the request.

Local ticket graph: [epic pgm-9m5d](../../../.tickets/pgm-9m5d.md). Ticket files own live refinement, status, and proof. Refine each ticket before execution.

## Implementation strategy

**Reuse the complete application.** Keep viewer components, SolidStart actions, `/api/projects`, `/api/v1`, and `/ws/jobs`. Keep the current record reader, serializer, operation history, images, and archives. Do not extract a new storage layer.

**Keep local settings local.** Apply loopback binding, local tokens, folder ownership, and root base path only to the local launcher/build. Preserve the normal app build/start path, configured hosted base path, host/port, `APP_DATA_DIR`, and production token rules. A hosted server does not need a local runtime record. Any local identity endpoint remains inactive there.

**Add startup at the CLI boundary.** Resolve local or remote mode before constructing `ProductGridClient` in `packages/cli/src/main.mjs`. Put new launcher, target, and packaging code in small TypeScript modules. Compile those modules to JavaScript for the existing Node CLI. Avoid converting unrelated CLI code.

**Select local data explicitly.** Proposed interface:

```sh
pgm viewer --data-dir ./product-grid-data
pgm node list --local ./product-grid-data --project demo --json
pgm node create --local ./product-grid-data --project demo --title Example --json
```

The viewer command stays in the foreground. Print its URL and absolute data path. Open the browser after readiness; provide `--no-open` for terminal use. Local mode rejects conflicting remote flags and ignores remote server/token defaults. Initially require an explicit project for project-scoped local commands. Add folder-local linking only if the current command flow needs it.

**Use production settings.** Start with `NODE_ENV=production`, an absolute `APP_DATA_DIR`, and a loopback host. Use an app build with root `BASE_PATH`. Override inherited Nitro host/port settings and clear socket/SSL settings that change startup. Generate a local API token with the existing scopes. Keep it out of terminal output and browser URLs.

**Keep the development loop local.** Add a focused `pnpm local:smoke` script that builds, relocates, starts, checks, and stops the artifact. Use a new folder under repo-root `tmp/` for each run. Disable update checks with `PGM_NO_UPDATE_CHECK=1`. Use real HTTP calls and real disposable files. Inject failures with an occupied port, malformed fixture, or non-writable folder.

The existing `app/data` contains user data. Existing tickets identify port 3000 as the user server. Neither is a test target. There is no need for cloud access, an emulator, or Docker. Manual browser checks use the disposable runtime; browser automation remains outside this plan unless requested.

The proof order is: relocated app → installed package → shared CLI/viewer writes → manual viewer parity. Preserve explicit remote mode throughout. Disable local startup to bypass the new code. Never migrate or modify remote data during these checks.

## Milestone 1: A relocated app edits disposable local projects

Ticket: [pgm-yg33](../../../.tickets/pgm-yg33.md).

Build current source with `pnpm --dir app build` and root `BASE_PATH`. Copy the complete `.output` to a disposable runtime directory. Start its server entry with a separate empty data folder and an unused loopback port.

- **Change — Add one reproducible artifact smoke script.** Create a project and node through the existing CLI/API. Change the node title and context. Fetch the project through the viewer’s read route. Upload an image, download it through the image route, and compare bytes. Stop and restart the runtime, then verify saved state.
- **Change — Prove artifact closure.** Launch with a working directory outside the checkout. Check module resolution, symlinks, static script URLs, CSS, and runtime dependency paths. No import may resolve back into the checkout. Retain required server dependencies and public assets.
- **Change — Capture the hosted baseline.** Run the normal production app on a separate disposable data folder. Record project/node/image API behavior, assets, auth, and event delivery before shared changes. Repeat the checks afterward. Keep configured deployment settings working; record any existing limitation separately.
- **Spike — Resolve output packaging.** Determine whether `.output` is complete for the installed Vinxi/Nitro versions. If modules are missing, adjust tracing or stage the exact required runtime dependencies. Do not ship all development dependencies or change frameworks.

Use real production API authentication. Fetch HTML and asset bytes as the initial operator proof. This does not prove hydration, server-action transport, or visual parity; those checks belong in the next milestone.

### Desired end state

- A relocated production artifact creates, edits, and reloads local projects.
- Image bytes survive the API round-trip and runtime restart.
- One focused command repeats the proof without touching user data.
- Normal production startup, data access, and remote CLI/API behavior retain the observed baseline.

## Milestone 2: Installed pgm opens the existing editable viewer

Ticket: [pgm-c2o7](../../../.tickets/pgm-c2o7.md).

Package the proven output with the CLI and add the foreground viewer command. Resolve packaged files relative to the installed module, not the current working directory.

- **Change — Package one complete app build.** Update `packages/cli/package.json` and build scripts to stage the app under a package-owned runtime directory. Build before packing. Include server modules, public assets, and required runtime dependencies. Pack with pnpm; inspect the actual tarball, not only the staging folder. Install it in a disposable prefix outside the checkout. Confirm nested dependencies survived packaging.
- **Change — Add the viewer launcher.** Resolve the data directory, select a port, spawn with `process.execPath`, and wait for a bounded readiness check. Then open the browser. Show startup errors. A browser-open failure should leave the printed URL usable. Forward termination and wait for the owned child to stop.
- **Change — Verify the real viewer manually.** On the disposable server, create and edit nodes, move a node, change status and metadata, upload/view/remove an image, and save project settings. Check the spatial map, tree, inspector, Markdown, and image viewer. Exercise actual server actions and deep-link refresh. Reopen the folder and confirm saved state.
- **Change — Confirm hosted viewer behavior.** Repeat the representative viewer and action checks on a normal production runtime with separate disposable data. Confirm packaging does not change the normal app build or deployment path. Do not deploy or write to the live hosted service.

Start only one viewer runtime for a folder in this intermediate slice. Introduce the folder ownership guard here; duplicate startup must fail clearly until reuse is added. Keep mutable records outside the installed package.

### Desired end state

- `pgm viewer --data-dir <folder>` works from an installed package.
- The same app components and routes provide local editing and image management.
- Ctrl+C stops the owned server. Restart retains local state.
- Manual checks establish viewer parity. Local assets work with internet access unavailable.
- Hosted viewer controls, server actions, assets, images, and deployment settings retain baseline behavior.

## Milestone 3: CLI commands share the local viewer’s write authority

Ticket: [pgm-gydq](../../../.tickets/pgm-gydq.md).

Extend local target selection to all project, node, and image commands that currently use `ProductGridClient`. Keep their API payloads and output formats.

- **Change — Reuse or start the folder runtime.** Store a small private ownership record for the canonical data path. Acquire ownership atomically before starting a writer. Record the local URL and token after readiness. Verify a live server identifies the same folder and runtime before reuse. Add a narrow local identity endpoint if existing routes cannot prove this. Keep that endpoint inactive in remote mode.
- **Change — Handle process ownership directly.** A command reuses an active runtime. Without one, it starts a temporary runtime, performs the operation, and stops the child in `finally`. Remove a stale record only after confirming its owner is gone. A second caller waits briefly for startup or receives a clear retry error. Do not infer ownership from an open port alone.
- **Change — Preserve target separation.** Reject mixed local and remote flags. Do not use global remote project selection for a local folder. Keep server diagnostics on stderr so `--json` stdout contains only command results. Skip remote update checks before local operations.
- **Change — Protect remote CLI access.** Preserve current remote server, token, and project resolution for commands without local selection. Verify valid and invalid production tokens, project/node/image operations, and viewer events against the normal disposable production runtime. Local ownership rules must not change hosted writes.
- **Change — Verify shared writes and events.** With the viewer open, make CLI edits and confirm the viewer receives them without reload. Send concurrent edits to different node fields through the one server and confirm both persist. Start two local commands against a stopped folder and prove only one writer starts. Check stale ownership, startup failure, command failure, and shutdown. Confirm commands never stop a server they reused.

Add a few focused lifecycle tests for duplicate writers, target selection, and cleanup. Reuse existing disk/API tests. Inspect read-time normalization: it can write outside `serializedMutation`. Reproduce overlap with a mutation before changing it. If the overlap loses changes, put that specific write inside the shared queue without nesting queued calls.

### Desired end state

- Local CLI commands work with and without an open viewer.
- A folder has one runtime writer. CLI edits reach the open viewer through existing events.
- Failed commands preserve data and clean up only their owned processes.
- Remote commands retain their current explicit path.
- The normal web/hosted app passes the representative regression checks for shared data services, auth, actions, and events.

## Resolved spikes

1. **Artifact closure and package contents.** Complete output relocated and installed successfully. The tarball includes server dependencies and browser assets. See pgm-yg33 and pgm-c2o7.
2. **Port selection.** Fresh output still maps port zero to 3000. The launcher selects a loopback port and rejects port zero, user port 3000, and its ownership guard port.
3. **Read normalization during writes.** Reproduced lost edits and stale list cleanup. Fresh per-record repair now runs inside the shared queue. Regression and independent race checks passed. See pgm-gydq.

## Below the cut line

- Native single-file executable, Electron, and a separate viewer build.
- Cloud sync, automated remote downloads, and data migration.
- Operating-system service registration and automatic background startup.
- Watching arbitrary external file edits or multiple app versions sharing one folder.
- New databases, generic adapters, and a broad project-service refactor.
