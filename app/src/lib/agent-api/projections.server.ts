import type { ProjectRecord, ProjectSummary } from "~/lib/projects/types";
import type { MapLink, MapNode } from "~/lib/spatial-map/types";
import type {
  AgentMapNode,
  AgentProjectDetail,
  AgentProjectSummary,
  AgentTaskSummary,
} from "./types";

export function toAgentProjectSummary(project: ProjectSummary): AgentProjectSummary {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    nodeCount: project.nodeCount,
    linkCount: project.linkCount,
  };
}

export function toAgentProjectDetail(project: ProjectRecord): AgentProjectDetail {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    nodeCount: project.spatialMap.nodes.length,
    linkCount: project.spatialMap.links.length,
    nodeMetadataSchema: project.nodeMetadataSchema,
    nodeTypeSchema: project.nodeTypeSchema,
    spatialMap: {
      nodes: project.spatialMap.nodes.map(toAgentMapNode),
      links: project.spatialMap.links,
    },
  };
}

export function toAgentMapNode(node: MapNode): AgentMapNode {
  return {
    id: node.id,
    label: node.label,
    type: node.type,
    status: node.status,
    metadata: node.metadata,
    context: node.context,
    rawContext: node.rawContext,
    contextMode: node.contextMode,
    images: node.images ?? [],
  };
}

export function toAgentTaskSummaries(project: ProjectRecord): AgentTaskSummary[] {
  return project.spatialMap.nodes
    .map((node) => {
      const parentNodeId = getParentNodeId(project.spatialMap.links, node.id);
      const childCount = project.spatialMap.links.filter(
        (link) => link.parentChild && link.source === node.id,
      ).length;

      return {
        id: node.id,
        title: node.label,
        status: node.status,
        type: node.type,
        parentNodeId,
        childCount,
        imageCount: node.images?.length ?? 0,
        updatedAt: project.updatedAt,
      };
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

function getParentNodeId(links: MapLink[], nodeId: string) {
  return links.find((link) => link.parentChild && link.target === nodeId)?.source ?? null;
}
