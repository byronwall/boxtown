import { popoverAnatomy } from "@ark-ui/solid/anatomy";
import { defineSlotRecipe } from "@pandacss/dev";

export const popover = defineSlotRecipe({
  className: "popover",
  slots: popoverAnatomy.extendWith("header", "body", "footer").keys(),
  base: {
    content: {
      "--popover-bg": "#fbfcfb",
      "--popover-padding": "spacing.3",

      background: "var(--popover-bg)",
      borderWidth: "1px",
      borderColor: "olive.7",
      borderRadius: "6px",
      boxShadow: "0 8px 24px rgba(24, 32, 24, 0.15)",
      display: "flex",
      flexDirection: "column",
      maxHeight: "var(--available-height)",
      outline: "0",
      position: "relative",
      fontSize: "12px",
      transformOrigin: "var(--transform-origin)",
      width: "xs",
      zIndex: "calc(var(--z-index-popover) + var(--layer-index, 0))",
      _open: {
        animationStyle: "scale-fade-in",
        animationDuration: "fast",
      },
      _closed: {
        animationStyle: "scale-fade-out",
        animationDuration: "faster",
      },
    },
    title: {
      color: "#171c19",
      fontSize: "13px",
      fontWeight: "bold",
    },
    description: {
      color: "#475249",
      fontSize: "12px",
    },
    closeTrigger: {
      position: "absolute",
      top: "1",
      right: "1",
    },
    header: {
      display: "flex",
      flexDirection: "column",
      pt: "var(--popover-padding)",
      px: "var(--popover-padding)",
    },
    body: {
      p: "var(--popover-padding)",
      display: "flex",
      flex: "1",
      flexDirection: "column",
    },
    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      gap: "3",
      paddingInline: "var(--popover-padding)",
      paddingBottom: "var(--popover-padding)",
    },
    arrow: {
      "--arrow-size": "sizes.3",
      "--arrow-background": "var(--popover-bg)",
    },
    arrowTip: {
      borderTopWidth: "0.5px",
      borderInlineStartWidth: "0.5px",
    },
  },
});
