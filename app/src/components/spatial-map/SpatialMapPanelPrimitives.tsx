import { Show, type JSX } from "solid-js";
import { ChevronRightIcon } from "lucide-solid";
import { Box, HStack, styled } from "styled-system/jsx";

import { Text } from "~/components/ui/text";

export function SpatialMapInspectorSection(props: {
  children: JSX.Element;
  error?: boolean;
  dragging?: boolean;
  gap?: string;
  minH?: string;
  overflow?: string;
  onDragEnter?: JSX.EventHandlerUnion<HTMLDivElement, DragEvent>;
  onDragOver?: JSX.EventHandlerUnion<HTMLDivElement, DragEvent>;
  onDragLeave?: JSX.EventHandlerUnion<HTMLDivElement, DragEvent>;
  onDrop?: JSX.EventHandlerUnion<HTMLDivElement, DragEvent>;
}) {
  return (
    <Box
      w="100%"
      minW="0"
      display="grid"
      gridTemplateColumns="minmax(0, 1fr)"
      pt="8px"
      borderTop="1px solid"
      style={{ gap: props.gap ?? "6px" }}
      borderColor={props.error ? "rgba(126, 41, 41, 0.28)" : props.dragging ? "rgba(23, 62, 39, 0.62)" : "var(--spatial-map-panel-divider)"}
      borderStyle={props.dragging ? "dashed" : "solid"}
      background={props.error ? "rgba(246, 235, 235, 0.82)" : props.dragging ? "rgba(218, 229, 216, 0.96)" : "transparent"}
      minH={props.minH}
      overflow={props.overflow}
      onDragEnter={props.onDragEnter}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
    >
      {props.children}
    </Box>
  );
}

export function SpatialMapBlockTitle(props: { as?: "h3" | "h4" | "span"; children: JSX.Element }) {
  return (
    <Text
      as={props.as ?? "h3"}
      margin="0"
      color="var(--spatial-map-copy-dim)"
      fontSize="11px"
      fontWeight="700"
      letterSpacing="0.08em"
      lineHeight="1.2"
      textTransform="uppercase"
    >
      {props.children}
    </Text>
  );
}

export function SpatialMapSectionHeader(props: {
  title: JSX.Element;
  count?: number;
  children?: JSX.Element;
}) {
  return (
    <HStack justifyContent="space-between" alignItems="center" gap="2" minH="22px">
      <HStack gap="1.5" minW="0">
        <SpatialMapBlockTitle>{props.title}</SpatialMapBlockTitle>
        <Show when={props.count}>
          <SpatialMapSectionCount>{props.count}</SpatialMapSectionCount>
        </Show>
      </HStack>
      {props.children}
    </HStack>
  );
}

function SpatialMapSectionCount(props: { children: JSX.Element }) {
  return (
    <Text as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" lineHeight="1.2" fontVariantNumeric="tabular-nums">
      {props.children}
    </Text>
  );
}

const CollapsibleTrigger = styled("button");

// Secondary inspector content: one dense row when closed, with a summary so
// empty groups do not need to be opened to learn that they are empty.
export function SpatialMapCollapsibleGroup(props: {
  title: string;
  summary: JSX.Element;
  open: boolean;
  onToggle: () => void;
  children: JSX.Element;
}) {
  return (
    <Box minW="0">
      <CollapsibleTrigger
        _active={{ transform: "scale(0.99)", background: "rgba(34, 41, 36, 0.1)" }}
        type="button"
        display="flex"
        alignItems="center"
        gap="1"
        w="100%"
        minH="24px"
        p="0"
        border="0"
        borderRadius="4px"
        background="transparent"
        color="var(--spatial-map-copy-dim)"
        font="inherit"
        textAlign="left"
        cursor="pointer"
        _hover={{ background: "rgba(34, 41, 36, 0.06)" }}
        _focusVisible={{ outline: "none", boxShadow: "inset 0 0 0 1px rgba(37, 95, 58, 0.56)" }}
        aria-expanded={props.open}
        onClick={() => props.onToggle()}
      >
        <Box
          as="span"
          display="inline-flex"
          transition="transform 120ms ease"
          transform={props.open ? "rotate(90deg)" : "rotate(0deg)"}
          aria-hidden="true"
        >
          <ChevronRightIcon size={13} />
        </Box>
        <SpatialMapBlockTitle as="span">{props.title}</SpatialMapBlockTitle>
        <Box as="span" flex="1" />
        <SpatialMapSectionCount>{props.summary}</SpatialMapSectionCount>
      </CollapsibleTrigger>
      <Show when={props.open}>
        <Box display="grid" gridTemplateColumns="minmax(0, 1fr)" gap="6px" p="2px 0 8px 17px">
          {props.children}
        </Box>
      </Show>
    </Box>
  );
}

export function SpatialMapEmptyState(props: { as?: "p" | "span"; children: JSX.Element }) {
  return (
    <Text
      as={props.as ?? "p"}
      margin="0"
      color="var(--spatial-map-copy-muted)"
      fontFamily={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`}
      fontSize="12px"
      lineHeight="1.4"
    >
      {props.children}
    </Text>
  );
}
