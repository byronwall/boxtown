import type { JSX } from "solid-js";
import { Box, HStack } from "styled-system/jsx";

import { Text } from "~/components/ui/text";

export function SpatialMapInspectorSection(props: {
  children: JSX.Element;
  error?: boolean;
  dragging?: boolean;
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
      display="grid"
      gap="9px"
      mt="8px"
      p="13px 0 0"
      border="0"
      borderTop="1px solid rgba(96, 101, 95, 0.16)"
      background={props.error ? "rgba(246, 235, 235, 0.82)" : props.dragging ? "rgba(218, 229, 216, 0.96)" : "transparent"}
      borderColor={props.error ? "rgba(126, 41, 41, 0.28)" : props.dragging ? "rgba(23, 62, 39, 0.62)" : "rgba(96, 101, 95, 0.16)"}
      borderStyle={props.dragging ? "dashed" : "solid"}
      boxShadow={props.dragging ? "inset 3px 0 0 rgba(23, 62, 39, 0.88)" : "none"}
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

export function SpatialMapBlockTitle(props: { children: JSX.Element }) {
  return (
    <Text
      as="h3"
      margin="0"
      color="var(--spatial-map-copy)"
      fontSize="sm"
      fontWeight="semibold"
      letterSpacing="-0.02em"
    >
      {props.children}
    </Text>
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
      letterSpacing="0.04em"
      lineHeight="1.35"
      textTransform="none"
    >
      {props.children}
    </Text>
  );
}

export function SpatialMapRelationName(props: { as?: "div" | "span"; children: JSX.Element }) {
  return (
    <Text as={props.as ?? "div"} color="var(--spatial-map-copy)" fontWeight="semibold" letterSpacing="-0.02em">
      {props.children}
    </Text>
  );
}

export function SpatialMapRelationMeta(props: { as?: "div" | "span"; children: JSX.Element }) {
  return (
    <Text
      as={props.as ?? "div"}
      color="var(--spatial-map-copy-muted)"
      fontFamily={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`}
      fontSize="12px"
      letterSpacing="0.04em"
      textTransform="none"
    >
      {props.children}
    </Text>
  );
}
