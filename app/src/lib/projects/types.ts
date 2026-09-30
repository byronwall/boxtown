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
  operationLog: ProjectOperationLogEntry[];
}

export type ProjectOperationKind =
  | "project.backfilled"
  | "project.created"
  | "nodes.generated"
  | "node.context.updated"
  | "node.title.updated"
  | "node.status.updated"
  | "node.archive.updated"
  | "nodes.bulk.updated"
  | "node.type.updated"
  | "node.metadata.updated"
  | "project.schema.updated"
  | "node.images.added"
  | "node.image.deleted"
  | "context.nodes.imported"
  | "node.created"
  | "node.deleted"
  | "link.deleted"
  | "node.moved";

export interface ProjectOperationLogEntry {
  id: string;
  kind: ProjectOperationKind;
  actor: ProjectOperationActor;
  createdAt: string;
  summary: string;
  nodeIds: string[];
  linkKeys?: string[];
  metadata?: Record<string, string>;
  payload?: ProjectOperationPayload;
}

export interface ProjectMutationMeta {
  clientMutationId?: string;
}

export type ProjectOperationActorKind = "human" | "agent";

export interface ProjectOperationActor {
  kind: ProjectOperationActorKind;
  id?: string;
  label?: string;
}

export interface ProjectOperationPayload {
  state?: ProjectOperationState;
}

export interface ProjectOperationState {
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
