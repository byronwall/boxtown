---
version: alpha
name: Product Grid Industrial Drafting
description: "A dense, calm, industrial drafting interface for Product Grid Management: an olive index surface, contained workspace shells, spatial product maps, metadata grids, inspector rails, AI workflow panels, markdown context, and image-backed architecture nodes."
colors:
  primary: "#143A29"
  primary-strong: "#0F2D20"
  primary-muted: "#5D8068"
  operational-green: "#30A46C"
  secondary: "#6D7472"
  tertiary: "#9B3A3A"
  olive-1: "#FCFDFC"
  olive-2: "#F8FAF8"
  olive-3: "#EFF1EF"
  olive-4: "#E7E9E7"
  olive-6: "#D7DAD7"
  olive-7: "#CCCFCC"
  olive-8: "#B9BCB8"
  olive-11: "#60655F"
  olive-12: "#1D211C"
  neutral: "#F7F9F7"
  background: "#EAEEEA"
  surface: "#F7F9F7"
  surface-shell: "rgba(252,253,252,0.94)"
  surface-header: "rgba(248,250,248,0.90)"
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
  app-headline-lg:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 30px
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: 0em
  app-body-md:
    fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: 0em
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
    typography: "{typography.app-body-md}"
  spatial-workspace:
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

This document reconciles the broader product design direction with the existing `docs/design-language-index-surface.md` language. The index-surface doc is now treated as the baseline for page fields, app shells, token usage, modal treatment, and restrained interaction states because the current index page, drawer/dialog recipes, console log capture shell, and several spatial-map dialogs clearly follow it. The denser spatial-map workspace keeps the more technical drafting-table rules where the existing site already uses them.

The visual style observed in the implemented site is a soft industrial UI with muted olive page fields, near-white translucent shells, crisp hairline borders, subtle grid texture, technical metadata typography, compact labels, and low-shadow panels. It should feel like an engineering notebook merged with a graph editor, not like a marketing SaaS dashboard.

Use this document as the cleanup target for the repo. When existing code diverges, prefer the rule that is already working in the strongest implemented surfaces:

- **Index surface baseline:** page background, outer shell, left creation/import rail, right data list, modal backdrop language, token-led olive surfaces, compact chips, restrained green focus/active states.
- **Spatial map drafting baseline:** canvas nodes, metadata grid, tree view, inspector rail, AI workflow rails, image tools, and project settings dialogs.
- **Shared cleanup direction:** converge custom spatial-map colors toward Panda olive/green/red/blue/amber tokens without losing the denser drafting feel.

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
  - Workspace text can be monospaced where density and technical scanning matter.
  - Index and general app surfaces may use the standard Panda heading/body stack, with mono reserved for ids, counts, filenames, metadata, shortcuts, and code-like values.
  - Labels are compact, controls are square-ish, and most depth comes from borders and tonal changes.

## Relationship to the Index Surface

The index page is the clearest completed reference for the general product surface. Carry these rules forward anywhere the app renders a page-level layout, modal, drawer, shell, or non-canvas management view:

- Use the olive/gray Panda token family for major surfaces: `olive.1`, `olive.2`, `olive.3`, `olive.4`, `olive.6`, `olive.7`, and `olive.8`.
- Use near-white translucent shells such as `rgba(252,253,252,0.94)` over muted olive fields.
- Use green as an operational accent only: primary actions, active controls, focus rings, selected states, and occasional row hover markers.
- Avoid pure black app surfaces, black modal stages, bright white full-page fields, glossy cards, and high-contrast black/white UI.
- Use one strong outer shell for page-level tools: `olive.8` border, `l3` radius, near-white translucent fill, large tinted shadow, subtle white outline, and inset top highlight.
- Use interior bands, rails, list rows, and framed tool surfaces instead of nested decorative cards.
- Selected menu/list states should use restrained fill plus text weight/color. Do not add decorative side bars, inset stripes, or rail markers for ordinary selected/current states.

Where the spatial-map workspace currently uses sharper zero-radius controls, full mono typography, or custom CSS variables, treat that as a specialized drafting mode. New shared UI and cleanup work should bias back toward index-surface tokens and small radii unless the component is explicitly part of the scaled SVG/canvas or metadata-grid drafting surface.

## Colors

The palette is built from Panda olive/gray tokens, muted industrial greens, warm near-white surfaces, blueprint-like node tints, and restrained red for destructive actions. In implementation, prefer token references over hard-coded hex values whenever possible.

### Canonical token families

- **Olive surface tokens**
  - Use `olive.4` as the page field/base background for index-like surfaces.
  - Use `olive.1`, `olive.2`, and `olive.3` for interior panels, list rows, rails, and work-area bands.
  - Use `olive.6`, `olive.7`, and `olive.8` for borders, with `olive.8` reserved for outer shells and stronger containers.
  - Use `olive.11` and `olive.12` for muted and primary text when using Panda semantic tokens.
