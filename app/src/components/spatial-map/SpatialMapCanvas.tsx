import { createEffect, createSignal, For, Show } from "solid-js";
import { ChevronLeftIcon, ChevronRightIcon, LocateFixedIcon, PlusIcon, UndoIcon } from "lucide-solid";
import { Box, styled } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { IconButton } from "~/components/ui/icon-button";
import { Tooltip } from "~/components/ui/tooltip";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode } from "~/lib/spatial-map/types";

import type { SpatialMapNodeColorMode } from "./spatial-map-canvas.types";
import { SpatialMapProvider, useSpatialMap } from "./SpatialMapContext";
import { SpatialMapInspector } from "./SpatialMapInspector";
import { SpatialMapBlockTitle } from "./SpatialMapPanelPrimitives";
import { SpatialMapImageProvider, useSpatialMapImages } from "./SpatialMapImages";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";
import { SpatialMapCommandMenu } from "./SpatialMapCommandMenu";
import { SpatialMapGridView } from "./SpatialMapGridView";
import { SpatialMapScene } from "./SpatialMapScene";
import { SpatialMapToolbar } from "./SpatialMapToolbar";
import { SpatialMapTreeView } from "./SpatialMapTreeView";
import { SpatialMapUrlSync } from "./SpatialMapUrlSync";

const StashCardButton = styled("button");
const StashCardImage = styled("img");

interface SpatialMapHeaderProps {
  title?: string;
  backHref?: string;
  backLabel?: string;
}

interface SpatialMapCanvasProps {
  project: ProjectRecord;
  header?: SpatialMapHeaderProps;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}

export function SpatialMapCanvas(props: SpatialMapCanvasProps) {
  return (
    <SpatialMapProvider data={props.project.spatialMap} operationLog={props.project.operationLog}>
      <SpatialMapCanvasLayout
        header={props.header}
        project={props.project}
        hasNodes={props.project.spatialMap.nodes.length > 0}
        onProjectUpdated={props.onProjectUpdated}
      />
    </SpatialMapProvider>
  );
}

