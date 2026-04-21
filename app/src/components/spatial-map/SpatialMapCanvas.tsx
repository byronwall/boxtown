import { Box } from "styled-system/jsx";
import type { SpatialMapData } from "~/lib/spatial-map/types";

import "./spatial-map.css";
import { SpatialMapProvider, useSpatialMap } from "./SpatialMapContext";
import { SpatialMapInspector } from "./SpatialMapInspector";
import { SpatialMapScene } from "./SpatialMapScene";
import { SpatialMapToolbar } from "./SpatialMapToolbar";

interface SpatialMapCanvasProps {
  data: SpatialMapData;
}

export function SpatialMapCanvas(props: SpatialMapCanvasProps) {
  return (
    <SpatialMapProvider data={props.data}>
      <SpatialMapCanvasLayout />
    </SpatialMapProvider>
  );
}

function SpatialMapCanvasLayout() {
  const controller = useSpatialMap();

  return (
    <Box class={`spatial-map-shell${controller.inspectorOpen() ? "" : " spatial-map-shell--collapsed"}`}>
      <Box class="spatial-map-main">
        <Box class="spatial-map-stage">
          <SpatialMapToolbar />
          <SpatialMapScene />
        </Box>

        <SpatialMapInspector />
      </Box>
    </Box>
  );
}