- **Shell surface (`rgba(252,253,252,0.94)`)**
  - Used for the main index-page shell and should become the default page-level shell surface.
  - Pair with a larger tinted shadow, subtle white outline, and inset highlight.
- **Header band (`rgba(248,250,248,0.90)`)**
  - Used for shell headers, modal headers, drawer headers, and management-surface title bands.
- **Operational green (`green.9` / `#30A46C`)**
  - Use for primary actions, focus rings, active controls, and selected/focused state accents.
  - Do not use green as a broad decorative wash when olive tokens can provide structure.

### Semantic working colors

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

Cleanup guidance:

- Convert page-level and overlay surfaces toward Panda `olive.*` tokens before inventing new hex values.
- Keep hard-coded rgba values only where the translucency is part of the shell/grid effect and no semantic token exists yet.
- Keep the spatial-map CSS variable palette temporarily, but align new values with olive/green/red/blue/amber tokens as the module is cleaned up.
- Avoid broad dark or black surfaces except for true media-inspection needs.

Node type colors should stay muted and low-saturation:

- **Page nodes:** pale blueprint blue (`#DCE9F4`).
- **Region nodes:** pale structural green (`#CFE7C7`).
- **Assembly nodes:** gray-green (`#DCE8DC`).
- **Component nodes:** near-white green (`#F4F7F3`).
- **Block nodes:** pale blue-gray (`#DDEBF0`).
- **Note/context nodes:** warm paper tan (`#F1EAD9`).

Current implementation note: the spatial map currently maps page/area to blue, assembly/module to green, component/contract/standard to neutral, taxonomy to steel, and note to amber. Treat those as the live taxonomy until a dedicated node-type token set is created.

Status colors should be quieter than type colors. Status is a work-tracking overlay, not the primary visual identity.

- **Planned:** off-white green.
- **Working:** slightly stronger green.
- **Done:** calm completed green.
- **Blocked:** pale red.

## Typography

The product should use a technical typography system, but it should not force every surface into monospace. The implemented index surface uses standard Panda heading/body styles for approachable management copy and reserves the mono stack for ids, counts, file details, and technical metadata. The spatial-map workspace currently uses full monospace and can keep that stronger drafting character.

Recommended stack split:

- **General app/index surfaces**
  - Use existing Panda `Heading`, `Text`, and `textStyle` tokens.
  - Keep headings heavy, direct, and tight.
  - Use muted text for helper copy and descriptions.
  - Use monospaced text for project ids, file names, counts, metadata chips, keyboard shortcuts, command labels, code, and structured values.
- **Spatial-map workspace**
  - Use the project mono stack across toolbar, grid, tree, inspector, canvas labels, and AI workflow rails.
  - Current stack: `IBM Plex Mono`, `SFMono-Regular`, `SF Mono`, `Roboto Mono`, `Consolas`, `Liberation Mono`, monospace.
- **Markdown/prose surfaces**
  - Use monospace for code, metadata, tables, ids, and diagram labels.
  - Long-form prose can use the standard readable body stack when a full-mono preview hurts scanning.

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

Avoid mixed typographic personalities. The acceptable split is standard Panda app typography for broad management surfaces and mono for technical/drafting surfaces. Do not introduce a decorative proportional marketing font into the workspace UI.

## Layout

The product has two related layout families: the index/management surface and the spatial workbench.

### Index and management surfaces

Use the current project index page as the baseline:

- Page field:
  - `minH="100dvh"` with `olive.4` base.
  - Layered background with low-opacity radial green/olive washes, a subtle 40px grid, and a light vertical wash.
  - Keep the grid quiet enough that text reads only on opaque or near-opaque panels.
- Outer shell:
  - Constrain to a wide container, currently `maxW="7xl"` with responsive padding.
  - Use one strong shell with `olive.8` border, `l3` radius, near-white translucent fill, and layered shadow.
  - The shell should feel like a contained desktop tool.
- Interior layout:
  - Prefer a two-column work layout when the page has setup/actions plus primary data.
  - Left rail contains creation, import, setup, filters, or project controls.
  - Right side contains primary data lists, tables, grids, or previews.
  - Separate sections with border lines and background shifts, not decorative nested cards.
- Density:
  - Keep rows moderate and scannable.
  - Avoid marketing-style oversized cards, oversized empty states, and decorative hero composition inside authenticated app surfaces.

### Spatial workbench

The spatial-map project page is a three-part workbench:

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

- Index/management surfaces should stack the left rail above the primary data area on small screens.
- Page-level shells should retain useful padding and avoid clipping controls on mobile.
- Preserve the inspector rail on desktop.
- Allow the rail to collapse when viewport width becomes constrained.
- Let the center workspace shrink before shrinking table font size.
- Metadata tables should scroll horizontally rather than losing columns.
- Canvas fit controls should remain pinned and readable.

