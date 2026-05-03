import { A, useSearchParams } from "@solidjs/router";
import { createEffect, createSignal, lazy, Show, untrack } from "solid-js";
import { css } from "styled-system/css";
import { Box } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import type { ProjectRecord } from "~/lib/projects/types";

import { AddNodesFlowRail } from "./add-nodes-flow/AddNodesFlowRail";
import type {
  SpatialMapDepthLevel,
  SpatialMapNodeColorMode,
  SpatialMapViewMode,
} from "./spatial-map-canvas.types";
import { SpatialMapProvider, useSpatialMap } from "./SpatialMapContext";
import { SpatialMapInspector } from "./SpatialMapInspector";
import { SpatialMapImageProvider } from "./SpatialMapImages";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";
import { SpatialMapCommandMenu } from "./SpatialMapCommandMenu";
import { SpatialMapGridView } from "./SpatialMapGridView";
import { SpatialMapScene } from "./SpatialMapScene";
import { SpatialMapToolbar } from "./SpatialMapToolbar";
import { SpatialMapTreeView } from "./SpatialMapTreeView";

const ContextNoteConversionRail = lazy(() =>
  import("./context-note-conversion-flow/ContextNoteConversionRail").then(
    (module) => ({
      default: module.ContextNoteConversionRail,
    }),
  ),
);

const SourceDecompositionRail = lazy(() =>
  import("./source-decomposition-flow/SourceDecompositionRail").then(
    (module) => ({
      default: module.SourceDecompositionRail,
    }),
  ),
);

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
  onProjectUpdated?: (project: ProjectRecord) => void;
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
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  const controller = useSpatialMap();
  const [nodeColorMode, setNodeColorMode] =
    createSignal<SpatialMapNodeColorMode>("type");

  return (
    <SpatialMapImageProvider
      projectId={props.project.id}
      projectName={props.project.name}
      spatialMap={props.project.spatialMap}
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
          gridTemplateColumns={{ base: "minmax(0, 1fr)", md: "minmax(0, 1fr) auto" }}
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
          <Box
            class="spatial-map-stage"
            position="relative"
            display="grid"
            gridTemplateRows="auto minmax(0, 1fr)"
            minW="0"
            minH="0"
            p={{ base: "8px", md: "10px" }}
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
                  projectId={props.project.id}
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
                  This project doesn’t have nodes yet. The route and canvas are
                  ready for the next layer of project details and AI-assisted
                  editing.
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

          <Show
            when={!controller.addNodesOpen()}
            fallback={
              <AddNodesFlowRail
                project={props.project}
                onProjectUpdated={props.onProjectUpdated}
              />
            }
          >
            <Show
              when={!controller.sourceDecompositionOpen()}
              fallback={
                <SourceDecompositionRail
                  project={props.project}
                  onProjectUpdated={props.onProjectUpdated}
                />
              }
            >
              <Show
                when={!controller.contextNoteConversionOpen()}
                fallback={
                  <ContextNoteConversionRail
                    project={props.project}
                    onProjectUpdated={props.onProjectUpdated}
                  />
                }
              >
                <SpatialMapInspector
                  project={props.project}
                  onProjectUpdated={props.onProjectUpdated}
                />
              </Show>
            </Show>
          </Show>
        </Box>
      </Box>
    </SpatialMapImageProvider>
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
