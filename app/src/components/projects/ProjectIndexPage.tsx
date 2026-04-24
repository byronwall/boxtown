import { A } from "@solidjs/router";
import { For } from "solid-js";
import { Box, Grid, HStack, Stack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { ProjectSummary } from "~/lib/projects/types";
import { ProjectDeleteControl } from "./ProjectDeleteControl";
import { ProjectExportControl } from "./ProjectExportControl";
import { ProjectImportControl } from "./ProjectImportControl";

interface ProjectIndexPageProps {
  projects: ProjectSummary[];
  createProjectActionUrl: string;
  createProjectSubmission?: { pending: boolean };
}

const dateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const monoFont =
  '"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace';

export function ProjectIndexPage(props: ProjectIndexPageProps) {
  const totalNodes = () => props.projects.reduce((count, project) => count + project.nodeCount, 0);
  const totalLinks = () => props.projects.reduce((count, project) => count + project.linkCount, 0);

  return (
    <Box
      minH="100dvh"
      color="#171c19"
      backgroundColor="#c9cec6"
      backgroundImage={`
        repeating-linear-gradient(0deg, rgba(31,36,33,0.08) 0 1px, transparent 1px 32px),
        repeating-linear-gradient(90deg, rgba(31,36,33,0.06) 0 1px, transparent 1px 32px)
      `}
    >
      <Box maxW="7xl" mx="auto" px={{ base: "3", md: "4" }} py={{ base: "3", md: "4" }}>
        <Box
          borderWidth="2px"
          borderColor="#414740"
          bg="#d8ddd5"
          boxShadow="inset 0 1px 0 rgba(255,255,255,0.22)"
        >
          <Stack gap="0">
            <Box px={{ base: "3", md: "4" }} py="3" borderBottomWidth="1px" borderColor="#596057">
              <HStack justifyContent="space-between" alignItems="start" gap="4" flexWrap="wrap">
                <Box maxW="2xl">
                  <Heading as="h1" textStyle="lg" lineHeight="1.05">
                    Projects
                  </Heading>
                  <Text mt="1" textStyle="sm" color="#4a524a">
                    Create a project, import one, or open existing work.
                  </Text>
                </Box>
                <HStack
                  gap="3"
                  borderWidth="1px"
                  borderColor="#596057"
                  px="3"
                  py="2"
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
              gridTemplateColumns={{ base: "1fr", lg: "minmax(280px, 320px) minmax(0, 1fr)" }}
              alignItems="start"
            >
              <Box
                borderRightWidth={{ base: "0", lg: "1px" }}
                borderBottomWidth={{ base: "1px", lg: "0" }}
                borderColor="#596057"
                bg="#d2d7cf"
              >
                <Box px="3" py="3" borderBottomWidth="1px" borderColor="#6a7168">
                  <Heading as="h2" textStyle="sm" lineHeight="1.05">
                    New project
                  </Heading>
                  <Text mt="1" textStyle="sm" color="#4a524a">
                    Start with an empty grid.
                  </Text>
              </Box>
              <Box px="3" py="3" borderBottomWidth="1px" borderColor="#6a7168">
                <form action={props.createProjectActionUrl} method="post">
                  <VStack alignItems="stretch" gap="2">
                    <Field.Root>
                      <Field.Label fontSize="sm">
                        Name
                      </Field.Label>
                      <Input
                        name="name"
                        placeholder="Untitled Project"
                        borderRadius="0"
                        borderColor="#51584f"
                        bg="#eef1eb"
                        h="9"
                        px="3"
                      />
                      <Field.HelperText color="#4a524a">
                        Leave blank for an untitled grid.
                      </Field.HelperText>
                    </Field.Root>
                    <Button
                      type="submit"
                      size="sm"
                      loading={props.createProjectSubmission?.pending}
                      loadingText="Initializing"
                      colorPalette="green"
                      borderRadius="0"
                      h="9"
                    >
                      Create
                    </Button>
                  </VStack>
                </form>
              </Box>
              <Box px="3" py="3">
                <ProjectImportControl />
              </Box>
            </Box>

            <VStack alignItems="stretch" gap="0">
              <Box
                px="3"
                py="2"
                borderBottomWidth="1px"
                borderColor="#596057"
                bg="#dfe3dd"
              >
                <HStack justifyContent="space-between" alignItems="center" gap="4" flexWrap="wrap">
                  <Heading as="h2" textStyle="sm">
                    Existing projects
                  </Heading>
                  <Text textStyle="sm" color="#4a524a">
                    {props.projects.length} total
                  </Text>
                </HStack>
              </Box>

              <VStack alignItems="stretch" gap="0">
                <For each={props.projects}>
                  {(project) => (
                    <Box
                      borderBottomWidth="1px"
                      borderColor="#596057"
                      bg="#e4e8e1"
                      _hover={{ bg: "#edf0eb" }}
                    >
                      <Grid
                        gridTemplateColumns={{ base: "1fr", md: "minmax(0, 1fr) 316px auto" }}
                        gap={{ base: "2", md: "3" }}
                        alignItems="center"
                        px="3"
                        py="2"
                      >
                        <Box minW="0">
                          <A href={`/projects/${project.id}`} style={{ display: "block", "text-decoration": "none", color: "inherit" }}>
                            <Heading as="h3" textStyle="md" lineHeight="1.05">
                              {project.name}
                            </Heading>
                            <Text mt="1" textStyle="sm" color="#414740" lineClamp="2">
                              {project.description}
                            </Text>
                            <Text mt="2" textStyle="xs" color="#5b635b" fontFamily={monoFont}>
                              {project.id}
                            </Text>
                          </A>
                        </Box>

                        <HStack gap="3" color="#30362f" flexWrap="wrap" fontFamily={monoFont} textStyle="sm">
                          <Text as="span">{project.nodeCount} nodes</Text>
                          <Text as="span">{project.linkCount} links</Text>
                          <Text as="span">{dateFormatter.format(new Date(project.updatedAt))}</Text>
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

function SummaryItem(props: { label: string; value: number }) {
  return (
    <HStack gap="1" whiteSpace="nowrap">
      <Text as="span" textStyle="md" fontWeight="semibold">
        {props.value}
      </Text>
      <Text as="span" textStyle="sm" color="#4a524a">
        {props.label}
      </Text>
    </HStack>
  );
}