## Elevation & Depth

Depth should be created with tonal layers, borders, and opacity rather than heavy shadows.

Use elevation sparingly:

- **Page field:** olive base with soft radial washes, quiet grid texture, and vertical wash.
- **Outer shell:** near-white translucent frame with strong olive boundary and layered shadow.
- **Base workspace layer:** green-gray app background.
- **Canvas layer:** pale grid plane with subtle vertical and horizontal grid lines.
- **Panel layer:** near-white surface with 1px border.
- **Raised overlay:** popovers and menus may use a small shadow plus a stronger border.
- **Selected layer:** selected rows and active controls use pale moss fills.
- **Focus layer:** selected canvas nodes use stronger borders and clearer fills.

Shadow guidance:

- Page-level shells: may use the index-surface shadow pattern, currently `0 28px 70px rgba(29,33,28,0.2)`, a subtle white outline, and inset top highlight.
- Default interior panels: no visible shadow.
- Popovers, menus, dialogs: use a small soft shadow like `0 8px 24px #18201826`.
- Avoid modern glossy card shadows. They conflict with the drafting-table style.
- Dialogs and drawers can use the stronger shell shadow when they are page-like tools rather than tiny menus.

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
  - Use modest radii.
  - Page-level outer shells use `l3`.
  - Interior containers usually use `l1`/`l2`.
  - Spatial-map toolbar/canvas containers may stay sharper when matching the drafting surface.
  - The outer app frame can be slightly rounder than internal controls.
- **Buttons, inputs, and selects**
  - Use small radii (`l1`/`l2`, roughly 4-6px) on shared app surfaces.
  - Spatial-map module controls currently use zero-radius square buttons; keep only where it reinforces the dense drafting mode.
  - Controls should feel precise and compact.
- **Pills and tags**
  - Use 2-4px radii for metadata chips.
  - Avoid fully rounded consumer-style badges except for tiny status dots or icon bubbles.
- **Destructive buttons**
  - Use small rounded-square icon buttons.
  - Keep them compact and visually separated from primary creation actions.

## Components

### App shell

- Use the olive/green-gray background as the global page field behind everything.
- For page-level management surfaces, use the index-surface shell:
  - `olive.4` page base.
  - subtle radial washes.
  - 40px low-opacity grid.
  - `maxW="7xl"` constrained content.
  - `olive.8` shell border.
  - `rgba(252,253,252,0.94)` shell fill.
  - `l3` shell radius.
  - large tinted shadow, white outline, and inset highlight.
- For full-workbench tools such as the spatial map, the app may fill the viewport but should still feel bounded by topbar, stage, and rail borders.
- The frame should feel like a contained desktop tool, not a full-bleed website or marketing page.

### Index surface

The index page is the reference implementation for app-level management screens.

- Header band:
  - Slightly brighter/translucent than the work area.
  - Contains direct heading, concise helper copy, and compact summary stats.
  - Summary stats use bordered `olive.1`/`olive.2` capsules with tabular numbers.
- Left rail:
  - Contains create/import/setup actions.
  - Uses `olive.2` and `olive.1` bands with `olive.7` borders.
  - Form controls use small radii and compact heights.
- Primary data area:
  - Uses list rows or tables over `olive.1`.
  - Rows separate with `olive.6`/`olive.7` borders.
  - Row hover may lift with `olive.2` and a restrained green marker only when the row is actionable.
  - Project ids and technical details use mono; headings/body copy can use standard Panda typography.
- Empty states:
  - Keep them compact and useful.
  - Do not introduce illustration-heavy hero panels.

### Project toolbar

- Use a prominent bordered toolbar container with muted surface fill.
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
  - Stronger green/olive border or a subtle bottom inset when the control is already built as a connected segmented group.
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

- Inputs use white or near-white surfaces, thin borders, and compact height.
- Spatial-map inputs should usually inherit the mono workspace stack.
- Index/management forms may use standard Panda body typography while preserving mono for ids and structured values.
- Textareas use the same border language but larger internal padding.
- Focus state should use a green outline or border, not a bright glow.
- Placeholder text should be muted.

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

- Use the same surface, border, and typography split as the rest of the app: standard Panda text for management dialogs, mono for spatial-map/tooling dialogs and technical values.
- Popovers can have slightly stronger depth than panels.
- Dialogs should remain compact and task-oriented.
- Do not introduce large marketing-style modal headers.
- Modal/dialog treatment should inherit the index-surface language:
  - Avoid black stage/backdrop treatment unless the content is truly a dark media-inspection mode.
  - Use a warm olive/grid field behind large dialog content when the dialog behaves like a tool.
  - Use a near-white shell, strong olive boundary shadow, compact header band, and token-aligned controls.
  - Active thumbnails, focus rings, and selected controls use green accents.
  - Project settings, image viewer tools, drawers, and console capture panels should converge on this family.

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

