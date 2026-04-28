# Index Surface Design Language

Use the project index page as the baseline visual language for the app. The style should feel like a quiet industrial workspace: structured, lightly technical, and warm-neutral instead of flat white or high-contrast black.

## Palette

- Start from the olive/gray Panda token family for major surfaces.
- Use near-white translucent shell backgrounds, such as `rgba(252,253,252,0.94)`, over a muted olive page field.
- Use green only as an operational accent: primary actions, active row markers, focus rings, and selected states.
- Avoid pure black backgrounds for app surfaces and overlays. Use tinted olive surfaces, grid texture, and shadows for depth instead.

## Backgrounds

- Page backgrounds should use a layered composition:
  - `olive.4` or similar muted base color.
  - soft radial washes with low-opacity green/olive tones.
  - a subtle 40px grid pattern with very low opacity.
  - a light vertical wash that keeps the page readable.
- The grid should support the interface, not compete with it. Keep line opacity low and put opaque panels above it where reading happens.

## Surfaces

- Use one strong outer shell to separate the working area from the background:
  - `borderColor="olive.8"`
  - `borderRadius="l3"`
  - translucent near-white background.
  - layered shadow: a larger tinted drop shadow, a subtle white outline, and an inset highlight.
- Interior panels should be made from `olive.1`, `olive.2`, and `olive.3`, separated by `olive.6`/`olive.7` borders.
- Header bands should be slightly translucent and brighter than the work area.
- Avoid nested decorative cards. Use bands, rails, list rows, and framed tool surfaces.

## Layout

- Use constrained wide layouts (`maxW="7xl"`) with responsive padding.
- Prefer two-column work layouts where the left rail contains creation/import controls and the right side contains primary data.
- Keep row density moderate: enough spacing to scan comfortably, but no marketing-style oversized cards.
- Use borders and background shifts for section separation rather than heavy card stacks.

## Typography

- Keep headings heavy and direct with tight line-height.
- Use muted text for descriptions and helper copy.
- Use the project mono stack for ids, file details, counts, and technical metadata.
- Use tabular numbers for compact stats.

## Interaction States

- Hover states should be restrained: slight background lift plus a thin green inset marker when appropriate.
- Focus states must remain visible and use the green accent.
- Buttons and inputs use small radii (`l1`/`l2`) rather than square-zero edges or pill shapes.
- Metadata chips should use light olive fills, thin borders, and compact spacing.

## Modal Treatment

- Modals should inherit the same language:
  - no black stage/backdrop unless content truly requires a dark inspection mode.
  - use a warm olive page/grid field behind the media.
  - use a prominent near-white shell with a stronger boundary shadow.
  - keep controls compact, bordered, and token-aligned.
  - use green for active thumbnail and focus states.
