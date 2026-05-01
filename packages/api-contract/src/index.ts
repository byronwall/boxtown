export const mapNodeStatuses = [
  "planned",
  "implemented",
  "working",
  "blocked",
  "needs-review",
  "deprecated",
] as const;

export type MapNodeStatus = (typeof mapNodeStatuses)[number];

export interface AgentApiErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface AgentProjectSummary {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nodeCount: number;
  linkCount: number;
}

export interface AgentProjectCreateRequest {
  name?: string;
}

export interface AgentMapNodeImage {
  id: string;
  src: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  createdAt: string;
}

export interface AgentMapNode {
  id: string;
  label: string;
  type: string;
  status: MapNodeStatus;
  metadata: Record<string, string>;
  context: string;
  rawContext: string;
  contextMode: "context-only" | "structured";
  images: AgentMapNodeImage[];
}

export interface AgentMapLink {
  source: string;
  target: string;
  parentChild: boolean;
  relationship?: "related" | "dependency" | "reuse";
}

export interface AgentProjectDetail extends AgentProjectSummary {
  nodeMetadataSchema: Array<{
    key: string;
    label: string;
    defaultValue: string;
  }>;
  nodeTypeSchema: Array<{
    name: string;
    color: string;
  }>;
  spatialMap: {
    nodes: AgentMapNode[];
    links: AgentMapLink[];
  };
}

export interface AgentProjectCreateResponse {
  project: AgentProjectDetail;
}

export interface AgentNodeCreateRequest {
  title: string;
  type?: string;
  status?: MapNodeStatus;
  parentNodeId?: string | null;
  context?: string;
  metadata?: Record<string, unknown>;
}

export interface AgentNodeMutationResponse {
  node: AgentMapNode;
}

export interface AgentNodeCreateResponse extends AgentNodeMutationResponse {
  nodeId: string;
  parentLink: AgentMapLink | null;
}

export interface AgentNodeMoveResponse extends AgentNodeMutationResponse {
  parentNodeId: string | null;
  parentLink: AgentMapLink | null;
}

export interface AgentNodeContextResponse {
  nodeId: string;
  context: string;
  rawContext: string;
  contextMode: "context-only" | "structured";
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

export interface AgentMarkdownImportRequest {
  title: string;
  markdown: string;
  metadata?: Record<string, unknown>;
  splitByHeadingLevel?: boolean;
  maxHeadingDepth?: number;
}

export interface AgentMarkdownImportResponse {
  import: {
    rootNodeId: string;
    createdNodeIds: string[];
    createdNodeCount: number;
  };
  nodes: AgentMapNode[];
  links: AgentMapLink[];
}

export interface AgentImageAddResponse {
  nodeId: string;
  imageCount: number;
  images: AgentMapNodeImage[];
}

export interface AgentImageRemoveResponse extends AgentImageAddResponse {
  removedImageId: string;
}

export interface AgentVersionResponse {
  apiVersion: "1";
  minimumCliVersion: string;
  recommendedCliVersion: string;
}
