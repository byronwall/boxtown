import { A, useSearchParams } from "@solidjs/router";
import { createEffect, createSignal, For, Show, untrack } from "solid-js";
import { ChevronLeftIcon, ChevronRightIcon, LocateFixedIcon, XIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { Box, styled } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode } from "~/lib/spatial-map/types";

import type {
  SpatialMapDepthLevel,
  SpatialMapNodeColorMode,
  SpatialMapViewMode,
} from "./spatial-map-canvas.types";
import { SpatialMapProvider, useSpatialMap } from "./SpatialMapContext";
import { SpatialMapInspector } from "./SpatialMapInspector";
import { SpatialMapImageProvider, useSpatialMapImages } from "./SpatialMapImages";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";
import { SpatialMapCommandMenu } from "./SpatialMapCommandMenu";
import { SpatialMapGridView } from "./SpatialMapGridView";
import { SpatialMapScene } from "./SpatialMapScene";
import { SpatialMapToolbar } from "./SpatialMapToolbar";
import { SpatialMapTreeView } from "./SpatialMapTreeView";

const StashCardButton = styled("button");
const StashCardImage = styled("img");

// Router A is not a Panda styled component, so backlink hover styling remains
// as a local class instead of the removed global stylesheet.
const shellBacklinkClass = css({
  display: "inline-flex",
  alignItems: "center",
  flexShrink: "0",
  w: "fit-content",
  minH: "14px",
  p: "0",
  border: "0",
  background: "transparent",
  color: "var(--spatial-map-accent-strong)",
  fontSize: "11px",
  fontWeight: "700",
  letterSpacing: "0.08em",
  lineHeight: "1",
  pointerEvents: "auto",
  textDecoration: "none",
  textTransform: "none",
  _hover: {
    color: "var(--spatial-map-accent)",
    textDecoration: "underline",
    textUnderlineOffset: "3px",
  },
});

