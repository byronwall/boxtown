# spatial-map.css Refactor Review

## Goal

Move common style decisions out of `app/src/components/spatial-map/spatial-map.css` and into the existing component system: Panda recipes, shared UI wrappers, and small spatial-map-specific wrapper components where the style is domain-specific.

The current stylesheet is 4,342 lines and mixes four kinds of styles:

- Spatial layout and canvas mechanics that should stay close to the spatial map.
- Reusable control styling already covered by `Button`, `IconButton`, `Input`, `Textarea`, `Dialog`, `Menu`, `Badge`, `Card`, `SegmentGroup`, and `Table` recipes.
- Domain tokens for node types, status colors, panel surfaces, and selected/current states.
- Late override blocks that restyle earlier rules, often with `!important`.

The safest first migrations are the repeated UI-control patterns that do not participate in SVG scaling, canvas transforms, or spatial layout math.

## Highest-Value, Lowest-Risk Migration Areas

### 1. Buttons, Icon Buttons, Toggle Buttons, and Control Groups

**Why first:** These selectors are used heavily and mostly duplicate the existing `button` recipe. Migrating them should reduce `!important` usage without changing spatial map layout behavior.

**CSS clusters:**

- `.spatial-map-button`, `.spatial-map-button--strong`, `.spatial-map-button--danger`, `.spatial-map-icon-button`: `spatial-map.css` lines 405-451 and 3814-3849.
- `.spatial-map-toggle-group`, `.spatial-map-toggle-button`, `.spatial-map-depth-button`, `.spatial-map-viewport-button`, active states: lines 389-403, 695-720, and 3851-3873.
- `.spatial-map-grid-mode-button`, `.spatial-map-grid-metadata-toggle`: lines 959-1042.
- `.spatial-map-inspector-toggle`, `.spatial-map-isolation-clear`: lines 2459-2507.

**Primary call sites:**

- `SpatialMapToolbar.tsx`
- `SpatialMapScene.tsx`
- `SpatialMapInspector.tsx`
- `SpatialMapGridView.tsx`
- `ProjectMetadataSettingsDialog.tsx`
- `SpatialMapDeleteNodeControl.tsx`
- flow rails under `add-nodes-flow/`, `source-decomposition-flow/`, and `context-note-conversion-flow/`

**Migration path:**

1. Add recipe variants instead of route-local classes:
   - `button.variant`: add `danger` if the app needs a first-class destructive style.
   - `button.size`: existing `2xs`/`xs` already map well to 24-30px controls.
   - Consider `button.visual = "spatial"` only if the mono, compact, panel-integrated look must remain isolated from global buttons.
2. Replace `class="spatial-map-button spatial-map-icon-button"` with `IconButton size="xs"` or `Button size="xs"` plus normal props.
3. Replace `.is-active` button styles with recipe `_on` / `aria-pressed` state where possible.
4. Replace ad-hoc grouped toggle markup with `SegmentGroup` for view/depth/mode controls where the value is mutually exclusive.
5. Keep only positional wrappers in CSS, for example viewport controls being absolute in the canvas corner.

**Expected CSS reduction:** roughly 180-260 lines after the component call sites are updated.

**Breakage risk:** Low. These are HTML controls, already mostly using shared `Button`; the main risk is small visual changes from recipe sizing.

### 2. Inputs and Textareas

**Why next:** The input overrides are repetitive and rely on `!important` to fight recipe output. Shared `Input` and `Textarea` already exist and support variant/size props.

**CSS clusters:**

- `.spatial-map-settings-input`, `.spatial-map-settings-textarea`: lines 551-568.
- `.spatial-map-metadata-input`: lines 650-660.
- `.spatial-map-context-textarea`, `.spatial-map-add-nodes-textarea`: lines 2806-2820.
- Shared late override block: lines 4103-4125.
- Command input overrides: lines 4164-4174.
- Grid search input: lines 894-957.

**Primary call sites:**

- `ProjectMetadataSettingsDialog.tsx`
- `SpatialMapCommandMenu.tsx`
- `SpatialMapGridView.tsx`
- `SpatialMapInspector.tsx`
- flow rail components

