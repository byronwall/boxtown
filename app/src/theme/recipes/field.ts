import { fieldAnatomy } from "@ark-ui/solid/anatomy";
import { defineSlotRecipe } from "@pandacss/dev";

export const field = defineSlotRecipe({
  className: "field",
  slots: fieldAnatomy.keys(),
  base: {
    root: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
    },
    label: {
      alignItems: "center",
      color: "var(--spatial-map-copy-dim)",
      display: "flex",
      fontSize: "12px",
      fontWeight: "500",
      gap: "0.5",
      lineHeight: "1.3",
      textAlign: "start",
      userSelect: "none",
      _disabled: {
        layerStyle: "disabled",
      },
    },
    requiredIndicator: {
      color: "colorPalette.solid",
    },
    helperText: {
      color: "var(--spatial-map-copy-dim)",
      fontSize: "11px",
      lineHeight: "1.35",
      _disabled: {
        layerStyle: "disabled",
      },
    },
    errorText: {
      color: "error",
      fontSize: "11px",
    },
  },
});
