---
version: alpha
name: Boxtown Industrial Drafting
description: "A dense, calm, industrial drafting interface for Boxtown: an olive index surface, contained workspace shells, spatial product maps, metadata grids, inspector rails, markdown context, and image-backed architecture nodes."
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

# Boxtown Industrial Drafting Design System

## Overview

Boxtown should feel like a drafting table for software architecture: technical, calm, spatial, precise, and intentionally dense. The interface is not decorative or consumer-playful. It is a working environment for mapping product ideas, UI architecture, system relationships, planning notes, markdown context, and image attachments.

This document reconciles the broader product design direction with the existing `docs/design-language-index-surface.md` language. The index-surface doc is now treated as the baseline for page fields, app shells, token usage, modal treatment, and restrained interaction states because the current index page, drawer/dialog recipes, console log capture shell, and several spatial-map dialogs clearly follow it. The denser spatial-map workspace keeps the more technical drafting-table rules where the existing site already uses them.

The visual style observed in the implemented site is a soft industrial UI with muted olive page fields, near-white translucent shells, crisp hairline borders, subtle grid texture, technical metadata typography, compact labels, and low-shadow panels. It should feel like an engineering notebook merged with a graph editor, not like a marketing SaaS dashboard.

Use this document as the cleanup target for the repo. When existing code diverges, prefer the rule that is already working in the strongest implemented surfaces:

- **App shell baseline:** every page is full-bleed with one top header bar (see "App shell"). Pages are not inset inside a padded, shadowed frame.
- **Index surface baseline:** token-led olive surfaces, list rows, modal backdrop language, restrained green focus/active states.
- **Spatial map drafting baseline:** canvas nodes, metadata grid, tree view, inspector rail, image tools, and project settings dialogs.
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
  - Create-menu actions, workflow rails, candidate review states, progress steps, and generated nodes should use the same industrial control language.
- Prefer legibility over polish.
  - Workspace text can be monospaced where density and technical scanning matter.
  - Index and general app surfaces may use the standard Panda heading/body stack, with mono reserved for ids, counts, filenames, metadata, shortcuts, and code-like values.
  - Labels are compact, controls are square-ish, and most depth comes from borders and tonal changes.

## Relationship to the Index Surface

The index page is the clearest completed reference for the general product surface. Carry these rules forward anywhere the app renders a page-level layout, modal, drawer, shell, or non-canvas management view:

- Use the olive/gray Panda token family for major surfaces: `olive.1`, `olive.2`, `olive.3`, `olive.4`, `olive.6`, `olive.7`, and `olive.8`.
- Use near-white panel surfaces over a flat muted olive page field.
- Use green as an operational accent only: primary actions, active controls, focus rings, selected states, and occasional row hover markers.
- Avoid pure black app surfaces, black modal stages, bright white full-page fields, glossy cards, and high-contrast black/white UI.
- Pages are full-bleed under a shared header bar. The earlier inset outer shell (rounded frame, large tinted shadow, gridded page field) is retired for pages; dialogs and drawers may still use a framed shell because they float.
- Use interior bands, rails, list rows, and framed tool surfaces instead of nested decorative cards.
- Selected menu/list states should use restrained fill plus text weight/color. Do not add decorative side bars, inset stripes, or rail markers for ordinary selected/current states.

Where the spatial-map workspace currently uses sharper zero-radius controls, full mono typography, or custom CSS variables, treat that as a specialized drafting mode. New shared UI and cleanup work should bias back toward index-surface tokens and small radii unless the component is explicitly part of the scaled SVG/canvas or metadata-grid drafting surface.

## Density and Cleanup Principles

These principles came out of the inspector-rail cleanup and are the method for cleaning up other surfaces. The inspector rail is the reference implementation. Each one names the smell it removes so it can be used as a review checklist.

1. **Rank the content, then order by rank.**
   - Decide what the surface is for before styling it: identity, then state, then actions, then primary content, then secondary detail.
   - Secondary detail goes last and stays closed until it has something to show.
   - Smell: sections appear in the order they were built, and mostly-empty sections sit above the content people came for.
