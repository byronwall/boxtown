import type {
  MapLink,
  MapNode,
  PositionedMapNode,
} from "~/lib/spatial-map/types";
import { getLinkLabel } from "~/lib/spatial-map/links";

import type { EdgeVisualState, NodeVisualState } from "./spatial-map-canvas.types";

export interface RelationMapItem {
  kind: string;
  nodeId: string;
}

export function describeRelations(
  links: MapLink[],
  nodesById: Map<string, MapNode>,
  selectedNode: MapNode | null,
) {
  if (!selectedNode) {
    return {
      outgoing: [] as RelationMapItem[],
      incoming: [] as RelationMapItem[],
    };
  }

  const outgoing = links
    .filter((link) => link.source === selectedNode.id && nodesById.has(link.target))
    .map((link) => ({
      kind: getLinkLabel(link),
      nodeId: link.target,
    }));

  const incoming = links
    .filter((link) => link.target === selectedNode.id && nodesById.has(link.source))
    .map((link) => ({
      kind: getLinkLabel(link),
      nodeId: link.source,
    }));

  return { outgoing, incoming };
}

export function createOrderedNodeState(options: {
  activeNodeId: string | null;
  hoveredNodeId: string | null;
  positionedNodes: PositionedMapNode[];
  relatedSet: Set<string>;
  selectedNodeId: string | null;
}): NodeVisualState[] {
  const {
    activeNodeId,
    hoveredNodeId,
    positionedNodes,
    relatedSet,
    selectedNodeId,
  } = options;

  return positionedNodes.map((node) => {
    const isActive = Boolean(activeNodeId && relatedSet.has(node.id));
    const isDimmed = Boolean(activeNodeId && !relatedSet.has(node.id));
    const isHovered = hoveredNodeId === node.id;
    const isSelected = selectedNodeId === node.id;
    const isCore = isHovered || isSelected;

    return {
      node,
      isHovered,
      isSelected,
      opacity: isDimmed ? 0.22 : 1,
      scale: isCore ? 1.045 : isActive ? 1.02 : isDimmed ? 0.985 : 1,
    };
  });
}

export function createEdgeState(options: {
  activeNodeId: string | null;
  links: MapLink[];
  nodesById: Map<string, PositionedMapNode>;
  relatedSet: Set<string>;
  showEdges: boolean;
}): EdgeVisualState[] {
  const { activeNodeId, links, nodesById, relatedSet, showEdges } = options;

  return links.flatMap((link, index) => {
    const source = nodesById.get(link.source);
    const target = nodesById.get(link.target);
    if (!source || !target) {
      return [];
    }

    const isRelatedEdge = Boolean(
      activeNodeId && relatedSet.has(link.source) && relatedSet.has(link.target),
    );
    const visible = showEdges || isRelatedEdge;
    const opacity = activeNodeId
      ? isRelatedEdge
        ? 0.55
        : showEdges
          ? 0.2
          : 0.04
      : showEdges
        ? 0.38
        : 0;

    return [
      {
        linkId: `${link.source}-${link.target}-${getLinkLabel(link)}-${index}`,
        path: `M ${source.x} ${source.y} L ${target.x} ${target.y}`,
        opacity: visible ? opacity : 0,
      },
    ];
  });
}
