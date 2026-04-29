import { A } from "@solidjs/router";
import {
  FocusIcon,
  PlusIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  XIcon,
} from "lucide-solid";
import { For, createMemo, createSignal } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import * as Menu from "~/components/ui/menu";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import type { ProjectRecord } from "~/lib/projects/types";
import { ProjectMetadataSettingsDialog } from "./ProjectMetadataSettingsDialog";
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
  onProjectUpdated?: (project: ProjectRecord) => void;
}

export function SpatialMapToolbar(props: SpatialMapToolbarProps) {
  const spatialMap = useSpatialMap();
  const [contextNodeDialogOpen, setContextNodeDialogOpen] = createSignal(false);
  const isolationLabel = createMemo(() =>
    truncateIsolationLabel(spatialMap.isolationLabel()),
  );

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

      <HStack
        gap="1.5"
        flexWrap="wrap"
        justifyContent="flex-end"
        class="spatial-map-control-strip"
      >
        {spatialMap.isolationModeActive() ? (
          <>
            <Text as="span" class="spatial-map-isolation-readout">
              <FocusIcon size={14} aria-hidden="true" />
              <span>{isolationLabel()}</span>
            </Text>
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
          </>
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
        </HStack>
        <HStack
          gap="0"
          class="spatial-map-toggle-group"
          aria-label="Displayed hierarchy depth"
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

function truncateIsolationLabel(label: string | null) {
  const fallback = label ?? "Current node";
  return fallback.length > 16 ? `${fallback.slice(0, 15)}...` : fallback;
}

function getDepthSelection(level: number, availableLevels: number[]) {
  return level === availableLevels.at(-1) ? "max" : level;
}

function getDepthLabel(level: number, availableLevels: number[]) {
  return getDepthSelection(level, availableLevels) === "max" ? "Max" : level;
}
