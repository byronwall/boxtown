import {
  ClipboardIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SettingsIcon,
  XIcon,
} from "lucide-solid";
import { For, createSignal } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import * as Menu from "~/components/ui/menu";
import { Text } from "~/components/ui/text";
import { toaster } from "~/components/ui/toast";
import type { ProjectRecord } from "~/lib/projects/types";
import { ProjectMetadataSettingsDialog } from "./ProjectMetadataSettingsDialog";
import { buildVisibleNodesMarkdown } from "./spatial-map-markdown-export";
import { SpatialMapCreateContextNodeDialog } from "./SpatialMapCreateContextNodeDialog";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapGlobalFilterMenu } from "./SpatialMapGlobalFilterMenu";
import { InspectorToggle } from "./SpatialMapInspectorHeader";

interface SpatialMapToolbarProps {
  project: ProjectRecord;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}

export function SpatialMapToolbar(props: SpatialMapToolbarProps) {
  const spatialMap = useSpatialMap();
  const [contextNodeDialogOpen, setContextNodeDialogOpen] = createSignal(false);
  const copyVisibleNodesAsMarkdown = async () => {
    try {
      const markdown = buildVisibleNodesMarkdown({
        project: props.project,
        visibleData: spatialMap.visibleData(),
        origin: typeof window === "undefined" ? undefined : window.location.origin,
      });

      await navigator.clipboard.writeText(markdown);
      toaster.success({
        title: "Markdown copied",
        description: `${spatialMap.visibleData().nodes.length} visible nodes are now in your clipboard.`,
      });
    } catch (error) {
      toaster.error({
        title: "Copy failed",
        description:
          error instanceof Error
            ? error.message
            : "The visible node markdown could not be copied.",
      });
    }
  };

  return (
    <Box
      class="spatial-map-topbar"
      display="grid"
      gridTemplateColumns={{ base: "minmax(0, 1fr)", xl: "minmax(0, 1fr) auto minmax(0, 1fr)" }}
      alignItems="center"
      gap="8px"
      minH="54px"
      p="8px 10px"
      border="1px solid rgba(119, 125, 117, 0.42)"
      borderRadius={{ base: "6px", md: "8px" }}
      background="rgba(248, 250, 248, 0.9)"
      boxShadow={`
        inset 0 1px 0 rgba(255, 255, 255, 0.72),
        0 10px 28px rgba(29, 33, 28, 0.06)
      `}
    >
      <HStack gap="3" alignItems="center" minW="0" overflow="hidden" justifySelf="start">
        <Box display="flex" minW="0" alignItems="baseline" gap="8px">
          {!props.backHref ? (
            <Text
              as="span"
              display="inline-flex"
              p="3px 6px"
              border="1px solid rgba(45, 111, 72, 0.34)"
              borderRadius="4px"
              background="rgba(229, 239, 229, 0.74)"
              color="var(--spatial-map-accent-strong)"
              fontSize="11px"
              lineHeight="1"
              letterSpacing="0.12em"
              textTransform="none"
            >
              {props.eyebrow ?? "System map / operator view"}
            </Text>
          ) : null}
          <Box
            as="h1"
            m="0"
            color="#141816"
            fontSize="clamp(1rem, 1.45vw, 1.35rem)"
            lineHeight="1"
            fontWeight="740"
            letterSpacing="-0.04em"
            textTransform="none"
            whiteSpace="nowrap"
            overflow="hidden"
            textOverflow="ellipsis"
          >
            {props.title ?? "Recipe Architecture Grid"}
          </Box>
          <ProjectMetadataSettingsDialog
            project={props.project}
            onProjectUpdated={props.onProjectUpdated}
            trigger={(open) => (
              <IconButton
                colorPalette="green"
                variant="outline"
                size="xs"
                flexShrink="0"
                alignSelf="center"
                w="24px"
                minW="24px"
                h="24px"
                minH="24px"
                aria-label="Project settings"
                title="Project settings"
                onClick={() => open()}
              >
                <SettingsIcon size={15} aria-hidden="true" />
              </IconButton>
            )}
          />
        </Box>
      </HStack>

      <HStack
        gap="1.5"
        flexWrap="wrap"
        justifyContent="flex-end"
        alignContent="center"
        alignItems="center"
        justifySelf="end"
        minW="0"
      >
        {spatialMap.isolationModeActive() ? (
          <Button
            colorPalette="green"
            variant="outline"
            size="xs"
            class="spatial-map-isolation-clear"
            ml="-6px"
            borderColor="var(--spatial-map-panel-border-strong)"
            color="var(--spatial-map-copy-muted)"
            background="rgba(231, 235, 228, 0.98)"
            _hover={{
              color: "var(--spatial-map-copy)",
              background: "rgba(219, 227, 217, 0.98)",
            }}
            aria-label="Clear isolation"
            onClick={() => spatialMap.clearIsolation()}
          >
            <XIcon size={14} aria-hidden="true" />
          </Button>
        ) : null}
        <Menu.Root
          positioning={{ placement: "bottom-start", gutter: 4 }}
          size="sm"
        >
          <Menu.Trigger
            asChild={(triggerProps) => (
              <Button
                {...triggerProps()}
                colorPalette="green"
                variant="surface"
                size="xs"
                aria-label="Create nodes"
              >
                <PlusIcon size={16} />
              </Button>
            )}
          />
          <Menu.Positioner>
            <Menu.Content minW="190px" borderRadius="0" fontFamily="inherit" textTransform="none">
              <Menu.Item
                value="add-nodes"
                onClick={() => spatialMap.openAddNodesFlow()}
              >
                <Menu.ItemText>Add Nodes</Menu.ItemText>
              </Menu.Item>
              <Menu.Item
                value="decompose-source"
                onClick={() => spatialMap.openSourceDecompositionFlow()}
              >
                <Menu.ItemText>Decompose Source</Menu.ItemText>
              </Menu.Item>
              <Menu.Item
                value="new-context-node"
                onClick={() => setContextNodeDialogOpen(true)}
              >
                <Menu.ItemText>New Context Node</Menu.ItemText>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
        <Menu.Root
          positioning={{ placement: "bottom-start", gutter: 4 }}
          size="sm"
        >
          <Menu.Trigger
            asChild={(triggerProps) => (
              <Button
                {...triggerProps()}
                colorPalette="green"
                variant="outline"
                size="xs"
                aria-label="More map actions"
              >
                <MoreHorizontalIcon size={16} aria-hidden="true" />
              </Button>
            )}
          />
          <Menu.Positioner>
            <Menu.Content minW="190px" borderRadius="0" fontFamily="inherit" textTransform="none">
              <Menu.Item
                value="copy-visible-nodes-markdown"
                onClick={copyVisibleNodesAsMarkdown}
              >
                <ClipboardIcon size={14} aria-hidden="true" />
                <Menu.ItemText>Copy as Markdown</Menu.ItemText>
              </Menu.Item>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
        <SpatialMapCreateContextNodeDialog
          project={props.project}
          onProjectUpdated={props.onProjectUpdated}
          open={contextNodeDialogOpen()}
          onOpenChange={setContextNodeDialogOpen}
          trigger={() => null}
        />
        <SpatialMapGlobalFilterMenu />
        <HStack
          gap="0"
          class="spatial-map-toggle-group"
          overflow="hidden"
          border="1px solid var(--spatial-map-panel-border-strong)"
          borderColor="rgba(96, 101, 95, 0.44)"
          borderRadius="6px"
          background="rgba(246, 248, 244, 0.94)"
          boxShadow={`
            inset 0 1px 0 rgba(255, 255, 255, 0.36),
            inset 0 -1px 0 rgba(44, 52, 46, 0.14)
          `}
          aria-label="Map view mode"
        >
          <Button
            colorPalette="green"
            variant={spatialMap.viewMode() === "canvas" ? "surface" : "outline"}
            size="xs"
            class={`spatial-map-toggle-button${spatialMap.viewMode() === "canvas" ? " is-active" : ""}`}
            minW="34px"
            borderWidth="0 1px 0 0"
            borderColor="rgba(24, 29, 26, 0.24)"
            background={spatialMap.viewMode() === "canvas" ? "rgba(229, 239, 229, 0.96)" : "transparent"}
            color={spatialMap.viewMode() === "canvas" ? "var(--spatial-map-accent-strong)" : undefined}
            boxShadow={
              spatialMap.viewMode() === "canvas"
                ? "inset 0 0 0 1px rgba(45, 111, 72, 0.42), inset 0 -2px 0 rgba(45, 111, 72, 0.86)"
                : undefined
            }
            aria-pressed={spatialMap.viewMode() === "canvas"}
            onClick={() => spatialMap.setViewMode("canvas")}
          >
            Canvas
          </Button>
          <Button
            colorPalette="green"
            variant={spatialMap.viewMode() === "tree" ? "surface" : "outline"}
            size="xs"
            class={`spatial-map-toggle-button${spatialMap.viewMode() === "tree" ? " is-active" : ""}`}
            minW="34px"
            borderWidth="0 1px 0 0"
            borderColor="rgba(24, 29, 26, 0.24)"
            background={spatialMap.viewMode() === "tree" ? "rgba(229, 239, 229, 0.96)" : "transparent"}
            color={spatialMap.viewMode() === "tree" ? "var(--spatial-map-accent-strong)" : undefined}
            boxShadow={
              spatialMap.viewMode() === "tree"
                ? "inset 0 0 0 1px rgba(45, 111, 72, 0.42), inset 0 -2px 0 rgba(45, 111, 72, 0.86)"
                : undefined
            }
            aria-pressed={spatialMap.viewMode() === "tree"}
            onClick={() => spatialMap.setViewMode("tree")}
          >
            Tree
          </Button>
          <Button
            colorPalette="green"
            variant={spatialMap.viewMode() === "grid" ? "surface" : "outline"}
            size="xs"
            class={`spatial-map-toggle-button${spatialMap.viewMode() === "grid" ? " is-active" : ""}`}
            minW="34px"
            borderWidth="0"
            borderColor="rgba(24, 29, 26, 0.24)"
            background={spatialMap.viewMode() === "grid" ? "rgba(229, 239, 229, 0.96)" : "transparent"}
            color={spatialMap.viewMode() === "grid" ? "var(--spatial-map-accent-strong)" : undefined}
            boxShadow={
              spatialMap.viewMode() === "grid"
                ? "inset 0 0 0 1px rgba(45, 111, 72, 0.42), inset 0 -2px 0 rgba(45, 111, 72, 0.86)"
                : undefined
            }
            aria-pressed={spatialMap.viewMode() === "grid"}
            onClick={() => spatialMap.setViewMode("grid")}
          >
            Grid
          </Button>
        </HStack>
        <HStack
          gap="0"
          class="spatial-map-toggle-group"
          overflow="hidden"
          border="1px solid var(--spatial-map-panel-border-strong)"
          borderColor="rgba(96, 101, 95, 0.44)"
          borderRadius="6px"
          background="rgba(246, 248, 244, 0.94)"
          boxShadow={`
            inset 0 1px 0 rgba(255, 255, 255, 0.36),
            inset 0 -1px 0 rgba(44, 52, 46, 0.14)
          `}
          aria-label="Displayed hierarchy levels"
        >
          <For each={spatialMap.availableDepthLevels()}>
            {(level) => {
              const selection = () =>
                getDepthSelection(level, spatialMap.availableDepthLevels());
              const active = () =>
                spatialMap.visibleDepthSelection() === selection();
              const label = () =>
                getDepthLabel(level, spatialMap.availableDepthLevels());

              return (
                <Button
                  colorPalette="green"
                  variant={active() ? "surface" : "outline"}
                  size="xs"
                  class={`spatial-map-depth-button${active() ? " is-active" : ""}`}
                  minW="34px"
                  borderWidth="0 1px 0 0"
                  borderColor="rgba(24, 29, 26, 0.24)"
                  background={active() ? "rgba(229, 239, 229, 0.96)" : "transparent"}
                  color={active() ? "var(--spatial-map-accent-strong)" : undefined}
                  boxShadow={
                    active()
                      ? "inset 0 0 0 1px rgba(45, 111, 72, 0.42), inset 0 -2px 0 rgba(45, 111, 72, 0.86)"
                      : undefined
                  }
                  aria-label={`Show ${label()} hierarchy ${level === 1 ? "level" : "levels"}`}
                  aria-pressed={active()}
                  onClick={() => spatialMap.setVisibleDepthLevel(selection())}
                >
                  {label()}
                </Button>
              );
            }}
          </For>
        </HStack>
      </HStack>
    </Box>
  );
}

function getDepthSelection(level: number, availableLevels: number[]) {
  return level === availableLevels.at(-1) ? "max" : level;
}

function getDepthLabel(level: number, availableLevels: number[]) {
  return getDepthSelection(level, availableLevels) === "max" ? "Max" : level;
}