2. **Empty costs one line.**
   - An empty section is a single header row with a summary on the right (`0/2`, `0`, "Drop or paste to add"). It never gets a placeholder box, a paragraph of explanation, or its own bordered panel.
   - Groups open automatically when they have content and stay closed when they do not.
   - Smell: dashed boxes, patterned fills, and multi-line "nothing here yet" copy.
3. **One style per role.**
   - A surface has one section-label style, one meta/dim style, one body style, and one control height. If two headings look different, one of them is wrong.
   - Dense rails use three text sizes only: 11px for labels and meta, 12px for body and values, one title size.
   - Smell: sibling headings with different weight, color, or tracking; controls of three different heights in one row.
4. **Values over labels.**
   - A value that explains itself does not need a label: a `Planned` chip does not need "Status" in front of it. Put the label in the tooltip and the accessible name.
   - Keep a visible label only where the value is ambiguous on its own, such as free-text metadata fields.
   - Smell: a label/value row per attribute where a single row of chips would do.
5. **Rules, not boxes.**
   - Separate sections with one hairline divider. Do not wrap sections, lists, or button groups in their own bordered containers, and never let two dividers touch.
   - Lists are rows separated by hairlines with a hover fill. They are not stacks of cards.
   - Smell: card-in-panel nesting, a header border directly above a section border, pill badges used for plain metadata.
6. **Edit where you read.**
   - Text is edited in place: click the rendered value, type, click away to save, Esc to cancel, Cmd/Ctrl+Enter to save from the keyboard.
   - No Edit / Save / Cancel button rows for single-field edits, and no success toast for a routine save. Failures still surface as a toast.
   - Smell: a mode switch button, a separate form, and a confirmation for changing one field.
7. **Color means something.**
   - Tone is reserved for state: status, priority, destructive, selected. Everything structural is neutral.
   - Selected and current items use a fill plus text treatment. No accent bars, inset stripes, or underline markers.
   - Smell: tinted buttons and borders that carry no information.
8. **Flat docked surfaces.**
   - Rails, panels, and bands that are docked into the shell use a flat fill and a single border. No gradients, inset highlights, or drop shadows. Shadows belong to things that float: menus, popovers, dialogs, tooltips.
   - Smell: stacked box-shadows and gradient backgrounds on a panel that never moves.
9. **Structural controls live in structure.**
   - A control that acts on the layout sits in the layout, not on top of content. The pane resize handle is its own gutter column with a vertical ellipsis; it never overlaps either pane, and the neighbouring pane gives up its padding so the gutter is the only gap.
   - Smell: absolutely positioned handles and toggles floating over text.
10. **Every text run has an overflow plan.**
    - Each line either wraps or truncates with an ellipsis and exposes the full value on hover. Nothing is clipped by a parent.
    - Smell: text cut off mid-word at a panel edge.
11. **Icon-only buttons explain themselves.**
    - Every icon-only button gets the shared `Tooltip` component and an `aria-label`. Do not rely on the `title` attribute.
    - Smell: two adjacent icon buttons that can only be told apart by clicking one.
12. **Spend vertical space on content.**
    - In dense rails: 8px between sections, 6px inside a section, 22-24px controls and header rows, 4px between adjacent controls.
    - If an action row, header, or label line can merge into the row above it without losing meaning, merge it.
    - Smell: 32px buttons in a rail, a row that holds one small control, 24px+ gaps between sections.

Cleanup order for an existing surface:

1. List what the surface shows and rank it (principle 1).
2. Remove or collapse everything empty (2) and every redundant label (4).
3. Collapse the styles to one per role (3) and the containers to hairlines (5, 8).
4. Fix overflow (10), tooltips (11), and control placement (9).
5. Tighten spacing last (12). Tightening first only makes a disorganized surface denser.

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

### Dark mode

The app follows the OS setting (`prefers-color-scheme`). There is no toggle. Dark is the same drafting table at night: green-black paper, chalk-light ink, and the same muted type colors pulled down into the paper.

