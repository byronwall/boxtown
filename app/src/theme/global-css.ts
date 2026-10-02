export const globalCss = {
  extend: {
    "*": {
      "--global-color-border": "colors.border",
      "--global-color-placeholder": "colors.fg.subtle",
      "--global-color-selection": "colors.colorPalette.subtle.bg",
      "--global-color-focus-ring": "colors.colorPalette.solid.bg",
    },
    // The workspace palette lives on :root so portalled overlays (dialogs, menus,
    // tooltips) resolve the same variables as the page.
    ":root": {
      "--spatial-map-bg": "#dfe3dc",
      "--spatial-map-panel": "rgba(252, 253, 252, 0.94)",
      "--spatial-map-panel-strong": "rgba(248, 250, 248, 0.92)",
      "--spatial-map-panel-border": "rgba(95, 101, 94, 0.34)",
      "--spatial-map-panel-border-strong": "rgba(96, 101, 95, 0.72)",
      "--spatial-map-panel-divider": "rgba(96, 101, 95, 0.2)",
      "--spatial-map-copy": "#171c19",
      "--spatial-map-copy-muted": "#323b35",
      "--spatial-map-copy-dim": "#475249",
      "--spatial-map-blue-fill": "#d6e0e8",
      "--spatial-map-blue-fill-hover": "#c8d6e1",
      "--spatial-map-blue-stroke": "#63798c",
      "--spatial-map-blue-stroke-hover": "#4f677c",
      "--spatial-map-green-fill": "#cdd9cd",
      "--spatial-map-green-fill-hover": "#c0cfbf",
      "--spatial-map-green-stroke": "#607861",
      "--spatial-map-green-stroke-hover": "#4f684f",
      "--spatial-map-neutral-fill": "#eef1eb",
      "--spatial-map-neutral-fill-hover": "#e3e7df",
      "--spatial-map-neutral-stroke": "#747b72",
      "--spatial-map-neutral-stroke-hover": "#5f685f",
      "--spatial-map-steel-fill": "#d8dddd",
      "--spatial-map-steel-fill-hover": "#cbd2d2",
      "--spatial-map-steel-stroke": "#677477",
      "--spatial-map-steel-stroke-hover": "#556367",
      "--spatial-map-amber-fill": "#e4d9bf",
      "--spatial-map-amber-fill-hover": "#d8caa8",
      "--spatial-map-amber-stroke": "#806c47",
      "--spatial-map-amber-stroke-hover": "#6b5937",
      "--spatial-map-accent": "#3d4540",
      "--spatial-map-accent-strong": "#1f2421",
    },
    html: {
      // Neutral default palette for workspace chrome; semantic node type and
      // status colors are set explicitly where they are used.
      colorPalette: "gray",
      backgroundColor: "colors.gray.2",
    },
    body: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top, token(colors.gray.a3) 0%, transparent 30%), linear-gradient(180deg, token(colors.gray.1) 0%, token(colors.olive.2) 100%)",
      color: "fg.default",
      // Overlays are portalled to body, so the workspace mono stack is set here
      // rather than on each page shell.
      fontFamily:
        '"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", "Liberation Mono", monospace',
      textRendering: "optimizeLegibility",
      WebkitFontSmoothing: "antialiased",
    },
    // Press feedback for every button (see DESIGN.md "Press feedback").
    // :where() keeps specificity at zero and this sits in the base layer, so any
    // component transform or _active style wins. Buttons inside the scaled SVG
    // scene are excluded: transforms there cause flicker at high zoom.
    ":where(button)": {
      transition: "transform 160ms cubic-bezier(0.23, 1, 0.32, 1)",
    },
    ":where(button:not(:disabled):not(.spatial-map-scene-layer *)):active": {
      transform: "scale(0.97)",
    },
  },
};
