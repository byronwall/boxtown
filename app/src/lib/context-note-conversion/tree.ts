import type { MapLink, MapNode } from "~/lib/spatial-map/types";
import { calculateNodeDepths } from "~/lib/spatial-map/depth";
import type { ConversionCandidateTree } from "./types";

function sortNodeIds(
  nodeIds: string[],
  nodeById: Map<string, MapNode>,
  depthsByNodeId: Map<string, number>,
) {
  return [...nodeIds].sort((left, right) => {
    const leftNode = nodeById.get(left);
    const rightNode = nodeById.get(right);
    if (!leftNode || !rightNode) return left.localeCompare(right);
    const depthDiff =
      (depthsByNodeId.get(leftNode.id) ?? 0) - (depthsByNodeId.get(rightNode.id) ?? 0);
    if (depthDiff !== 0) return depthDiff;
    return leftNode.label.localeCompare(rightNode.label);
  });
}

export function buildCandidateTree(nodes: MapNode[], links: MapLink[]): ConversionCandidateTree {
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const depthsByNodeId = calculateNodeDepths({ nodes, links });
  const childSetByParent = new Map<string, Set<string>>();
  const parentSetByChild = new Map<string, Set<string>>();

  for (const link of links) {
    if (!nodeById.has(link.source) || !nodeById.has(link.target)) {
      continue;
    }

    if (!link.parentChild) {
      continue;
    }

    childSetByParent.set(link.source, (childSetByParent.get(link.source) ?? new Set()).add(link.target));
    parentSetByChild.set(link.target, (parentSetByChild.get(link.target) ?? new Set()).add(link.source));
  }

  const roots = sortNodeIds(
    nodes
      .filter((node) => (parentSetByChild.get(node.id)?.size ?? 0) === 0)
      .map((node) => node.id),
    nodeById,
    depthsByNodeId,
  );

  const items = Object.fromEntries(
    nodes.map((node) => [
      node.id,
      {
        nodeId: node.id,
        label: node.label,
        type: node.type,
        depth: depthsByNodeId.get(node.id) ?? 0,
        metadata: node.metadata,
        childNodeIds: sortNodeIds(
          [...childSetByParent.get(node.id) ?? []],
          nodeById,
          depthsByNodeId,
        ),
      },
    ]),
  );

  return { roots, items };
}
