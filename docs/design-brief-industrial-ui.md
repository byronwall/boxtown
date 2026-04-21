# Industrial UI Design Brief

## Context

Current page reviewed at `http://localhost:3000` on April 20, 2026 in desktop and mobile layouts.

The current interface is clean and readable, but it does not yet deliver the desired feeling of being tight, compact, dense, technical, or industrial. The overall presentation is still soft: pale gradients, glassy white surfaces, generous spacing, low-contrast borders, and floating card behavior make the product feel more like a product demo than an operator-grade tool.

## Target Direction

Design the interface like a technical workstation, not a marketing canvas.

### Desired Feel

- Tight
- Sharp
- Dense
- Technical
- Industrial
- Precise
- Controlled
- High-information

### Explicit Constraints

- No rounded corners
- Minimal softness
- Minimal decorative blur
- Minimal floating-card behavior
- Compact spacing throughout
- Strong alignment to a visible grid

## Visual Principles

### 1. Compact by Default

Every component should feel one size tighter than it does now.

- Reduce outer page padding
- Reduce panel padding
- Reduce button height
- Reduce vertical whitespace between labels, controls, and sections
- Prefer stacked information density over large empty zones

### 2. Hard Edge Geometry

The interface should use square geometry everywhere.

- `border-radius: 0` across all controls and panels
- Prefer hard separators over soft elevation
- Use 1px and 2px strokes intentionally
- Remove any effect that makes surfaces feel pill-like, buoyant, or soft

### 3. Industrial Surface Language

Surfaces should feel fabricated and functional.

- Use flatter panels with stronger borders
- Favor steel, graphite, off-white, muted green, and technical blue accents
- Replace hazy translucency with more opaque, layered surfaces
- Use shadows sparingly and only to establish plane separation
- Prefer inset lines, rails, seams, and panel edges over blur

### 4. Technical Typography

Typography should improve scan speed and reinforce the system feel.

- Keep headings compact and authoritative
- Use tighter line-height in headers and panel metadata
- Consider a mono or industrial grotesk treatment for metadata, coordinates, ids, shortcuts, and labels
- Increase typographic hierarchy through weight and case, not through oversized type

### 5. High Information Density

Every region should justify its footprint.

- Turn empty space into useful structure
- Add stronger labels for state, depth, type, and selection context
- Make controls read like tooling, not like generic app buttons
- Make the inspector feel like an instrument panel

### 6. Grid-First Composition

The map should feel locked into a technical drafting environment.

- Strengthen the drafting-grid impression
- Make alignment, spacing, and panel widths feel measured
- Treat legend, controls, viewport, and inspector as one cohesive system

## Current Visual Diagnosis

### What is Working

- The canvas metaphor is clear
- The grid background supports a systems-map concept
- The inspector pattern is useful and already structurally correct
- Core composition is understandable on desktop and mobile
- Corners are already square in key places

### What is Working Against the Goal

- Top bar, footer, and inspector use translucent white surfaces with soft shadows
- The background uses airy gradients that lighten the mood instead of tightening it
- Buttons are oversized relative to the desired density
- Controls feel like standard SaaS controls, not tool controls
- The map nodes are too pastel and gentle
- Borders are too low-contrast to feel engineered
- Shadows imply floating paper cards rather than machined panels
- The inspector wastes vertical space on mobile and still reads as soft desktop chrome
- The visual rhythm is relaxed instead of compressed

## Visual Scorecard

Scores are based on the current implementation and screenshots taken from desktop and mobile.

| Dimension | Score | Why it scored this way |
| --- | ---: | --- |
| Compactness and density | 4/10 | Layout has large outer padding, roomy top bar controls, tall sections, and generous inspector spacing. |
| Sharpness and edge discipline | 6/10 | Most visible corners are square, but the rest of the styling still feels soft because borders are light and shadows are diffuse. |
| Technical feel | 5/10 | Grid background helps, but typography, buttons, spacing, and color treatment still feel like a friendly web app. |
| Industrial materiality | 3/10 | Glassmorphism, pale gradients, and floating surfaces work directly against an industrial tone. |
| Information density | 4/10 | The page is understandable, but the amount of visible information per square inch is low. |
| Hierarchy and scanability | 7/10 | Basic grouping is good and selection state is understandable, but stronger visual compression would improve scan speed. |
| Color discipline | 5/10 | Palette is coherent, but too soft, bright, and fresh. It needs more neutral control and more deliberate accent usage. |
| Control/tooling feel | 4/10 | Buttons and legend feel generic instead of like map tooling or operator controls. |
| Diagram legibility | 6/10 | The graph is readable, but edge contrast and node styling are still too faint at a glance. |
| Mobile compactness | 5/10 | Responsive layout works, but it becomes stacked and airy instead of deliberately dense. |