- **Tokens:** Panda semantic colors carry `_light` and `_dark` values. The `dark` condition in `app/src/theme/conditions.ts` is the media query, so a component that uses tokens needs no extra work.
- **Spatial-map variables:** `app/src/theme/global-css.ts` sets every `--spatial-map-*` variable twice, on `:root` and inside the dark media query. Use these variables instead of new hex or rgba values.
- **Tints:** for a hover wash, a divider or a selected fill, mix a variable with `transparent`, for example `color-mix(in srgb, var(--spatial-map-ink) 6%, transparent)`. `--spatial-map-ink` is dark in light mode and light in dark mode, so one value serves both.
- **Canvas:** paper `#141814`, grid `#1e241f`, ink `#E6EBE6`. These match the live map on the landing page (`site/public/town.css`).
- **Box fills:** write node tones for light mode. In dark mode a configured type color keeps 44% of itself over `#1a1f1b` (`--spatial-map-box-mix`). Pastel status and fallback tones keep 22% (`--spatial-map-tint-mix`). Lines mix toward light ink (`--spatial-map-line-mix`), and chip text toward `#E6EBE6` (`--spatial-map-ink-mix`).
- **Elevation:** shadows mostly disappear on dark paper. Separate surfaces with the raised (`#1c221e`) and sunken (`#121613`) variables and with borders, not with stronger shadows. The canvas safety rules still apply: no filters or shadows inside the scaled SVG.

## Typography

The product should use a technical typography system, but it should not force every surface into monospace. The implemented index surface uses standard Panda heading/body styles for approachable management copy and reserves the mono stack for ids, counts, file details, and technical metadata. The spatial-map workspace currently uses full monospace and can keep that stronger drafting character.

Recommended stack split:

- **General app/index surfaces**
  - Use existing Panda `Heading`, `Text`, and `textStyle` tokens.
  - Keep headings heavy, direct, and tight.
  - Use muted text for helper copy and descriptions.
  - Use monospaced text for project ids, file names, counts, metadata chips, keyboard shortcuts, command labels, code, and structured values.
- **Spatial-map workspace**
  - Use the project mono stack across toolbar, grid, tree, inspector, canvas labels.
  - Current stack: `IBM Plex Mono`, `SFMono-Regular`, `SF Mono`, `Roboto Mono`, `Consolas`, `Liberation Mono`, monospace.
- **Markdown/prose surfaces**
  - Use monospace for code, metadata, tables, ids, and diagram labels.
  - Long-form prose can use the standard readable body stack when a full-mono preview hurts scanning.

Type should be compact and sharp:

- **Headlines**
  - Use 18-22px, bold, tight tracking.
  - Project titles such as “Recipe Architecture Grid” should feel like a technical document title.
- **Panel titles**
  - Use 14px bold for the title of a whole panel or view, such as “Metadata grid”.
- **Section labels inside a panel**
  - Use 11px bold uppercase with 0.08em tracking in the dim text color.
  - Examples: “Context”, “Images”, “Metadata”, “Connections”, “Activity” in the inspector rail.
  - Every section label on a surface uses this one style.
- **Body and inspector text**
  - Use 12-13px regular with comfortable line height.
  - Inspector body text, values, and the in-place context editor use 12px; labels and meta use 11px.
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

- Use the standard app shell: header bar on top, content full-bleed below.
- Content sits in one centered column on the flat olive page field.
- Put page-level actions in a single row above the primary list or table.
- Separate rows with hairlines and background shifts, not decorative nested cards.
- Avoid marketing-style oversized cards, oversized empty states, and decorative hero composition inside authenticated app surfaces.

### Spatial workbench

The spatial-map project page is a full-bleed workbench under the app header:

- **Top project toolbar**
  - Contains back navigation, project title, settings, color/type/status mode controls, create/actions controls, view switches, and depth controls.
  - It is the page's app header: a flat full-width bar with a bottom border.
- **Primary workspace**
  - Occupies the center/left.
  - Switches between canvas, tree/document, and metadata grid views.
  - In canvas mode, it uses a large gridded plane with visible fit/zoom controls in the lower-right.
  - In metadata grid mode, it uses a dense table with column controls, search, node/link toggle, and row actions.
