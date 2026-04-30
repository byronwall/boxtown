import { A } from "@solidjs/router";
import {
  ClipboardIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-solid";
import { For, createSignal } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import * as Menu from "~/components/ui/menu";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { toaster } from "~/components/ui/toast";
import type { ProjectRecord } from "~/lib/projects/types";
import { ProjectMetadataSettingsDialog } from "./ProjectMetadataSettingsDialog";
import { buildVisibleNodesMarkdown } from "./spatial-map-markdown-export";
import type { SpatialMapNodeColorMode } from "./spatial-map-canvas.types";
import { SpatialMapCreateContextNodeDialog } from "./SpatialMapCreateContextNodeDialog";
import { useSpatialMap } from "./SpatialMapContext";
import { InspectorToggle } from "./SpatialMapInspectorHeader";

interface SpatialMapToolbarProps {
  project: ProjectRecord;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  backHref?: string;
  backLabel?: string;
  nodeColorMode: SpatialMapNodeColorMode;
  onNodeColorModeChange: (mode: SpatialMapNodeColorMode) => void;
  onProjectUpdated?: (project: ProjectRecord) => void;
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
    <Box class="spatial-map-topbar">
      <HStack gap="3" alignItems="center" class="spatial-map-topbar-copy">
        <Box class="spatial-map-title-row">
          {props.backHref ? (
            <A
              href={props.backHref}
              class="spatial-map-backlink"
              aria-label={props.backLabel ?? "Back"}
            >
              &lt; Back
            </A>
          ) : (
            <Text as="span" class="spatial-map-eyebrow">
              {props.eyebrow ?? "System map / operator view"}
            </Text>
          )}
          <Box as="h1" class="spatial-map-title">
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
                class="spatial-map-button spatial-map-icon-button spatial-map-title-settings-button"
                aria-label="Project settings"
                title="Project settings"
                onClick={open}
              >
                <SettingsIcon size={15} aria-hidden="true" />
              </IconButton>
            )}
          />
        </Box>
      </HStack>

      <Box
        class="spatial-map-color-controls spatial-map-color-controls--header"
        role="group"
        aria-label="Node color mode"
      >
        <Box as="span" class="spatial-map-color-controls-label">
          Color
        </Box>
        <button
          type="button"
          class={`spatial-map-color-toggle${props.nodeColorMode === "type" ? " is-active" : ""}`}
          aria-pressed={props.nodeColorMode === "type"}
          onClick={() => props.onNodeColorModeChange("type")}
        >
          Type
        </button>
        <button
          type="button"
          class={`spatial-map-color-toggle${props.nodeColorMode === "status" ? " is-active" : ""}`}
          aria-pressed={props.nodeColorMode === "status"}
          onClick={() => props.onNodeColorModeChange("status")}
        >
          Status
        </button>
      </Box>

      <HStack
        gap="1.5"
        flexWrap="wrap"
        justifyContent="flex-end"
        class="spatial-map-control-strip"
      >
        {spatialMap.isolationModeActive() ? (
          <Button
            colorPalette="green"
            variant="outline"
            size="xs"
            class="spatial-map-button spatial-map-icon-button spatial-map-isolation-clear"
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
                class="spatial-map-button spatial-map-icon-button spatial-map-button--strong"
                aria-label="Create nodes"
              >
                <PlusIcon size={16} />
              </Button>
            )}
          />
          <Menu.Positioner>
            <Menu.Content class="spatial-map-create-menu">
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
                class="spatial-map-button spatial-map-icon-button"
                aria-label="More map actions"
              >
                <MoreHorizontalIcon size={16} aria-hidden="true" />
              </Button>
            )}
          />
          <Menu.Positioner>
            <Menu.Content class="spatial-map-create-menu">
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
        <Menu.Root
          positioning={{ placement: "bottom-end", gutter: 4 }}
          size="sm"
        >
          <Menu.Trigger
            asChild={(triggerProps) => (
              <Button
                {...triggerProps()}
                colorPalette="green"
                variant="outline"
                size="xs"
                class="spatial-map-button spatial-map-icon-button"
                aria-label="Display options"
              >
                <SlidersHorizontalIcon size={16} aria-hidden="true" />
              </Button>
            )}
          />
          <Menu.Positioner>
            <Menu.Content class="spatial-map-create-menu">
              {spatialMap.isolationModeActive() ? (
                <Tooltip
                  content="Show nodes directly linked to the isolated node, even when they are outside the isolated branch."
                  openDelay={150}
                  closeDelay={80}
                  positioning={{ placement: "left" }}
                >
                  <Menu.CheckboxItem
                    value="show-linked"
                    checked={spatialMap.showLinkedInIsolation()}
                    onClick={() => spatialMap.toggleLinkedInIsolation()}
                  >
                    <Menu.ItemText>Show Linked</Menu.ItemText>
                    <Menu.ItemIndicator />
                  </Menu.CheckboxItem>
                </Tooltip>
              ) : null}
              <Menu.CheckboxItem
                value="show-edges"
                checked={spatialMap.showEdges()}
                onClick={() => spatialMap.toggleEdges()}
              >
                <Menu.ItemText>Show Edges</Menu.ItemText>
                <Menu.ItemIndicator />
              </Menu.CheckboxItem>
            </Menu.Content>
          </Menu.Positioner>
        </Menu.Root>
        <HStack
          gap="0"
          class="spatial-map-toggle-group"
          aria-label="Map view mode"
        >
          <Button
            colorPalette="green"
            variant={spatialMap.viewMode() === "canvas" ? "surface" : "outline"}
            size="xs"
            class={`spatial-map-button spatial-map-toggle-button${spatialMap.viewMode() === "canvas" ? " is-active" : ""}`}
            aria-pressed={spatialMap.viewMode() === "canvas"}
            onClick={() => spatialMap.setViewMode("canvas")}
          >
            Canvas
          </Button>
          <Button
            colorPalette="green"
            variant={spatialMap.viewMode() === "tree" ? "surface" : "outline"}
            size="xs"
            class={`spatial-map-button spatial-map-toggle-button${spatialMap.viewMode() === "tree" ? " is-active" : ""}`}
            aria-pressed={spatialMap.viewMode() === "tree"}
            onClick={() => spatialMap.setViewMode("tree")}
          >
            Tree
          </Button>
          <Button
            colorPalette="green"
            variant={spatialMap.viewMode() === "grid" ? "surface" : "outline"}
            size="xs"
            class={`spatial-map-button spatial-map-toggle-button${spatialMap.viewMode() === "grid" ? " is-active" : ""}`}
            aria-pressed={spatialMap.viewMode() === "grid"}
            onClick={() => spatialMap.setViewMode("grid")}
          >
            Grid
          </Button>
        </HStack>
        <HStack
          gap="0"
          class="spatial-map-toggle-group"
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
                  class={`spatial-map-button spatial-map-depth-button${active() ? " is-active" : ""}`}
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
        {!spatialMap.inspectorOpen() ? <InspectorToggle inToolbar /> : null}
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