**Migration path:**

1. Add a compact recipe variant to `input` and `textarea`, or use existing `size="sm"`/`variant="surface"` where visually acceptable.
2. Use `Input` for grid search and command search rather than styling raw `input`.
3. Use `Textarea autoResize={false}` for fixed/resizable spatial textareas.
4. Keep only layout-specific CSS: grid cell sizing, hidden file inputs, and textarea min-height variants if they are domain-specific.

**Expected CSS reduction:** roughly 120-180 lines.

**Breakage risk:** Low. These are isolated form controls. Watch for auto-resize behavior in `Textarea`, because the wrapper defaults `autoResize` to true.

### 3. Chips, Badges, Status Indicators, and Metadata Pills

**Why high value:** The stylesheet defines several chip systems with similar dimensions, borders, type, and selected/current treatments. These are good recipe candidates because the same visual language appears in tree meta, grid meta, inspector chips, image viewer meta, command result type, status chips, and node status labels.

**CSS clusters:**

- `.spatial-map-status-chip`, status variables: lines 2065-2119.
- `.spatial-map-tree-node-meta > span`: lines 2045-2064 and 3970-3999.
- `.spatial-map-inspector-chip`: lines 2641-2670 and 4058-4077.
- `.spatial-map-grid-node-meta span`, `.spatial-map-grid-link-chip`, `.spatial-map-grid-data-chip`, `.spatial-map-grid-metadata-chip`: lines 1358-1429.
- `.spatial-map-image-viewer-meta span`: lines 3181-3198 and 3970-3983.
- `.spatial-map-command-result-type`: lines 4225-4234.
- `.spatial-map-tree-toc-type`: lines 1660-1674.

**Primary call sites:**

- `SpatialMapNodeStatusMenu.tsx`
- `SpatialMapScene.tsx`
- `SpatialMapTreeView.tsx`
- `SpatialMapInspector.tsx`
- `SpatialMapGridView.tsx`
- `SpatialMapImages.tsx`
- `SpatialMapCommandMenu.tsx`

**Migration path:**

1. Start by using the existing `Badge` wrapper for non-interactive chips.
2. Add status/type-specific variants only where plain `colorPalette` cannot express the current domain colors.
3. Use `data-status` / `data-node-type` attributes and one status/type recipe rather than parallel classes like `.spatial-map-status-chip--blocked` and `.spatial-map-node-status--blocked`.
4. Keep SVG status marker geometry in CSS or component code; migrate only color token decisions first.

**Expected CSS reduction:** roughly 200-300 lines once status/type/meta chips converge.

**Breakage risk:** Low to medium. HTML chips are low risk. SVG node status labels are more sensitive because they are inside the scaled canvas.

### 4. Dialog Shells and Dialog Sizes

**Why high value:** The spatial map dialog overrides repeat much of `dialog` recipe styling, and the existing global dialog recipe already includes the same backdrop, panel surface, shadows, header/body/footer slots, and close trigger language.

**CSS clusters:**

- `.spatial-map-project-settings-dialog`: lines 459-493.
- `.spatial-map-context-dialog`: lines 2844-2849.
- `.spatial-map-image-viewer-dialog` and nested dialog body/header/backdrop/positioner overrides: lines 2876-2926 and 3054-3063.
- `.spatial-map-command-menu` and command dialog internals: lines 4127-4174.

**Primary call sites:**

- `ProjectMetadataSettingsDialog.tsx`
- `SpatialMapImages.tsx`
- `SourceImagePreview.tsx`
- `SpatialMapCommandMenu.tsx`
- context dialog components

**Migration path:**

1. Add explicit `dialog.size` variants for `spatialSettings`, `spatialImageViewer`, and `commandPalette`, or general sizes like `wide`, `workspace`, and `command`.
2. Move header/body/footer padding and overflow rules into dialog slot recipe variants.
3. Keep image viewer layout CSS in the image viewer module/component because it is content-specific.
4. Avoid `:has()` selectors that target dialog internals from the global spatial stylesheet when a recipe variant can express the same backdrop/positioner behavior.

