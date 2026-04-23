import { lazy, Show } from "solid-js";
import { Box } from "styled-system/jsx";
import type { ProjectRecord } from "~/lib/projects/types";

import "./spatial-map.css";
import { AddNodesFlowRail } from "./add-nodes-flow/AddNodesFlowRail";
import { SpatialMapProvider, useSpatialMap } from "./SpatialMapContext";
import { SpatialMapInspector } from "./SpatialMapInspector";
import { SpatialMapScene } from "./SpatialMapScene";
import { SpatialMapToolbar } from "./SpatialMapToolbar";
import { SpatialMapTreeView } from "./SpatialMapTreeView";

const ContextNoteConversionRail = lazy(() =>
  import("./context-note-conversion-flow/ContextNoteConversionRail").then((module) => ({
    default: module.ContextNoteConversionRail,
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
    <Box class={`spatial-map-shell${controller.inspectorOpen() ? "" : " spatial-map-shell--collapsed"}`}>
      <Box class="spatial-map-main">
        <Box class="spatial-map-stage">
          <SpatialMapToolbar
            {...props.header}
            projectId={props.project.id}
            onProjectUpdated={props.onProjectUpdated}
          />
          <Show when={controller.viewMode() === "canvas"} fallback={<SpatialMapTreeView />}>
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
            when={!controller.contextNoteConversionOpen()}
            fallback={
              <ContextNoteConversionRail
                project={props.project}
                onProjectUpdated={props.onProjectUpdated}
              />
            }
          >
            <SpatialMapInspector
              projectId={props.project.id}
              onProjectUpdated={props.onProjectUpdated}
            />
          </Show>
        </Show>
      </Box>
    </Box>
  );
}
