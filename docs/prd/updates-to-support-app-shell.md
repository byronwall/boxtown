Hi,

> Historical review. In-app AI workflows and their routes have been removed.
> CLI APIs, project events, and image attachments remain.

Yes — after seeing the shell directions, I would update both the **component inventory** and the **design brief** so they better reflect the product you are actually building now, not just the current implementation you started from.

The biggest gap is that your current materials describe the map workspace mostly as a canvas plus toolbar/tree/inspector system, while the new concepts reveal that the real product direction is a broader **workspace shell** with stronger navigation, denser operational status, clearer multi-mode structure, and more deliberate utility surfaces. That is consistent with the current inventory, but it is not yet described explicitly enough.

## 1. What is missing right now

There are two main documentation gaps.

- The **design brief** is strong on visual tone.
  - It clearly defines the desired feel: dense, industrial, technical, precise.
  - It gives good surface-language guidance.
  - But it is still somewhat **styling-heavy** and not explicit enough about the shell’s structural model.

- The **component inventory** is strong on implementation components.
  - It lists the map, inspector, tree, image tools, AI rails, and related pieces well.
  - But it does not yet frame the product as a **full workstation shell** with persistent navigation layers, utility docks, status systems, and cross-workspace modes.

So I would update both docs in a way that makes the product direction more explicit.

---

## 2. Updates I would make to the design brief

## A. Add a new section: “Workspace Shell Strategy”

Right now the brief says “design the interface like a technical workstation,” which is directionally correct, but I would make that more concrete.

Add a section like this:

### Workspace Shell Strategy

The product is not just a canvas view. It is a multi-surface planning workstation centered on the canvas.

The shell should support five persistent layers of orientation:

- workspace identity
  - project, environment, workspace name, owner, status

- mode/navigation
  - canvas, tree, pages, components, reports, notes, related views

- map tooling
  - add, arrange, filter, fit, zoom, reflow, show edges, selection tools

- contextual inspection
  - metadata, relationships, context, assets, activity, notes, comments

- operational status
  - selection count, coordinates, snap state, grid mode, sync/save state, shortcuts

Why add this:

- It gives the brief a clearer product model.
- It stops the redesign from becoming only a visual restyle.
- It makes future shell decisions much easier and more consistent.

This would also better reflect the actual component boundaries in the app.

---

## B. Add explicit shell design principles

I would add a new principle section after the existing visual principles. Something like:

### 7. Persistent Structural Orientation

Users should always know:

- what project they are in
- what mode they are in
- what is selected
- what actions are available at this level
- what status the workspace is in

### 8. Multi-Level Action Hierarchy

The shell should visually separate:

- global actions
- project actions
- canvas actions
- selection actions
- inspector actions

### 9. Expert Workflow Support

The product should feel optimized for repeat use by operators, not just understandable to first-time viewers.

This means:

- frequently used actions stay visible
- status is ambient, not hidden
- supporting tools like minimap, comments, history, and assets should be integrated into the shell rather than treated as secondary overlays

These additions would help preserve the strongest parts of the new concepts.

---

## C. Add a section on “Interaction hierarchy”

Your current brief is very strong on surfaces and density, but less explicit about interaction layers.

I would add a section like this:

### Interaction Hierarchy

Use consistent visual treatment to distinguish between:

- navigation controls
- mode switches
- canvas tools
- selection tools
- inspector controls
- utility/status indicators

Rules:

- mode switches should look different from actions
- toggles should feel mechanical and stateful
- selection actions should appear close to the selected object or directly above the viewport
- persistent utilities should live in stable, repeatable shell zones
- status indicators should remain readable without competing with primary actions

Why this matters:

- It gives design and engineering a shared language.
- It prevents “everything becomes the same button” drift.

---

## D. Add shell-specific target outcomes

Your current “What 10/10 Looks Like” section is good, but I would expand it.

Add shell-specific statements such as:

### A 10/10 shell should feel like:

- a control surface around the map, not decoration around the map
- a system with layers of command, navigation, and inspection
- a tool optimized for ongoing project work, not a one-screen diagram demo

### A 10/10 shell should enable:

- fast switching between alternate readings of the same project
- low-friction navigation across project artifacts
- ambient awareness of system state
- efficient inspection without modal churn

That would turn the brief into a more complete product UX brief rather than mostly a visual styling brief.

---

## E. Add a section on “Docking and secondary surfaces”

The new concepts imply utility surfaces that are not fully covered in the current brief.

