# Spatial Map Node Visual Rules

This document summarizes the size and color rules currently applied to canvas nodes in `app/src/components/spatial-map/`.

## Size Rules

- Base node geometry comes from `getNodeSize(depth, label)` in `app/src/lib/spatial-map/layout.ts`.
- Base size is depth-aware before any canvas-only visual scaling:
  - Depth `0`: largest base area, widest labels, `fontSize: 22`, `metaSize: 12`
  - Depth `1`: medium base area, `fontSize: 16`, `metaSize: 11`
  - Depth `2+`: smallest base area, `fontSize: 12`, `metaSize: 10`
- Label length adjusts the width/height aspect ratio within per-depth min/max width limits.
- Before layout runs, an additional relative depth size multiplier is applied in `createInitialLayout(...)`.
- That relative depth multiplier is computed only from the currently visible nodes.
- The shallowest visible depth scales base size up to `1.32`.
- The deepest visible depth scales base size down to `0.80`.
- Depths between those two extremes are interpolated linearly.
- The multiplier affects `width`, `height`, `fontSize`, and `metaSize`, so layout spacing and shared borders use the final rendered size.
- If all visible nodes are at the same depth, the relative depth size multiplier stays neutral at `1`.
- Text layout still derives from each node’s actual width, height, `fontSize`, and `metaSize`, then compresses visually based on camera zoom.

## Color Rules

- Each node type maps to a base fill and stroke palette in `app/src/components/spatial-map/spatial-map.css`.
- Known type groups currently use these palette families:
  - `page`, `area`: blue
  - `assembly`, `module`: green
  - `component`, `contract`, `standard`: neutral
  - `taxonomy`: steel
  - `note`: amber
- Unknown node types fall back to the rotating neutral tone list in `SpatialMapScene.tsx`.
- Hover uses the node type’s hover fill and hover stroke.
- Selection overrides the stroke to `#0f2f1d` at `2px`.
- Isolation adds a stronger green stroke, `2.4px` border width, and glow/drop-shadow treatment.
- Independently of node type, visible depth also lightens the node background fill.
- That fill lightening is computed only from the currently visible depth range.
- The shallowest visible depth adds `0%` white mix to the default fill and hover fill.
- The deepest visible depth adds `46%` white mix to the default fill and `36%` white mix to the hover fill.
- Intermediate visible depths are interpolated linearly.
- If all visible nodes are at the same depth, no extra fill lightening is applied.
- This lightening changes fill color only. It does not alter node opacity.
- Visible depth also lightens the border stroke and slightly reduces its width.
- The shallowest visible depth keeps the base stroke color and `1.4px` stroke width.
- The deepest visible depth adds `28%` white mix to the default stroke, `22%` white mix to the hover stroke, and reduces stroke width to `1.05px`.
- Intermediate visible depths are interpolated linearly.
- Selection and isolation still override the border with their stronger explicit strokes.

## Opacity Rules

- Node opacity is still controlled separately from size and fill color.
- When a node is unrelated to the active selection context, its base opacity is reduced to `0.22`.
- Otherwise its base opacity is `1`.
- Layout-transition opacity is multiplied on top of that base opacity during animated layout changes.
