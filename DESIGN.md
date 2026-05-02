---
version: alpha
name: Product Grid Industrial Drafting
description: "A dense, calm, industrial drafting interface for Product Grid Management: spatial product maps, metadata grids, inspector rails, AI workflow panels, markdown context, and image-backed architecture nodes."
colors:
  primary: "#143A29"
  primary-strong: "#0F2D20"
  primary-muted: "#5D8068"
  secondary: "#6D7472"
  tertiary: "#9B3A3A"
  neutral: "#F7F9F7"
  background: "#EAEEEA"
  surface: "#F7F9F7"
  surface-muted: "#EFF3EF"
  surface-raised: "#FFFFFF"
  surface-selected: "#D7E8D8"
  surface-panel: "#F3F6F2"
  grid-line: "#DDE2DC"
  border: "#B8C3BB"
  border-strong: "#8A968E"
  text: "#171B18"
  text-muted: "#5F6661"
  text-subtle: "#8A928B"
  text-inverse: "#FFFFFF"
  link-edge: "#B8C3BB"
  node-page: "#DCE9F4"
  node-region: "#CFE7C7"
  node-assembly: "#DCE8DC"
  node-component: "#F4F7F3"
  node-block: "#DDEBF0"
  node-note: "#F1EAD9"
  status-planned: "#EEF4EF"
  status-working: "#DDEBDD"
  status-done: "#D0E5D4"
  status-blocked: "#F2D4D4"
  focus: "#2E8C59"
  danger: "#9B3131"
  danger-surface: "#F8EAEA"
  shadow: "#18201826"
typography:
  headline-lg:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 22px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.02em
  headline-md:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 18px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: -0.01em
  title-sm:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: 0em
  body-md:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.55
    letterSpacing: 0em
  body-sm:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0em
  label-md:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.04em
  label-sm:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 10px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.12em
  node-title:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 16px
    fontWeight: 800
    lineHeight: 1.15
    letterSpacing: -0.03em
  node-meta:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 10px
    fontWeight: 500
    lineHeight: 1
    letterSpacing: 0em
  data-cell:
    fontFamily: "JetBrains Mono, IBM Plex Mono, ui-monospace, SFMono-Regular, Menlo, monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0em
rounded:
  none: 0px
  xs: 2px
  sm: 4px
  md: 6px
  lg: 8px
  xl: 12px
  full: 9999px
spacing:
  px: 1px
  hairline: 1px
  xxs: 2px
  xs: 4px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  2xl: 24px
  3xl: 32px
  canvas-grid: 24px
  toolbar-gap: 4px
  rail-width: 348px
  inspector-padding: 12px
  table-row-height: 41px
components:
  app-shell:
    backgroundColor: "{colors.background}"
    textColor: "{colors.text}"
    typography: "{typography.body-md}"
  top-toolbar:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.border}"
    rounded: "{rounded.lg}"
    padding: "10px"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.text-inverse}"
    borderColor: "{colors.primary-strong}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "8px"
  button-secondary:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.primary}"
    borderColor: "{colors.border}"
    typography: "{typography.label-md}"
    rounded: "{rounded.md}"
    height: "34px"
    padding: "8px"
  button-danger:
    backgroundColor: "{colors.danger-surface}"
    textColor: "{colors.danger}"
    borderColor: "#D9AAAA"
    rounded: "{rounded.md}"
    size: "28px"
  segmented-control:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.primary}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    typography: "{typography.label-md}"
  segmented-control-active:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.primary-strong}"
    borderColor: "{colors.primary-muted}"
  input:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    borderColor: "{colors.border}"
    rounded: "{rounded.xs}"
    typography: "{typography.body-sm}"
    height: "28px"
    padding: "8px"
  textarea:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.text}"
    borderColor: "{colors.border}"
    rounded: "{rounded.md}"
    typography: "{typography.body-md}"
    padding: "12px"
  table-header:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text-muted}"
    borderColor: "{colors.grid-line}"
    typography: "{typography.label-sm}"
  table-row-selected:
    backgroundColor: "{colors.surface-selected}"
    textColor: "{colors.text}"
  node-card:
    backgroundColor: "{colors.node-component}"
    textColor: "{colors.text}"
    borderColor: "{colors.border-strong}"
    rounded: "{rounded.none}"
    typography: "{typography.node-title}"
  node-card-selected:
    backgroundColor: "{colors.node-page}"
    borderColor: "{colors.primary-muted}"
  inspector-rail:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    borderColor: "{colors.border}"
    width: "348px"
    padding: "12px"
