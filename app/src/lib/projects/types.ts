import type { SpatialMapData } from "~/lib/spatial-map/types";

export interface ProjectNodeMetadataField {
  key: string;
  label: string;
  defaultValue: string;
}

export interface ProjectNodeTypeDefinition {
  name: string;
  color: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nodeMetadataSchema: ProjectNodeMetadataField[];
  nodeTypeSchema: ProjectNodeTypeDefinition[];
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