**Expected CSS reduction:** roughly 150-220 lines.

**Breakage risk:** Medium. Dialog structure depends on Ark/Panda slots, but the current recipe is already close. Verify scroll locking and image viewer overflow after this migration.

### 5. Selectable Cards and Process Rows

**Why high value:** Relation cards, answer options, follow-up cards, run steps, candidate rows, source rows, and activity entries share the same panel-card skeleton and state treatment. These are good candidates for a small `spatialSelectableCard` recipe or a reusable component local to `spatial-map`.

**CSS clusters:**

- `.spatial-map-relation-card`: lines 3469-3500 and 4276-4308.
- `.spatial-map-answer-option`, `.spatial-map-follow-up-card`: lines 3325-3358 and 4276-4308.
- `.spatial-map-run-step`: lines 3360-3388 and 4276-4289.
- `.spatial-map-candidate-tree-row`: lines 3312-3324 and 3389-3398.
- `.spatial-map-source-file-row`: lines 3413-3418 and 4276-4289.
- `.spatial-map-activity-entry`, `.spatial-map-activity-body`, `.spatial-map-activity-chip`: lines 3501-3641.

**Primary call sites:**

- `SpatialMapInspector.tsx`
- `SpatialMapGenerateImageControl.tsx`
- `add-nodes-flow/AddNodesFlowRail.tsx`
- `context-note-conversion-flow/ContextNoteConversionRail.tsx`
- `source-decomposition-flow/SourceDecompositionRail.tsx`

**Migration path:**

1. Create a small spatial-map wrapper, for example `SpatialMapSelectableCard`, backed by a Panda recipe.
2. Variants to support first: `selected`, `interactive`, `tone = neutral | success | danger | active`, and `density = compact | normal`.
3. Use `Button` semantics for clickable cards when the element is an action; use `Card` or `Box` for static run steps.
4. Move the selected/current visual into the recipe and keep any flow-specific layout in the flow component.

**Expected CSS reduction:** roughly 200-260 lines.

**Breakage risk:** Low to medium. The visual states are straightforward, but element semantics vary between buttons, cards, checkbox rows, and activity actions.

## Areas to Defer

### Canvas SVG Nodes and Edges

Keep `.spatial-map-scene`, `.spatial-map-scene-layer`, `.spatial-map-node`, `.spatial-map-node-body`, `.spatial-map-edge`, and child SVG text/status geometry in CSS for now.

Reasons:

- The canvas is a scaled SVG scene with known flicker and rasterization risks.
- Existing project guidance explicitly says not to add filters, shadows, blur, or forced compositing hints to scaled scene layers or nodes.
- Node depth, type color, hover, selected, and isolation states use SVG-specific variables and geometry.

Safe later work:

- Move node type and status color tokens into theme tokens.
- Keep CSS variable assignment near the scene until the token mapping is stable.
- Do not replace SVG styling with generic card/button recipes.

### Tree Rail Geometry and Hierarchy Connectors

Keep tree rail/branch geometry local until the simpler control migrations are done.

Relevant selectors:

- `.spatial-map-tree-rails`, `.spatial-map-tree-rail`, `.spatial-map-grid-tree-gutter`, `.spatial-map-grid-tree-ancestor`, `.spatial-map-grid-tree-branch`, `.spatial-map-grid-tree-chevron`.

This styling is structural, not component-system styling. It depends on hierarchy depth and connector geometry.

### Large Layout Containers

Keep shell/stage/viewport layout in CSS or migrate only after component-level cleanup:

- `.spatial-map-shell`
- `.spatial-map-main`
- `.spatial-map-stage`
- `.spatial-map-topbar`
- `.spatial-map-viewport`
- `.spatial-map-tree-viewport`
- `.spatial-map-grid-viewport`
- `.spatial-map-inspector`

These are spatial-map layout primitives, not reusable UI atoms. They may eventually become local layout components, but they should not be forced into generic recipes.

## Cross-Cutting Cleanup Opportunities

### Collapse Late Override Blocks

The file defines many base rules early and then restyles them later, starting around line 3729. This makes it hard to know which declaration is canonical.

