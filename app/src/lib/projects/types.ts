import type { SpatialMapData } from "~/lib/spatial-map/types";

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  spatialMap: SpatialMapData;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  linkCount: number;
}