- **Inspector rail**
  - Sits on the right at 348px by default and is resizable from 280px through a gutter handle between the panes.
  - Shows, in order: title, id, status/priority/type chips, actions, context, images, then collapsible metadata, connections, and activity.
  - Uses a flat surface with hairline dividers between sections, not stacked bordered panels.

Spacing rules:

- Use a 4px micro-grid with 8px as the default control rhythm.
- Use 12px internal padding for the inspector rail and toolbar groups.
- Inside dense rails use 8px between sections, 6px within a section, and 22-24px controls and header rows.
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

- **Page field:** flat olive base.
- **Header bar:** near-white band with one bottom border.
- **Base workspace layer:** green-gray app background.
- **Canvas layer:** pale grid plane with subtle vertical and horizontal grid lines.
- **Panel layer:** near-white surface with 1px border.
- **Raised overlay:** popovers and menus may use a small shadow plus a stronger border.
- **Selected layer:** selected rows and active controls use pale moss fills.
- **Focus layer:** selected canvas nodes use stronger borders and clearer fills.

Shadow guidance:

- Pages and docked panes: no shadow.
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

Every page uses the same standard shell: a full-width header bar on top and full-bleed content below it.

- Header (`AppHeader`): 44px, flat fill, one bottom border. Left to right: the logo as a home link, an optional parent crumb ("Projects /"), the page title, then page actions on the right.
- Navigation back to the project list is the logo and the crumb in the header. Do not float a back link outside the page frame.
- Content fills the viewport under the header. No outer page padding, no rounded page frame, no page-level drop shadow, and no gridded page field behind the app.
- While a route's data loads, show the shell itself (`AppShellFallback`): the header bar with a placeholder title on the page field. Never a blank page or a lone logo.
- Images without an intrinsic size (the SVG logo) carry explicit `width` and `height` attributes so they hold their size before the stylesheet applies. On Panda `styled` elements `width="20"` is a style token, not the attribute; use a plain element or `htmlWidth`.
- Panes inside a page (stash, workspace, inspector) are separated by single borders or the resize gutter, not by gaps and nested frames.
- The drafting grid texture belongs to the canvas only.

### Index surface

The project list is the reference for app-level management screens.

- Header: logo, "Projects" title, and one dim summary line of counts on the right.
- Content: a single centered column (max 960px).
- Actions row above the list: a name input with a Create button, and one "Import archive" button that opens the file picker and imports on selection.
- List: one bordered surface with hairline-separated rows, not cards. Each row is a link with the project name, a description clamped to two lines, and one dim meta line (`nodes · links · updated · id`).
- Row actions: plain 24px icon buttons with tooltips (download archive, delete). Delete turns red on hover only.
- Empty state: one line of dim text inside the list.

### Project toolbar

The toolbar follows the same Density and Cleanup Principles as the inspector rail.

- Surface: the project page's `AppHeader`. All controls are 24px.
- Left: logo home link, "Projects /" crumb, project title (16px bold, truncates), and a quiet settings icon button with a tooltip.
- Right, ordered by how often the control changes what you see:
  - An "Isolated: name ×" chip, only while isolation is active. It names what is isolated instead of showing a bare ×.
  - View switch: Canvas / Tree / Grid.
  - Depth: 1 / 2 / 3 / Max, with a dim "Depth" label because the numbers are ambiguous on their own.
  - Filter button with its current summary.
  - Create (+) menu: New node, New context node.
  - Overflow (…) menu: Copy visible nodes as Markdown.
- Icon-only buttons have tooltips. The cluster wraps onto a second row on narrow widths instead of clipping.

### Segmented controls

- Use the shared `SpatialMapSegmentedControl` for any single-choice group of two to five options.
- One bordered group, 24px tall, with hairline dividers between segments.
- Active segment: pale moss fill, dark green bold text. No underline, inset bar, or extra border.
- Inactive segment: transparent with dim text that darkens on hover.
- A segment presses with a darker fill rather than a scale, because it sits flush in its group.
- Add a dim text label beside the group when the option labels do not explain themselves.

### Create and action menu

- The create menu is a simple raised popover below the toolbar action.
- Menu surface should be near-white with a subtle shadow.
- Items are text-first, monospaced, and vertically compact.
- Expected items:
  - “New node”, with its `C` shortcut on the right
  - “New context node”