- Use the index page as the baseline for page fields, shells, management layouts, drawers, and dialogs.
- Use Panda `olive.*` tokens for major surfaces and borders.
- Use green as an operational accent, not a decorative theme wash.
- Use pale green-gray surfaces and crisp borders as the main visual language.
- Keep the interface dense, aligned, and technical.
- Use monospaced typography consistently inside the spatial-map workspace and for technical metadata elsewhere.
- Use standard Panda heading/body typography for index-like management surfaces when it improves readability.
- Use the selected-node state across canvas, grid, tree, and inspector.
- Use muted type colors for nodes and stronger green only for active controls.
- Use table indentation and canvas proximity to communicate hierarchy.
- Keep create, decomposition, and AI workflows visually integrated with the core app.
- Prefer 1px borders, small labels, and tonal grouping over heavy shadows.
- Prefer bands, rails, rows, and framed tool surfaces over decorative card stacks.

Don't:

- Do not use bright saturated greens, blues, or reds.
- Do not introduce large rounded cards or consumer SaaS styling.
- Do not rely on shadows for primary hierarchy.
- Do not make destructive actions visually equal to creation actions.
- Do not hide the structural tree cues in metadata rows.
- Do not make canvas edges overly prominent by default.
- Do not mix in decorative fonts, gradients, glassmorphism, or glossy effects.
- Do not expand spacing so much that the tool loses its dense architecture-workbench feel.
- Do not add decorative left/right accent bars, inset side borders, or stripe markers for ordinary selected/current states.
- Do not use black app surfaces or black modal stages unless the interaction is explicitly media inspection.

## Site-Derived Details

These details are derived from the existing index surface, theme tokens, spatial-map workspace, metadata-grid view, create menu, and modal/drawer treatments.

Index-surface details:

- The index page uses `olive.4` as the base field with soft radial washes, a subtle 40px grid, and a light vertical wash.
- The index shell uses `rgba(252,253,252,0.94)`, `olive.8` border, `l3` radius, and the layered shadow `0 28px 70px rgba(29,33,28,0.2)` plus white outline/inset highlight.
- The index content is a two-column work layout on desktop: left rail for new project/import controls, right side for existing project rows.
- The left rail and primary data area use `olive.1`, `olive.2`, `olive.3`, `olive.6`, and `olive.7`.
- Project rows are list rows, not cards. They use borders, compact stats, and restrained hover lift.
- Project ids use a mono stack; headings and helper copy use the standard Panda type styles.
- Focus rings and primary actions use green, currently `green.9`.

Spatial-map details:

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
- Project settings dialogs already match the index-surface shell language: near-white translucent content, strong boundary shadow, brighter header band, compact bordered controls, and subtle grid texture in the form area.
- Drawer/dialog recipes include the same olive grid backdrop pattern and should remain the shared overlay foundation.

## Implementation Notes

This design system maps cleanly to Panda CSS tokens, recipes, layer styles, and text styles.

Suggested implementation approach:

- Treat `docs/design-language-index-surface.md` as reconciled into this file. Future design cleanup should target `DESIGN.md` as the working source of truth and leave the index-surface doc as historical/reference context unless it is explicitly updated too.
- Create semantic color tokens first, then alias node type and status colors.
- Promote index-surface shell values into reusable layer styles or component wrappers:
  - page field/background composition.
  - outer shell.
  - shell header band.
  - interior rail/list/table bands.
  - modal/drawer tool shell.
- Continue using Panda `olive.*` tokens for broad app surfaces. Avoid adding new hex values unless they fill a real semantic gap.
- Gradually replace spatial-map hard-coded surface variables with semantic aliases where it does not risk canvas behavior or layout regressions.
- Use component recipes for buttons, segmented controls, inspector panels, table rows, node cards, and icon buttons.
- Keep canvas SVG styling token-driven but allow graph logic to determine opacity, scale, and focus states.
- Build metadata-grid row styling around data attributes such as `data-selected`, `data-depth`, `data-expanded`, and `data-has-image`.
- Build inspector sections as reusable panel components with `title`, `actions`, and `children` slots.
- Treat menu, popover, select, and dialog primitives as a single overlay family with shared border, shadow, and typography tokens.
- For selected/current items in menus, lists, inspectors, grids, and dropdowns, implement background fill plus text treatment. Reserve side markers for hover affordances or true navigation rails/timelines.
- Keep the spatial SVG canvas free of CSS filters, shadows, blur, and forced-compositing hints on scaled scene layers and nodes.
