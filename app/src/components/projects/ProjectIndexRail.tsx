import { Archive, Plus } from "lucide-solid";
import type { Component } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { Heading } from "~/components/ui/heading";
import { Input } from "~/components/ui/input";
import { Text } from "~/components/ui/text";
import { ProjectImportControl } from "./ProjectImportControl";

type ProjectIndexRailProps = {
  creatingProject: boolean;
  onSubmit: (form: HTMLFormElement) => void;
};

export function ProjectIndexRail(props: ProjectIndexRailProps) {
  return (
    <Box
      display="flex"
      flexDirection="column"
      minH="0"
      borderRight={{ base: "0", lg: "1px solid var(--spatial-map-panel-border-strong)" }}
      borderBottom={{ base: "1px solid var(--spatial-map-panel-border-strong)", lg: "0" }}
      bg="rgba(248, 250, 248, 0.9)"
    >
      <Box px="16px" py="14px" borderBottom="1px solid var(--spatial-map-panel-border)">
        <Heading as="h2" fontSize="22px" lineHeight="1.05" letterSpacing="0">
          Project index
        </Heading>
        <Text mt="8px" color="var(--spatial-map-copy-muted)" fontSize="12px" lineHeight="1.55">
          Create, import, or open product grids.
        </Text>
      </Box>

      <Box px="16px" py="16px" borderBottom="1px solid var(--spatial-map-panel-border)">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            props.onSubmit(event.currentTarget);
          }}
        >
          <VStack alignItems="stretch" gap="12px">
            <SectionLabel icon={Plus} label="New project" />
            <Field.Root>
              <Field.Label fontSize="12px" fontWeight="700">
                Name
              </Field.Label>
              <Input
                name="name"
                placeholder="Untitled Project"
                borderRadius="4px"
                variant="surface"
                h="36px"
                px="10px"
                fontSize="13px"
              />
              <Field.HelperText color="var(--spatial-map-copy-dim)" fontSize="11px">
                Leave blank for an untitled grid.
              </Field.HelperText>
            </Field.Root>
            <Button
              type="submit"
              size="xs"
              variant="surface"
              loading={props.creatingProject}
              loadingText="Initializing"
              colorPalette="green"
              borderRadius="4px"
              borderColor="var(--spatial-map-panel-border-strong)"
              h="34px"
            >
              <Box as={Plus} boxSize="14px" />
              <Text as="span">Create</Text>
            </Button>
          </VStack>
        </form>
      </Box>

      <Box px="16px" py="16px">
        <SectionLabel icon={Archive} label="Import archive" />
        <Box mt="12px">
          <ProjectImportControl />
        </Box>
      </Box>
    </Box>
  );
}

function SectionLabel(props: { icon: Component<{ size?: number | string }>; label: string }) {
  return (
    <HStack gap="7px" color="var(--spatial-map-copy)" fontSize="12px" fontWeight="700">
      <Box as={props.icon} boxSize="14px" color="var(--spatial-map-accent-strong)" />
      <Text as="span">{props.label}</Text>
    </HStack>
  );
}