- Hover state should use pale moss or muted green surface.

### Canvas workspace

- The canvas fills its pane edge to edge with a pale drafting-grid background. It has no border, radius, or shadow of its own.
- Grid lines should be subtle and regular, approximately 24px apart.
- Nodes are rectangular and type-tinted. Edges should be thin and muted by default.
- Canvas controls are one compact floating bar in the top-right corner, 8px from the edges: zoom value, Fit, Edges toggle, a Linked toggle while isolated, and a labelled Type / Status color switch. All 24px.
- Toggles in the bar show "on" with a fill and bold text.
- The new-node draft is a small floating form with Cancel and Create.
- A blank project shows one small centered prompt with a New node button.
- Selected node should have clearer fill, stronger border, and remain above unrelated nodes.
- Isolated/focus mode may fade unrelated nodes to low opacity while preserving spatial context.

### Node stash

- A flat side pane on the left of the canvas, shown only when nodes are stashed.
- Header: collapse button, "Stash" label, count, and the `S` shortcut.
- Stashed nodes are hairline-separated rows (name, `type · status`, optional thumbnail) with Find, Unstash, and delete as 24px controls. The selected row uses a fill.

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

### Tree view

The tree view is a reading surface, so it stays roomier than the grid, but it follows the same rules.

- Flat surface with a centered text column (max 86ch). No bordered document card, accent bar, shadow, or grid texture.
- A slim sticky bar holds the table-of-contents button, the current path breadcrumb, and Expand all / Collapse all.
- Each node is one header row: a collapse chevron in a fixed left gutter, the heading with a dim child count, and the controls on the right.
- Controls sit in fixed-width columns (priority when any visible node has one, then status, then type) and each chip fills its column, so the right edge is a straight line down the page.
- Headings step down by depth: 20px, 17px, 15px, then 13px. Depth is also shown by the rails on the left.
- Branches collapse and expand from the chevron or with the left and right arrow keys. Jumping to a node from the table of contents opens its collapsed ancestors.
- Context renders at 13px and is clamped with an "Open full context" link. Metadata is a compact table whose labels sit directly beside their values.
- The selected node uses a fill.

### Metadata grid

- A flat, dense table that fills its pane. No outer border, radius, shadow, or grid texture.
- Header row (36px): a dim summary of visible counts on the left; column toggles, the name filter, and the Nodes / Links switch on the right.
- One table in one scroll container. The column header row is sticky at the top, and the select and name columns are sticky on the left with a stronger divider after the name.
- Column headers use the section-label style (11px bold uppercase, dim).
- Columns resize from their divider line: the right edge of each header is the drag handle and highlights on hover. There is no separate grip block.
- Rows are separated by hairlines. No zebra striping; hover and selection use solid fills so sticky cells stay opaque.
- Rows preserve tree hierarchy through indentation, elbows, and disclosure icons.
- Type, status, and priority all use the shared attribute chips, each filling its column.
- Long cells should truncate with ellipses.
- Delete actions use small red icon buttons with tooltips.

### Inspector rail

The inspector rail is the reference implementation of the Density and Cleanup Principles.

- Surface:
  - Flat near-white fill, one left border, no gradient or shadow on desktop.
  - Sections are separated by a single hairline divider. The header has no border of its own.
- Header:
  - Editable node title on the left.
  - Icon buttons on the right: copy agent prompt, project-activity toggle, collapse. Each has a tooltip.
- Identity and state, directly under the title:
  - Node id as one dim mono line that truncates and copies on click.
  - Status, priority, and type as one row of unlabelled 22px chips. Status and priority chips carry tone; type is neutral.
  - One 24px action row: Add Child on the left, archive and delete icon buttons on the right.
- Context:
  - First content section, because it is the primary content of a node.
  - Rendered markdown that is edited in place: click to edit, click away or Cmd/Ctrl+Enter to save, Esc to cancel.
  - When empty it is a single dim "click to add" line. A small icon in the section header opens the large view.
