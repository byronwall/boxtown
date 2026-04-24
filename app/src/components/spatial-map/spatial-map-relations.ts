import type {
  MapLink,
  MapNode,
  PositionedMapNode,
} from "~/lib/spatial-map/types";
import { getLinkLabel } from "~/lib/spatial-map/links";

import type {
  EdgeVisualState,
  NodeVisualState,
  TransitionVisualState,
} from "./spatial-map-canvas.types";

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
  transitionVisualState?: Map<string, TransitionVisualState>;
}): NodeVisualState[] {
const {
    activeNodeId,
    hoveredNodeId,
    positionedNodes,
    relatedSet,
    selectedNodeId,
    transitionVisualState,
  } = options;
  return positionedNodes.map((node) => {
    const isDimmed = Boolean(activeNodeId && !relatedSet.has(node.id));
    const isHovered = hoveredNodeId === node.id;
    const isSelected = selectedNodeId === node.id;
    const transitionState = transitionVisualState?.get(node.id);
    const baseOpacity = isDimmed ? 0.22 : 1;
    const relativeDepth = getRelativeDepth(node.depth, positionedNodes);
    const baseFillLightness = 46;
    const hoverFillLightness = 36;
    const baseStrokeLightness = 28;
    const hoverStrokeLightness = 22;
    const depthStrokeWidth = relativeDepth === null
      ? 1.4
      : Math.round(interpolateNumber(1.4, 1.05, relativeDepth) * 100) / 100;
    const depthFillLightness = `${Math.round(
      relativeDepth === null ? 0 : interpolateNumber(0, baseFillLightness, relativeDepth),
    )}%`;
    const depthFillHoverLightness = `${Math.round(
      relativeDepth === null ? 0 : interpolateNumber(0, hoverFillLightness, relativeDepth),
    )}%`;
    const depthStrokeLightness = `${Math.round(
      relativeDepth === null ? 0 : interpolateNumber(0, baseStrokeLightness, relativeDepth),
    )}%`;
    const depthStrokeHoverLightness = `${Math.round(
      relativeDepth === null ? 0 : interpolateNumber(0, hoverStrokeLightness, relativeDepth),
    )}%`;

    return {
      node,
      isHovered,
      isSelected,
      opacity: baseOpacity * (transitionState?.opacity ?? 1),
      scale: transitionState?.scale ?? 1,
      depthFillLightness,
      depthFillHoverLightness,
      depthStrokeLightness,
      depthStrokeHoverLightness,
      depthStrokeWidth,
    };
  });
}

function getRelativeDepth(
  depth: number,
  nodes: PositionedMapNode[],
) {
  if (nodes.length === 0) {
    return null;
  }

  let minDepth = Number.POSITIVE_INFINITY;
  let maxDepth = Number.NEGATIVE_INFINITY;

  for (const node of nodes) {
    minDepth = Math.min(minDepth, node.depth);
    maxDepth = Math.max(maxDepth, node.depth);
  }

  const span = maxDepth - minDepth;
  if (span <= 0) {
    return null;
  }

  return (depth - minDepth) / span;
}

function interpolateNumber(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

export function createEdgeState(options: {
  activeNodeId: string | null;
  links: MapLink[];
  nodesById: Map<string, PositionedMapNode>;
  relatedSet: Set<string>;
  showEdges: boolean;
  transitionVisualState?: Map<string, TransitionVisualState>;
}): EdgeVisualState[] {
  const {
    activeNodeId,
    links,
    nodesById,
    relatedSet,
    showEdges,
    transitionVisualState,
  } = options;

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

    const transitionOpacity = Math.min(
      transitionVisualState?.get(link.source)?.opacity ?? 1,
      transitionVisualState?.get(link.target)?.opacity ?? 1,
    );

    return [
      {
        linkId: `${link.source}-${link.target}-${getLinkLabel(link)}-${index}`,
        path: `M ${source.x} ${source.y} L ${target.x} ${target.y}`,
        opacity: visible ? opacity * transitionOpacity : 0,
      },
    ];
  });
}
