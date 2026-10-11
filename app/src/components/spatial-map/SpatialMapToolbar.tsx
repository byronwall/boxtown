import {
  FilePlusIcon,
  PlusIcon,
  SettingsIcon,
  XIcon,
} from "lucide-solid";
import { Show, createMemo, createSignal } from "solid-js";
import { Box, HStack } from "styled-system/jsx";
import { AppHeader } from "~/components/app-shell/AppHeader";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import * as Menu from "~/components/ui/menu";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import type { ProjectRecord } from "~/lib/projects/types";
import { ProjectMetadataSettingsDialog } from "./ProjectMetadataSettingsDialog";
import type { SpatialMapDepthLevel, SpatialMapViewMode } from "./spatial-map-canvas.types";
import { SpatialMapCreateContextNodeDialog } from "./SpatialMapCreateContextNodeDialog";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapGlobalFilterMenu } from "./SpatialMapGlobalFilterMenu";
import { SpatialMapProjectActionsMenu } from "./SpatialMapProjectActionsMenu";
import { SpatialMapSegmentedControl, type SpatialMapSegmentedOption } from "./SpatialMapSegmentedControl";

const VIEW_MODE_OPTIONS: SpatialMapSegmentedOption<SpatialMapViewMode>[] = [
  { value: "canvas", label: "Canvas" },
  { value: "tree", label: "Tree" },
  { value: "grid", label: "Grid" },
];

interface SpatialMapToolbarProps {
  project: ProjectRecord;
  title?: string;
  backHref?: string;
  backLabel?: string;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}

export function SpatialMapToolbar(props: SpatialMapToolbarProps) {
  const spatialMap = useSpatialMap();
  const [contextNodeDialogOpen, setContextNodeDialogOpen] = createSignal(false);
  // Hide the trigger tooltip while its menu is open so it never covers the first item.
  const [createMenuOpen, setCreateMenuOpen] = createSignal(false);
  const [createTooltipOpen, setCreateTooltipOpen] = createSignal(false);
  const depthOptions = createMemo<SpatialMapSegmentedOption<SpatialMapDepthLevel>[]>(() => {
    const levels = spatialMap.availableDepthLevels();
    return levels.map((level) => {
      const label = String(getDepthLabel(level, levels));
      return {
        value: getDepthSelection(level, levels),
        label,
        ariaLabel: `Show ${label} hierarchy ${level === 1 ? "level" : "levels"}`,
      };
    });
  });

  // The node draft only renders on the canvas, so switch there first and wait
  // a frame for the canvas camera before placing the draft.
  const createNode = () => {
    if (spatialMap.viewMode() === "canvas") {
      spatialMap.openChildNodeDraft();
      return;
    }

    spatialMap.setViewMode("canvas");
    requestAnimationFrame(() => spatialMap.openChildNodeDraft());
  };

  return (
    <AppHeader
      homeHref={props.backHref}
      parent={props.backHref ? { href: props.backHref, label: props.backLabel ?? "Projects" } : undefined}
      actions={
        <>
          <Show when={spatialMap.isolationModeActive()}>
            <Button
              variant="outline"
              size="2xs"
              maxW="220px"
              title="Exit isolation and show the whole map"
              onClick={() => spatialMap.clearIsolation()}
            >
              <Text as="span" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">
                Isolated{spatialMap.isolationLabel() ? `: ${spatialMap.isolationLabel()}` : ""}
              </Text>
              <XIcon size={13} aria-hidden="true" />
            </Button>
          </Show>
          <SpatialMapSegmentedControl
            ariaLabel="Map view mode"
            value={spatialMap.viewMode()}
            options={VIEW_MODE_OPTIONS}
            onChange={(mode) => spatialMap.setViewMode(mode)}
          />
          <HStack gap="1.5" flexShrink="0">
            <Text as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" lineHeight="1">
              Depth
            </Text>
            <SpatialMapSegmentedControl
              ariaLabel="Displayed hierarchy levels"
              value={spatialMap.visibleDepthSelection()}
              options={depthOptions()}
              onChange={(depth) => spatialMap.setVisibleDepthLevel(depth)}
            />
          </HStack>
          <SpatialMapGlobalFilterMenu />
          <HStack gap="1" flexShrink="0">
            <Menu.Root
              positioning={{ placement: "bottom-end", gutter: 4 }}
              size="sm"
              onOpenChange={(details) => setCreateMenuOpen(details.open)}
            >
              <Menu.Trigger
                asChild={(triggerProps) => (
                  <Tooltip
                    content="Create"
                    openDelay={150}
                    closeDelay={80}
                    open={createTooltipOpen() && !createMenuOpen()}
                    onOpenChange={(details) => setCreateTooltipOpen(details.open)}
                  >
                    <Button
                      {...triggerProps()}
                      colorPalette="gray"
                      variant="surface"
                      size="2xs"
                      px="0"
                      aria-label="Create nodes"
                    >
                      <PlusIcon size={14} aria-hidden="true" />
                    </Button>
                  </Tooltip>
                )}
              />
              <Menu.Positioner>
                <Menu.Content minW="190px" borderRadius="0" fontFamily="inherit" textTransform="none">
                  <Menu.Item value="new-node" onClick={createNode}>
                    <PlusIcon size={14} aria-hidden="true" />
                    <Menu.ItemText>New node</Menu.ItemText>
                    <Text as="kbd" ml="auto" color="var(--spatial-map-copy-dim)" fontFamily="mono" fontSize="11px">
                      C
                    </Text>
                  </Menu.Item>
                  <Menu.Item value="new-context-node" onClick={() => setContextNodeDialogOpen(true)}>
                    <FilePlusIcon size={14} aria-hidden="true" />
                    <Menu.ItemText>New context node</Menu.ItemText>
                  </Menu.Item>
                </Menu.Content>
              </Menu.Positioner>
            </Menu.Root>
            <SpatialMapProjectActionsMenu project={props.project} onProjectUpdated={props.onProjectUpdated} />
          </HStack>
          <SpatialMapCreateContextNodeDialog
            project={props.project}
            onProjectUpdated={props.onProjectUpdated}
            open={contextNodeDialogOpen()}
            onOpenChange={setContextNodeDialogOpen}
            trigger={() => null}
          />
        </>
      }
    >
      <Box
        as="h1"
        m="0"
        minW="0"
          color="var(--spatial-map-copy)"
          fontSize="1rem"
          lineHeight="1.25"
          fontWeight="700"
          letterSpacing="-0.02em"
          whiteSpace="nowrap"
          overflow="hidden"
          textOverflow="ellipsis"
          title={props.title}
        >
          {props.title ?? "Recipe Architecture Grid"}
        </Box>
        <ProjectMetadataSettingsDialog
          project={props.project}
          onProjectUpdated={props.onProjectUpdated}
          trigger={(open) => (
            <Tooltip content="Project settings" openDelay={150} closeDelay={80}>
              <IconButton
                variant="plain"
                size="2xs"
                flexShrink="0"
                color="var(--spatial-map-copy-dim)"
                aria-label="Project settings"
                onClick={() => open()}
              >
                <SettingsIcon size={14} aria-hidden="true" />
              </IconButton>
            </Tooltip>
          )}
        />
    </AppHeader>
  );
}

function getDepthSelection(level: number, availableLevels: number[]) {
  return level === availableLevels.at(-1) ? "max" : level;
}

function getDepthLabel(level: number, availableLevels: number[]) {
  return getDepthSelection(level, availableLevels) === "max" ? "Max" : level;
}