## What 10/10 Looks Like

The finished interface should feel like a blend of:

- a CAD viewer
- an internal operations console
- a systems planning tool

It should not feel like:

- a marketing landing page
- a soft SaaS dashboard
- a glassmorphic prototype

## Plan to Reach 10/10

### Phase 1. Reset the Surface Language

Primary goal: remove softness.

- Replace translucent white panel fills with more opaque, flatter surfaces
- Remove or drastically reduce blur effects
- Replace large diffuse shadows with minimal edge separation
- Darken border colors and make separators more intentional
- Reduce the background gradient intensity so the screen feels more controlled

Implementation focus:

- `app/src/components/spatial-map/spatial-map.css`

### Phase 2. Compress the Layout

Primary goal: increase density without harming usability.

- Reduce stage padding from the current roomy shell to a tighter frame
- Shrink top bar padding and inter-control gaps
- Reduce footer height and legend spacing
- Tighten inspector padding and inter-section spacing
- Reduce relation-card padding and section chrome
- Tighten mobile spacing so the responsive layout stays intentional

Implementation focus:

- `app/src/components/spatial-map/spatial-map.css`

### Phase 3. Rebuild the Control Language

Primary goal: make controls feel like instrumentation.

- Convert primary controls to compact, squared, tool-button styling
- Normalize button heights and label casing
- Introduce keyboard-shortcut styling that feels embedded into the interface
- Make the toggle rail feel like a structural part of the layout instead of a floating tab
- Rework the legend to feel like a calibration key, not a passive footer

Implementation focus:

- `app/src/components/spatial-map/SpatialMapCanvas.tsx`
- `app/src/components/spatial-map/spatial-map.css`

### Phase 4. Harden the Map Itself

Primary goal: make the diagram feel engineered.

- Increase contrast between node classes with more disciplined fills and borders
- Reduce pastel softness in page and assembly colors
- Strengthen selected, hovered, and active states
- Make edge lines clearer and more technical
- Increase text crispness and metadata legibility
- Consider mono styling for secondary labels and ids

Implementation focus:

- `app/src/components/spatial-map/SpatialMapCanvas.tsx`
- `app/src/components/spatial-map/spatial-map.css`

### Phase 5. Turn the Inspector into an Operator Panel

Primary goal: make the right rail feel dense and useful.

- Tighten header height and metadata rows
- Use stronger section dividers and smaller section paddings
- Reduce prose-like spacing in content blocks
- Make relationship cards read like selectable records
- Add clearer key-value rhythm for id, type, depth, and relationship data

Implementation focus:

- `app/src/components/spatial-map/SpatialMapCanvas.tsx`
- `app/src/components/spatial-map/spatial-map.css`

### Phase 6. Refine Typography

Primary goal: improve authority and scan speed.

- Reduce heading looseness
- Tighten body line-height in utility areas
- Differentiate labels, metadata, and content more aggressively
- Introduce an industrial secondary face or a mono utility face where appropriate

Implementation focus:

- `app/src/components/spatial-map/spatial-map.css`
- shared theme tokens only if the spatial-map view is meant to establish the broader product language

## Concrete Style Moves

These changes would immediately move the design closer to the target.

- Shift from bright green and pale sky fills toward graphite, off-white, steel blue, muted process green
- Replace diffuse shadow stacks with 1px borders, inset separators, and sparse hard-edged depth
- Reduce panel padding by roughly 20 to 35 percent
- Reduce major control heights by roughly 15 to 25 percent
- Tighten gaps between stacked blocks to a more compact rhythm
- Increase contrast of the drafting grid slightly
- Use uppercase utility labels more consistently
- Make interactive states snappier and less floaty

## Suggested Success Metrics

The redesign is successful when:

- The interface feels dense without feeling cramped
- The controls read as tools, not generic app UI
- The inspector feels like a technical sidecar, not a content sidebar
- The map reads quickly at a glance
- Mobile keeps the same industrial personality instead of becoming soft and stacked
- A reviewer would describe the UI as precise, operational, and engineered

## Next Implementation Pass

If the next task is execution, start with a styling-only pass in `app/src/components/spatial-map/spatial-map.css` before changing structure. The current structure is good enough to support the new direction. The biggest gains will come from changing spacing, surface treatment, border contrast, type treatment, and control styling first.
