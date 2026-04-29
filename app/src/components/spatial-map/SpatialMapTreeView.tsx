import { createMemo, createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { Box, VStack } from "styled-system/jsx";

import { MarkdownRenderer } from "~/components/markdown-renderer";
import { toaster } from "~/components/ui/toast";
import { patchProjectNode } from "~/lib/projects/client-mutations";
import { getNodeMetadataEntries } from "~/lib/projects/node-metadata";
import { updateProjectNode } from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode, MapNodeStatus } from "~/lib/spatial-map/types";
import {
  SpatialMapImageDropTarget,
  SpatialMapImageStrip,
} from "./SpatialMapImages";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapNodeStatusMenu } from "./SpatialMapNodeStatusMenu";
import { SpatialMapTreeNavigation } from "./SpatialMapTreeNavigation";
import {
  buildSpatialMapTree,
  type SpatialMapTree,
  type SpatialMapTreeItem,
} from "./spatial-map-tree";

export function SpatialMapTreeView(props: {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  const spatialMap = useSpatialMap();
  const tree = createMemo(() => buildSpatialMapTree(spatialMap.visibleData()));
  let viewportRef: HTMLDivElement | undefined;
  const [statusPending, setStatusPending] = createSignal(false);
  const [optimisticStatus, setOptimisticStatus] = createSignal<{
    nodeId: string;
    previousStatus: MapNodeStatus;
    status: MapNodeStatus;
  } | null>(null);

  const rollBackStatus = (error: unknown) => {
    const optimistic = optimisticStatus();
    if (!optimistic) {
      return;
    }

    props.onProjectUpdated?.(
      updateProjectNode(props.project, optimistic.nodeId, (projectNode) => ({
        ...projectNode,
        status: optimistic.previousStatus,
      })),
    );
    setOptimisticStatus(null);
    toaster.error({
      title: "Status update failed",
      description:
        error instanceof Error
          ? error.message
          : "The selected node status could not be updated.",
    });
  };

  const scrollToTreeNode = (path: string) => {
    const rows = Array.from(
      viewportRef?.querySelectorAll<HTMLElement>(
        "[data-spatial-map-tree-path]",
      ) ?? [],
    );
    const row = rows.find(
      (entry) => entry.dataset.spatialMapTreePath === path,
    );
    row?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const submitStatus = async (nodeId: string, status: MapNodeStatus) => {
    const node = spatialMap.sourceNodesById().get(nodeId);
    if (!node || statusPending() || node.status === status) return;

    setStatusPending(true);
    setOptimisticStatus({
      nodeId,
      previousStatus: node.status,
      status,
    });
    props.onProjectUpdated?.(
      updateProjectNode(props.project, nodeId, (projectNode) => ({
        ...projectNode,
        status,
      })),
    );

    try {
      const result = await patchProjectNode(props.project.id, nodeId, { status });
      props.onProjectUpdated?.(result);
      setOptimisticStatus(null);
    } catch (error) {
      rollBackStatus(error);
    } finally {
      setStatusPending(false);
    }
  };

  return (
    <Box ref={viewportRef} class="spatial-map-tree-viewport">
      <Show
        when={tree().roots.length > 0}
        fallback={
          <Box class="spatial-map-tree-empty">
            No hierarchy nodes are visible at this depth.
          </Box>
        }
      >
        <SpatialMapTreeNavigation
          tree={tree()}
          getScrollRoot={() => viewportRef}
          onNavigate={scrollToTreeNode}
        />
        <VStack
          alignItems="stretch"
          gap="1.5"
          class="spatial-map-tree-list"
          role="tree"
        >
          <For each={tree().roots}>
            {(nodeId, index) => {
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
                      path={nodeId}
                      hasSameDepthSiblingBelow={index() < tree().roots.length - 1}
                      statusPending={statusPending()}
                      optimisticStatus={optimisticStatus()}
                      onStatusChange={submitStatus}
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
  path: string;
  hasSameDepthSiblingBelow: boolean;
  statusPending: boolean;
  optimisticStatus: {
    nodeId: string;
    status: MapNodeStatus;
  } | null;
  onStatusChange: (nodeId: string, status: MapNodeStatus) => void;
}) {
  const spatialMap = useSpatialMap();
  const children = createMemo(() =>
    props.item.childNodeIds
      .filter((nodeId) => !props.ancestry.has(nodeId))
      .map((nodeId) => props.tree.items.get(nodeId))
      .filter((item): item is SpatialMapTreeItem => Boolean(item)),
  );
  const context = createMemo(() =>
    (props.item.node.context || props.item.node.rawContext).trim(),
  );
  const metadataEntries = createMemo(() =>
    getNodeMetadataEntries(props.item.node, props.nodeMetadataSchema),
  );
  const isSelected = () => spatialMap.selectedNodeId() === props.item.node.id;
  const railLevels = createMemo(() => getRailLevels(props.depth));
  const nodeWithOptimisticStatus = createMemo(() =>
    props.optimisticStatus?.nodeId === props.item.node.id
      ? { ...props.item.node, status: props.optimisticStatus.status }
      : props.item.node,
  );

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
          data-spatial-map-tree-node-id={props.item.node.id}
          data-spatial-map-tree-path={props.path}
          class={`spatial-map-tree-row spatial-map-tree-row--${props.item.node.type}${railLevels().length === 0 ? " spatial-map-tree-row--root" : ""}${isSelected() ? " is-selected" : ""}`}
          style={{
            "--spatial-map-tree-depth": String(props.depth),
          }}
          onClick={() => spatialMap.setSelectedNodeId(props.item.node.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              spatialMap.setSelectedNodeId(props.item.node.id);
            }
          }}
        >
          <Show when={railLevels().length > 0}>
            <span class="spatial-map-tree-rails" aria-hidden="true">
              <For each={railLevels()}>
                {() => (
                  <span
                    class={`spatial-map-tree-rail${props.hasSameDepthSiblingBelow ? "" : " spatial-map-tree-rail--terminal"}`}
                  />
                )}
              </For>
            </span>
          </Show>
          <article class="spatial-map-tree-content">
            <NodeHeading node={props.item.node} depth={props.depth} />
            <Box class="spatial-map-tree-node-meta">
              <SpatialMapNodeStatusMenu
                node={nodeWithOptimisticStatus()}
                pending={props.statusPending}
                variant="tree"
                onChange={(status) => {
                  void props.onStatusChange(props.item.node.id, status);
                }}
              />
              <span>{props.item.node.type}</span>
              <span>D{props.item.node.depth}</span>
              <span>
                {children().length}{" "}
                {children().length === 1 ? "child" : "children"}
              </span>
            </Box>
            <Show when={context().length > 0}>
              <Box class="spatial-map-tree-context">
                <MarkdownRenderer>{context()}</MarkdownRenderer>
              </Box>
            </Show>
            <Show when={(props.item.node.images ?? []).length > 0}>
              <Box class="spatial-map-tree-rich-content">
                <SpatialMapImageStrip node={props.item.node} variant="tree" />
              </Box>
            </Show>
            <Show when={metadataEntries().length > 0}>
              <Box class="spatial-map-tree-metadata-wrap">
                <table class="spatial-map-tree-metadata">
                  <tbody>
                    <For each={metadataEntries()}>
                      {(entry) => (
                        <tr>
                          <th scope="row">{entry.label}</th>
                          <td>{entry.value}</td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </Box>
            </Show>
          </article>
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
            {(child, index) => {
              const hasSameDepthSiblingBelow = () =>
                index() < children().length - 1;

              return (
                <SpatialMapTreeNode
                  item={child}
                  tree={props.tree}
                  nodeMetadataSchema={props.nodeMetadataSchema}
                  depth={props.depth + 1}
                  ancestry={new Set([...props.ancestry, child.node.id])}
                  path={`${props.path}/${child.node.id}`}
                  hasSameDepthSiblingBelow={hasSameDepthSiblingBelow()}
                  statusPending={props.statusPending}
                  optimisticStatus={props.optimisticStatus}
                  onStatusChange={props.onStatusChange}
                />
              );
            }}
          </For>
        </VStack>
      </Show>
    </Box>
  );
}

function getRailLevels(depth: number) {
  return Array.from({ length: depth });
}

function NodeHeading(props: { node: MapNode; depth: number }) {
  const level = createMemo(() => Math.min(props.depth + 1, 6));
  const headingTag = createMemo(() => `h${level()}`);

  return (
    <Dynamic
      component={headingTag()}
      class={`spatial-map-tree-heading spatial-map-tree-heading--${level()}`}
    >
      {props.node.label}
    </Dynamic>
  );
}
