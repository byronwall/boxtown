import { createMemo, For, Show } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";

import { getNodePrimaryMetadataText } from "~/lib/projects/node-metadata";
import type { ProjectRecord } from "~/lib/projects/types";
import {
  SpatialMapImageDropTarget,
  SpatialMapImageStrip,
} from "./SpatialMapImages";
import { useSpatialMap } from "./SpatialMapContext";
import {
  buildSpatialMapTree,
  type SpatialMapTree,
  type SpatialMapTreeItem,
} from "./spatial-map-tree";

export function SpatialMapTreeView(props: { project: ProjectRecord }) {
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
        <VStack
          alignItems="stretch"
          gap="1.5"
          class="spatial-map-tree-list"
          role="tree"
        >
          <For each={tree().roots}>
            {(nodeId) => {
              const item = () => tree().items.get(nodeId);
              return (
                <Show when={item()}>
                  {(treeItem) => (
                    <SpatialMapTreeNode
                      item={treeItem()}
                      tree={tree()}
                      nodeMetadataSchema={props.project.nodeMetadataSchema}
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
  nodeMetadataSchema: ProjectRecord["nodeMetadataSchema"];
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
      <SpatialMapImageDropTarget
        nodeId={props.item.node.id}
        class="spatial-map-tree-drop-target"
      >
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
            <span class="spatial-map-tree-purpose">
              {getNodePrimaryMetadataText(
                props.item.node,
                props.nodeMetadataSchema,
                "No metadata",
              )}
            </span>
            <SpatialMapImageStrip node={props.item.node} variant="tree" />
          </span>
          <HStack gap="1" class="spatial-map-tree-meta">
            <span>{props.item.node.type}</span>
            <span>D{props.item.node.depth}</span>
            <span>
              {children().length}{" "}
              {children().length === 1 ? "child" : "children"}
            </span>
          </HStack>
        </div>
      </SpatialMapImageDropTarget>

      <Show when={children().length > 0}>
        <VStack
          alignItems="stretch"
          gap="1"
          class="spatial-map-tree-children"
          role="group"
        >
          <For each={children()}>
            {(child) => (
              <SpatialMapTreeNode
                item={child}
                tree={props.tree}
                nodeMetadataSchema={props.nodeMetadataSchema}
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
