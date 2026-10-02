import { useParams } from "@solidjs/router";
import { FolderKanbanIcon } from "lucide-solid";
import { createMemo, createResource, type Accessor } from "solid-js";
import { Box, HStack, styled } from "styled-system/jsx";
import { getProjects } from "~/lib/projects/data";
import { searchProjects } from "~/lib/projects/project-search";
import type { ProjectSummary } from "~/lib/projects/types";

const PROJECT_RESULT_LIMIT = 5;

const CommandProjectButton = styled("button");

// Projects other than the current one that match the command menu query.
// With an empty query, the most recently updated projects act as a quick switcher.
export function useCommandMenuProjects(open: Accessor<boolean>, query: Accessor<string>) {
  const params = useParams<{ projectId?: string }>();
  // Only fetch once the menu has been opened; the list is small and cached by query().
  const [projects] = createResource(
    () => (open() ? true : undefined),
    () => getProjects(),
  );

  return createMemo(() =>
    searchProjects(projects.latest ?? [], query(), params.projectId).slice(0, PROJECT_RESULT_LIMIT),
  );
}

export function CommandProjectRow(props: {
  project: ProjectSummary;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <CommandProjectButton
      _active={{ transform: "scale(0.99)" }}
      type="button"
      role="option"
      aria-selected={props.active}
      display="block"
      w="100%"
      p="8px 10px"
      border="1px solid"
      borderColor={props.active ? "rgba(84, 90, 86, 0.38)" : "transparent"}
      borderRadius="6px"
      background={props.active ? "rgba(233, 235, 232, 0.52)" : "transparent"}
      color="var(--spatial-map-copy)"
      cursor="pointer"
      textAlign="left"
      _hover={{
        borderColor: "rgba(84, 90, 86, 0.38)",
        background: "rgba(233, 235, 232, 0.52)",
      }}
      _focusVisible={{ outline: "2px solid rgba(84, 90, 86, 0.7)", outlineOffset: "2px" }}
      onMouseEnter={() => props.onHover()}
      onClick={() => props.onSelect()}
    >
      <HStack gap="2" minW="0">
        <FolderKanbanIcon size={15} aria-hidden="true" />
        <Box flex="1 1 auto" minW="0" overflow="hidden" fontWeight="760" lineHeight="1.25" textOverflow="ellipsis" whiteSpace="nowrap">
          {props.project.name}
        </Box>
        <Box as="span" flex="0 0 auto" color="var(--spatial-map-copy-dim)" fontSize="11px" fontWeight="760" whiteSpace="nowrap">
          {props.project.nodeCount} nodes · Open project
        </Box>
      </HStack>
    </CommandProjectButton>
  );
}

export function CommandSectionLabel(props: { children: string }) {
  return (
    <Box p="8px 10px 4px" color="var(--spatial-map-copy-dim)" fontSize="11px" fontWeight="760" letterSpacing="0.06em" textTransform="uppercase">
      {props.children}
    </Box>
  );
}