Add something like:

### Docking and Secondary Surfaces

The shell may include compact secondary surfaces for:

- minimap
- activity feed
- comments
- notes
- assets
- history
- AI workflow rails
- console or diagnostic panels

Guidelines:

- these surfaces should feel integrated into the workstation shell
- they should not look like unrelated floating consumer widgets
- they should support compact review and quick expansion
- they should preserve canvas primacy while increasing workspace capability

This matters because your current app already has image tooling, AI rails, markdown context, and diagnostics, but the brief does not really say how those should coexist visually inside the shell.

---

## F. Add a “state language” section

The new concepts made state much more visible. The brief should capture that.

### State Language

The shell should make the following states visible and legible:

- active project
- workspace mode
- selected item count
- zoom level
- fit state
- snap/grid state
- autosave/sync state
- read-only vs editable state
- item lifecycle state such as draft, approved, in progress, deprecated

Design guidance:

- state should be present without overwhelming the screen
- state should be grouped by meaning
- status indicators should be compact, repeatable, and consistent across surfaces

That would help a lot once you start implementing more of the shell.

---

## G. Add guidance for future extensibility

Your product is already more than a single map. The brief should say that directly.

### Extensibility Guidance

The shell should be able to support future adjacent views without redesigning the entire workspace.

Assume the product may grow to include:

- alternate graph views
- project reports
- dependency views
- decisions and notes
- AI-assisted planning views
- asset/context browsing
- activity and review workflows

Therefore:

- left navigation should be scalable
- top-level mode model should be stable
- right rail should support tabbed or segmented detail surfaces
- secondary dock surfaces should be composable

This is important because the current inventory already points in this direction.

---

## 3. Updates I would make to the component inventory

The inventory is solid, but I would expand it so the shell is represented as a first-class product system rather than an implied wrapper around `SpatialMapCanvas`.

## A. Add a new top-level category: `workspace-shell`

Right now most shell behavior is effectively hidden under project page + spatial map. I would explicitly add a shell layer.

Suggested category:

- `workspace-shell`
  - `WorkspaceShell`
    - Commentary: Primary operator-style shell for the project workspace. It coordinates top command areas, navigation rails, the central viewport region, inspector rail, and persistent status surfaces.

  - `WorkspaceHeader`
    - Commentary: Project-level header for workspace identity, breadcrumbs, environment labels, and global actions.

  - `WorkspaceModeTabs`
    - Commentary: Persistent mode switcher for alternate readings of the project such as canvas, tree, pages, graph, docs, or reports.

  - `WorkspaceStatusBar`
    - Commentary: Dense operational footer for selection state, zoom, snap, grid, save/sync status, and shortcut hints.

  - `WorkspaceCommandSearch`
    - Commentary: Cross-workspace command launcher and search entry point for nodes, components, docs, and actions.

  - `WorkspaceUtilityDock`
    - Commentary: Docked secondary-surface container for minimap, activity, comments, history, or related compact utilities.

Why:

- This makes the shell explicit.
- It gives engineering and design a shared vocabulary.
- It reduces the chance that shell features become scattered across unrelated files.

---

## B. Split “spatial-map/core” into clearer shell vs viewport concerns

Right now `SpatialMapCanvas` and `SpatialMapCanvasLayout` appear to carry a huge amount of responsibility. That may be true in code today, but the inventory should better distinguish the conceptual pieces.

I would revise the commentary for those components, or split them conceptually in the inventory.

For example:

- `SpatialMapCanvas`
  - Commentary: Main workspace route surface for map-centered project planning. It composes the viewport, shell regions, map tools, tree navigation, inspector, and workflow rails.

- `SpatialMapCanvasLayout`
  - Commentary: Structural layout system for the map workspace shell. It allocates left navigation, top control zones, viewport framing, right inspection surfaces, and bottom operational status.

- `SpatialMapViewport`
  - Commentary: Viewport container for the pan/zoom map region, minimap, selection overlays, and viewport-specific actions.

Even if `SpatialMapViewport` does not exist yet as code, adding it conceptually to the inventory can be useful if you intend to move in that direction.

---

## C. Add a category for `workspace-navigation`

The current inventory has `SpatialMapTreeView`, but not the broader navigation idea that the new shell concepts imply.

Suggested additions:

- `workspace-navigation`
  - `WorkspacePrimaryNav`
    - Commentary: Persistent left-rail navigation for major workspace destinations and views.

  - `WorkspaceSectionNav`
    - Commentary: Secondary grouped navigation for project-specific destinations such as views, notes, reports, dependencies, or AI tools.

  - `WorkspaceHierarchyPanel`
    - Commentary: Hierarchy-focused navigation surface for browsing the project structure without relying on the canvas alone.

  - `WorkspaceFilterPanel`
    - Commentary: Compact filter controls for visible node classes, status, level, and related map-scoping controls.

This is helpful because right now the inventory captures tree navigation, but not the broader shell navigation model.

---

## D. Add a category for `workspace-inspection-and-context`

Your current inspector section is good, but the new concepts suggest the right rail may become more than a single details panel.

Suggested reframe:

- `workspace-inspection-and-context`
  - `SpatialMapInspector`
    - Commentary: Primary node detail rail for the selected item.

  - `InspectorTabs`
    - Commentary: Right-rail mode switcher for detail surfaces such as Details, Context, Assets, History, or related node intelligence.

  - `InspectorMetadataPanel`
    - Commentary: Dense structured metadata surface for ids, type, depth, status, ownership, and update information.

  - `InspectorContextPanel`
    - Commentary: Structured panel for markdown, notes, AI output, or source context associated with a node.

  - `InspectorAssetsPanel`
    - Commentary: Node-adjacent asset surface for images and related artifacts.

  - `InspectorHistoryPanel`
    - Commentary: Compact event/activity surface for changes, links, review comments, and update history.

Why:

- It better reflects where the product is heading.
- It gives a clearer home for images, context previews, notes, comments, and history-like content.

---

## E. Add a category for `selection-and-viewport-tools`

The new concepts introduce stronger selection action strips and viewport instrumentation.

Suggested additions:

- `selection-and-viewport-tools`
  - `SelectionActionBar`
    - Commentary: Contextual action strip for selected nodes, exposing common operations near the viewport.

  - `ViewportControls`
    - Commentary: Compact zoom, fit, lock, and view-state controls attached to the map viewport.

  - `ViewportMinimap`
    - Commentary: Compact spatial overview of the current canvas with viewport framing and quick navigation affordances.

  - `ViewportLegend`
    - Commentary: Calibration-style guide for node classes, map states, and current filter scope.

That would align the inventory better with the design direction and keep viewport utilities from being buried in generic toolbar descriptions.

---

## F. Add a category for `activity-and-review-surfaces`

Your new shell concepts imply more collaborative and review-oriented surfaces.

Suggested additions:

- `activity-and-review-surfaces`
  - `WorkspaceActivityFeed`
    - Commentary: Compact timeline of recent project and node changes.

  - `WorkspaceCommentsPanel`
    - Commentary: Focused discussion surface for project or node-level review comments.

  - `WorkspaceReviewDock`
    - Commentary: Docked review area combining minimap, activity, and comments without pulling focus away from the canvas.

This is useful even if some of it is aspirational. It documents the intended ecosystem.

---

## G. Add explicit shell-level commentary to existing project components

Your `ProjectDetailPage` commentary is currently accurate, but it could better reflect the shell direction.

Current version is about bridging project data and map canvas. I would expand it to something like:

- `ProjectDetailPage`
  - Commentary: Project-scoped workspace entry point. It prepares project data and composes the operator-style shell that contains map-centered planning, navigation rails, inspection surfaces, and related project utilities.

This sounds small, but it helps the inventory communicate the product more accurately.

---

## 4. New fields I would add to the component inventory format itself

Beyond categories, I would change the **metadata model** of the inventory.

Right now the inventory mostly has:

- name
- path
- commentary

That is useful, but once the shell gets richer, I would add a few more descriptive fields.

## Recommended added fields

- `surface-type`
  - examples:
    - shell
    - navigation
    - viewport
    - inspector
    - dialog
    - dock
    - rail
    - overlay
    - utility

- `scope`
  - examples:
    - global workspace
    - project workspace
    - canvas-local
    - selection-local
    - node-local

- `primary-user-goal`
  - examples:
    - orient
    - navigate
    - inspect
    - manipulate
    - review
    - annotate
    - monitor status

- `persistence`
  - examples:
    - persistent
    - collapsible persistent
    - contextual
    - transient
    - modal

- `information-density`
  - examples:
    - low
    - medium
    - high

- `interaction-frequency`
  - examples:
    - constant
    - frequent
    - occasional
    - rare

Why these help:

