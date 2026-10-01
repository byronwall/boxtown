import type { MapNodePriority } from "~/lib/spatial-map/node-priority";
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

export interface AgentProjectSchema {
  projectId: string;
  name: string;
  statuses: Array<{
    value: MapNodeStatus;
    label: string;
  }>;
  nodeTypes: ProjectRecord["nodeTypeSchema"];
  metadataFields: ProjectRecord["nodeMetadataSchema"];
}

export interface AgentProjectCreateResponse {
  project: AgentProjectDetail;
}

export interface AgentMapNode extends Omit<MapNode, "images" | "priority"> {
  images: NonNullable<MapNode["images"]>;
  priority: MapNodePriority | null;
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
}

export interface AgentNodeMetadataResponse {
  nodeId: string;
  metadata: Record<string, string>;
}

export interface AgentNodeSummary {
  id: string;
  label: string;
  title: string;
  status: MapNodeStatus;
  type: string;
  metadata: Record<string, string>;
  parentNodeId: string | null;
  childCount: number;
  imageCount: number;
  archived: boolean;
  priority: MapNodePriority | null;
  updatedAt: string;
  titlePath?: string;
  path?: AgentPathNode[];
}

export interface AgentPathNode extends AgentMapNode {
  title: string;
}

export interface AgentContextMetadataBlock {
  sourceNodeId: string;
  sourceTitle: string;
  key: string;
  value: string;
}

export interface AgentContextTextBlock {
  sourceNodeId: string;
  sourceTitle: string;
  value: string;
}

export type AgentContextImage = NonNullable<MapNode["images"]>[number] & {
  sourceNodeId: string;
  sourceTitle: string;
};

export interface AgentInheritedContext {
  titlePath: string;
  metadata: AgentContextMetadataBlock[];
  contextBlocks: AgentContextTextBlock[];
  rawContextBlocks: AgentContextTextBlock[];
  images: AgentContextImage[];
  hasDirectContext: boolean;
  hasInheritedContext: boolean;
  missingContext: boolean;
}

export interface AgentNodeContextTree {
  node: AgentPathNode;
  path: AgentPathNode[];
  inheritedContext: AgentInheritedContext;
}

export interface AgentNodeContext {
  node: AgentNodeSummary;
  path: AgentPathNode[];
  inheritedContext: AgentInheritedContext;
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
