import type { ProjectRecord, ProjectSummary } from "~/lib/projects/types";
import type { MapNode, MapNodeStatus } from "~/lib/spatial-map/types";

export interface AgentActor {
  id: string;
  scopes: string[];
  tokenSuffix: string | null;
}

export interface AgentApiContext {
  actor: AgentActor;
}

export interface AgentApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface AgentProjectSummary extends ProjectSummary {}

export interface AgentProjectDetail extends ProjectSummary {
  nodeMetadataSchema: ProjectRecord["nodeMetadataSchema"];
  nodeTypeSchema: ProjectRecord["nodeTypeSchema"];
  spatialMap: {
    nodes: AgentMapNode[];
    links: ProjectRecord["spatialMap"]["links"];
  };
}

export interface AgentProjectCreateResponse {
  project: AgentProjectDetail;
}

export interface AgentMapNode extends Omit<MapNode, "images"> {
  images: NonNullable<MapNode["images"]>;
}

export interface AgentNodeMutationResponse {
  node: AgentMapNode;
}

export interface AgentNodeCreateResponse extends AgentNodeMutationResponse {
  nodeId: string;
  parentLink: ProjectRecord["spatialMap"]["links"][number] | null;
}

export interface AgentNodeMoveResponse extends AgentNodeMutationResponse {
  parentNodeId: string | null;
  parentLink: ProjectRecord["spatialMap"]["links"][number] | null;
}

export interface AgentNodeContextResponse {
  nodeId: string;
  context: string;
  rawContext: string;
  contextMode: MapNode["contextMode"];
}

export interface AgentNodeMetadataResponse {
  nodeId: string;
  metadata: Record<string, string>;
}

export interface AgentTaskSummary {
  id: string;
  title: string;
  status: MapNodeStatus;
  type: string;
  parentNodeId: string | null;
  childCount: number;
  imageCount: number;
  updatedAt: string;
}

export interface AgentMarkdownImportResponse {
  import: {
    rootNodeId: string;
    createdNodeIds: string[];
    createdNodeCount: number;
  };
  nodes: AgentMapNode[];
  links: ProjectRecord["spatialMap"]["links"];
}

export interface AgentImageAddResponse {
  nodeId: string;
  imageCount: number;
  images: NonNullable<MapNode["images"]>;
}

export interface AgentImageRemoveResponse extends AgentImageAddResponse {
  removedImageId: string;
}
