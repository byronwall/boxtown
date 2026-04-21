import {
  createContext,
  createMemo,
  type Accessor,
  type JSX,
  useContext,
} from "solid-js";
import type { SpatialMapData } from "~/lib/spatial-map/types";

import type { SpatialMapCanvasController } from "./spatial-map-canvas.types";
import { useSpatialMapCanvasController } from "./useSpatialMapCanvasController";

const SpatialMapContext = createContext<SpatialMapCanvasController>();

interface SpatialMapProviderProps {
  data: SpatialMapData;
  children: JSX.Element;
}

export function SpatialMapProvider(props: SpatialMapProviderProps) {
  const data = createMemo(() => props.data);
  const controller = useSpatialMapCanvasController(data as Accessor<SpatialMapData>);

  return (
    <SpatialMapContext.Provider value={controller}>
      {props.children}
    </SpatialMapContext.Provider>
  );
}

export function useSpatialMap() {
  const context = useContext(SpatialMapContext);
  if (!context) {
    throw new Error("useSpatialMap must be used within SpatialMapProvider.");
  }

  return context;
}
