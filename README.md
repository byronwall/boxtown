# Product Grid Management

Product Grid Management is a SolidStart application for mapping product ideas, UI architecture, system relationships, and loose planning context as a spatial graph. It combines a project registry, an interactive map canvas, structured node metadata, markdown context notes, image attachments, and AI-assisted workflows for expanding or converting project knowledge.

## App Features

### Project Registry

- Create blank project workspaces from the landing page.
- View a registry of existing projects with project counts, node counts, and link counts.
- Open any project directly into its grid workspace.
- Delete projects from the registry.
- Persist project records to local JSON data under `app/data/projects.json`.
- Store project metadata including id, name, description, created timestamp, updated timestamp, nodes, and links.

### Spatial Product Map

- Render each project as an interactive spatial map of typed rectangular nodes.
- Represent product structure with parent-child hierarchy links.
- Represent non-hierarchical relationships with related, dependency, and reuse links.
- Use spatial proximity and clustering as the primary relationship signal.
- Keep edges hidden by default to reduce graph noise.
- Toggle relationship edges on when explicit link tracing is useful.
- Size nodes by hierarchy depth so larger concepts and smaller implementation details read differently.
- Style nodes by type with deterministic fallback color tones.
- Show node labels and type metadata directly on the canvas.
- Wrap long node labels inside SVG nodes for scan-friendly rendering.
- Display image previews inside nodes when attachments exist.

### Canvas Navigation

- Pan the map by dragging the viewport.
- Zoom with the mouse wheel around the pointer position.
- Fit the camera to all visible nodes from the toolbar.
- Use the `F` keyboard shortcut to fit the current view.
- Reflow the layout to regenerate the visible node arrangement.
- Preserve viewport behavior across resize events.
- Animate layout and camera transitions when depth filters, isolation, or data changes.
- Clear selection by clicking the background.

### Focus and Isolation

- Select a node to make it the active item in the inspector.
- Hover nodes to highlight the active/related neighborhood.
- Double-click a node to isolate that node's local hierarchy.
- Toggle linked nodes into an isolated view with "Show Linked".
- Clear isolation and return to the broader project map.
- Dim or de-emphasize unrelated nodes and edges during focus states.

### Depth and View Controls

- Switch between a canvas view and a hierarchy tree view.
- Filter the map by visible hierarchy depth from the toolbar.
- Automatically clamp available depth controls to the current visible graph.
- Keep depth filtering compatible with isolation mode.
- Show project title, description, and back navigation in the project toolbar.

### Hierarchy Tree View

- Inspect the same project graph as a structured tree.
- Build the tree from parent-child links.
- Show root nodes, nested children, node purpose, type, depth, and child counts.
- Select nodes from the tree and synchronize the selection with the inspector.
- Display image thumbnails in tree rows.
- Support image drag-and-drop on tree rows.

### Inspector Rail

- Inspect selected node metadata including id, type, context mode, and depth.
- Read node purpose and implementation notes.
- View incoming and outgoing relationships grouped separately.
- Click related nodes from the connection lists to jump selection.
- Collapse and reopen the inspector rail.
- Delete selected nodes and automatically remove their links.
- Open context-only note conversion from eligible nodes.

### Markdown Context

- Store freeform markdown context on any node.
- Edit node context from the inspector with a form-backed server action.
- Preview context as rendered markdown when not editing.
- Expand longer context into a dialog.
- Render context-only notes as raw text until they are converted.
- Copy raw context from context-only nodes.
- Keep raw source context alongside structured context for AI conversion workflows.

### Context Nodes

- Create standalone context note nodes from the toolbar.
- Add a label and freeform markdown content.
- Store context nodes as `note` nodes with `context-only` mode.
- Optionally split markdown by heading level during import.
- Convert headings into linked child note nodes.
- Choose the maximum heading depth to promote into child nodes.
- Preserve deeper markdown under the parent context when not promoted.

### Image Attachments

- Attach image files to nodes by dropping images onto canvas nodes.
- Attach image files by dropping onto inspector image panels.
- Attach image files by dropping onto tree rows.
- Paste images from the clipboard while a node is selected.
- Store image files on disk under `app/data/images/<project>/<node>/`.
- Support AVIF, GIF, JPEG, PNG, and WebP image uploads.
- Display thumbnails in canvas nodes, inspector panels, and tree rows.
- Open images in a dedicated viewer dialog.
- Zoom images in the viewer with the wheel.
- Pan images in the viewer by dragging.
- Reset image viewer zoom/pan with double-click or the Reset button.
- Show image metadata including MIME type, size, and zoom level.

### AI-Assisted Node Expansion