---

# Product Grid Industrial Drafting Design System

## Overview

Product Grid Management should feel like a drafting table for software architecture: technical, calm, spatial, precise, and intentionally dense. The interface is not decorative or consumer-playful. It is a working environment for mapping product ideas, UI architecture, system relationships, planning notes, markdown context, images, and AI-generated graph expansions.

The visual style observed in the screenshots is a soft industrial UI with pale green-gray surfaces, crisp hairline borders, grid-paper canvas texture, monospaced typography, small capsule labels, and low-shadow panels. It should feel like an engineering notebook merged with a graph editor.

Design goals:

- Preserve high information density without letting the page feel noisy.
  - Use muted surfaces, compact spacing, and strict alignment.
  - Rely on labels, indentation, grid lines, and panels instead of large whitespace.
- Make hierarchy visible everywhere.
  - Canvas nodes use size, placement, opacity, and relationship lines.
  - Metadata rows use indentation, tree elbows, disclosure controls, and selected-row highlighting.
- Keep the selected node unmistakable.
  - The selected object should synchronize across canvas, metadata grid, tree/document view, and inspector rail.
  - Use pale green selected backgrounds in tables and stronger node fills on canvas.
- Treat AI workflows as native workspace tools.
  - Create-menu actions, workflow rails, candidate review states, progress steps, and generated nodes should use the same industrial control language.
- Prefer legibility over polish.
  - Text is monospaced, labels are compact, controls are square-ish, and most depth comes from borders and tonal changes.

## Colors

The palette is built from muted industrial greens, warm white-gray surfaces, blueprint-like node tints, and restrained red for destructive actions.

- **Primary / Forest Ink (`#143A29`)**
  - Used for active controls, important icons, tab text, selected borders, and high-emphasis action states.
  - Should read as green-black, not bright green.
- **Background / Green Drafting Paper (`#EAEEEA`)**
  - Used behind the workspace and inside canvas areas.
  - Should be lightly gridded or tonally layered to create a workbench feel.
- **Surface / Chalk White (`#F7F9F7`)**
  - Used for cards, rails, toolbar panels, table bodies, popovers, and form panels.
- **Selected / Pale Moss (`#D7E8D8`)**
  - Used for selected table rows, active segmented buttons, selected chips, and node-focus backgrounds.
- **Border / Oxidized Steel (`#B8C3BB`)**
  - Used for most component outlines.
  - Combine with a stronger border (`#8A968E`) for important containers and active canvas nodes.
- **Text / Near Black (`#171B18`)**
  - Used for primary content, node labels, table titles, and inspector text.
- **Muted Text (`#5F6661`)**
  - Used for metadata, secondary labels, type captions, and helper text.
- **Danger / Muted Red (`#9B3131`)**
  - Used only for destructive actions such as delete buttons and trash icons.
  - Always pair with a pale red surface for small icon buttons.

Node type colors should stay muted and low-saturation:

- **Page nodes:** pale blueprint blue (`#DCE9F4`).
- **Region nodes:** pale structural green (`#CFE7C7`).
- **Assembly nodes:** gray-green (`#DCE8DC`).
- **Component nodes:** near-white green (`#F4F7F3`).
- **Block nodes:** pale blue-gray (`#DDEBF0`).
- **Note/context nodes:** warm paper tan (`#F1EAD9`).

Status colors should be quieter than type colors. Status is a work-tracking overlay, not the primary visual identity.

- **Planned:** off-white green.
- **Working:** slightly stronger green.
- **Done:** calm completed green.
- **Blocked:** pale red.

## Typography

The product should use a monospaced technical typeface across the application. The screenshots read as a code-oriented UI, so a stack such as `JetBrains Mono`, `IBM Plex Mono`, and system monospace is appropriate.

Type should be compact and sharp:

- **Headlines**
  - Use 18-22px, bold, tight tracking.
  - Project titles such as “Recipe Architecture Grid” should feel like a technical document title.
- **Panel and section titles**
  - Use 14px bold.
  - Examples: “Metadata grid”, “Images”, “Metadata”, “Context”.
- **Body and inspector text**
  - Use 12-13px regular with comfortable line height.
  - Inspector text areas can use 16px monospace for editability when content is long.
- **Table cells**
  - Use 12px monospaced body text.
  - Ellipsize long purpose and implementation copy.
- **Labels and metadata pills**
  - Use 10-12px bold monospaced text.
  - Letter spacing can increase slightly for table headers and section labels.
- **Node labels**
  - Use bold 14-18px monospaced text depending on node size and hierarchy depth.
  - Wrap labels within SVG/card bounds rather than truncating primary node names.

Avoid mixed typographic personalities. Do not introduce a proportional marketing font into the workspace UI unless it is isolated to a public landing page.

## Layout

The layout is a three-part workbench:

- **Top project toolbar**
  - Contains back navigation, project title, settings, color/type/status mode controls, create/actions controls, view switches, and depth controls.
  - It sits inside a rounded panel with a thin border and muted surface.
- **Primary workspace**
  - Occupies the center/left.
  - Switches between canvas, tree/document, and metadata grid views.
  - In canvas mode, it uses a large gridded plane with visible fit/zoom controls in the lower-right.
  - In metadata grid mode, it uses a dense table with column controls, search, node/link toggle, and row actions.
- **Inspector rail**
  - Fixed on the right at roughly 348px wide.
  - Shows selected-node title, status/type/id controls, action buttons, images, metadata, and context.
  - Uses stacked bordered panels with compact section headers.

Spacing rules:

- Use a 4px micro-grid with 8px as the default control rhythm.
- Use 12px internal padding for inspector panels and toolbar groups.
- Use 16px only when separating larger regions.
- Use 24px canvas grid spacing for the background drafting grid.
- Table rows should be compact, roughly 40-42px high.
- Controls in toolbar groups should visually attach through tight gaps, usually 4px.

Alignment rules:

- Keep all toolbar controls vertically centered.
- Keep metadata table column boundaries visible and aligned with headers.
- Indentation in tree rows should be structural, not decorative.
- Canvas nodes can be spatially arranged, but node interiors should be rigidly aligned.

Responsive behavior:

- Preserve the inspector rail on desktop.
- Allow the rail to collapse when viewport width becomes constrained.
- Let the center workspace shrink before shrinking table font size.
- Metadata tables should scroll horizontally rather than losing columns.
- Canvas fit controls should remain pinned and readable.

## Elevation & Depth

Depth should be created with tonal layers, borders, and opacity rather than heavy shadows.

Use elevation sparingly:

- **Base layer:** green-gray app background.
- **Canvas layer:** pale grid plane with subtle vertical and horizontal grid lines.
- **Panel layer:** near-white surface with 1px border.
- **Raised overlay:** popovers and menus may use a small shadow plus a stronger border.
- **Selected layer:** selected rows and active controls use pale moss fills.
- **Focus layer:** selected canvas nodes use stronger borders and clearer fills.

Shadow guidance:

- Default panels: no visible shadow.
- Popovers, menus, dialogs: use a small soft shadow like `0 8px 24px #18201826`.
- Avoid modern glossy card shadows. They conflict with the drafting-table style.

Opacity guidance for focus states:

- When a node is focused or isolated, unrelated canvas nodes may fade heavily.
- Keep their labels barely readable as spatial context.
- Relationship lines should be quiet until explicitly enabled or in a focus neighborhood.

## Shapes

The shape language is rectilinear and engineered.

- **Canvas nodes**
  - Use square corners or nearly square corners.
  - Rectangles are preferred over pill shapes.
  - Node shape should emphasize architecture blocks and diagram objects.
- **Panels and toolbar containers**
  - Use modest 8-12px radii.
  - The outer app frame can be slightly rounder than internal controls.
- **Buttons, inputs, and selects**
  - Use 4-6px radii.
  - Controls should feel precise and compact.
- **Pills and tags**
  - Use 2-4px radii for metadata chips.
  - Avoid fully rounded consumer-style badges except for tiny status dots or icon bubbles.
