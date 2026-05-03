import { A, useAction } from "@solidjs/router";
import { For, createSignal } from "solid-js";
import { css } from "styled-system/css";
import { Box, Grid, HStack, Stack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { createProject } from "~/lib/projects/data";
import type { ProjectSummary } from "~/lib/projects/types";
import { ProjectDeleteControl } from "./ProjectDeleteControl";
import { ProjectExportControl } from "./ProjectExportControl";
import { ProjectImportControl } from "./ProjectImportControl";

interface ProjectIndexPageProps {
  projects: ProjectSummary[];
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monoFont =
  '"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace';

const projectLinkClass = css({
  color: "inherit",
  display: "block",
  outline: "none",
  textDecoration: "none",
  _focusVisible: {
    boxShadow: "0 0 0 2px token(colors.green.9)",
  },
});

export function ProjectIndexPage(props: ProjectIndexPageProps) {
  const submitCreateProject = useAction(createProject);
  const [creatingProject, setCreatingProject] = createSignal(false);
  const totalNodes = () => props.projects.reduce((count, project) => count + project.nodeCount, 0);
  const totalLinks = () => props.projects.reduce((count, project) => count + project.linkCount, 0);

  return (
    <Box
      minH="100dvh"
      color="fg.default"
      backgroundColor="olive.4"
      backgroundImage="
        radial-gradient(circle at 15% 8%, rgba(48,164,108,0.16), transparent 28rem),
        radial-gradient(circle at 88% 20%, rgba(137,142,135,0.14), transparent 30rem),
        repeating-linear-gradient(0deg, rgba(31,36,33,0.045) 0 1px, transparent 1px 40px),
        repeating-linear-gradient(90deg, rgba(31,36,33,0.035) 0 1px, transparent 1px 40px),
        linear-gradient(180deg, rgba(248,250,248,0.96), rgba(223,226,223,1))
      "
    >
      <Box maxW="7xl" mx="auto" px={{ base: "3", md: "5" }} py={{ base: "3", md: "6" }}>
        <Box
          borderWidth="1px"
          borderColor="olive.8"
          bg="rgba(252,253,252,0.94)"
          borderRadius="l3"
          boxShadow="0 28px 70px rgba(29,33,28,0.2), 0 0 0 1px rgba(255,255,255,0.64), inset 0 1px 0 rgba(255,255,255,0.88)"
          overflow="hidden"
        >
          <Stack gap="0">
            <Box
              px={{ base: "4", md: "6" }}
              py={{ base: "4", md: "5" }}
              borderBottomWidth="1px"
              borderColor="olive.7"
              bg="rgba(248,250,248,0.9)"
            >
              <HStack justifyContent="space-between" alignItems="start" gap="4" flexWrap="wrap">
                <Box maxW="2xl">
                  <Heading as="h1" textStyle="3xl" lineHeight="1.05">
                    Projects
                  </Heading>
                  <Text mt="1" textStyle="sm" color="fg.muted">
                    Create a project, import one, or open existing work.
                  </Text>
                </Box>
                <HStack
                  gap="3"
                  borderWidth="1px"
                  borderColor="olive.7"
                  borderRadius="l2"
                  px="4"
                  py="2"
                  bg="olive.1"
                  boxShadow="inset 0 1px 0 rgba(255,255,255,0.8)"
                  alignSelf={{ base: "stretch", md: "start" }}
                  flex={{ base: "1 1 100%", md: "0 0 auto" }}
                  flexWrap="wrap"
                >
                  <SummaryItem value={props.projects.length} label="projects" />
                  <SummaryItem value={totalNodes()} label="nodes" />
                  <SummaryItem value={totalLinks()} label="links" />
                </HStack>
              </HStack>
            </Box>

            <Grid
              gap="0"
              gridTemplateColumns={{ base: "1fr", lg: "minmax(300px, 340px) minmax(0, 1fr)" }}
              alignItems="start"
              bg="olive.3"
            >
              <Box
                borderRightWidth={{ base: "0", lg: "1px" }}
                borderBottomWidth={{ base: "1px", lg: "0" }}
                borderColor="olive.7"
                bg="olive.3"
              >
                <Box px="4" py="4" borderBottomWidth="1px" borderColor="olive.7" bg="olive.2">
                  <Heading as="h2" textStyle="md" lineHeight="1.2">
                    New project
                  </Heading>
                  <Text mt="1" textStyle="sm" color="fg.muted">
                    Start with an empty grid.
                  </Text>
                </Box>
                <Box px="4" py="4" borderBottomWidth="1px" borderColor="olive.7" bg="olive.1">
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      if (creatingProject()) {
                        return;
                      }

                      setCreatingProject(true);
                      void submitCreateProject(new FormData(event.currentTarget))
                        .catch(() => setCreatingProject(false));
                    }}
                  >
                    <VStack alignItems="stretch" gap="3">
                      <Field.Root>
                        <Field.Label fontSize="sm">
                          Name
                        </Field.Label>
                        <Input
                          name="name"
                          placeholder="Untitled Project"
                          borderRadius="l1"
                          variant="surface"
                          h="10"
                          px="3"
                        />
                        <Field.HelperText color="fg.muted">
                          Leave blank for an untitled grid.
                        </Field.HelperText>
                      </Field.Root>
                      <Button
                        type="submit"
                        size="sm"
                        loading={creatingProject()}
                        loadingText="Initializing"
                        colorPalette="green"
                        borderRadius="l1"
                        h="10"
                      >
                        Create
                      </Button>
                    </VStack>
                  </form>
                </Box>
                <Box px="4" py="4" bg="olive.2">
                  <ProjectImportControl />
                </Box>
              </Box>

              <VStack alignItems="stretch" gap="0" bg="olive.1">
                <Box
                  px={{ base: "4", md: "5" }}
                  py="4"
                  borderBottomWidth="1px"
                  borderColor="olive.7"
                  bg="olive.1"
                >
                  <HStack justifyContent="space-between" alignItems="center" gap="4" flexWrap="wrap">
                    <Heading as="h2" textStyle="md">
                      Existing projects
                    </Heading>
                    <Text textStyle="sm" color="fg.muted">
                      {props.projects.length} total
                    </Text>
                  </HStack>
                </Box>

                <VStack alignItems="stretch" gap="0" bg="olive.1">
                  <For each={props.projects}>
                    {(project) => (
                      <Box
                        borderBottomWidth="1px"
                        borderColor="olive.6"
                        bg="olive.1"
                        transition="background-color 160ms ease, box-shadow 160ms ease"
                        _hover={{ bg: "olive.2", boxShadow: "inset 3px 0 0 token(colors.green.9)" }}
                      >
                        <Grid
                          gridTemplateColumns={{ base: "1fr", md: "minmax(0, 1fr) minmax(220px, 316px) auto" }}
                          gap={{ base: "3", md: "4" }}
                          alignItems="center"
                          px={{ base: "4", md: "5" }}
                          py="4"
                        >
                          <Box minW="0">
                            <A href={`/projects/${project.id}`} class={projectLinkClass}>
                              <Heading as="h3" textStyle="md" lineHeight="1.25">
                                {project.name}
                              </Heading>
                              <Text mt="1" textStyle="sm" color="fg.muted" lineClamp="2" maxW="68ch">
                                {project.description}
                              </Text>
                              <Text mt="2" textStyle="xs" color="fg.subtle" fontFamily={monoFont}>
                                {project.id}
                              </Text>
                            </A>
                          </Box>

                          <HStack gap="2" color="fg.muted" flexWrap="wrap" textStyle="sm">
                            <ProjectStat value={project.nodeCount} label="nodes" />
                            <ProjectStat value={project.linkCount} label="links" />
                            <ProjectStat value={dateFormatter.format(new Date(project.updatedAt))} />
                          </HStack>
                          <HStack
                            gap="2"
                            justifyContent={{ base: "end", md: "start" }}
                            gridColumn={{ base: "1", md: "auto" }}
                          >
                            <ProjectExportControl projectId={project.id} projectName={project.name} />
                            <ProjectDeleteControl projectId={project.id} projectName={project.name} />
                          </HStack>
                        </Grid>
                      </Box>
                    )}
                  </For>
                </VStack>
              </VStack>
            </Grid>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}

function ProjectStat(props: { label?: string; value: number | string }) {
  return (
    <HStack
      as="span"
      gap="1"
      borderWidth="1px"
      borderColor="olive.6"
      borderRadius="l1"
      bg="olive.2"
      px="2"
      py="1"
      whiteSpace="nowrap"
    >
      <Text as="span" color="fg.default" fontWeight="medium" fontVariantNumeric="tabular-nums">
        {props.value}
      </Text>
      {props.label && (
        <Text as="span" color="fg.muted">
          {props.label}
        </Text>
      )}
    </HStack>
  );
}

function SummaryItem(props: { label: string; value: number }) {
  return (
    <HStack gap="1" whiteSpace="nowrap">
      <Text as="span" textStyle="md" fontWeight="semibold">
        {props.value}
      </Text>
      <Text as="span" textStyle="sm" color="fg.muted">
        {props.label}
      </Text>
    </HStack>
  );
}
