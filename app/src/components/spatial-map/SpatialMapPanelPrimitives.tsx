import type { JSX } from "solid-js";
import { Box, Grid, HStack, styled } from "styled-system/jsx";

import { Text } from "~/components/ui/text";

type FlowStepStatus = "active" | "completed" | "failed" | string;

const PanelButton = styled("button");

export function SpatialMapFlowRail(props: { id: string; children: JSX.Element }) {
  return (
    <Box minW="0" minH="0" h="100%" position="relative">
      <Box
        as="aside"
        id={props.id}
        position={{ base: "absolute", md: "static" }}
        right={{ base: "0", md: undefined }}
        top={{ base: "0", md: undefined }}
        bottom={{ base: "0", md: undefined }}
        zIndex={{ base: "2", md: undefined }}
        w={{ base: "min(92vw, 360px)", md: "360px" }}
        h="100%"
        minH="0"
        overflow="auto"
        p="12px"
        borderLeft="1px solid rgba(96, 101, 95, 0.38)"
        background="linear-gradient(180deg, rgba(248, 250, 248, 0.92), rgba(235, 239, 233, 0.96))"
        color="var(--spatial-map-copy)"
        boxShadow="inset 1px 0 0 rgba(255, 255, 255, 0.64), -12px 0 30px rgba(29, 33, 28, 0.04)"
        overscrollBehavior="contain"
      >
        {props.children}
      </Box>
    </Box>
  );
}

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

export function SpatialMapCopy(props: { children: JSX.Element }) {
  return (
    <Text
      as="p"
      margin="0"
      color="var(--spatial-map-copy-muted)"
      fontSize="12px"
      lineHeight="1.5"
      maxW="none"
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

export function SpatialMapInspectorRow(props: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <HStack
      justifyContent="space-between"
      alignItems="start"
      gap="3"
      pb="4px"
      borderBottom="1px solid rgba(34, 41, 36, 0.08)"
      _last={{ pb: "0", borderBottom: "0" }}
    >
      <Text
        as="span"
        color="var(--spatial-map-copy-dim)"
        fontSize="11px"
        fontWeight="700"
        letterSpacing="0.12em"
        lineHeight="1"
      >
        {props.label}
      </Text>
      <Text
        as="span"
        color="var(--spatial-map-copy)"
        fontFamily={props.mono ? `"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace` : undefined}
        fontSize="12px"
        fontWeight="600"
        lineHeight="1.1"
        textAlign="right"
      >
        {props.value}
      </Text>
    </HStack>
  );
}

export function SpatialMapRunStep(props: {
  status: FlowStepStatus;
  label: string;
  detail: string;
}) {
  const tone = () => getRunStepTone(props.status);

  return (
    <Box
      p="7px 8px"
      border="1px solid"
      borderColor={tone().border}
      background={tone().background}
      borderRadius="6px"
      transition="background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease"
    >
      <HStack justifyContent="space-between" alignItems="start" gap="3">
        <Text
          as="span"
          color="var(--spatial-map-copy)"
          fontSize="12px"
          fontWeight="700"
          letterSpacing="-0.02em"
        >
          {props.label}
        </Text>
        <Text
          as="span"
          color="var(--spatial-map-copy-dim)"
          fontSize="10px"
          letterSpacing="0.12em"
          lineHeight="1"
          textTransform="none"
        >
          {props.status}
        </Text>
      </HStack>
      <Text
        as="p"
        m="3px 0 0"
        color="var(--spatial-map-copy-muted)"
        fontSize="11px"
        lineHeight="1.4"
      >
        {props.detail}
      </Text>
    </Box>
  );
}

export function SpatialMapQuestionTitle(props: { children: JSX.Element }) {
  return (
    <Text as="div" color="var(--spatial-map-copy)" fontSize="12px" fontWeight="700" letterSpacing="-0.02em">
      {props.children}
    </Text>
  );
}

export function SpatialMapQuestionHelper(props: { children: JSX.Element }) {
  return (
    <Text as="div" m="3px 0 0" color="var(--spatial-map-copy-muted)" fontSize="11px" lineHeight="1.4">
      {props.children}
    </Text>
  );
}

export function SpatialMapAnswerGrid(props: { children: JSX.Element }) {
  return (
    <Grid gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }} gap="6px">
      {props.children}
    </Grid>
  );
}

export function SpatialMapOptionButton(props: {
  children: JSX.Element;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <PanelButton
      type="button"
      w="100%"
      p="9px 8px"
      border="1px solid"
      borderColor={props.selected ? "rgba(45, 111, 72, 0.74)" : "rgba(44, 52, 46, 0.24)"}
      borderRadius="6px"
      background={props.selected ? "rgba(229, 239, 229, 0.96)" : "rgba(239, 242, 237, 0.84)"}
      boxShadow={props.selected ? "inset 4px 0 0 var(--spatial-map-accent), inset 0 0 0 1px rgba(45, 111, 72, 0.12)" : "none"}
      color="var(--spatial-map-copy)"
      cursor="pointer"
      fontFamily="inherit"
      fontSize="11px"
      letterSpacing="0.05em"
      lineHeight="1.3"
      textAlign="left"
      transition="background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease, transform 180ms ease"
      aria-pressed={props.selected}
      _hover={{ borderColor: "rgba(45, 111, 72, 0.58)", boxShadow: "inset 4px 0 0 rgba(45, 111, 72, 0.24)" }}
      _focusVisible={{ outline: "none", borderColor: "rgba(45, 111, 72, 0.74)", boxShadow: "inset 4px 0 0 var(--spatial-map-accent)" }}
      onClick={props.onClick}
    >
      {props.children}
    </PanelButton>
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

export function SpatialMapCandidateRow(props: {
  children: JSX.Element;
  level: number;
}) {
  return (
    <HStack
      alignItems="start"
      gap="2"
      w="100%"
      p="8px 8px 8px 0"
      pl={`${8 + props.level * 16}px`}
      border="1px solid rgba(44, 52, 46, 0.24)"
      borderRadius="6px"
      background="rgba(239, 242, 237, 0.84)"
      transition="background-color 180ms ease, border-color 180ms ease"
      _groupChecked={{ borderColor: "rgba(23, 62, 39, 0.42)", background: "rgba(223, 230, 221, 0.96)" }}
    >
      {props.children}
    </HStack>
  );
}

function getRunStepTone(status: FlowStepStatus) {
  if (status === "active") {
    return { border: "rgba(37, 95, 58, 0.34)", background: "rgba(230, 237, 229, 0.9)" };
  }
  if (status === "failed") {
    return { border: "rgba(126, 41, 41, 0.28)", background: "rgba(246, 235, 235, 0.82)" };
  }
  return { border: "rgba(44, 52, 46, 0.24)", background: "rgba(239, 242, 237, 0.84)" };
}
