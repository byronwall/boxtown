import { A } from "@solidjs/router";
import { For } from "solid-js";
import { Box, Grid, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Card from "~/components/ui/card";
import * as Field from "~/components/ui/field";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import type { ProjectSummary } from "~/lib/projects/types";

interface ProjectIndexPageProps {
  projects: ProjectSummary[];
  createProjectAction: any;
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
  return (
    <Box
      minH="100dvh"
      color="#171c19"
      backgroundColor="#c6cbc4"
      backgroundImage={`
        linear-gradient(180deg, rgba(255,255,255,0.14) 0%, rgba(255,255,255,0) 16%),
        repeating-linear-gradient(0deg, rgba(30,36,32,0.1) 0 1px, transparent 1px 24px),
        repeating-linear-gradient(90deg, rgba(30,36,32,0.08) 0 1px, transparent 1px 24px),
        linear-gradient(180deg, #d3d7d0 0%, #c6cbc4 100%)
      `}
    >
      <Box maxW="7xl" mx="auto" px={{ base: "3", md: "4" }} py={{ base: "3", md: "4" }}>
        <Box
          borderWidth="2px"
          borderColor="#414740"
          bg="#d9ddd6"
          boxShadow="inset 0 1px 0 rgba(255,255,255,0.22)"
        >
          <Grid
            gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 320px) minmax(0, 1fr)" }}
            borderBottomWidth="1px"
            borderColor="#596057"
          >
            <Box px="4" py="3" borderRightWidth={{ base: "0", lg: "1px" }} borderBottomWidth={{ base: "1px", lg: "0" }} borderColor="#596057">
              <Text
                as="div"
                textStyle="xs"
                textTransform="uppercase"
                letterSpacing="0.2em"
                fontWeight="bold"
                fontFamily={monoFont}
                color="#4a524a"
              >
                Registry / Product Grid
              </Text>
              <Heading as="h1" textStyle="lg" lineHeight="1.05" mt="2">
                Project index
              </Heading>
              <Text mt="2" textStyle="sm" color="#4a524a" maxW="72">
                Technical registry for project canvases. Create a blank grid, inspect existing work,
                and route directly into each project workspace.
              </Text>
            </Box>

            <Grid
              gridTemplateColumns={{ base: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }}
            >
              <RegistryMetric label="Projects" value={String(props.projects.length)} />
              <RegistryMetric
                label="Nodes"
                value={String(props.projects.reduce((count, project) => count + project.nodeCount, 0))}
              />
              <RegistryMetric
                label="Links"
                value={String(props.projects.reduce((count, project) => count + project.linkCount, 0))}
              />
              <RegistryMetric label="Mode" value="INDEX" accent />
            </Grid>
          </Grid>

          <Grid
            gap="0"
            gridTemplateColumns={{ base: "1fr", lg: "minmax(0, 320px) minmax(0, 1fr)" }}
            alignItems="start"
          >
            <Card.Root
              borderRadius="0"
              borderWidth="0"
              borderRightWidth={{ base: "0", lg: "1px" }}
              borderBottomWidth={{ base: "1px", lg: "0" }}
              borderColor="#596057"
              bg="#d4d8d1"
            >
              <Card.Header px="4" py="3" gap="2" borderBottomWidth="1px" borderColor="#6a7168">
                <Text
                  as="span"
                  textStyle="xs"
                  textTransform="uppercase"
                  letterSpacing="0.18em"
                  fontFamily={monoFont}
                  color="#4a524a"
                >
                  Control Bay
                </Text>
                <Heading as="h2" textStyle="md" lineHeight="1.05">
                  Initialize blank project
                </Heading>
                <Card.Description color="#4a524a">
                  New projects open as empty infinite grids. AI detail and context tools can layer on
                  later without changing the route structure.
                </Card.Description>
              </Card.Header>
              <Card.Body px="4" py="3">
                <form action={props.createProjectAction} method="post">
                  <VStack alignItems="stretch" gap="3">
                    <Field.Root>
                      <Field.Label fontSize="xs" textTransform="uppercase" letterSpacing="0.16em" fontFamily={monoFont}>
                        Project name
                      </Field.Label>
                      <Input
                        name="name"
                        placeholder="Untitled Project"
                        borderRadius="0"
                        borderColor="#51584f"
                        bg="#eef1eb"
                        h="10"
                        px="3"
                      />
                      <Field.HelperText color="#4a524a">
                        Leave blank to create a default project name and route straight into a new grid.
                      </Field.HelperText>
                    </Field.Root>
                    <Button
                      type="submit"
                      size="sm"
                      loading={props.createProjectSubmission?.pending}
                      loadingText="Initializing"
                      colorPalette="green"
                      borderRadius="0"
                      h="10"
                      textTransform="uppercase"
                      letterSpacing="0.12em"
                      fontFamily={monoFont}
                    >
                      Create project
                    </Button>
                  </VStack>
                </form>
              </Card.Body>
            </Card.Root>

            <VStack alignItems="stretch" gap="0">
              <Box
                px="4"
                py="3"
                borderBottomWidth="1px"
                borderColor="#596057"
                bg="#dfe2dc"
              >
                <HStack justifyContent="space-between" alignItems="end" gap="4" flexWrap="wrap">
                  <Box>
                    <Text
                      as="div"
                      textStyle="xs"
                      textTransform="uppercase"
                      letterSpacing="0.18em"
                      fontFamily={monoFont}
                      color="#4a524a"
                    >
                      Registry
                    </Text>
                    <Heading as="h2" textStyle="md" mt="1">
                      Available projects
                    </Heading>
                  </Box>
                  <Text textStyle="sm" color="#4a524a" fontFamily={monoFont}>
                    {props.projects.length} UNIT{props.projects.length === 1 ? "" : "S"} READY
                  </Text>
                </HStack>
              </Box>

              <Grid
                gap="0"
                gridTemplateColumns={{
                  base: "1fr",
                  xl: "repeat(2, minmax(0, 1fr))",
                }}
              >
                <For each={props.projects}>
                  {(project) => (
                    <A href={`/projects/${project.id}`} style={{ display: "block", "text-decoration": "none" }}>
                      <Box
                        h="full"
                        borderBottomWidth="1px"
                        borderRightWidth={{ base: "0", xl: "1px" }}
                        borderColor="#596057"
                        bg="#e8ebe5"
                        transition="background-color 120ms ease"
                        _hover={{ bg: "#edf0eb" }}
                      >
                        <Grid
                          gridTemplateColumns={{ base: "1fr", md: "minmax(0, 1fr) auto" }}
                          gap="0"
                          h="full"
                        >
                          <Box px="4" py="3" borderBottomWidth={{ base: "1px", md: "0" }} borderRightWidth={{ base: "0", md: "1px" }} borderColor="#6a7168">
                            <HStack justifyContent="space-between" alignItems="start" gap="3">
                              <Box minW="0">
                                <Text
                                  as="div"
                                  textStyle="xs"
                                  textTransform="uppercase"
                                  letterSpacing="0.18em"
                                  fontFamily={monoFont}
                                  color="#4a524a"
                                >
                                  {project.id}
                                </Text>
                                <Heading as="h3" textStyle="md" mt="1" lineHeight="1.05">
                                  {project.name}
                                </Heading>
                                <Text mt="2" textStyle="sm" color="#414740">
                                  {project.description}
                                </Text>
                              </Box>
                              <Text
                                as="span"
                                textStyle="xs"
                                px="2"
                                py="1"
                                borderWidth="1px"
                                borderColor="#5a6258"
                                fontFamily={monoFont}
                                textTransform="uppercase"
                                color="#1e4f39"
                                whiteSpace="nowrap"
                              >
                                Grid
                              </Text>
                            </HStack>
                          </Box>

                          <Grid
                            minW={{ base: "unset", md: "220px" }}
                            gridTemplateColumns="repeat(2, minmax(0, 1fr))"
                            gridTemplateRows="repeat(2, minmax(0, 1fr))"
                          >
                            <ProjectStat label="Nodes" value={String(project.nodeCount)} />
                            <ProjectStat label="Links" value={String(project.linkCount)} />
                            <ProjectStat
                              label="Updated"
                              value={dateFormatter.format(new Date(project.updatedAt))}
                              compact
                            />
                            <ProjectStat label="Route" value="Open" compact accent />
                          </Grid>
                        </Grid>
                      </Box>
                    </A>
                  )}
                </For>
              </Grid>
            </VStack>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}

function RegistryMetric(props: { label: string; value: string; accent?: boolean }) {
  return (
    <Box
      px="3"
      py="3"
      borderLeftWidth="1px"
      borderTopWidth={{ base: "1px", md: "0" }}
      borderColor="#596057"
      bg={props.accent ? "#d8e0d7" : "#dfe2dc"}
    >
      <Text
        textStyle="xs"
        textTransform="uppercase"
        letterSpacing="0.16em"
        fontFamily={monoFont}
        color="#4a524a"
      >
        {props.label}
      </Text>
      <Text mt="1" textStyle="lg" fontWeight="semibold">
        {props.value}
      </Text>
    </Box>
  );
}

function ProjectStat(props: {
  label: string;
  value: string;
  compact?: boolean;
  accent?: boolean;
}) {
  return (
    <Box
      borderWidth="1px"
      borderColor="#6a7168"
      borderTopWidth="0"
      borderLeftWidth="0"
      bg={props.accent ? "#dbe3da" : "#e3e7e0"}
      px="3"
      py="3"
    >
      <Text
        textStyle="xs"
        textTransform="uppercase"
        letterSpacing="0.16em"
        color="#4a524a"
        fontFamily={monoFont}
      >
        {props.label}
      </Text>
      <Text
        mt="1"
        textStyle={props.compact ? "sm" : "xl"}
        fontWeight="semibold"
        fontFamily={props.compact ? monoFont : undefined}
      >
        {props.value}
      </Text>
    </Box>
  );
}
