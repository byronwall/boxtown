import { createMemo, For, Show } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";

import type { MapNode, SpatialMapData } from "~/lib/spatial-map/types";
import { SpatialMapImageDropTarget, SpatialMapImageStrip } from "./SpatialMapImages";
import { useSpatialMap } from "./SpatialMapContext";

interface SpatialMapTreeItem {
  node: MapNode;
  childNodeIds: string[];
}

interface SpatialMapTree {
  roots: string[];
  items: Map<string, SpatialMapTreeItem>;
}

export function SpatialMapTreeView() {
  const spatialMap = useSpatialMap();
  const tree = createMemo(() => buildSpatialMapTree(spatialMap.visibleData()));

  return (
    <Box class="spatial-map-tree-viewport">
      <Box class="spatial-map-tree-header">
        <Box>
          <Box as="h2" class="spatial-map-tree-title">
            Hierarchy Tree
          </Box>
          <Box as="p" class="spatial-map-tree-subtitle">
            Showing {spatialMap.visibleData().nodes.length} nodes across{" "}
            {spatialMap.visibleDepthLevel()} visible{" "}
            {spatialMap.visibleDepthLevel() === 1 ? "level" : "levels"}.
          </Box>
        </Box>
      </Box>

      <Show
        when={tree().roots.length > 0}
        fallback={
          <Box class="spatial-map-tree-empty">
            No hierarchy nodes are visible at this depth.
          </Box>
        }
      >
        <VStack alignItems="stretch" gap="1.5" class="spatial-map-tree-list" role="tree">
          <For each={tree().roots}>
            {(nodeId) => {
              const item = () => tree().items.get(nodeId);
              return (
                <Show when={item()}>
                  {(treeItem) => (
                    <SpatialMapTreeNode
                      item={treeItem()}
                      tree={tree()}
                      depth={0}
                      ancestry={new Set([nodeId])}
                    />
                  )}
                </Show>
              );
            }}
          </For>
        </VStack>
      </Show>
    </Box>
  );
}

function SpatialMapTreeNode(props: {
  item: SpatialMapTreeItem;
  tree: SpatialMapTree;
  depth: number;
  ancestry: Set<string>;
}) {
  const spatialMap = useSpatialMap();
  const children = createMemo(() =>
    props.item.childNodeIds
      .filter((nodeId) => !props.ancestry.has(nodeId))
      .map((nodeId) => props.tree.items.get(nodeId))
      .filter((item): item is SpatialMapTreeItem => Boolean(item)),
  );
  const isSelected = () => spatialMap.selectedNodeId() === props.item.node.id;

  return (
    <Box class="spatial-map-tree-node">
      <SpatialMapImageDropTarget nodeId={props.item.node.id} class="spatial-map-tree-drop-target">
        <div
          role="treeitem"
          tabindex="0"
          aria-level={props.depth + 1}
          aria-expanded={children().length > 0 ? true : undefined}
          aria-selected={isSelected()}
          class={`spatial-map-tree-row spatial-map-tree-row--${props.item.node.type}${isSelected() ? " is-selected" : ""}`}
          style={{ "--spatial-map-tree-indent": `${props.depth * 24}px` }}
          onClick={() => spatialMap.setSelectedNodeId(props.item.node.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              spatialMap.setSelectedNodeId(props.item.node.id);
            }
          }}
        >
          <span class="spatial-map-tree-rail" aria-hidden="true" />
          <span class="spatial-map-tree-copy">
            <span class="spatial-map-tree-label">{props.item.node.label}</span>
            <span class="spatial-map-tree-purpose">{props.item.node.purpose}</span>
            <SpatialMapImageStrip node={props.item.node} variant="tree" />
          </span>
          <HStack gap="1" class="spatial-map-tree-meta">
            <span>{props.item.node.type}</span>
            <span>D{props.item.node.depth}</span>
            <span>
              {children().length} {children().length === 1 ? "child" : "children"}
            </span>
          </HStack>
        </div>
      </SpatialMapImageDropTarget>

      <Show when={children().length > 0}>
        <VStack alignItems="stretch" gap="1" class="spatial-map-tree-children" role="group">
          <For each={children()}>
            {(child) => (
              <SpatialMapTreeNode
                item={child}
                tree={props.tree}
                depth={props.depth + 1}
                ancestry={new Set([...props.ancestry, child.node.id])}
              />
            )}
          </For>
        </VStack>
      </Show>
    </Box>
  );
}

function buildSpatialMapTree(data: SpatialMapData): SpatialMapTree {
  const items: Map<string, SpatialMapTreeItem> = new Map(
    data.nodes.map((node) => [node.id, { node, childNodeIds: [] }]),
  );
  const parentIdsByChildId = new Map<string, Set<string>>();

  for (const link of data.links) {
    const source = items.get(link.source);
    const target = items.get(link.target);
    if (!source || !target || !link.parentChild) {
      continue;
    }

    source.childNodeIds.push(target.node.id);
    parentIdsByChildId.set(
      target.node.id,
      (parentIdsByChildId.get(target.node.id) ?? new Set()).add(source.node.id),
    );
  }

  for (const item of items.values()) {
    item.childNodeIds = sortNodeIds(item.childNodeIds, items);
  }

  const roots = sortNodeIds(
    data.nodes
      .filter((node) => (parentIdsByChildId.get(node.id)?.size ?? 0) === 0)
      .map((node) => node.id),
    items,
  );

  return { roots, items };
}

function sortNodeIds(nodeIds: string[], items: Map<string, SpatialMapTreeItem>) {
  return [...nodeIds].sort((left, right) => {
    const leftNode = items.get(left)?.node;
    const rightNode = items.get(right)?.node;
    if (!leftNode || !rightNode) {
      return left < right ? -1 : left > right ? 1 : 0;
    }

    const depthDiff = leftNode.depth - rightNode.depth;
    if (depthDiff !== 0) {
      return depthDiff;
    }

    if (leftNode.label !== rightNode.label) {
      return leftNode.label < rightNode.label ? -1 : 1;
    }

    return leftNode.id < rightNode.id ? -1 : leftNode.id > rightNode.id ? 1 : 0;
  });
}
