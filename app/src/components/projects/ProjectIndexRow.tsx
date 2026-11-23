import { A } from "@solidjs/router";
import { css } from "styled-system/css";
import { Box, HStack } from "styled-system/jsx";
import { Text } from "~/components/ui/text";
import type { ProjectSummary } from "~/lib/projects/types";
import { ProjectDeleteControl } from "./ProjectDeleteControl";
import { ProjectExportControl } from "./ProjectExportControl";
import { ProjectUnusedImagesControl } from "./ProjectUnusedImagesControl";

type ProjectIndexRowProps = {
  project: ProjectSummary;
};

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

// Router A is not a Panda styled component, so link styling is passed as a class.
const projectLinkClass = css({
  color: "inherit",
  display: "block",
  minW: "0",
  p: "8px 12px",
  outline: "none",
  textDecoration: "none",
  _focusVisible: {
    boxShadow: "inset 0 0 0 2px token(colors.green.9)",
  },
});

export function ProjectIndexRow(props: ProjectIndexRowProps) {
  const meta = () =>
    [
      `${props.project.nodeCount} ${props.project.nodeCount === 1 ? "node" : "nodes"}`,
      `${props.project.linkCount} ${props.project.linkCount === 1 ? "link" : "links"}`,
      `Updated ${dateFormatter.format(new Date(props.project.updatedAt))}`,
      props.project.id,
    ].join(" · ");

  return (
    <Box
      display="grid"
      gridTemplateColumns="minmax(0, 1fr) auto"
      alignItems="center"
      transition="background-color 120ms ease"
      _hover={{ background: "color-mix(in srgb, var(--spatial-map-ink) 5%, transparent)" }}
    >
      <A href={`/projects/${props.project.id}`} class={projectLinkClass}>
        <Text as="h2" m="0" fontSize="14px" fontWeight="700" lineHeight="1.3" overflowWrap="anywhere">
          {props.project.name}
        </Text>
        {props.project.description && (
          <Text mt="2px" fontSize="12px" color="var(--spatial-map-copy-muted)" lineClamp="2" maxW="78ch" lineHeight="1.45">
            {props.project.description}
          </Text>
        )}
        <Text
          mt="2px"
          fontSize="11px"
          color="var(--spatial-map-copy-dim)"
          overflow="hidden"
          textOverflow="ellipsis"
          whiteSpace="nowrap"
          title={meta()}
        >
          {meta()}
        </Text>
      </A>
      <HStack gap="1" pr="8px">
        <ProjectExportControl projectId={props.project.id} projectName={props.project.name} />
        <ProjectUnusedImagesControl projectId={props.project.id} projectName={props.project.name} />
        <ProjectDeleteControl projectId={props.project.id} projectName={props.project.name} />
      </HStack>
    </Box>
  );
}
