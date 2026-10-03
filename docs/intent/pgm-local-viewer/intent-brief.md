---
title: "PGM local viewer"
slug: "pgm-local-viewer"
phase: intent
status: current
last_updated: "2026-10-02"
---

# PGM local viewer

## My read

You want `pgm` to include the existing Product Grid viewer and work with a folder on your computer. Project data and images must stay in that folder. The local viewer must have the same controls and behavior as the online app. Its edits must update local files.

This is a second operating mode for the same tool. Today, the CLI connects to an app server that owns the data. You want local use without a separately installed or managed remote service. You should install `pgm`, select a data folder, and use the viewer. The CLI and viewer should operate on the same projects.

“Exact same viewer” is a strong requirement. A simplified export, read-only preview, or separate local interface would miss the goal. The recommended approach should reuse the app source, routes, actions, image handling, and project change events. Changes to the viewer should reach both modes through the same release build.

A local HTTP runtime may satisfy this intent while keeping the current application structure. The runtime would be started by `pgm` and would read and write the selected folder. This is a recommendation, not a confirmed requirement. Whether CLI commands must work directly on files without any server remains open.

## What matters most

- Preserve the complete viewer and its editing behavior.
- Store projects and image bytes in a selected local folder.
- Make local use available through the installed `pgm` package.
- Keep one source of truth for CLI and viewer changes.

## The experience or behavior you appear to want

Select a local folder and open its projects through `pgm`. Browse the graph, inspect nodes, edit content, and manage images through the current viewer. Those actions save to that folder. Close the tool, start it again, and see the saved state. Use CLI commands against those same projects. A CLI edit should reach an open viewer through the current project event flow.

The package should carry the runtime assets needed for this experience. A source checkout, development server, Docker container, and remote app account should not be prerequisites. The current package requires Node; a native executable is a separate distribution choice.

## Boundaries

### Must be true

- Local mode uses the same viewer source as online mode.
- Local edits and images survive a restart.
- The selected folder is separate from installed program files.
- Remote server use remains available as a separate mode.

### Must be avoided

- A second viewer or separate set of mutation rules.
- Silent fallback from local data to a remote server.
- Simultaneous independent writers that bypass the current mutation queue.

## What seems settled

This request is about finding a buildable approach. It does not request implementation, deployment, publication, or migration of existing data. The initial audience is Byron and existing CLI users. No shared editing, cloud synchronization, or background service is required by the request.

## Current reality that matters

The app already persists projects under `APP_DATA_DIR/projects/<project-id>/project.json`. Image bytes live under each project’s `images` directory. The stored project format includes an operation log; graph state is reconstructed through existing readers. A local CLI must not invent a simpler competing JSON format.

The viewer reads through app routes and writes through SolidStart server actions. CLI commands use `/api/v1`. Both reach the same disk services. The missing pieces are packaged app output, local startup, and local CLI target selection.

## What still needs your input

Can `pgm` manage a local HTTP runtime, or must CLI commands work directly on files with no server? The provisional recommendation uses a managed local runtime.

## Next step after confirmation

Confirm the runtime boundary, then produce the implementation plan. First prove that a relocated app build can edit disposable local data. Then package that build with `pgm`.