- Images:
  - One header row with a count and a quiet "Drop or paste to add" hint. Thumbnails render below only when images exist.
  - The whole section is the drop target; dragging over it shows a dashed border and a tinted fill.
- Secondary groups, last:
  - Metadata, Connections, and Activity are one-line collapsible rows with a summary on the right (`1/2`, `3`, `8`).
  - Metadata and Connections open on their own when they have content. Activity starts closed.
  - Metadata fields are a dim 11px label above an in-place editable value.
  - Connections are a single list with `→` / `←` direction markers, one line per link.
- Nothing selected:
  - The rail becomes a project starting point instead of showing empty sections.
  - One dim line with the hint and project counts by status.
  - A list of project-level actions as 24px rows (icon, label, shortcut on the right): new node, new context node, copy visible nodes as Markdown, project settings, and a search shortcut reminder.
  - Recent project activity below, where each entry selects its node.

### Activity lists

- Activity is a dense list, not a stack of cards.
- Each entry is one row: a toned 13px icon for the kind of change, the summary (up to two lines), a dim meta line (`Updated · actor`, plus the node name in project-wide lists), and a short relative time (`2h`, `3d`) on the right.
- Rows are separated by hairlines and get a hover fill when they select a node.
- Do not use badges for kind, actor, node, or date.

### Pane resize handle

- The handle is its own 12px full-height column between the workspace and the rail, marked with a vertical ellipsis.
- It never overlaps content in either pane. The workspace drops its right padding while the rail is open so the handle is the only gap.
- Hover darkens the gutter; dragging tints it green.

### Images panel

- The section itself is the drop target; there is no separate drop-zone box.
- Empty state is the header row and hint only.
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
- Attribute chips (status, priority, type) are 22px tall with a 4px radius. Tone comes from the value; neutral values use the neutral fill.
- Do not render plain metadata such as ids, actors, or dates as pills. Use dim text.
- Chips should not dominate the rail; they provide state, not primary actions.

### Buttons

- Primary creation or confirmation buttons use dark forest green with white text.
- Secondary buttons use surface fill with green text and green/gray borders.
- Utility icon buttons use a white or pale green surface.
- Destructive icon buttons use pale red surfaces with red outlines/icons.
- Disabled buttons use neutral gray fills and low contrast text.

### Press feedback

Every button gives physical feedback while it is pressed, so the interface visibly registers the click before anything else happens.

- Default: `transform: scale(0.97)` on `:active`, with a 160ms ease-out transform transition. This comes from a global rule for all `button` elements and from the shared button recipe, so new buttons get it without extra work.
- Full-width rows (list rows, menu-like results, collapsible headers): use `scale(0.99)` plus a slightly darker fill. A 3% scale is too much travel on a wide row.
- A button that already has a positioning transform must restate it in its pressed state, for example `translateY(-50%) scale(0.97)`.
- No press scale on layout handles such as the pane resize gutter, and none on anything inside the scaled SVG canvas scene.
- Disabled buttons do not respond.
- Keep the scale between 0.95 and 0.99. Press feedback is confirmation, not animation.

### Dialogs, menus, and popovers

Everything that floats belongs to one overlay family and gets its look from the shared recipes, not from per-dialog overrides.

