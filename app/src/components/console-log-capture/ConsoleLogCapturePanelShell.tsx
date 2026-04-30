import type { JSX } from "solid-js";
import { Show, createEffect, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { Box } from "styled-system/jsx";

type ConsoleLogCapturePanelShellProps = {
  open: boolean;
  onClose: () => void;
  children: JSX.Element;
  /** If true, pressing Escape closes the panel (default true) */
  closeOnEsc?: boolean;
  /** ARIA label for the dialog container */
  ariaLabel?: string;
  /** Optional width override */
  width?: string;
};

export const ConsoleLogCapturePanelShell = (
  props: ConsoleLogCapturePanelShellProps,
) => {
  const shouldCloseOnEsc = () => props.closeOnEsc !== false;

  createEffect(() => {
    if (!props.open || !shouldCloseOnEsc()) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKey);
    onCleanup(() => window.removeEventListener("keydown", onKey));
  });

  // Lock background scroll while panel is open
  createEffect(() => {
    if (!props.open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    onCleanup(() => {
      document.body.style.overflow = previousOverflow;
    });
  });

  return (
    <Show when={props.open}>
      <Portal>
        <Box
          position="fixed"
          inset="0"
          zIndex="50"
          overflow="hidden"
          overscrollBehavior="contain"
          role="dialog"
          aria-modal="true"
          aria-label={props.ariaLabel || "Side panel"}
        >
          <Box
            position="absolute"
            inset="0"
            onClick={props.onClose}
            style={{
              background: `
                radial-gradient(circle at 15% 8%, rgba(48, 164, 108, 0.16), transparent 28rem),
                radial-gradient(circle at 88% 20%, rgba(137, 142, 135, 0.14), transparent 30rem),
                repeating-linear-gradient(0deg, rgba(31, 36, 33, 0.045) 0 1px, transparent 1px 40px),
                repeating-linear-gradient(90deg, rgba(31, 36, 33, 0.035) 0 1px, transparent 1px 40px),
                linear-gradient(180deg, rgba(248, 250, 248, 0.9), rgba(223, 226, 223, 0.94))
              `,
              "backdrop-filter": "blur(6px)",
            }}
          />
          <Box
            position="absolute"
            insetY="0"
            right="0"
            display="flex"
            flexDirection="column"
            h="full"
            maxH="full"
            overflowY="auto"
            overscrollBehavior="contain"
            borderLeftWidth="1px"
            borderColor="olive.8"
            bg="rgba(252, 253, 252, 0.94)"
            boxShadow="0 28px 70px rgba(29, 33, 28, 0.2), 0 0 0 1px rgba(255, 255, 255, 0.64), inset 0 1px 0 rgba(255, 255, 255, 0.88)"
            onClick={(e) => e.stopPropagation()}
            style={{
              width: props.width || "min(94vw, 560px)",
              "backdrop-filter": "blur(10px)",
            }}
          >
            {props.children}
          </Box>
        </Box>
      </Portal>
    </Show>
  );
};
