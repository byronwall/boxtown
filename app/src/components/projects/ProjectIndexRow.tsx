import { A } from "@solidjs/router";
import { css } from "styled-system/css";
import { Box, Grid, HStack, VStack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import type { ProjectSummary } from "~/lib/projects/types";
import { ProjectDeleteControl } from "./ProjectDeleteControl";
import { ProjectExportControl } from "./ProjectExportControl";

type ProjectIndexRowProps = {
  project: ProjectSummary;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const projectLinkClass = css({
  color: "inherit",
  display: "block",
  outline: "none",
  textDecoration: "none",
  _focusVisible: {
    boxShadow: "0 0 0 2px token(colors.green.9)",
  },
});

export function ProjectIndexRow(props: ProjectIndexRowProps) {
  return (
    <Box
      border="1px solid var(--spatial-map-panel-border)"
      borderRadius="6px"
      bg="rgba(252, 253, 252, 0.86)"
      boxShadow="0 8px 18px rgba(29, 33, 28, 0.045), inset 0 1px 0 rgba(255, 255, 255, 0.72)"
      transition="background-color 160ms ease, border-color 160ms ease, box-shadow 160ms ease"
      _hover={{
        bg: "rgba(255, 255, 255, 0.96)",
        borderColor: "rgba(45, 111, 72, 0.34)",
        boxShadow: "0 10px 24px rgba(29, 33, 28, 0.07), inset 0 1px 0 rgba(255, 255, 255, 0.82)",
      }}
    >
      <Grid
        gridTemplateColumns={{ base: "1fr", md: "minmax(0, 1fr) auto" }}
        gap={{ base: "12px", md: "16px" }}
        alignItems="start"
        px={{ base: "12px", md: "14px" }}
        py="13px"
      >
        <Box minW="0">
          <A href={`/projects/${props.project.id}`} class={projectLinkClass}>
            <HStack gap="2" alignItems="baseline" minW="0" flexWrap="wrap">
              <Heading as="h3" fontSize="15px" lineHeight="1.2" letterSpacing="0" minW="0">
                {props.project.name}
              </Heading>
              <Text as="span" fontSize="11px" color="var(--spatial-map-copy-dim)">
                Updated {dateFormatter.format(new Date(props.project.updatedAt))}
              </Text>
            </HStack>
            <Text
              mt="5px"
              fontSize="12px"
              color="var(--spatial-map-copy-muted)"
              lineClamp="2"
              maxW="78ch"
              lineHeight="1.45"
            >
              {props.project.description}
            </Text>
            <Text mt="8px" fontSize="11px" color="var(--spatial-map-copy-dim)" lineClamp="1">
              {props.project.id}
            </Text>
          </A>
        </Box>

        <VStack alignItems={{ base: "stretch", md: "end" }} gap="2">
          <HStack gap="6px" color="var(--spatial-map-copy-muted)" flexWrap="wrap" fontSize="12px" justifyContent={{ base: "start", md: "end" }}>
            <ProjectStat value={props.project.nodeCount} label="nodes" />
            <ProjectStat value={props.project.linkCount} label="links" />
          </HStack>
          <HStack gap="6px" justifyContent={{ base: "start", md: "end" }}>
            <ProjectExportControl projectId={props.project.id} projectName={props.project.name} />
            <ProjectDeleteControl projectId={props.project.id} projectName={props.project.name} />
          </HStack>
        </VStack>
      </Grid>
    </Box>
  );
}

function ProjectStat(props: { label?: string; value: number | string }) {
  return (
    <HStack
      as="span"
      gap="4px"
      border="1px solid var(--spatial-map-panel-border)"
      borderRadius="4px"
      bg="rgba(248, 250, 248, 0.86)"
      px="7px"
      py="4px"
      whiteSpace="nowrap"
    >
      <Text as="span" color="var(--spatial-map-copy)" fontWeight="700" fontVariantNumeric="tabular-nums">
        {props.value}
      </Text>
      {props.label && (
        <Text as="span" color="var(--spatial-map-copy-dim)">
          {props.label}
        </Text>
      )}
    </HStack>
  );
}