interface SpatialMapHeaderProps {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
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
    <SpatialMapProvider data={props.project.spatialMap}>
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
        h="100dvh"
        w="100%"
        overflow="hidden"
        padding={{ base: "8px", md: "clamp(12px, 2vw, 24px)" }}
        color="var(--spatial-map-copy)"
        fontFamily={`"IBM Plex Mono", "SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", "Liberation Mono", monospace`}
        background={`
          radial-gradient(circle at 15% 8%, rgba(48, 164, 108, 0.16), transparent 28rem),
          radial-gradient(circle at 88% 20%, rgba(137, 142, 135, 0.14), transparent 30rem),
          repeating-linear-gradient(0deg, rgba(31, 36, 33, 0.045) 0 1px, transparent 1px 40px),
          repeating-linear-gradient(90deg, rgba(31, 36, 33, 0.035) 0 1px, transparent 1px 40px),
          linear-gradient(180deg, rgba(248, 250, 248, 0.96), rgba(223, 226, 223, 1))
        `}
        style={{
          "--spatial-map-bg": "#dfe3dc",
          "--spatial-map-panel": "rgba(252, 253, 252, 0.94)",
          "--spatial-map-panel-strong": "rgba(248, 250, 248, 0.92)",
          "--spatial-map-panel-border": "rgba(95, 101, 94, 0.34)",
          "--spatial-map-panel-border-strong": "rgba(96, 101, 95, 0.72)",
          "--spatial-map-panel-divider": "rgba(96, 101, 95, 0.2)",
          "--spatial-map-copy": "#171c19",
          "--spatial-map-copy-muted": "#323b35",
          "--spatial-map-copy-dim": "#475249",
          "--spatial-map-blue-fill": "#d6e0e8",
          "--spatial-map-blue-fill-hover": "#c8d6e1",
          "--spatial-map-blue-stroke": "#63798c",
          "--spatial-map-blue-stroke-hover": "#4f677c",
          "--spatial-map-green-fill": "#cdd9cd",
          "--spatial-map-green-fill-hover": "#c0cfbf",
          "--spatial-map-green-stroke": "#607861",
          "--spatial-map-green-stroke-hover": "#4f684f",
          "--spatial-map-neutral-fill": "#eef1eb",
          "--spatial-map-neutral-fill-hover": "#e3e7df",
          "--spatial-map-neutral-stroke": "#747b72",
          "--spatial-map-neutral-stroke-hover": "#5f685f",
          "--spatial-map-steel-fill": "#d8dddd",
          "--spatial-map-steel-fill-hover": "#cbd2d2",
          "--spatial-map-steel-stroke": "#677477",
          "--spatial-map-steel-stroke-hover": "#556367",
          "--spatial-map-amber-fill": "#e4d9bf",
          "--spatial-map-amber-fill-hover": "#d8caa8",
          "--spatial-map-amber-stroke": "#806c47",
          "--spatial-map-amber-stroke-hover": "#6b5937",
          "--spatial-map-accent": "#2d6f48",
          "--spatial-map-accent-strong": "#173e27",
        }}
      >
        <Show when={props.header?.backHref}>
          {(backHref) => (
            <Box
              class="spatial-map-shell-nav"
              position="absolute"
              top="6px"
              left="30px"
              zIndex="3"
              display="flex"
              alignItems="center"
              pointerEvents="none"
            >
              <A
                href={backHref()}
                class={shellBacklinkClass}
                aria-label={props.header?.backLabel ?? "Back"}
              >
                &lt; Back
              </A>
            </Box>
          )}
        </Show>
        <Box
          class="spatial-map-main"
          position="relative"
          zIndex="1"
          display="grid"
          gridTemplateColumns={{
            base: "minmax(0, 1fr)",
            md: "auto minmax(0, 1fr) auto",
          }}
          w="100%"
          h="100%"
          minH="0"
          m="0"
          overflow="hidden"
          border="1px solid var(--spatial-map-panel-border-strong)"
          borderRadius="12px"
          background="var(--spatial-map-panel)"
          boxShadow={`
            0 28px 70px rgba(29, 33, 28, 0.2),
            0 0 0 1px rgba(255, 255, 255, 0.64),
            inset 0 1px 0 rgba(255, 255, 255, 0.88)
          `}
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
            gridTemplateRows="auto minmax(0, 1fr)"
            minW="0"
            minH="0"
            p={{ base: "8px", md: "10px" }}
            // The inspector's resize gutter already separates the panes on desktop.
            pr={{ base: "8px", md: controller.inspectorOpen() ? "0" : "10px" }}
            gap="8px"
            overflow="hidden"
            background="rgba(229, 234, 226, 0.72)"
          >
            <SpatialMapToolbar
              {...props.header}
              project={props.project}
              onProjectUpdated={props.onProjectUpdated}
            />
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
                top="calc(50% + 27px)"
                left="50%"
                w="min(360px, calc(100% - 32px))"
                p="16px 18px"
                border="1px solid var(--spatial-map-panel-border)"
                background="rgba(246, 248, 244, 0.9)"
                boxShadow="0 16px 40px rgba(23, 27, 24, 0.14)"
                transform="translate(-50%, -50%)"
              >
                <Box as="h2" margin="0 0 8px" fontSize="16px" fontWeight="700" letterSpacing="-0.03em">
                  Blank project grid
                </Box>
                <Box as="p" margin="0" color="var(--spatial-map-copy-muted)" fontSize="12px" lineHeight="1.6">
                  This project doesn’t have nodes yet. Create a node here or
                  add project details with the CLI.
                </Box>
                <Button
                  colorPalette="green"
                  size="xs"
                  mt="12px"
                  onClick={() => controller.openChildNodeDraft(null)}
                >
                  Create node
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
        p={stashOpen() ? "10px" : "8px 4px"}
        borderRight="1px solid rgba(96, 101, 95, 0.38)"
        background="linear-gradient(180deg, rgba(248, 250, 248, 0.88), rgba(235, 239, 233, 0.92))"
        boxShadow="inset -1px 0 0 rgba(255, 255, 255, 0.58), 10px 0 24px rgba(29, 33, 28, 0.035)"
        transition="width 160ms ease, padding 160ms ease"
      >
        <Box
          display="flex"
          alignItems="baseline"
          justifyContent={stashOpen() ? "space-between" : "center"}
          gap="2"
          pb="8px"
          borderBottom="1px solid rgba(96, 101, 95, 0.18)"
        >
          <Button
            type="button"
            size="xs"
            variant="plain"
            colorPalette="green"
            minW="24px"
            w="24px"
            h="24px"
            p="0"
            aria-label={stashOpen() ? "Collapse node stash" : "Expand node stash"}
            onClick={() => setStashOpen((current) => !current)}
          >
            <Show when={stashOpen()} fallback={<ChevronRightIcon size={15} />}>
              <ChevronLeftIcon size={15} />
            </Show>
          </Button>
          <Show when={stashOpen()}>
            <Box as="h2" m="0" color="var(--spatial-map-copy)" fontSize="13px" fontWeight="700" letterSpacing="0.02em">
              Node Stash
            </Box>
            <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" fontWeight="700">
              S toggles
            </Box>
          </Show>
        </Box>
        <Show when={stashOpen()}>
          <Box display="grid" alignContent="start" gap="8px" minH="0" overflow="auto" pt="9px">
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
      gap="7px"
      p="9px"
      border="1px solid"
      borderColor={isSelected() ? "rgba(45, 111, 72, 0.62)" : "rgba(96, 101, 95, 0.24)"}
      borderRadius="7px"
      background={isSelected() ? "rgba(229, 239, 229, 0.82)" : "rgba(246, 248, 244, 0.78)"}
      boxShadow={isSelected() ? "inset 0 0 0 1px rgba(45, 111, 72, 0.22)" : "none"}
    >
      <Box
        display="grid"
        gridTemplateColumns={(props.node.images ?? []).length > 0 ? "minmax(0, 1fr) 54px" : "minmax(0, 1fr)"}
        alignItems="start"
        gap="8px"
        minW="0"
      >
        <StashCardButton
          type="button"
          display="grid"
          gap="3px"
          minW="0"
          p="0"
          border="0"
          background="transparent"
          color="inherit"
          textAlign="left"
          cursor="pointer"
          onClick={selectStashedNode}
        >
          <Box as="span" color="var(--spatial-map-copy)" fontSize="14px" fontWeight="700" lineHeight="1.16" overflowWrap="anywhere">
            {props.node.label}
          </Box>
          <Box as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" fontWeight="700" letterSpacing="0.04em">
            {props.node.type} / {props.node.status}
          </Box>
        </StashCardButton>
        <StashedNodeThumbnail node={props.node} />
      </Box>
      <Box display="flex" alignItems="center" flexWrap="wrap" gap="5px">
        <Button
          size="xs"
          variant="surface"
          colorPalette="green"
          onClick={() => controller.focusStashedNode(props.node.id)}
        >
          <LocateFixedIcon size={13} />
          Find
        </Button>
        <Button
          size="xs"
          variant="outline"
          colorPalette="green"
          onClick={() => controller.unstashNode(props.node.id)}
        >
          <XIcon size={13} />
          Unstash
        </Button>
      </Box>
      <Box display="flex" alignItems="center" flexWrap="wrap" gap="5px">
        <SpatialMapDeleteNodeControl
          project={props.project}
          node={props.node}
          onProjectUpdated={props.onProjectUpdated}
          compact
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
          w="54px"
          h="42px"
          p="0"
          border="1px solid rgba(34, 41, 36, 0.22)"
          borderRadius="5px"
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

type SpatialMapSearchParams = {
  node?: string;
  view?: SpatialMapViewMode;
  depth?: string;
  edges?: string;
  inspector?: string;
  isolate?: string;
  linked?: string;
};

interface SpatialMapUrlState {
  nodeId: string | null;
  viewMode: SpatialMapViewMode | null;
  depthLevel: SpatialMapDepthLevel | null;
  showEdges: boolean | null;
  inspectorOpen: boolean | null;
  isolatedNodeId: string | null;
  showLinked: boolean | null;
}

interface SpatialMapNodeLookup {
  has(nodeId: string): boolean;
}

function SpatialMapUrlSync() {
  const controller = useSpatialMap();
  const [searchParams, setSearchParams] =
    useSearchParams<SpatialMapSearchParams>();

  createEffect(() => {
    const nodeId = getStringParam(searchParams.node) ?? null;
    const viewMode = parseViewMode(getStringParam(searchParams.view));
    const depthLevel = parseDepthLevel(getStringParam(searchParams.depth));
    const showEdges = parseBooleanParam(getStringParam(searchParams.edges));
    const inspectorOpen = parseInspectorParam(
      getStringParam(searchParams.inspector),
    );
    const isolatedNodeId = getStringParam(searchParams.isolate) ?? null;
    const showLinked = parseBooleanParam(getStringParam(searchParams.linked));
    const nodeIds = controller.sourceNodesById();

    untrack(() => {
      syncControllerFromUrlState(controller, nodeIds, {
        nodeId,
        viewMode,
        depthLevel,
        showEdges,
        inspectorOpen,
        isolatedNodeId,
        showLinked,
      });
    });
  });

  createEffect(() => {
    const selectedNodeId = controller.selectedNodeId();
    const viewMode = controller.viewMode();
    const visibleDepthSelection = controller.visibleDepthSelection();
    const showEdges = controller.showEdges();
    const inspectorOpen = controller.inspectorOpen();
    const isolatedNodeId = controller.isolatedNodeId();
    const showLinked = controller.showLinkedInIsolation();

    const nextParams = {
      node: selectedNodeId,
      view: viewMode === "canvas" ? null : viewMode,
      depth:
        visibleDepthSelection === "max" ? null : String(visibleDepthSelection),
      edges: showEdges ? "1" : null,
      inspector: inspectorOpen ? null : "closed",
      isolate: isolatedNodeId,
      linked: isolatedNodeId && showLinked ? "1" : null,
    };

    if (
      getNullableStringParam(searchParams.node) === nextParams.node &&
      getNullableStringParam(searchParams.view) === nextParams.view &&
      getNullableStringParam(searchParams.depth) === nextParams.depth &&
      getNullableStringParam(searchParams.edges) === nextParams.edges &&
      getNullableStringParam(searchParams.inspector) === nextParams.inspector &&
      getNullableStringParam(searchParams.isolate) === nextParams.isolate &&
      getNullableStringParam(searchParams.linked) === nextParams.linked
    ) {
      return;
    }

    setSearchParams(nextParams, { replace: true });
  });

  return null;
}

function syncControllerFromUrlState(
  controller: ReturnType<typeof useSpatialMap>,
  nodeIds: SpatialMapNodeLookup,
  state: SpatialMapUrlState,
) {
  if (state.viewMode && controller.viewMode() !== state.viewMode) {
    controller.setViewMode(state.viewMode);
  }

  const nextDepthLevel = state.depthLevel ?? "max";
  if (controller.visibleDepthSelection() !== nextDepthLevel) {
    controller.setVisibleDepthLevel(nextDepthLevel);
  }

  if (state.showEdges !== null && controller.showEdges() !== state.showEdges) {
    controller.setShowEdges(state.showEdges);
  }

  if (
    state.inspectorOpen !== null &&
    controller.inspectorOpen() !== state.inspectorOpen
  ) {
    controller.setInspectorOpen(state.inspectorOpen);
  }

  syncIsolationFromUrlState(controller, nodeIds, state);

  if (
    state.showLinked !== null &&
    controller.showLinkedInIsolation() !== state.showLinked
  ) {
    controller.setShowLinkedInIsolation(state.showLinked);
  }

  const nextSelectedNodeId =
    state.nodeId && nodeIds.has(state.nodeId) ? state.nodeId : null;
  if (controller.selectedNodeId() !== nextSelectedNodeId) {
    controller.setSelectedNodeId(nextSelectedNodeId);
  }
}

function syncIsolationFromUrlState(
  controller: ReturnType<typeof useSpatialMap>,
  nodeIds: SpatialMapNodeLookup,
  state: Pick<SpatialMapUrlState, "isolatedNodeId">,
) {
  if (state.isolatedNodeId && nodeIds.has(state.isolatedNodeId)) {
    if (controller.isolatedNodeId() !== state.isolatedNodeId) {
      controller.isolateNode(state.isolatedNodeId);
    }
    return;
  }

  if (controller.isolatedNodeId()) {
    controller.clearIsolation();
  }
}

function getStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNullableStringParam(value: string | string[] | undefined) {
  return getStringParam(value) ?? null;
}

function parseViewMode(value: string | undefined): SpatialMapViewMode | null {
  if (value === "markdown") {
    return "tree";
  }

  return value === "canvas" || value === "tree" || value === "grid"
    ? value
    : null;
}

function parseDepthLevel(value: string | undefined): SpatialMapDepthLevel | null {
  if (!value) {
    return null;
  }

  if (value === "max") {
    return value;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function parseBooleanParam(value: string | undefined) {
  if (value === "1" || value === "true") {
    return true;
  }

  if (value === "0" || value === "false") {
    return false;
  }

  return null;
}

function parseInspectorParam(value: string | undefined) {
  if (value === "closed") {
    return false;
  }

  if (value === "open") {
    return true;
  }

  return parseBooleanParam(value);
}
