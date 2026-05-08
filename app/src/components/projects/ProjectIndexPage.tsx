import { useAction } from "@solidjs/router";
import { FolderOpen } from "lucide-solid";
import { For, Show, createSignal } from "solid-js";
import { Box, HStack, Stack, VStack } from "styled-system/jsx";
import { Heading } from "~/components/ui/heading";
import { Text } from "~/components/ui/text";
import { createProject } from "~/lib/projects/data";
import type { ProjectSummary } from "~/lib/projects/types";
import { ProjectIndexRail } from "./ProjectIndexRail";
import { ProjectIndexRow } from "./ProjectIndexRow";

interface ProjectIndexPageProps {
  projects: ProjectSummary[];
}

const monoFont =
  '"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace';

export function ProjectIndexPage(props: ProjectIndexPageProps) {
  const submitCreateProject = useAction(createProject);
  const [creatingProject, setCreatingProject] = createSignal(false);
  const totalNodes = () => props.projects.reduce((count, project) => count + project.nodeCount, 0);
  const totalLinks = () => props.projects.reduce((count, project) => count + project.linkCount, 0);

  return (
    <Box
      position="relative"
      boxSizing="border-box"
      minH="100dvh"
      w="100%"
      overflow="hidden"
      padding={{ base: "8px", md: "clamp(12px, 2vw, 24px)" }}
      color="var(--spatial-map-copy)"
      fontFamily={monoFont}
      background="
        radial-gradient(circle at 15% 8%, rgba(48,164,108,0.16), transparent 28rem),
        radial-gradient(circle at 88% 20%, rgba(137,142,135,0.14), transparent 30rem),
        repeating-linear-gradient(0deg, rgba(31,36,33,0.045) 0 1px, transparent 1px 40px),
        repeating-linear-gradient(90deg, rgba(31,36,33,0.035) 0 1px, transparent 1px 40px),
        linear-gradient(180deg, rgba(248,250,248,0.96), rgba(223,226,223,1))
      "
      style={{
        "--spatial-map-panel": "rgba(252, 253, 252, 0.94)",
        "--spatial-map-panel-strong": "rgba(248, 250, 248, 0.92)",
        "--spatial-map-panel-border": "rgba(95, 101, 94, 0.34)",
        "--spatial-map-panel-border-strong": "rgba(96, 101, 95, 0.72)",
        "--spatial-map-copy": "#171c19",
        "--spatial-map-copy-muted": "#323b35",
        "--spatial-map-copy-dim": "#475249",
        "--spatial-map-accent": "#2d6f48",
        "--spatial-map-accent-strong": "#173e27",
      }}
    >
      <Box
        position="relative"
        zIndex="1"
        display="grid"
        gridTemplateColumns={{ base: "minmax(0, 1fr)", lg: "minmax(300px, 336px) minmax(0, 1fr)" }}
        w="100%"
        h={{ base: "auto", lg: "calc(100dvh - clamp(24px, 4vw, 48px))" }}
        minH={{ base: "calc(100dvh - 16px)", lg: "0" }}
        overflow="hidden"
        border="1px solid var(--spatial-map-panel-border-strong)"
        borderRadius="12px"
        background="var(--spatial-map-panel)"
        boxShadow="
          0 28px 70px rgba(29, 33, 28, 0.2),
          0 0 0 1px rgba(255, 255, 255, 0.64),
          inset 0 1px 0 rgba(255, 255, 255, 0.88)
        "
      >
        <ProjectIndexRail
          creatingProject={creatingProject()}
          onSubmit={(form) => {
            if (creatingProject()) {
              return;
            }

            setCreatingProject(true);
            void submitCreateProject(new FormData(form)).catch(() => setCreatingProject(false));
          }}
        />
        <Stack minW="0" minH="0" gap="8px" p={{ base: "8px", md: "10px" }} overflow="hidden" bg="rgba(229, 234, 226, 0.72)">
          <Box
            border="1px solid var(--spatial-map-panel-border)"
            borderRadius="6px"
            background="var(--spatial-map-panel-strong)"
            px={{ base: "10px", md: "12px" }}
            py="10px"
          >
            <HStack justifyContent="space-between" alignItems="center" gap="3" flexWrap="wrap">
              <HStack gap="2" minW="0">
                <Heading as="h1" fontSize={{ base: "18px", md: "20px" }} lineHeight="1.1" letterSpacing="0">
                  Projects
                </Heading>
              </HStack>
              <HStack gap="2" flexWrap="wrap" justifyContent="flex-end">
                <SummaryItem value={props.projects.length} label="projects" />
                <SummaryItem value={totalNodes()} label="nodes" />
                <SummaryItem value={totalLinks()} label="links" />
              </HStack>
            </HStack>
          </Box>

          <Box
            minH="0"
            overflow="hidden"
            border="1px solid var(--spatial-map-panel-border-strong)"
            borderRadius="6px"
            bg="rgba(252, 253, 252, 0.88)"
          >
            <HStack
              justifyContent="space-between"
              alignItems="center"
              gap="3"
              px={{ base: "12px", md: "14px" }}
              py="10px"
              borderBottom="1px solid var(--spatial-map-panel-border)"
              bg="rgba(248, 250, 248, 0.9)"
              flexWrap="wrap"
            >
              <HStack gap="2">
                <Box as={FolderOpen} boxSize="16px" color="var(--spatial-map-accent-strong)" />
                <Heading as="h2" fontSize="14px" lineHeight="1.2" letterSpacing="0">
                  Existing projects
                </Heading>
              </HStack>
              <Text fontSize="12px" color="var(--spatial-map-copy-dim)" fontWeight="700">
                {props.projects.length} total
              </Text>
            </HStack>

            <VStack alignItems="stretch" gap="0" maxH={{ base: "none", lg: "100%" }} overflowY={{ base: "visible", lg: "auto" }}>
              <Show
                when={props.projects.length > 0}
                fallback={
                  <Box p="24px" color="var(--spatial-map-copy-muted)" fontSize="13px" lineHeight="1.5">
                    No projects yet. Create one from the rail to start a grid.
                  </Box>
                }
              >
                <For each={props.projects}>
                  {(project) => (
                    <ProjectIndexRow project={project} />
                  )}
                </For>
              </Show>
            </VStack>
          </Box>
        </Stack>
      </Box>
    </Box>
  );
}

function SummaryItem(props: { label: string; value: number }) {
  return (
    <HStack
      gap="5px"
      px="8px"
      py="5px"
      border="1px solid var(--spatial-map-panel-border)"
      borderRadius="4px"
      bg="rgba(252, 253, 252, 0.74)"
      whiteSpace="nowrap"
    >
      <Text as="span" fontSize="13px" fontWeight="700" fontVariantNumeric="tabular-nums">
        {props.value}
      </Text>
      <Text as="span" fontSize="12px" color="var(--spatial-map-copy-dim)">
        {props.label}
      </Text>
    </HStack>
  );
}
