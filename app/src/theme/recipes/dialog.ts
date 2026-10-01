import { dialogAnatomy } from "@ark-ui/solid/anatomy";
import { defineSlotRecipe } from "@pandacss/dev";

export const dialog = defineSlotRecipe({
  className: "dialog",
  slots: dialogAnatomy.extendWith("header", "body", "footer").keys(),
  base: {
    backdrop: {
      // A quiet scrim: the page stays visible so the dialog reads as a layer over it.
      background: "rgba(30, 36, 32, 0.32)",
      height: "100dvh",
      left: "0",
      position: "fixed",
      top: "0",
      width: "100dvw",
      zIndex: "var(--z-index)",
      _open: {
        animationName: "fade-in",
        animationTimingFunction: "emphasized-in",
        animationDuration: "fast",
      },
      _closed: {
        animationName: "fade-out",
        animationTimingFunction: "emphasized-out",
        animationDuration: "fast",
      },
    },
    positioner: {
      "--dialog-z-index": "zIndex.modal",
      display: "flex",
      height: "100dvh",
      justifyContent: "center",
      left: 0,
      overscrollBehaviorY: "none",
      position: "fixed",
      top: 0,
      width: "100dvw",
      zIndex: "calc(var(--dialog-z-index) + var(--layer-index, 0))",
    },

    title: {
      color: "#171c19",
      fontSize: "14px",
      fontWeight: "bold",
      lineHeight: "1.3",
    },
    description: {
      color: "#475249",
      fontSize: "12px",
      lineHeight: "1.4",
    },
    closeTrigger: {
      pos: "absolute",
      top: "2",
      insetEnd: "2",
      zIndex: "1",
    },
    content: {
      "--dialog-z-index": "zIndex.modal",
      bg: "#fbfcfb",
      borderWidth: "1px",
      borderColor: "olive.7",
      borderRadius: "8px",
      boxShadow: "0 8px 24px rgba(24, 32, 24, 0.15)",
      color: "#171c19",
      display: "flex",
      flexDirection: "column",
      my: "var(--dialog-margin, var(--dialog-base-margin))",
      outline: 0,
      position: "relative",
      fontSize: "13px",
      lineHeight: "1.45",
      width: "100%",
      zIndex: "calc(var(--dialog-z-index) + var(--layer-index, 0))",
      gap: "0",
      _open: {
        animationDuration: "moderate",
      },
      _closed: {
        animationDuration: "fast",
      },
    },
    header: {
      display: "flex",
      flexDirection: "column",
      gap: "0.5",
      // Leave room for the close button.
      pl: "4",
      pr: "10",
      py: "2.5",
      flex: "0",
      borderBottomWidth: "1px",
      borderColor: "olive.6",
    },
    body: {
      display: "flex",
      flex: "1",
      flexDirection: "column",
      alignItems: "flex-start",
      px: "4",
      py: "3",
    },
    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      flex: "0",
      gap: "2",
      px: "4",
      py: "2.5",
      borderTopWidth: "1px",
      borderColor: "olive.6",
    },
  },
  defaultVariants: {
    size: "md",
    scrollBehavior: "outside",
    placement: "center",
    motionPreset: "scale",
  },
  variants: {
    motionPreset: {
      scale: {
        content: {
          _open: { animationName: "scale-in, fade-in" },
          _closed: { animationName: "scale-out, fade-out" },
        },
      },
      "slide-in-bottom": {
        content: {
          _open: { animationName: "slide-from-bottom, fade-in" },
          _closed: { animationName: "slide-to-bottom, fade-out" },
        },
      },
      "slide-in-top": {
        content: {
          _open: { animationName: "slide-from-top, fade-in" },
          _closed: { animationName: "slide-to-top, fade-out" },
        },
      },
      "slide-in-left": {
        content: {
          _open: { animationName: "slide-from-left, fade-in" },
          _closed: { animationName: "slide-to-left, fade-out" },
        },
      },
      "slide-in-right": {
        content: {
          _open: { animationName: "slide-from-right, fade-in" },
          _closed: { animationName: "slide-to-right, fade-out" },
        },
      },
      none: {},
    },
    size: {
      xs: { content: { maxW: "xs" } },
      sm: { content: { maxW: "sm" } },
      md: { content: { maxW: "md" } },
      lg: { content: { maxW: "lg" } },
      xl: { content: { maxW: "xl" } },
      cover: {
        positioner: { padding: "8" },
        content: {
          width: "100%",
          height: "100%",
          "--dialog-margin": "0",
        },
      },
      full: {
        content: {
          maxW: "100dvw",
          minH: "100dvh",
          "--dialog-margin": "0",
          borderRadius: "0",
        },
      },
    },
    placement: {
      center: {
        positioner: {
          alignItems: "center",
        },
        content: {
          "--dialog-base-margin": "auto",
          mx: "auto",
        },
      },
      top: {
        positioner: {
          alignItems: "flex-start",
        },
        content: {
          "--dialog-base-margin": "spacing.16",
          mx: "auto",
        },
      },
      bottom: {
        positioner: {
          alignItems: "flex-end",
        },
        content: {
          "--dialog-base-margin": "spacing.16",
          mx: "auto",
        },
      },
    },
    scrollBehavior: {
      inside: {
        positioner: {
          overflow: "hidden",
        },
        content: {
          maxH: "calc(100% - 7.5rem)",
        },
        body: {
          overflow: "auto",
        },
      },
      outside: {
        positioner: {
          overflow: "auto",
          pointerEvents: "auto",
        },
      },
    },
  },
});
