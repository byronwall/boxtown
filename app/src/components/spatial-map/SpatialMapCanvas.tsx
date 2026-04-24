import { useSearchParams } from "@solidjs/router";
import { createEffect, lazy, Show, untrack } from "solid-js";
import { Box } from "styled-system/jsx";
import type { ProjectRecord } from "~/lib/projects/types";

import "./spatial-map.css";
import { AddNodesFlowRail } from "./add-nodes-flow/AddNodesFlowRail";
import type { SpatialMapViewMode } from "./spatial-map-canvas.types";
import { SpatialMapProvider, useSpatialMap } from "./SpatialMapContext";
import { SpatialMapInspector } from "./SpatialMapInspector";
import { SpatialMapImageProvider } from "./SpatialMapImages";
import { SpatialMapScene } from "./SpatialMapScene";
import { SpatialMapToolbar } from "./SpatialMapToolbar";
import { SpatialMapTreeView } from "./SpatialMapTreeView";

const ContextNoteConversionRail = lazy(() =>
  import("./context-note-conversion-flow/ContextNoteConversionRail").then((module) => ({
    default: module.ContextNoteConversionRail,
  })),
);

const SourceDecompositionRail = lazy(() =>
  import("./source-decomposition-flow/SourceDecompositionRail").then((module) => ({
    default: module.SourceDecompositionRail,
  })),
);

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

  return (
    <SpatialMapImageProvider
      projectId={props.project.id}
      projectName={props.project.name}
      spatialMap={props.project.spatialMap}
      onProjectUpdated={props.onProjectUpdated}
    >
      <SpatialMapUrlSync />
      <Box class={`spatial-map-shell${controller.inspectorOpen() ? "" : " spatial-map-shell--collapsed"}`}>
        <Box class="spatial-map-main">
          <Box class="spatial-map-stage">
            <SpatialMapToolbar
              {...props.header}
              project={props.project}
              onProjectUpdated={props.onProjectUpdated}
            />
            <Show
              when={controller.viewMode() === "canvas"}
              fallback={<SpatialMapTreeView project={props.project} />}
            >
              <SpatialMapScene />
            </Show>
            <Show when={!props.hasNodes && controller.viewMode() === "canvas"}>
              <Box class="spatial-map-empty">
                <Box as="h2" class="spatial-map-empty-title">
                  Blank project grid
                </Box>
                <Box as="p" class="spatial-map-empty-copy">
                  This project doesn’t have nodes yet. The route and canvas are ready for the next
                  layer of project details and AI-assisted editing.
                </Box>
              </Box>
            </Show>
          </Box>

          <Show
            when={!controller.addNodesOpen()}
            fallback={<AddNodesFlowRail project={props.project} onProjectUpdated={props.onProjectUpdated} />}
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

function SpatialMapUrlSync() {
  const controller = useSpatialMap();
  const [searchParams, setSearchParams] = useSearchParams<SpatialMapSearchParams>();

  createEffect(() => {
    const nodeId = getStringParam(searchParams.node);
    const viewMode = parseViewMode(getStringParam(searchParams.view));
    const depthLevel = parsePositiveInteger(getStringParam(searchParams.depth));
    const showEdges = parseBooleanParam(getStringParam(searchParams.edges));
    const inspectorOpen = parseInspectorParam(getStringParam(searchParams.inspector));
    const isolatedNodeId = getStringParam(searchParams.isolate);
    const showLinked = parseBooleanParam(getStringParam(searchParams.linked));
    const nodeIds = controller.sourceNodesById();

    untrack(() => {
      if (viewMode && controller.viewMode() !== viewMode) {
        controller.setViewMode(viewMode);
      }

      if (depthLevel !== null && controller.visibleDepthLevel() !== depthLevel) {
        controller.setVisibleDepthLevel(depthLevel);
      }

      if (showEdges !== null && controller.showEdges() !== showEdges) {
        controller.setShowEdges(showEdges);
      }

      if (inspectorOpen !== null && controller.inspectorOpen() !== inspectorOpen) {
        controller.setInspectorOpen(inspectorOpen);
      }

      if (isolatedNodeId && nodeIds.has(isolatedNodeId)) {
        if (controller.isolatedNodeId() !== isolatedNodeId) {
          controller.isolateNode(isolatedNodeId);
        }
      } else if (controller.isolatedNodeId()) {
        controller.clearIsolation();
      }

      if (showLinked !== null && controller.showLinkedInIsolation() !== showLinked) {
        controller.setShowLinkedInIsolation(showLinked);
      }

      const nextSelectedNodeId = nodeId && nodeIds.has(nodeId) ? nodeId : null;
      if (controller.selectedNodeId() !== nextSelectedNodeId) {
        controller.setSelectedNodeId(nextSelectedNodeId);
      }
    });
  });

  createEffect(() => {
    const selectedNodeId = controller.selectedNodeId();
    const viewMode = controller.viewMode();
    const visibleDepthLevel = controller.visibleDepthLevel();
    const maxDepthLevel = controller.availableDepthLevels().at(-1) ?? 1;
    const showEdges = controller.showEdges();
    const inspectorOpen = controller.inspectorOpen();
    const isolatedNodeId = controller.isolatedNodeId();
    const showLinked = controller.showLinkedInIsolation();

    const nextParams = {
      node: selectedNodeId,
      view: viewMode === "canvas" ? null : viewMode,
      depth: visibleDepthLevel === maxDepthLevel ? null : String(visibleDepthLevel),
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

function getStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNullableStringParam(value: string | string[] | undefined) {
  return getStringParam(value) ?? null;
}

function parseViewMode(value: string | undefined): SpatialMapViewMode | null {
  return value === "canvas" || value === "tree" ? value : null;
}

function parsePositiveInteger(value: string | undefined) {
  if (!value) {
    return null;
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
