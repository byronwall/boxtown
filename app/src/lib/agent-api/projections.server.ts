import type { ProjectRecord, ProjectSummary } from "~/lib/projects/types";
import type { MapLink, MapNode } from "~/lib/spatial-map/types";
import type {
  AgentNodeContextTree,
  AgentMapNode,
  AgentPathNode,
  AgentProjectDetail,
  AgentProjectSummary,
  AgentTaskContext,
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
    images: node.images ?? [],
  };
}

export function toAgentTaskSummaries(
  project: ProjectRecord,
  options: { withAncestors?: boolean } = {},
): AgentTaskSummary[] {
  return project.spatialMap.nodes
    .map((node) => {
      const path = options.withAncestors ? getNodePath(project, node.id) : [];
      return toAgentTaskSummary(project, node, path);
    })
    .sort((left, right) => left.title.localeCompare(right.title));
}

export function toAgentTaskContexts(project: ProjectRecord): AgentTaskContext[] {
  return project.spatialMap.nodes
    .map((node) => toAgentTaskContext(project, node.id))
    .filter((item): item is AgentTaskContext => item !== null)
    .sort((left, right) => left.task.title.localeCompare(right.task.title));
}

export function toAgentTaskContext(
  project: ProjectRecord,
  nodeId: string,
): AgentTaskContext | null {
  const node = project.spatialMap.nodes.find((item) => item.id === nodeId);
  if (!node) {
    return null;
  }

  const path = getNodePath(project, nodeId);
  const summary = toAgentTaskSummary(project, node, path);

  return {
    task: summary,
    path,
    inheritedContext: getInheritedContext(path),
  };
}

export function toAgentNodeContextTree(
  project: ProjectRecord,
  nodeId: string,
): AgentNodeContextTree | null {
  const path = getNodePath(project, nodeId);
  const node = path.at(-1);
  if (!node) {
    return null;
  }

  return {
    node,
    path,
    inheritedContext: getInheritedContext(path),
  };
}

function toAgentTaskSummary(
  project: ProjectRecord,
  node: MapNode,
  path: AgentPathNode[] = [],
): AgentTaskSummary {
  const parentNodeId = getParentNodeId(project.spatialMap.links, node.id);
  const childCount = project.spatialMap.links.filter(
    (link) => link.parentChild && link.source === node.id,
  ).length;
  const withPath = path.length > 0;

  return {
    id: node.id,
    title: node.label,
    status: node.status,
    type: node.type,
    parentNodeId,
    childCount,
    imageCount: node.images?.length ?? 0,
    updatedAt: project.updatedAt,
    ...(withPath
      ? {
        titlePath: formatTitlePath(path),
        path,
      }
      : {}),
  };
}

function getNodePath(project: ProjectRecord, nodeId: string): AgentPathNode[] {
  const nodesById = new Map(project.spatialMap.nodes.map((node) => [node.id, node]));
  const path: AgentPathNode[] = [];
  const seen = new Set<string>();
  let currentId: string | null = nodeId;

  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const node = nodesById.get(currentId);
    if (!node) {
      break;
    }

    path.push(toAgentPathNode(node));
    currentId = getParentNodeId(project.spatialMap.links, currentId);
  }

  return path.reverse();
}

function toAgentPathNode(node: MapNode): AgentPathNode {
  return {
    ...toAgentMapNode(node),
    title: node.label,
  };
}

function getInheritedContext(path: AgentPathNode[]) {
  const leaf = path.at(-1) ?? null;
  const metadata = path.flatMap((node) =>
    Object.entries(node.metadata ?? {})
      .filter(([, value]) => value.trim().length > 0)
      .map(([key, value]) => ({
        sourceNodeId: node.id,
        sourceTitle: node.title,
        key,
        value,
      })),
  );
  const contextBlocks = path
    .filter((node) => node.context.trim().length > 0)
    .map((node) => ({
      sourceNodeId: node.id,
      sourceTitle: node.title,
      value: node.context,
    }));
  const rawContextBlocks = path
    .filter((node) => node.rawContext.trim().length > 0)
    .map((node) => ({
      sourceNodeId: node.id,
      sourceTitle: node.title,
      value: node.rawContext,
    }));
  const images = path.flatMap((node) =>
    node.images.map((image) => ({
      ...image,
      sourceNodeId: node.id,
      sourceTitle: node.title,
    })),
  );
  const directContext = leaf
    ? (leaf.context.trim().length > 0 ||
      leaf.rawContext.trim().length > 0 ||
      Object.values(leaf.metadata ?? {}).some((value) => value.trim().length > 0) ||
      leaf.images.length > 0)
    : false;
  const inheritedContext = path.slice(0, -1).some(
    (node) =>
      node.context.trim().length > 0 ||
      node.rawContext.trim().length > 0 ||
      Object.values(node.metadata ?? {}).some((value) => value.trim().length > 0) ||
      node.images.length > 0,
  );

  return {
    titlePath: formatTitlePath(path),
    metadata,
    contextBlocks,
    rawContextBlocks,
    images,
    hasDirectContext: directContext,
    hasInheritedContext: inheritedContext,
    missingContext:
      metadata.length === 0 &&
      contextBlocks.length === 0 &&
      rawContextBlocks.length === 0 &&
      images.length === 0,
  };
}

function formatTitlePath(path: AgentPathNode[]) {
  return path.map((node) => node.title).join(" > ");
}

function getParentNodeId(links: MapLink[], nodeId: string) {
  return links.find((link) => link.parentChild && link.target === nodeId)?.source ?? null;
}
