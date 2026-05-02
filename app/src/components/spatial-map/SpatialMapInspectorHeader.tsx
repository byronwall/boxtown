import { Show, createMemo } from "solid-js";
import type { JSX } from "solid-js";
import { Box, VStack } from "styled-system/jsx";
import { IconButton } from "~/components/ui/icon-button";
import { Text } from "~/components/ui/text";
import { useSpatialMap } from "./SpatialMapContext";

interface SpatialMapInspectorHeaderProps {
  title: string;
  titleContent?: JSX.Element;
  kicker?: string;
  description?: string;
  controls?: string;
  closeLabel?: string;
  onClose?: () => void;
}

export function SpatialMapInspectorHeader(props: SpatialMapInspectorHeaderProps) {
  return (
    <Box
      w="100%"
      display="grid"
      gridTemplateColumns="minmax(0, 1fr) auto"
      alignItems="start"
      gap="6px"
      p="0 0 10px"
      borderBottom="1px solid rgba(96, 101, 95, 0.26)"
    >
      <VStack alignItems="start" gap="1" minW="0">
        <Show when={props.kicker}>
          {(kicker) => (
            <Text
              as="span"
              textStyle="xs"
              display="inline-flex"
              p="3px 6px"
              border="1px solid rgba(45, 111, 72, 0.34)"
              borderRadius="4px"
              background="rgba(229, 239, 229, 0.74)"
              color="var(--spatial-map-accent-strong)"
              fontSize="11px"
              lineHeight="1"
              letterSpacing="0.12em"
              textTransform="none"
            >
              {kicker()}
            </Text>
          )}
        </Show>
        <Show
          when={props.titleContent}
          fallback={<InspectorTitle>{props.title}</InspectorTitle>}
        >
          {(titleContent) => (
            <InspectorTitle>
              {titleContent()}
            </InspectorTitle>
          )}
        </Show>
        <Show when={props.description}>
          {(description) => (
            <Text
              as="p"
              m="0"
              color="var(--spatial-map-copy-muted)"
              fontSize="12px"
              lineHeight="1.5"
              maxW="none"
            >
              {description()}
            </Text>
          )}
        </Show>
      </VStack>
      <InspectorToggle
        inToolbar={false}
        expanded
        controls={props.controls}
        expandedLabel={props.closeLabel}
        onClick={props.onClose}
      />
    </Box>
  );
}

export function InspectorToggle(props: {
  inToolbar: boolean;
  expanded?: boolean;
  controls?: string;
  expandedLabel?: string;
  collapsedLabel?: string;
  onClick?: () => void;
}) {
  const spatialMap = useSpatialMap();
  const expanded = createMemo(() => props.expanded ?? spatialMap.inspectorOpen());
  const label = createMemo(() =>
    expanded()
      ? props.expandedLabel ?? "Hide inspector panel"
      : props.collapsedLabel ?? "Show inspector panel"
  );

  return (
    <IconButton
      class={`spatial-map-inspector-toggle${props.inToolbar ? " is-toolbar" : ""}`}
      display="inline-flex"
      alignItems="center"
      justifyContent="center"
      justifySelf={props.inToolbar ? undefined : "end"}
      alignSelf={props.inToolbar ? "stretch" : undefined}
      w="28px"
      minW="28px"
      h="28px"
      p="0"
      border="1px solid var(--spatial-map-panel-border-strong)"
      borderRadius="4px"
      background="rgba(231, 235, 228, 0.98)"
      color="var(--spatial-map-copy)"
      fontFamily="inherit"
      fontSize="15px"
      lineHeight="1"
      fontWeight="700"
      cursor="pointer"
      appearance="none"
      flexShrink="0"
      transition="background-color 160ms ease, border-color 160ms ease, color 160ms ease, box-shadow 160ms ease, transform 160ms ease"
      _hover={{ background: "rgba(221, 229, 220, 0.98)" }}
      _active={{ transform: "scale(0.98)" }}
      _focusVisible={{
        outline: "none",
        borderColor: "rgba(23, 62, 39, 0.56)",
        boxShadow: "inset 0 0 0 1px rgba(23, 62, 39, 0.34)",
      }}
      onClick={props.onClick ?? (() => spatialMap.setInspectorOpen((current) => !current))}
      aria-expanded={expanded()}
      aria-controls={props.controls ?? "spatial-map-inspector"}
      aria-label={label()}
      title={label()}
    >
      <Box
        as="span"
        aria-hidden="true"
        display="inline-flex"
        alignItems="center"
        justifyContent="center"
        w="100%"
        transform="translateX(-0.5px)"
      >
        {expanded() ? ">" : "<"}
      </Box>
    </IconButton>
  );
}

function InspectorTitle(props: { children: JSX.Element }) {
  return (
    <Box
      as="h2"
      m="0"
      color="#141816"
      fontSize="1.24rem"
      lineHeight="1.18"
      fontWeight="700"
      letterSpacing="-0.04em"
      textTransform="none"
      overflowWrap="anywhere"
    >
      {props.children}
    </Box>
  );
}