Before or during migration, pick one of these approaches:

- Move the late visual refresh declarations next to the original selectors.
- Or split the file into local modules by concern: `layout`, `controls`, `tree`, `grid`, `inspector`, `dialogs`, `canvas`.

The component-system migration will be easier if a selector has one canonical definition before it is removed.

### Replace `!important` With Recipe Ownership

Many `!important` declarations exist because route-local classes override Panda recipe output. After moving style decisions into the recipes, most of these should disappear.

Good first targets:

- Buttons and icon buttons.
- Inputs and textareas.
- Dialog sizing/overflow.
- Command palette input.
- Toggle active states.

### Tokenize Spatial Palette Decisions

The shell defines many `--spatial-map-*` colors inline, including panel surfaces, borders, copy colors, node type colors, and status colors. These should become theme tokens only after the first control migrations prove the intended visual language.

Recommended token groups:

- `spatial.panel.bg`, `spatial.panel.border`, `spatial.panel.borderStrong`
- `spatial.text.default`, `spatial.text.muted`, `spatial.text.dim`
- `spatial.accent.default`, `spatial.accent.strong`
- `spatial.nodeType.page|area|assembly|module|component|contract|standard|taxonomy|note`
- `spatial.status.planned|implemented|working|blocked|needsReview|deprecated`

### Prefer Existing Wrappers Before New Components

Use existing wrappers when they fit:

- `Button`, `IconButton`, `CloseButton`, `ClearButton`
- `Input`, `Textarea`
- `Badge`
- `Dialog`
- `Menu`
- `SegmentGroup`
- `Card`
- `Table`
- `HoverCard`

Create local spatial-map wrappers only when the style is reusable inside spatial map but too domain-specific for global UI.

## Suggested Migration Order

1. **Button/control recipe pass**
   - Add needed `button` variants/sizes.
   - Migrate `.spatial-map-button`, `.spatial-map-icon-button`, `.spatial-map-button--danger`, and active toggle states.
   - Keep absolute placement wrappers in CSS.

2. **Input/textarea recipe pass**
   - Use shared `Input`/`Textarea` with size/variant props.
   - Remove the shared `!important` focus and background override block.

3. **Badge/chip pass**
   - Convert HTML-only metadata/status/type chips to `Badge`.
   - Leave SVG node status geometry for later.

4. **Dialog recipe pass**
   - Add dialog size/intent variants for settings, image viewer, context, and command palette.
   - Move slot padding/overflow into the dialog recipe.

5. **Selectable-card wrapper pass**
   - Introduce a local recipe-backed component for relation cards, answer options, follow-up cards, run steps, candidate rows, and source rows.

6. **Table/grid pass**
   - Consider the shared `Table` recipe for grid table header/body/cell styling after controls and chips have been migrated.
   - Preserve table layout variables and tree-grid hierarchy geometry.

7. **Token pass**
   - Promote stable spatial colors and state tokens into the theme.
   - Keep SVG/canvas mechanics local.

## Acceptance Criteria

For each migration PR:

- Remove at least one selector family from `spatial-map.css`; do not just add recipes while leaving dead CSS behind.
- Prefer typed recipe variants over stringly class combinations.
- Avoid new `!important`.
- Keep canvas SVG node/edge rendering unchanged unless the PR is explicitly about canvas visuals.
- Verify by targeted code review and, only when the visual surface is risky, a small manual or browser check.

## First PR Recommendation

Start with the button/control recipe pass. It touches many call sites but has the least behavioral coupling:

- Existing code already uses shared `Button` in most places.
- The CSS is mostly visual overrides and active states.
- It removes a visible source of `!important`.
- It establishes the pattern for later input, badge, dialog, and card migrations.

Suggested scope:

- Add `danger` and, if necessary, `spatialCompact`/`spatialToolbar` variants to `button`.
- Replace `spatial-map-button--danger` and `spatial-map-icon-button` call-site classes with recipe props.
- Convert the view mode and grid mode controls to `SegmentGroup` where the control is mutually exclusive.
- Leave viewport absolute positioning, isolation readout layout, and canvas controls placement in CSS.
