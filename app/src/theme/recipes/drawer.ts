import { dialogAnatomy } from "@ark-ui/solid/anatomy";
import { defineSlotRecipe } from "@pandacss/dev";

export const drawer = defineSlotRecipe({
  className: "drawer",
  slots: dialogAnatomy.extendWith("header", "body", "footer").keys(),
  base: {
    backdrop: {
      background: `
        radial-gradient(circle at 15% 8%, rgba(48, 164, 108, 0.16), transparent 28rem),
        radial-gradient(circle at 88% 20%, rgba(137, 142, 135, 0.14), transparent 30rem),
        repeating-linear-gradient(0deg, rgba(31, 36, 33, 0.045) 0 1px, transparent 1px 40px),
        repeating-linear-gradient(90deg, rgba(31, 36, 33, 0.035) 0 1px, transparent 1px 40px),
        linear-gradient(180deg, rgba(248, 250, 248, 0.9), rgba(223, 226, 223, 0.94))
      `,
      position: "fixed",
      insetInlineStart: "0",
      top: "0",
      width: "100vw",
      height: "100dvh",
      zIndex: "overlay",
      _open: {
        animationName: "fade-in",
        animationTimingFunction: "emphasized-in",
        animationDuration: "slow",
      },
      _closed: {
        animationName: "fade-out",
        animationTimingFunction: "emphasized-out",
        animationDuration: "normal",
      },
    },
    positioner: {
      display: "flex",
      width: "100vw",
      height: "100dvh",
      position: "fixed",
      insetInlineStart: "0",
      top: "0",
      zIndex: "modal",
      overscrollBehaviorY: "none",
    },
    content: {
      display: "flex",
      flexDirection: "column",
      position: "relative",
      width: "100%",
      maxW: "var(--drawer-size)",
      outline: 0,
      zIndex: "modal",
      maxH: "100dvh",
      color: "inherit",
      bg: "rgba(252, 253, 252, 0.94)",
      borderColor: "olive.8",
      boxShadow:
        "0 28px 70px rgba(29, 33, 28, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.64), inset 0 1px 0 rgba(255, 255, 255, 0.88)",
      _open: {
        animationDuration: "slowest",
        animationTimingFunction: "cubic-bezier(0.05, 0.7, 0.1, 1.0)",
      },
      _closed: {
        animationDuration: "normal",
        animationTimingFunction: "cubic-bezier(0.3, 0.0, 0.8, 0.15)",
      },
    },
    header: {
      display: "flex",
      flexDirection: "column",
      gap: "1",
      pt: { base: "4", md: "6" },
      pb: "4",
      px: { base: "4", md: "6" },
      flex: "0",
      borderBottomWidth: "1px",
      borderColor: "olive.7",
      bg: "rgba(248, 250, 248, 0.9)",
    },
    body: {
      display: "flex",
      flexDirection: "column",
      alignItems: "flex-start",
      flex: "1",
      overflow: "auto",
      p: { base: "4", md: "6" },
    },
    footer: {
      display: "flex",
      alignItems: "center",
      justifyContent: "flex-end",
      flex: "0",
      gap: "3",
      py: "4",
      px: { base: "4", md: "6" },
      borderTopWidth: "1px",
      borderColor: "olive.7",
      bg: "rgba(248, 250, 248, 0.82)",
    },
    title: {
      color: "fg.default",
      fontWeight: "bold",
      textStyle: "xl",
      lineHeight: "1.1",
    },
    description: {
      color: "fg.muted",
      textStyle: "sm",
    },
    closeTrigger: {
      pos: "absolute",
      top: "3",
      insetEnd: "3",
      borderWidth: "1px",
      borderColor: "olive.7",
      borderRadius: "l1",
      bg: "olive.1",
      boxShadow: "inset 0 1px 0 rgba(255, 255, 255, 0.78)",
      _hover: {
        bg: "olive.2",
        borderColor: "olive.8",
      },
      _focusVisible: {
        outline: "2px solid",
        outlineColor: "green.8",
        outlineOffset: "2px",
      },
    },
  },
  defaultVariants: {
    placement: "end",
    size: "sm",
  },
  variants: {
    size: {
      xs: {
        content: {
          "--drawer-size": "sizes.xs",
          "--drawer-block-size": "20dvh",
        },
      },
      sm: {
        content: {
          "--drawer-size": "sizes.sm",
          "--drawer-block-size": "28dvh",
        },
      },
      md: {
        content: {
          "--drawer-size": "sizes.md",
          "--drawer-block-size": "36dvh",
        },
      },
      lg: {
        content: {
          "--drawer-size": "sizes.lg",
          "--drawer-block-size": "48dvh",
        },
      },
      xl: {
        content: {
          "--drawer-size": "sizes.xl",
          "--drawer-block-size": "64dvh",
        },
      },
      full: {
        content: {
          "--drawer-size": "100vw",
          "--drawer-block-size": "100dvh",
          h: "100dvh",
        },
      },
    },
    placement: {
      start: {
        positioner: {
          justifyContent: "flex-start",
          alignItems: "stretch",
        },
        content: {
          borderRightWidth: "1px",
          _open: {
            animationName: {
              base: "slide-from-left-full, fade-in",
              _rtl: "slide-from-right-full, fade-in",
            },
          },
          _closed: {
            animationName: {
              base: "slide-to-left-full, fade-out",
              _rtl: "slide-to-right-full, fade-out",
            },
          },
        },
      },
      end: {
        positioner: {
          justifyContent: "flex-end",
          alignItems: "stretch",
        },
        content: {
          borderLeftWidth: "1px",
          _open: {
            animationName: {
              base: "slide-from-right-full, fade-in",
              _rtl: "slide-from-left-full, fade-in",
            },
          },
          _closed: {
            animationName: {
              base: "slide-to-right-full, fade-out",
              _rtl: "slide-to-left-full, fade-out",
            },
          },
        },
      },
      top: {
        positioner: {
          justifyContent: "stretch",
          alignItems: "flex-start",
        },
        content: {
          borderBottomWidth: "1px",
          width: "100vw",
          maxW: "100vw",
          h: "var(--drawer-block-size)",
          _open: { animationName: "slide-from-top-full, fade-in" },
          _closed: { animationName: "slide-to-top-full, fade-out" },
        },
      },

      bottom: {
        positioner: {
          justifyContent: "stretch",
          alignItems: "flex-end",
        },
        content: {
          borderTopWidth: "1px",
          width: "100vw",
          maxW: "100vw",
          h: "var(--drawer-block-size)",
          _open: { animationName: "slide-from-bottom-full, fade-in" },
          _closed: { animationName: "slide-to-bottom-full, fade-out" },
        },
      },
    },
  },
});
