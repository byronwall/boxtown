import { A } from "@solidjs/router";
import { css } from "styled-system/css";
import { Box, Grid, HStack } from "styled-system/jsx";
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
      borderBottom="1px solid var(--spatial-map-panel-border)"
      bg="rgba(252, 253, 252, 0.72)"
      transition="background-color 160ms ease, box-shadow 160ms ease"
      _hover={{ bg: "rgba(239, 244, 238, 0.92)" }}
    >
      <Grid
        gridTemplateColumns={{ base: "1fr", md: "minmax(0, 1fr) minmax(230px, 332px) auto" }}
        gap={{ base: "10px", md: "14px" }}
        alignItems="center"
        px={{ base: "12px", md: "14px" }}
        py="12px"
      >
        <Box minW="0">
          <A href={`/projects/${props.project.id}`} class={projectLinkClass}>
            <Heading as="h3" fontSize="15px" lineHeight="1.25" letterSpacing="0">
              {props.project.name}
            </Heading>
            <Text
              mt="4px"
              fontSize="12px"
              color="var(--spatial-map-copy-muted)"
              lineClamp="2"
              maxW="68ch"
              lineHeight="1.45"
            >
              {props.project.description}
            </Text>
            <Text mt="7px" fontSize="11px" color="var(--spatial-map-copy-dim)">
              {props.project.id}
            </Text>
          </A>
        </Box>

        <HStack gap="6px" color="var(--spatial-map-copy-muted)" flexWrap="wrap" fontSize="12px">
          <ProjectStat value={props.project.nodeCount} label="nodes" />
          <ProjectStat value={props.project.linkCount} label="links" />
          <ProjectStat value={dateFormatter.format(new Date(props.project.updatedAt))} />
        </HStack>
        <HStack gap="6px" justifyContent={{ base: "end", md: "start" }} gridColumn={{ base: "1", md: "auto" }}>
          <ProjectExportControl projectId={props.project.id} projectName={props.project.name} />
          <ProjectDeleteControl projectId={props.project.id} projectName={props.project.name} />
        </HStack>
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