- They make layout decisions easier.
- They clarify what deserves persistent visibility.
- They help prevent overgrowth in the shell.

For example, a minimap and status bar are persistent utilities; a selection action strip is contextual; a create-context dialog is transient.

---

## 5. Changes I would make to terminology

I would also tighten the terminology in both docs.

## A. Standardize on “workspace shell”

Use that phrase consistently for:

- the surrounding app chrome
- left rail
- top command areas
- right inspector
- bottom status zone
- docks and utilities

That is better than loosely saying “surrounding UI” or “chrome.”

## B. Standardize on “viewport”

Use “viewport” for:

- the framed pan/zoom region containing the infinite canvas

This distinguishes:

- shell
- viewport
- scene
- node

That separation will help both design and engineering.

## C. Standardize on “utility dock” vs “inspector rail”

Use:

- **inspector rail** for selected-item detail surfaces
- **utility dock** for minimap/activity/comments/history-style secondary panels

That keeps the right side from turning into a bucket of unrelated things.

## D. Standardize on “mode” vs “view” vs “tool”

These get conflated easily.

I would define them explicitly in the brief:

- **Mode**
  - broad workspace interpretation
  - examples: Canvas, Tree, Graph, Docs

- **View**
  - saved or filtered representation within a mode
  - examples: Default Map, MVP Scope, User Journey

- **Tool**
  - operational action or control
  - examples: Add Node, Reflow, Show Edges, Fit, Pan

This will reduce ambiguity later.

---

## 6. Add a “shell inventory” appendix to the design brief

This is probably the single most useful doc addition.

At the end of the brief, add an appendix like:

## Shell Inventory

The workspace shell consists of:

- Global/project header
- Workspace mode switcher
- Primary navigation rail
- Secondary section navigation
- Map tooling bar
- Selection action strip
- Central viewport
- Right inspector rail
- Utility dock
- Status bar

For each one, define:

- purpose
- required persistence
- expected density
- what belongs there
- what should not belong there

This makes the brief much more executable.

---

## 7. Specific additions for AI and content flows

Your inventory already includes:

- add-nodes AI rail
- context note conversion rail
- markdown context rendering
- image-related inspector tools

Those are real product differentiators. I would make the brief acknowledge them more directly.

## Add to brief:

### AI-Assisted Workflow Surfaces

AI generation and conversion flows should feel like integrated project tools, not detached chat-like overlays.

Guidelines:

- AI rails should match inspector density and shell discipline
- generated output should be reviewable in structured records or candidate trees
- acceptance actions should feel operational and precise
- AI surfaces should visually belong to the workstation shell

That will help keep your AI experiences from drifting into a different visual language than the rest of the product.

---

## 8. Specific additions for diagnostics and internal tooling

Your inventory also includes console capture and component explorer surfaces.

If these are internal-only, I would still add a note in the inventory or brief:

### Internal Utility Surfaces

Internal diagnostics and design-system dogfooding surfaces should inherit the same shell logic where practical, but may use simplified navigation and higher information density appropriate for staff tooling.

This is a small note, but it keeps your internal tools from becoming stylistic outliers.

---

## 9. What I would actually edit first

If you want the smallest set of high-value doc changes, I would start here.

## Design brief — first edits

- Add:
  - Workspace Shell Strategy
  - Interaction Hierarchy
  - Docking and Secondary Surfaces
  - State Language
  - Extensibility Guidance

## Component inventory — first edits

- Add categories:
  - `workspace-shell`
  - `workspace-navigation`
  - `selection-and-viewport-tools`
  - `activity-and-review-surfaces`

- Update commentary for:
  - `ProjectDetailPage`
  - `SpatialMapCanvas`
  - `SpatialMapCanvasLayout`
  - `SpatialMapInspector`

These changes would give the docs a much stronger fit with the redesign direction without forcing a giant rewrite.

---

## 10. My overall recommendation

The main documentation shift should be:

- from **“we have a spatial map with supporting components”**
- to **“we have a map-centered planning workstation with a deliberate shell architecture”**

That is the conceptual upgrade the new mockups are really pointing to.

Your current docs already contain most of the raw ingredients:

- map
- tree
- inspector
- images
- AI rails
- markdown context
- project shell

The design brief already contains the right tone goals:

- tighter
- denser
- more technical
- less soft
- more operator-grade

What is missing is the explicit documentation of the **shell as a first-class system**.

If you want, I can draft the exact markdown additions for both files so you can paste them in directly.