- Surface: opaque near-white (`#fbfcfb`), 1px olive border, and one shared shadow (`0 8px 24px rgba(24, 32, 24, 0.15)`). Dialogs use an 8px radius; menus and popovers use 6px.
- Backdrop: a quiet translucent scrim. The page stays visible behind a dialog; there is no gridded or gradient stage.
- Dialog header: 14px bold title, optional 12px dim description, hairline below. The close control is a plain 24px icon button in the corner.
- Dialog body: 13px text with 12-16px padding. Do not nest another bordered or textured container inside the body.
- Dialog footer: hairline above, actions right-aligned at one height (32px). Cancel is outline; the primary action is green; destructive actions use the danger variant.
- Dialogs with sections (project settings) use a left list with a fill for the current section, not a framed sidebar.
- Forms: labels are 12px dim and helper text is 11px dim, from the shared field recipe. Only add helper text that tells the user something the label and placeholder do not.
- Menus: 12px items at 28px, a hover fill, and a pointer cursor. Do not override radius or font per menu.
- Titles and button labels use sentence case ("Delete node", "Project settings", "Add child").
- Overlays are portalled to `body`, so the type stack and the `--spatial-map-*` palette are defined globally (`body` and `:root`) rather than on a page shell.
- Keep dialogs compact and task-oriented.

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
- Keep node creation and image tools visually integrated with the core app.
- Prefer 1px borders, small labels, and tonal grouping over heavy shadows.
- Prefer bands, rails, rows, and framed tool surfaces over decorative card stacks.
- Order content by importance and collapse secondary or empty groups to one line.
- Edit text in place and save on blur.
- Give every icon-only button a `Tooltip` and an `aria-label`.
- Give every button a pressed state.

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
- Do not give empty sections placeholder boxes or explanatory paragraphs.
- Do not stack dividers, nest bordered cards inside panels, or put gradients and shadows on docked panels.
- Do not float layout controls such as resize handles over content.
- Do not inset the app inside a padded, rounded, shadowed frame, and do not float navigation outside that frame.
- Do not add Edit / Save / Cancel rows for single-field edits.

## Site-Derived Details

These details are derived from the existing index surface, theme tokens, spatial-map workspace, metadata-grid view, create menu, and modal/drawer treatments.

Index-surface details:

- The index page is full-bleed: the shared header bar, then one centered column on a flat olive field.
- A single actions row (create, import) sits above the project list.
- Project rows are list rows, not cards: name, description, and one dim meta line, with icon-button actions on the right.
- Project ids use a mono stack.
- Focus rings and primary actions use green, currently `green.9`.

Spatial-map details:

- The project page is full-bleed: the header bar holds the title and toolbar controls, and the workspace and inspector fill the rest.
- View switching uses three tabs: Canvas, Tree, and Grid.
- Depth filtering uses small adjacent buttons: 1, 2, 3, Max.
- The metadata grid shows approximately 50 visible nodes and supports column toggles, search, and Nodes/Links modes.
- Tree structure inside the grid is represented with indentation, elbows, disclosure indicators, and selected-row fill.
- The inspector rail remains visible in both canvas and grid views and shows the selected “Nav Tabs” node.
- The selected node row in the grid is filled pale green.
- The canvas view uses a fine grid background and faded surrounding nodes when a cluster is focused.
- The create menu is a compact popover with a New Context Node action.
- The inspector edits title, metadata fields, and context in place; there are no Save buttons in the rail.
- The inspector's Metadata, Connections, and Activity groups are collapsible one-line rows at the end of the rail.
- The images section is a header row with a hint when empty; the section is the drop target.
- The pane resize handle is a 12px gutter column with a vertical ellipsis.
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
- Build inspector sections from the shared primitives in `app/src/components/spatial-map/SpatialMapPanelPrimitives.tsx`: `SpatialMapInspectorSection`, `SpatialMapSectionHeader` (title, count, right-side slot), `SpatialMapCollapsibleGroup` (title, summary, open state), and `SpatialMapEmptyState`.
- Panda only extracts static style values. A style prop built from runtime data, such as a template literal containing a tone color, produces no CSS and silently falls back to defaults. Pass runtime colors through CSS variables in `style` and reference the variables from static props, as `SpatialMapNodeAttributeMenu` does.
- The same applies to helpers: `fontSize={size()}` emits nothing even if `size()` returns a literal. Write the ternary of literals inline in the prop.
- Grid and flex containers that hold truncating text need `minmax(0, 1fr)` columns or `minW="0"`; otherwise a `nowrap` child widens the container and gets clipped by the rail.
- Overlay content needs a z-index token (`tooltip`, `popover`, `dropdown`). Portalled overlays without one render behind positioned panels that set their own z-index.
- Treat menu, popover, select, and dialog primitives as a single overlay family with shared border, shadow, and typography tokens.
- For selected/current items in menus, lists, inspectors, grids, and dropdowns, implement background fill plus text treatment. Reserve side markers for hover affordances or true navigation rails/timelines.
- Keep the spatial SVG canvas free of CSS filters, shadows, blur, and forced-compositing hints on scaled scene layers and nodes.