- Start an "Add Nodes" flow from any project.
- Provide a short brief describing the new product area, workflow, or system detail.
- Include the current project graph and current node selection as generation context.
- Generate 3-4 clarifying questions before adding nodes.
- Answer questions through guided multiple-choice options.
- Generate a structured batch of new nodes and links.
- Add up to 10 generated nodes per run.
- Persist generated nodes into the current project.
- Deduplicate generated link keys when merging results.
- Generate follow-up suggestions after nodes are added.
- Restart the flow from a suggested follow-up brief.
- Track run progress with explicit steps: capture context, generate questions, await answers, generate nodes, persist graph, suggest follow-ups, and complete.

### Context Note Conversion

- Convert context-only note nodes into structured product map nodes.
- Generate clarifying questions before producing conversion candidates.
- Produce a candidate hierarchy of structured nodes and links from loose context.
- Review suggested candidates before committing them.
- Select or deselect individual candidate nodes.
- Toggle candidate subtrees as a group.
- Accept only the selected nodes and links.
- Trim the original note context after accepted structured nodes are created.
- Track run progress with explicit conversion steps: capture context, generate questions, await answers, generate suggestions, await selection, persist graph, trim context, and complete.

### AI SDK Integration

- Uses the Vercel AI SDK with `@ai-sdk/openai`.
- Keeps OpenAI calls in server-side service modules.
- Reads `OPENAI_API_KEY` from the environment.
- Defaults lightweight work to `OPENAI_MODEL`, with `gpt-5-mini` documented in `app/.env.example`.
- Uses `OPENAI_HEAVY_MODEL` for heavier reasoning, with `gpt-5.4` documented in `app/.env.example`.
- Uses structured `zod` schemas for generated questions, node batches, candidate batches, trim results, and follow-up suggestions.
- Uses `generateText()` with structured object output for new AI service code.

### Data Model

- Projects contain a `SpatialMapData` graph with `nodes` and `links`.
- Nodes include id, label, type, depth, purpose, implementation, context, raw context, context mode, and optional images.
- Links support parent-child relationships and lateral relationships.
- Lateral relationships can be `related`, `dependency`, or `reuse`.
- Generated node batches are merged with stable project-specific ids.
- Node ids are derived from type and label and made unique with numeric suffixes.
- Project ids are slugged from project names and made unique with numeric suffixes.
- Data loading validates spatial map records before they reach the UI.

### Markdown Renderer

- Provides a reusable markdown rendering module in `app/src/components/markdown-renderer/`.
- Supports GitHub-flavored markdown.
- Supports syntax-highlighted code blocks.
- Supports line-numbered code rendering.
- Supports markdown tables.
- Supports Mermaid diagram blocks.
- Includes Mermaid viewport and dialog helpers for larger diagrams.

### Developer and Design System Features

- Built with SolidStart, SolidJS, and the Solid router.
- Uses Panda CSS for theme tokens, recipes, layer styles, text styles, keyframes, and generated styles.
- Uses Park UI / Ark UI wrapper components under `app/src/components/ui/`.
- Includes reusable app wrappers such as `SimpleDialog`, `SimplePopover`, `SimpleSelect`, `PanelPopover`, and `ConfirmDialog`.
- Includes a console log capture module for in-app debugging and filtering.
- Includes a component explorer module for design system and recipe inspection.
- Includes global error overlay UI.
- Provides Vitest tests for spatial layout, spatial relations, add-node validation, context-note conversion, and project data operations.
- Includes patched dependencies for Vinxi and Panda generator behavior.

## Quick Start

Run commands from `app/`:

```bash
pnpm install
pnpm prepare
pnpm dev
```

For AI-assisted features, create an environment file from `app/.env.example` and provide `OPENAI_API_KEY`.

## Common Commands

```bash
pnpm lint
pnpm lint:fix
pnpm type-check
pnpm test
pnpm build
pnpm start
```

## Key Paths

- App workspace: `app/`
- App entry: `app/src/app.tsx`
- Project registry page: `app/src/components/projects/ProjectIndexPage.tsx`
- Project detail page: `app/src/components/projects/ProjectDetailPage.tsx`
- Spatial map module: `app/src/components/spatial-map/`
- Project data services: `app/src/lib/projects/`
- Add-nodes AI workflow: `app/src/lib/add-nodes/`
- Context-note conversion workflow: `app/src/lib/context-note-conversion/`
- Markdown renderer: `app/src/components/markdown-renderer/`
- Shared UI wrappers: `app/src/components/ui/`
- Theme and recipes: `app/src/theme/`
- Local project data: `app/data/`
- Design brief: `docs/design-brief-industrial-ui.md`

## Notes

- `app/styled-system/` is generated by Panda and should not be edited by hand.
- The root README describes current repository capabilities; `app/README.md` contains app-workspace setup notes.
