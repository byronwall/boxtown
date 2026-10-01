import { useAction } from "@solidjs/router";
import { Plus } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Box, HStack, styled } from "styled-system/jsx";
import { AppHeader } from "~/components/app-shell/AppHeader";
import { Button } from "~/components/ui/button";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { createProject } from "~/lib/projects/data";
import type { ProjectSummary } from "~/lib/projects/types";
import { ProjectImportControl } from "./ProjectImportControl";
import { ProjectIndexRow } from "./ProjectIndexRow";

interface ProjectIndexPageProps {
  projects: ProjectSummary[];
}

const monoFont =
  '"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace';

const CreateForm = styled("form");

export function ProjectIndexPage(props: ProjectIndexPageProps) {
  const submitCreateProject = useAction(createProject);
  const [creatingProject, setCreatingProject] = createSignal(false);
  const totalNodes = () => props.projects.reduce((count, project) => count + project.nodeCount, 0);
  const totalLinks = () => props.projects.reduce((count, project) => count + project.linkCount, 0);
  const summary = () =>
    `${formatCount(props.projects.length, "project")} · ${formatCount(totalNodes(), "node")} · ${formatCount(totalLinks(), "link")}`;

  return (
    <Box
      display="grid"
      gridTemplateRows="auto minmax(0, 1fr)"
      minH="100dvh"
      w="100%"
      color="var(--spatial-map-copy)"
      fontFamily={monoFont}
      background="var(--spatial-map-bg)"
    >
      <AppHeader
        actions={
          <Text as="span" color="var(--spatial-map-copy-dim)" fontSize="12px" fontVariantNumeric="tabular-nums">
            {summary()}
          </Text>
        }
      >
        <Heading as="h1" fontSize="16px" lineHeight="1.25" letterSpacing="-0.02em">
          Projects
        </Heading>
      </AppHeader>

      <Box as="main" w="100%" maxW="960px" mx="auto" p={{ base: "12px", md: "16px 16px 32px" }}>
        <HStack gap="2" flexWrap="wrap" mb="8px">
          <CreateForm
            display="flex"
            alignItems="center"
            gap="2"
            flex="1 1 280px"
            minW="0"
            onSubmit={(event) => {
              event.preventDefault();
              if (creatingProject()) {
                return;
              }

              setCreatingProject(true);
              void submitCreateProject(new FormData(event.currentTarget)).catch(() => setCreatingProject(false));
            }}
          >
            <Input
              name="name"
              aria-label="New project name"
              placeholder="New project name"
              variant="surface"
              flex="1"
              minW="0"
              maxW="360px"
              h="32px"
              px="10px"
              borderRadius="4px"
              fontSize="13px"
            />
            <Button
              type="submit"
              size="xs"
              variant="surface"
              colorPalette="green"
              loading={creatingProject()}
              loadingText="Creating"
            >
              <Plus size={14} />
              Create
            </Button>
          </CreateForm>
          <ProjectImportControl />
        </HStack>

        <Box
          as="ul"
          m="0"
          p="0"
          listStyle="none"
          overflow="hidden"
          border="1px solid var(--spatial-map-panel-border)"
          borderRadius="6px"
          background="var(--spatial-map-panel-strong)"
        >
          <For each={props.projects}>
            {(project, index) => (
              <Box as="li" borderTop={index() === 0 ? "0" : "1px solid var(--spatial-map-panel-divider)"}>
                <ProjectIndexRow project={project} />
              </Box>
            )}
          </For>
          <Show when={props.projects.length === 0}>
            <Box as="li" p="10px 12px" color="var(--spatial-map-copy-dim)" fontSize="12px">
              No projects yet. Name one above and press Create, or import an archive.
            </Box>
          </Show>
        </Box>
      </Box>
    </Box>
  );
}

function formatCount(value: number, noun: string) {
  return `${value} ${noun}${value === 1 ? "" : "s"}`;
}
