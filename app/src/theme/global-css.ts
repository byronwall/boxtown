export const globalCss = {
  extend: {
    "*": {
      "--global-color-border": "colors.border",
      "--global-color-placeholder": "colors.fg.subtle",
      "--global-color-selection": "colors.colorPalette.subtle.bg",
      "--global-color-focus-ring": "colors.colorPalette.solid.bg",
    },
    html: {
      colorPalette: "green",
      backgroundColor: "colors.gray.2",
    },
    body: {
      minHeight: "100vh",
      background:
        "radial-gradient(circle at top, token(colors.green.a3) 0%, transparent 30%), linear-gradient(180deg, token(colors.gray.1) 0%, token(colors.olive.2) 100%)",
      color: "fg.default",
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