- **Destructive buttons**
  - Use small rounded-square icon buttons.
  - Keep them compact and visually separated from primary creation actions.

## Components

### App shell

- Use the green-gray background as the global canvas behind everything.
- Put the app inside a thin bordered frame when the viewport allows it.
- The frame should feel like a contained desktop tool, not a full-bleed website.

### Project toolbar

- Use a large rounded container with surface fill and thin border.
- Left section:
  - Back link outside or above the main frame.
  - Project title in bold monospace.
  - Settings icon as a small bordered square.
- Middle section:
  - Segmented mode controls for Color / Type / Status.
  - Active mode uses pale moss fill and stronger border.
- Right section:
  - Create button, action menu, layout/reflow button.
  - View switch: Canvas / Tree / Grid.
  - Depth controls: 1 / 2 / 3 / Max.

### Segmented controls

- Use compact rectangular tabs.
- Active item:
  - Pale moss background.
  - Dark green text.
  - Strong green border.
- Inactive item:
  - Near-white or muted surface.
  - Dark text or dark green text depending on context.
- Keep spacing tight enough to read as one grouped control.

### Create and action menu

- The create menu is a simple raised popover below the toolbar action.
- Menu surface should be near-white with a subtle shadow.
- Items are text-first, monospaced, and vertically compact.
- Expected items:
  - “Add Nodes”
  - “Decompose Source”
  - “New Context Node”
- Hover state should use pale moss or muted green surface.

### Canvas workspace

- Use a pale drafting-grid background.
- Grid lines should be subtle and regular, approximately 24px apart.
- Nodes are rectangular and type-tinted.
- Edges should be thin and muted by default.
- Fit/zoom controls should be pinned bottom-right inside a small segmented panel.
- Selected node should have clearer fill, stronger border, and remain above unrelated nodes.
- Isolated/focus mode may fade unrelated nodes to low opacity while preserving spatial context.

### Canvas nodes

- Include the node label as the dominant text.
- Include small metadata markers such as type below the label.
- Use tiny circular or icon-like markers sparingly for purpose/context indicators.
- Show image thumbnails inside nodes when available.
- Use node size to communicate hierarchy:
  - Larger pages and regions.
  - Medium assemblies.
  - Smaller components and blocks.
- Selected node should coordinate with the inspector and metadata grid selected state.

### Metadata grid

- Use a dense table with visible row and column boundaries.
- Header area includes:
  - Title and visible count.
  - Column toggles.
  - Filter input.
  - Nodes / Links switch.
- Rows preserve tree hierarchy through indentation, elbows, and disclosure icons.
- Selected row uses pale moss fill across the entire row.
- Columns shown in the screenshot:
  - Name
  - Type
  - Status
  - Purpose
  - Implementation
  - Image
  - Actions
- Long cells should truncate with ellipses.
- Type and status should be rendered as compact square-corner chips.
- Delete actions use red icon buttons aligned to the right.

### Inspector rail

- The right rail is a persistent details panel for the selected node.
- Top area:
  - Node title on the left.
  - Collapse/expand button on the right.
  - Status select, ID pill, type select, and context-mode pill.
  - Delete and AI/mockup actions as compact icon buttons.
- Section panels:
  - Use a subtle surface fill and thin border.
  - Section labels are small, bold, and monospaced.
  - Primary section action buttons sit at the top-right.
- Metadata fields:
  - Use labels above textareas.
  - Textareas are tall enough for multi-line notes.
  - Save button uses disabled gray when no changes are pending.
- Context preview/editing:
  - Context cards should support expand and edit actions.
  - Long markdown should scroll within the rail or open in a larger dialog.

### Images panel

- Use a bordered drop zone with dashed internal rectangle.
- Empty state should remain very quiet.
- Thumbnails in nodes, table rows, and rail panels should keep their original aspect ratio.
- Image borders should be thin and neutral.

### Forms and inputs

- Inputs use white surfaces, thin borders, monospaced text, and compact height.
- Textareas use the same border language but larger internal padding.
- Focus state should use a green outline or border, not a bright glow.
- Placeholder text should be muted and monospaced.

### Selects and pills

