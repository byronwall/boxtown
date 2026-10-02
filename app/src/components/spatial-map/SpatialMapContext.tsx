import { getLastEditorKinds } from "~/lib/projects/last-editor";
import type { ProjectOperationLogEntry } from "~/lib/projects/types";
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
  operationLog?: ProjectOperationLogEntry[];
  children: JSX.Element;
}

export function SpatialMapProvider(props: SpatialMapProviderProps) {
  const data = createMemo(() => props.data);
  const lastEditors = createMemo(() => getLastEditorKinds(props.operationLog ?? []));
  const controller = useSpatialMapCanvasController(data as Accessor<SpatialMapData>, lastEditors);

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