function SpatialMapCanvasLayout(props: {
  header?: SpatialMapHeaderProps;
  project: ProjectRecord;
  hasNodes: boolean;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const controller = useSpatialMap();
  const [nodeColorMode, setNodeColorMode] =
    createSignal<SpatialMapNodeColorMode>("type");

  return (
    <SpatialMapImageProvider
      project={props.project}
      onProjectUpdated={props.onProjectUpdated}
    >
      <SpatialMapUrlSync />
      <Box
        class={`spatial-map-shell${controller.inspectorOpen() ? "" : " spatial-map-shell--collapsed"}`}
        position="relative"
        boxSizing="border-box"
        display="grid"
        gridTemplateRows="auto minmax(0, 1fr)"
        h="100dvh"
        w="100%"
        overflow="hidden"
        color="var(--spatial-map-copy)"
        fontFamily={`"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", "Liberation Mono", monospace`}
        background="var(--spatial-map-bg)"
      >
        <SpatialMapToolbar
          {...props.header}
          project={props.project}
          onProjectUpdated={props.onProjectUpdated}
        />
        <Box
          class="spatial-map-main"
          position="relative"
          display="grid"
          gridTemplateColumns={{
            base: "minmax(0, 1fr)",
            md: "auto minmax(0, 1fr) auto",
          }}
          w="100%"
          minH="0"
          overflow="hidden"
        >
          <SpatialMapNodeStash
            project={props.project}
            onProjectUpdated={props.onProjectUpdated}
          />
          <Box
            class="spatial-map-stage"
            gridColumn={{ base: "1", md: "2" }}
            position="relative"
            display="grid"
            gridTemplateRows="minmax(0, 1fr)"
            minW="0"
            minH="0"
            overflow="hidden"
          >
            <SpatialMapCommandMenu />
            <Show when={controller.viewMode() === "canvas"}>
              <SpatialMapScene
                project={props.project}
                nodeColorMode={nodeColorMode()}
                onNodeColorModeChange={setNodeColorMode}
                onProjectUpdated={props.onProjectUpdated}
              />
            </Show>
            <Show when={controller.viewMode() === "tree"}>
              <SpatialMapTreeView
                project={props.project}
                onProjectUpdated={props.onProjectUpdated}
              />
            </Show>
            <Show when={controller.viewMode() === "grid"}>
              <SpatialMapGridView
                project={props.project}
                onProjectUpdated={props.onProjectUpdated}
              />
            </Show>
            <Show when={controller.selectedNode()}>
              {(node) => (
                <SpatialMapDeleteNodeControl
                  project={props.project}
                  node={node()}
                  onProjectUpdated={props.onProjectUpdated}
                  hideTrigger
                />
              )}
            </Show>
            <Show
              when={
                !props.hasNodes &&
                controller.viewMode() === "canvas" &&
                !controller.childNodeDraft()
              }
            >
              <Box
                position="absolute"
                top="50%"
                left="50%"
                w="min(320px, calc(100% - 32px))"
                p="12px"
                border="1px solid var(--spatial-map-panel-border)"
                borderRadius="6px"
                background="var(--spatial-map-panel-strong)"
                transform="translate(-50%, -50%)"
              >
                <Box as="h2" margin="0 0 4px" fontSize="13px" fontWeight="700">
                  Blank project
                </Box>
                <Box as="p" margin="0" color="var(--spatial-map-copy-dim)" fontSize="12px" lineHeight="1.45">
                  Create the first node here, or add nodes with the CLI.
                </Box>
                <Button
                  colorPalette="gray"
                  variant="surface"
                  size="2xs"
                  mt="8px"
                  onClick={() => controller.openChildNodeDraft(null)}
                >
                  <PlusIcon size={13} />
                  New node
                </Button>
              </Box>
            </Show>
          </Box>

          <Box
            gridColumn={{ base: "1", md: "3" }}
            minW="0"
            minH="0"
            h="100%"
          >
            <SpatialMapInspector
              project={props.project}
              onProjectUpdated={props.onProjectUpdated}
            />
          </Box>
        </Box>
      </Box>
    </SpatialMapImageProvider>
  );
}

function SpatialMapNodeStash(props: {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const controller = useSpatialMap();
  const [stashOpen, setStashOpen] = createSignal(true);
  let previousStashCount = controller.stashedNodeIds().length;

  createEffect(() => {
    const nextStashCount = controller.stashedNodeIds().length;
    if (nextStashCount > previousStashCount) {
      setStashOpen(true);
    }
    previousStashCount = nextStashCount;
  });

  return (
    <Show when={controller.viewMode() === "canvas" && controller.stashedNodes().length > 0}>
      <Box
        as="aside"
        aria-label="Node stash"
        display={{ base: "none", md: "grid" }}
        gridTemplateRows={stashOpen() ? "auto minmax(0, 1fr)" : "auto"}
        w={stashOpen() ? "250px" : "34px"}
        h="100%"
        minH="0"
        overflow="hidden"
        p={stashOpen() ? "8px 10px" : "8px 4px"}
        borderRight="1px solid var(--spatial-map-panel-border)"
        background="var(--spatial-map-panel-strong)"
        transition="width 160ms ease, padding 160ms ease"
      >
        <Box
          display="flex"
          alignItems="center"
          justifyContent={stashOpen() ? "flex-start" : "center"}
          gap="1.5"
          minH="24px"
        >
          <Tooltip content={stashOpen() ? "Collapse node stash" : "Expand node stash"} openDelay={150} closeDelay={80}>
            <IconButton
              variant="plain"
              size="2xs"
              color="var(--spatial-map-copy-dim)"
              aria-label={stashOpen() ? "Collapse node stash" : "Expand node stash"}
              onClick={() => setStashOpen((current) => !current)}
            >
              <Show when={stashOpen()} fallback={<ChevronRightIcon size={14} />}>
                <ChevronLeftIcon size={14} />
              </Show>
            </IconButton>
          </Tooltip>
          <Show when={stashOpen()}>
            <SpatialMapBlockTitle as="h3">Stash</SpatialMapBlockTitle>
            <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" fontVariantNumeric="tabular-nums">
              {controller.stashedNodes().length}
            </Box>
            <Box as="span" flex="1" />
            <Box as="kbd" color="var(--spatial-map-copy-dim)" fontFamily="mono" fontSize="11px" title="Press S to stash or unstash the selected node">
              S
            </Box>
          </Show>
        </Box>
        <Show when={stashOpen()}>
          <Box display="grid" alignContent="start" minH="0" overflow="auto" pt="4px">
            <For each={controller.stashedNodes()}>
              {(node) => (
                <StashedNodeCard
                  node={node}
                  project={props.project}
                  onProjectUpdated={props.onProjectUpdated}
                />
              )}
            </For>
          </Box>
        </Show>
      </Box>
    </Show>
  );
}

function StashedNodeCard(props: {
  node: MapNode;
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const controller = useSpatialMap();
  const isSelected = () => controller.selectedNodeId() === props.node.id;

  const selectStashedNode = () => {
    controller.setSelectedNodeId(props.node.id);
    controller.setInspectorOpen(true);
  };

  return (
    <Box
      as="section"
      display="grid"
      gridTemplateColumns={(props.node.images ?? []).length > 0 ? "minmax(0, 1fr) 40px" : "minmax(0, 1fr)"}
      alignItems="start"
      columnGap="8px"
      rowGap="4px"
      m="0 -6px"
      p="6px"
      borderTop="1px solid var(--spatial-map-panel-divider)"
      borderRadius="4px"
      background={isSelected() ? "rgba(233, 235, 232, 0.8)" : "transparent"}
    >
      <StashCardButton
        type="button"
        display="grid"
        gap="2px"
        minW="0"
        p="0"
        border="0"
        background="transparent"
        color="inherit"
        font="inherit"
        textAlign="left"
        cursor="pointer"
        _active={{ transform: "scale(0.99)" }}
        onClick={selectStashedNode}
      >
        <Box as="span" color="var(--spatial-map-copy)" fontSize="12px" fontWeight={isSelected() ? "700" : "600"} lineHeight="1.3" overflowWrap="anywhere">
          {props.node.label}
        </Box>
        <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" lineHeight="1.3">
          {props.node.type} · {props.node.status}
        </Box>
      </StashCardButton>
      <StashedNodeThumbnail node={props.node} />
      <Box gridColumn="1 / -1" display="flex" alignItems="center" gap="4px">
        <Button
          size="2xs"
          variant="outline"
          onClick={() => controller.focusStashedNode(props.node.id)}
        >
          <LocateFixedIcon size={13} />
          Find
        </Button>
        <Button
          size="2xs"
          variant="outline"
          onClick={() => controller.unstashNode(props.node.id)}
        >
          <UndoIcon size={13} />
          Unstash
        </Button>
        <Box flex="1" />
        <SpatialMapDeleteNodeControl
          project={props.project}
          node={props.node}
          onProjectUpdated={props.onProjectUpdated}
          compact
          size="2xs"
        />
      </Box>
    </Box>
  );
}

function StashedNodeThumbnail(props: { node: MapNode }) {
  const imageUi = useSpatialMapImages();
  const images = () => props.node.images ?? [];
  const firstImage = () => images()[0];

  return (
    <Show when={firstImage()}>
      {(image) => (
        <StashCardButton
          type="button"
          position="relative"
          display="block"
          w="40px"
          h="32px"
          p="0"
          border="1px solid var(--spatial-map-panel-border)"
          borderRadius="4px"
          background="rgba(214, 220, 212, 0.92)"
          cursor="zoom-in"
          overflow="hidden"
          aria-label={`Open ${image().originalName}`}
          title={image().originalName}
          onClick={(event) => {
            event.stopPropagation();
            imageUi.openImage(image(), props.node, images());
          }}
        >
          <StashCardImage
            src={image().src}
            alt={image().originalName}
            loading="lazy"
            display="block"
            w="100%"
            h="100%"
            objectFit="cover"
            pointerEvents="none"
          />
          <Show when={images().length > 1}>
            <Box
              as="span"
              position="absolute"
              right="3px"
              bottom="3px"
              minW="18px"
              p="2px 4px"
              border="1px solid rgba(34, 41, 36, 0.24)"
              borderRadius="3px"
              background="rgba(249, 250, 247, 0.94)"
              color="var(--spatial-map-copy)"
              fontSize="9px"
              fontWeight="760"
              lineHeight="1"
              textAlign="center"
              pointerEvents="none"
            >
              {images().length}
            </Box>
          </Show>
        </StashCardButton>
      )}
    </Show>
  );
}