- Select controls are compact, bordered, and rectangular.
- ID and mode values can be pill-like but should retain squared industrial geometry.
- Pills should not dominate the rail; they provide metadata, not primary actions.

### Buttons

- Primary creation or confirmation buttons use dark forest green with white text.
- Secondary buttons use surface fill with green text and green/gray borders.
- Utility icon buttons use a white or pale green surface.
- Destructive icon buttons use pale red surfaces with red outlines/icons.
- Disabled buttons use neutral gray fills and low contrast text.

### Dialogs and popovers

- Use the same surface, border, and monospaced typography as the rest of the app.
- Popovers can have slightly stronger depth than panels.
- Dialogs should remain compact and task-oriented.
- Do not introduce large marketing-style modal headers.

### AI workflow rails

- Workflow rails should look like extensions of the inspector rail.
- Use step-by-step progress rows with compact status indicators.
- Candidate trees should reuse hierarchy indentation and selected-row behaviors from the metadata grid.
- Generated candidates should use type-tinted node colors and standard metadata chips.
- Review/commit actions should use primary green only for the final accepted action.

### Markdown renderer

- Markdown preview should preserve the technical workspace style.
- Use monospaced body text unless readability clearly suffers for long prose.
- Code blocks should be bordered and lightly tinted.
- Tables should reuse metadata-grid border and header styling.
- Mermaid diagrams should use the same muted palette where possible.

## Do's and Don'ts

Do:

- Use pale green-gray surfaces and crisp borders as the main visual language.
- Keep the interface dense, aligned, and technical.
- Use monospaced typography consistently.
- Use the selected-node state across canvas, grid, tree, and inspector.
- Use muted type colors for nodes and stronger green only for active controls.
- Use table indentation and canvas proximity to communicate hierarchy.
- Keep create, decomposition, and AI workflows visually integrated with the core app.
- Prefer 1px borders, small labels, and tonal grouping over heavy shadows.

Don't:

- Do not use bright saturated greens, blues, or reds.
- Do not introduce large rounded cards or consumer SaaS styling.
- Do not rely on shadows for primary hierarchy.
- Do not make destructive actions visually equal to creation actions.
- Do not hide the structural tree cues in metadata rows.
- Do not make canvas edges overly prominent by default.
- Do not mix in decorative fonts, gradients, glassmorphism, or glossy effects.
- Do not expand spacing so much that the tool loses its dense architecture-workbench feel.

## Screenshot-Derived Details

These details were inferred directly from the provided metadata-grid and create-menu screenshots.

- The app frame has a subtle green-gray background and a large bordered content container.
- The top toolbar is a rounded white-green panel with compact grouped controls.
- View switching uses three tabs: Canvas, Tree, and Grid.
- Depth filtering uses small adjacent buttons: 1, 2, 3, Max.
- The metadata grid shows approximately 50 visible nodes and supports column toggles, search, and Nodes/Links modes.
- Tree structure inside the grid is represented with indentation, elbows, disclosure indicators, and selected-row fill.
- The inspector rail remains visible in both canvas and grid views and shows the selected “Nav Tabs” node.
- The selected node row in the grid is filled pale green.
- The canvas view uses a fine grid background and faded surrounding nodes when a cluster is focused.
- The create menu is a compact popover with Add Nodes, Decompose Source, and New Context Node actions.
- The inspector metadata section includes editable Purpose and Implementation textareas and a Save Metadata button.
- The images section has a quiet dashed drop target.
- Destructive actions are represented by small red trash icon buttons.

## Implementation Notes

This design system maps cleanly to Panda CSS tokens, recipes, layer styles, and text styles.

Suggested implementation approach:

- Create semantic color tokens first, then alias node type and status colors.
- Use component recipes for buttons, segmented controls, inspector panels, table rows, node cards, and icon buttons.
- Keep canvas SVG styling token-driven but allow graph logic to determine opacity, scale, and focus states.
- Build metadata-grid row styling around data attributes such as `data-selected`, `data-depth`, `data-expanded`, and `data-has-image`.
- Build inspector sections as reusable panel components with `title`, `actions`, and `children` slots.
- Treat menu, popover, select, and dialog primitives as a single overlay family with shared border, shadow, and typography tokens.
