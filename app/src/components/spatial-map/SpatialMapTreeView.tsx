import { useAction } from "@solidjs/router";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { Box, VStack, styled } from "styled-system/jsx";

import { MarkdownRenderer } from "~/components/markdown-renderer";
import { Button } from "~/components/ui/button";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { toaster } from "~/components/ui/toast";
import { updateProjectNodeStatus, updateProjectNodeType } from "~/lib/projects/data";
import { getNodeMetadataEntries } from "~/lib/projects/node-metadata";
import {
  appendClientMutationId,
  createClientMutationId,
  updateProjectNode,
} from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode, MapNodeStatus } from "~/lib/spatial-map/types";
import {
  SpatialMapImageDropTarget,
  SpatialMapImageStrip,
} from "./SpatialMapImages";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapNodePriorityMenu } from "./SpatialMapNodePriorityMenu";
import { SpatialMapNodeStatusMenu } from "./SpatialMapNodeStatusMenu";
import { SpatialMapNodeTypePicker } from "./SpatialMapNodeTypePicker";
import { SpatialMapTreeNavigation } from "./SpatialMapTreeNavigation";
import {
  buildSpatialMapTree,
  type SpatialMapTree,
  type SpatialMapTreeItem,
} from "./spatial-map-tree";

const TreeContextButton = styled("button");

// Tree rails and markdown/table descendants rely on pseudo-elements and
// generated child tags, so they stay as local Panda selectors.
const treeStructureClass = css({
  "& .spatial-map-tree-rails": {
    display: "inline-grid",
    gridAutoFlow: "column",
    gridAutoColumns: "12px",
    gap: "4px",
    alignSelf: "stretch",
    w: "max-content",
    minH: "100%",
    pointerEvents: "none",
  },
  "& .spatial-map-tree-rail": {
    position: "relative",
    alignSelf: "stretch",
    w: "3px",
    minH: "100%",
    background: "transparent",
    borderRadius: "4px",
    opacity: "0.82",
  },
  "& .spatial-map-tree-rail::before": {
    content: '""',
    position: "absolute",
    inset: "0 0 -10px",
    background: "color-mix(in srgb, var(--spatial-map-tree-stroke) 84%, #f8faf7)",
    borderRadius: "inherit",
    WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 38%, #000 62%, transparent 100%)",
    maskImage: "linear-gradient(90deg, transparent 0, #000 38%, #000 62%, transparent 100%)",
  },
  "& .spatial-map-tree-rail--terminal::before": {
    bottom: "0",
  },
  "& .spatial-map-tree-controls .spatial-map-attribute-menu-trigger-wrap": {
    display: "flex",
    w: "100%",
  },
  "& .spatial-map-tree-controls .spatial-map-attribute-menu-trigger": {
    w: "100%",
    justifyContent: "space-between",
  },
  "& .spatial-map-tree-metadata": {
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  "& .spatial-map-tree-metadata th": {
    p: "2px 12px 2px 0",
    color: "var(--spatial-map-copy-dim)",
    fontSize: "11px",
    fontWeight: "500",
    whiteSpace: "nowrap",
    textAlign: "left",
    verticalAlign: "top",
  },
  "& .spatial-map-tree-metadata td": {
    p: "2px 0",
    color: "var(--spatial-map-copy-muted)",
    verticalAlign: "top",
  },
  "& .spatial-map-tree-context :where(p, ul, ol, blockquote, pre, table)": {
    mb: "8px",
  },
  "& .spatial-map-tree-context :where(p, ul, ol, blockquote, pre, table):last-child": {
    mb: "0",
  },
});

// SimpleDialog exposes only contentClass for the markdown modal surface.
const treeContextDialogClass = css({
  "& .dialog__body": {
    alignItems: "stretch",
  },
});

export function SpatialMapTreeView(props: {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const spatialMap = useSpatialMap();
  const submitSaveStatus = useAction(updateProjectNodeStatus);
  const submitSaveType = useAction(updateProjectNodeType);
  const tree = createMemo(() => buildSpatialMapTree(spatialMap.visibleData()));
  let viewportRef: HTMLDivElement | undefined;
  const [statusPending, setStatusPending] = createSignal(false);
  const [typePending, setTypePending] = createSignal(false);
  // Collapsed branches are keyed by tree path so the same node can be open in one place and closed in another.
  const [collapsedPaths, setCollapsedPaths] = createSignal<Set<string>>(new Set());
  // The priority column is only reserved when some visible node has a priority.
  const hasPriorities = createMemo(() => spatialMap.visibleData().nodes.some((node) => Boolean(node.priority)));
  const toggleCollapsed = (path: string) => {
    setCollapsedPaths((current) => {
      const next = new Set(current);
      if (!next.delete(path)) next.add(path);
      return next;
    });
  };
  const [optimisticStatus, setOptimisticStatus] = createSignal<{
    clientMutationId: string;
    nodeId: string;
    previousStatus: MapNodeStatus;
    status: MapNodeStatus;
  } | null>(null);
  const [optimisticType, setOptimisticType] = createSignal<{
    clientMutationId: string;
    nodeId: string;
    previousType: string;
    type: string;
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
      { clientMutationId: optimistic.clientMutationId, phase: "server" },
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

  const rollBackType = (error: unknown) => {
    const optimistic = optimisticType();
    if (!optimistic) {
      return;
    }

    props.onProjectUpdated?.(
      updateProjectNode(props.project, optimistic.nodeId, (projectNode) => ({
        ...projectNode,
        type: optimistic.previousType,
      })),
      { clientMutationId: optimistic.clientMutationId, phase: "server" },
    );
    setOptimisticType(null);
    toaster.error({
      title: "Type update failed",
      description:
        error instanceof Error
          ? error.message
          : "The selected node type could not be updated.",
    });
  };

  const scrollToTreeNode = (path: string) => {
    // A collapsed ancestor has no row to scroll to, so open the way down first.
    const hiddenBy = [...collapsedPaths()].filter((collapsed) => path.startsWith(`${collapsed}/`));
    if (hiddenBy.length > 0) {
      setCollapsedPaths((current) => new Set([...current].filter((collapsed) => !hiddenBy.includes(collapsed))));
    }

    requestAnimationFrame(() => {
      const rows = Array.from(
        viewportRef?.querySelectorAll<HTMLElement>("[data-spatial-map-tree-path]") ?? [],
      );
      const row = rows.find((entry) => entry.dataset.spatialMapTreePath === path);
      row?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const submitStatus = async (nodeId: string, status: MapNodeStatus) => {
    const node = spatialMap.sourceNodesById().get(nodeId);
    if (!node || statusPending() || node.status === status) return;

    setStatusPending(true);
    const clientMutationId = createClientMutationId();
    setOptimisticStatus({
      clientMutationId,
      nodeId,
      previousStatus: node.status,
      status,
    });
    props.onProjectUpdated?.(
      updateProjectNode(props.project, nodeId, (projectNode) => ({
        ...projectNode,
        status,
      })),
      { clientMutationId, phase: "optimistic" },
    );

    try {
      const formData = new FormData();
      formData.set("projectId", props.project.id);
      formData.set("nodeId", nodeId);
      formData.set("status", status);
      const result = await submitSaveStatus(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      setOptimisticStatus(null);
    } catch (error) {
      rollBackStatus(error);
    } finally {
      setStatusPending(false);
    }
  };

  const submitType = async (nodeId: string, type: string) => {
    const node = spatialMap.sourceNodesById().get(nodeId);
    if (!node || typePending() || node.type === type) return;

    setTypePending(true);
    const clientMutationId = createClientMutationId();
    setOptimisticType({
      clientMutationId,
      nodeId,
      previousType: node.type,
      type,
    });
    props.onProjectUpdated?.(
      updateProjectNode(props.project, nodeId, (projectNode) => ({
        ...projectNode,
        type,
      })),
      { clientMutationId, phase: "optimistic" },
    );

    try {
      const formData = new FormData();
      formData.set("projectId", props.project.id);
      formData.set("nodeId", nodeId);
      formData.set("type", type);
      const result = await submitSaveType(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      setOptimisticType(null);
    } catch (error) {
      rollBackType(error);
    } finally {
      setTypePending(false);
    }
  };

  return (
    <Box
      ref={viewportRef}
      class={treeStructureClass}
      position="relative"
      minH="0"
      overflowX="hidden"
      overflowY="auto"
      p="0 8px 8px"
      background="var(--spatial-map-panel-strong)"
      style={{ "--spatial-map-tree-sticky-offset": "40px" }}
    >
      <Show
        when={tree().roots.length > 0}
        fallback={
          <Box p="12px 4px" color="var(--spatial-map-copy-dim)" fontSize="12px" lineHeight="1.4">
            No nodes are visible at this depth or with the current filters.
          </Box>
        }
      >
        <SpatialMapTreeNavigation
          tree={tree()}
          getScrollRoot={() => viewportRef}
          onNavigate={scrollToTreeNode}
          actions={
            <>
              <Button
                variant="plain"
                size="2xs"
                color="var(--spatial-map-copy-dim)"
                disabled={collapsedPaths().size === 0}
                onClick={() => setCollapsedPaths(new Set<string>())}
              >
                Expand all
              </Button>
              <Button
                variant="plain"
                size="2xs"
                color="var(--spatial-map-copy-dim)"
                onClick={() => setCollapsedPaths(new Set(collectParentPaths(tree())))}
              >
                Collapse all
              </Button>
            </>
          }
        />
        <VStack
          alignItems="stretch"
          gap="0"
          class="spatial-map-tree-list"
          w="min(100%, 86ch)"
          maxW="100%"
          minW="0"
          m="0 auto"
          p="0 4px 24px"
          color="var(--spatial-map-copy)"
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
                      project={props.project}
                      depth={0}
                      ancestry={new Set([nodeId])}
                      path={nodeId}
                      hasSameDepthSiblingBelow={index() < tree().roots.length - 1}
                      statusPending={statusPending()}
                      typePending={typePending()}
                      optimisticStatus={optimisticStatus()}
                      optimisticType={optimisticType()}
                      collapsedPaths={collapsedPaths()}
                      showPriority={hasPriorities()}
                      onToggleCollapsed={toggleCollapsed}
                      onStatusChange={submitStatus}
                      onTypeChange={submitType}
                      onProjectUpdated={props.onProjectUpdated}
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
  project: ProjectRecord;
  depth: number;
  ancestry: Set<string>;
  path: string;
  hasSameDepthSiblingBelow: boolean;
  statusPending: boolean;
  typePending: boolean;
  optimisticStatus: {
    nodeId: string;
    status: MapNodeStatus;
  } | null;
  optimisticType: {
    nodeId: string;
    type: string;
  } | null;
  collapsedPaths: Set<string>;
  showPriority: boolean;
  onToggleCollapsed: (path: string) => void;
  onStatusChange: (nodeId: string, status: MapNodeStatus) => void;
  onTypeChange: (nodeId: string, type: string) => void;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}) {
  const spatialMap = useSpatialMap();
  const isCollapsed = () => props.collapsedPaths.has(props.path);
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
  const nodeWithOptimisticType = createMemo(() =>
    props.optimisticType?.nodeId === props.item.node.id
      ? { ...props.item.node, type: props.optimisticType.type }
      : props.item.node,
  );

  return (
    <Box position="relative" w="100%" maxW="100%" minW="0">
      <SpatialMapImageDropTarget
        nodeId={props.item.node.id}
        class="spatial-map-tree-drop-target"
        variant="tree"
      >
        <Box
          role="treeitem"
          tabindex="0"
          aria-level={props.depth + 1}
          aria-expanded={children().length > 0 ? !isCollapsed() : undefined}
          aria-selected={isSelected()}
          data-spatial-map-tree-node-id={props.item.node.id}
          data-spatial-map-tree-path={props.path}
          class={`spatial-map-tree-row spatial-map-tree-row--${nodeWithOptimisticType().type}${railLevels().length === 0 ? " spatial-map-tree-row--root" : ""}${isSelected() ? " is-selected" : ""}`}
          display="grid"
          gridTemplateColumns={railLevels().length === 0 ? "minmax(0, 1fr)" : "max-content minmax(0, 1fr)"}
          alignItems="stretch"
          gap="10px"
          boxSizing="border-box"
          w="100%"
          maxW="100%"
          minW="0"
          minH="0"
          p="0 0 6px"
          border="0"
          borderRadius="4px"
          background={isSelected() ? "rgba(229, 239, 229, 0.7)" : "transparent"}
          color="var(--spatial-map-copy)"
          fontFamily="inherit"
          textAlign="left"
          scrollMarginTop="calc(var(--spatial-map-tree-sticky-offset) + 18px)"
          appearance="none"
          cursor="pointer"
          transition="background-color 180ms ease, box-shadow 180ms ease, outline-color 180ms ease"
          _hover={{ background: isSelected() ? "rgba(229, 239, 229, 0.7)" : "rgba(34, 41, 36, 0.04)", boxShadow: "none" }}
          _focusVisible={{
            outline: "2px solid rgba(23, 62, 39, 0.58)",
            outlineOffset: "2px",
            boxShadow: "none",
          }}
          style={{
            "--spatial-map-tree-depth": String(props.depth),
            ...getTreeToneStyle(nodeWithOptimisticType().type),
          }}
          onClick={() => spatialMap.setSelectedNodeId(props.item.node.id)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              spatialMap.setSelectedNodeId(props.item.node.id);
            }
            const wantsCollapsed = event.key === "ArrowLeft";
            if ((wantsCollapsed || event.key === "ArrowRight") && children().length > 0 && isCollapsed() !== wantsCollapsed) {
              event.preventDefault();
              props.onToggleCollapsed(props.path);
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
          <Box
            as="article"
            minW="0"
            display="grid"
            gridTemplateColumns="16px minmax(0, 1fr)"
            columnGap="4px"
            rowGap="6px"
            alignItems="start"
            boxSizing="border-box"
            p={railLevels().length === 0 ? "8px 8px 0 4px" : "4px 8px 0 0"}
            borderTop={railLevels().length === 0 ? "1px solid var(--spatial-map-panel-divider)" : undefined}
          >
            {/* The collapse toggle sits in a fixed gutter so headings and the right-hand controls stay aligned. */}
            <Show when={children().length > 0} fallback={<span aria-hidden="true" />}>
              <TreeContextButton
                type="button"
                display="inline-flex"
                alignItems="center"
                justifyContent="center"
                w="16px"
                h="21px"
                mt="2px"
                p="0"
                border="0"
                borderRadius="4px"
                background="transparent"
                color="var(--spatial-map-copy-dim)"
                cursor="pointer"
                _hover={{ background: "rgba(34, 41, 36, 0.1)", color: "var(--spatial-map-copy)" }}
                _focusVisible={{ outline: "2px solid rgba(45, 111, 72, 0.42)", outlineOffset: "1px" }}
                aria-label={`${isCollapsed() ? "Expand" : "Collapse"} ${children().length} ${children().length === 1 ? "child" : "children"}`}
                title={isCollapsed() ? "Expand children" : "Collapse children"}
                onClick={(event) => {
                  event.stopPropagation();
                  props.onToggleCollapsed(props.path);
                }}
              >
                <Show when={isCollapsed()} fallback={<ChevronDownIcon size={13} aria-hidden="true" />}>
                  <ChevronRightIcon size={13} aria-hidden="true" />
                </Show>
              </TreeContextButton>
            </Show>
            <Box display="flex" flexWrap="wrap" alignItems="center" columnGap="12px" rowGap="4px" minW="0">
              <Box display="flex" alignItems="baseline" gap="8px" flex="1 1 18ch" minW="0">
                <NodeHeading node={props.item.node} depth={props.depth} />
                <Show when={children().length > 0}>
                  <Box
                    as="span"
                    flexShrink="0"
                    color="var(--spatial-map-copy-dim)"
                    fontSize="11px"
                    fontWeight={isCollapsed() ? "700" : "500"}
                    fontVariantNumeric="tabular-nums"
                    title={`${children().length} ${children().length === 1 ? "child" : "children"}${isCollapsed() ? " hidden" : ""}`}
                  >
                    {children().length}
                  </Box>
                </Show>
              </Box>
              <Box
                class="spatial-map-tree-controls"
                display="grid"
                gridTemplateColumns={props.showPriority ? "78px 116px 100px" : "116px 100px"}
                gap="4px"
                flexShrink="0"
              >
                <Show when={props.showPriority}>
                  <Show when={props.item.node.priority} fallback={<span aria-hidden="true" />}>
                    <SpatialMapNodePriorityMenu
                      project={props.project}
                      node={props.item.node}
                      variant="tree"
                      onProjectUpdated={props.onProjectUpdated}
                    />
                  </Show>
                </Show>
                <SpatialMapNodeStatusMenu
                  node={nodeWithOptimisticStatus()}
                  pending={props.statusPending}
                  variant="tree"
                  onChange={(status) => {
                    void props.onStatusChange(props.item.node.id, status);
                  }}
                />
                <SpatialMapNodeTypePicker
                  project={props.project}
                  type={nodeWithOptimisticType().type}
                  pending={props.typePending}
                  variant="tree"
                  onChange={(type) => {
                    void props.onTypeChange(props.item.node.id, type);
                  }}
                />
              </Box>
            </Box>
            <Show when={(props.item.node.images ?? []).length > 0}>
              <Box gridColumn="2" maxW="100%">
                <SpatialMapImageStrip node={props.item.node} variant="tree" />
              </Box>
            </Show>
            <Show when={context().length > 0}>
              <Box gridColumn="2" minW="0">
                <TreeContext content={context()} nodeLabel={props.item.node.label} />
              </Box>
            </Show>
            <Show when={metadataEntries().length > 0}>
              <Box gridColumn="2" maxW="100%" overflowX="auto">
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
          </Box>
        </Box>
      </SpatialMapImageDropTarget>

      <Show when={children().length > 0 && !isCollapsed()}>
        <VStack
          alignItems="stretch"
          gap="0"
          class="spatial-map-tree-children"
          position="relative"
          w="100%"
          maxW="100%"
          minW="0"
          mt="0"
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
                  project={props.project}
                  depth={props.depth + 1}
                  ancestry={new Set([...props.ancestry, child.node.id])}
                  path={`${props.path}/${child.node.id}`}
                  hasSameDepthSiblingBelow={hasSameDepthSiblingBelow()}
                  statusPending={props.statusPending}
                  typePending={props.typePending}
                  optimisticStatus={props.optimisticStatus}
                  optimisticType={props.optimisticType}
                  collapsedPaths={props.collapsedPaths}
                  showPriority={props.showPriority}
                  onToggleCollapsed={props.onToggleCollapsed}
                  onStatusChange={props.onStatusChange}
                  onTypeChange={props.onTypeChange}
                  onProjectUpdated={props.onProjectUpdated}
                />
              );
            }}
          </For>
        </VStack>
      </Show>
    </Box>
  );
}

function TreeContext(props: { content: string; nodeLabel: string }) {
  let contentRef: HTMLDivElement | undefined;
  const [isDialogOpen, setIsDialogOpen] = createSignal(false);
  const [canExpand, setCanExpand] = createSignal(false);

  const measureOverflow = () => {
    if (!contentRef) return;
    setCanExpand(contentRef.scrollHeight > contentRef.clientHeight + 1);
  };

  onMount(measureOverflow);

  createEffect(() => {
    props.content;
    queueMicrotask(measureOverflow);
  });

  return (
    <Box maxW="72ch">
      <Box
        ref={contentRef}
        class="spatial-map-tree-context spatial-map-tree-context--collapsed"
        color="var(--spatial-map-copy-muted)"
        fontSize="13px"
        lineHeight="1.55"
        maxH="160px"
        overflow="hidden"
      >
        <MarkdownRenderer>{props.content}</MarkdownRenderer>
      </Box>
      <Show when={canExpand()}>
        <TreeContextButton
          type="button"
          mt="4px"
          p="0"
          border="0"
          background="transparent"
          color="var(--spatial-map-accent)"
          cursor="pointer"
          fontFamily="inherit"
          fontSize="12px"
          fontWeight="600"
          lineHeight="1.2"
          _hover={{ color: "var(--spatial-map-accent-strong)", textDecoration: "underline" }}
          _focusVisible={{
            outline: "2px solid rgba(45, 111, 72, 0.42)",
            outlineOffset: "3px",
          }}
          onClick={(event) => {
            event.stopPropagation();
            setIsDialogOpen(true);
          }}
        >
          Open full context
        </TreeContextButton>
      </Show>
      <SimpleDialog
        open={isDialogOpen()}
        onOpenChange={setIsDialogOpen}
        title={props.nodeLabel}
        description="Context"
        maxW="min(800px, 90vw)"
        contentClass={treeContextDialogClass}
      >
        <Box color="var(--spatial-map-copy-muted)" fontSize="12px" lineHeight="1.55">
          <MarkdownRenderer>{props.content}</MarkdownRenderer>
        </Box>
      </SimpleDialog>
    </Box>
  );
}

function getRailLevels(depth: number) {
  return Array.from({ length: depth });
}

function NodeHeading(props: { node: MapNode; depth: number }) {
  const level = createMemo(() => Math.min(props.depth + 1, 6));
  const headingTag = createMemo(() => `h${level()}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6");

  // Sizes are written as inline literals: Panda only emits CSS for values it
  // can read statically, so a helper that returns the size produces no style.
  return (
    <Box
      as={headingTag()}
      class={`spatial-map-tree-heading spatial-map-tree-heading--${level()}`}
      m="0"
      color="var(--spatial-map-copy)"
      fontSize={level() === 1 ? "20px" : level() === 2 ? "17px" : level() === 3 ? "15px" : "13px"}
      lineHeight="1.3"
      fontWeight={level() <= 2 ? "700" : "600"}
      letterSpacing={level() === 1 ? "-0.02em" : "0"}
      textWrap="pretty"
    >
      {props.node.label}
    </Box>
  );
}

// Every path that has children, for "Collapse all".
function collectParentPaths(tree: SpatialMapTree) {
  const paths: string[] = [];
  const visit = (nodeId: string, path: string, ancestry: Set<string>) => {
    const childIds = (tree.items.get(nodeId)?.childNodeIds ?? []).filter(
      (childId) => !ancestry.has(childId) && tree.items.has(childId),
    );
    if (childIds.length === 0) return;
    paths.push(path);
    for (const childId of childIds) {
      visit(childId, `${path}/${childId}`, new Set([...ancestry, childId]));
    }
  };
  for (const rootId of tree.roots) {
    visit(rootId, rootId, new Set([rootId]));
  }
  return paths;
}

function getTreeToneStyle(type: string) {
  if (type === "page" || type === "area") {
    return {
      "--spatial-map-tree-fill": "var(--spatial-map-blue-fill)",
      "--spatial-map-tree-fill-hover": "var(--spatial-map-blue-fill-hover)",
      "--spatial-map-tree-stroke": "var(--spatial-map-blue-stroke)",
      "--spatial-map-tree-stroke-hover": "var(--spatial-map-blue-stroke-hover)",
    };
  }
  if (type === "assembly" || type === "module") {
    return {
      "--spatial-map-tree-fill": "var(--spatial-map-green-fill)",
      "--spatial-map-tree-fill-hover": "var(--spatial-map-green-fill-hover)",
      "--spatial-map-tree-stroke": "var(--spatial-map-green-stroke)",
      "--spatial-map-tree-stroke-hover": "var(--spatial-map-green-stroke-hover)",
    };
  }
  if (type === "taxonomy") {
    return {
      "--spatial-map-tree-fill": "var(--spatial-map-steel-fill)",
      "--spatial-map-tree-fill-hover": "var(--spatial-map-steel-fill-hover)",
      "--spatial-map-tree-stroke": "var(--spatial-map-steel-stroke)",
      "--spatial-map-tree-stroke-hover": "var(--spatial-map-steel-stroke-hover)",
    };
  }
  if (type === "note") {
    return {
      "--spatial-map-tree-fill": "var(--spatial-map-amber-fill)",
      "--spatial-map-tree-fill-hover": "var(--spatial-map-amber-fill-hover)",
      "--spatial-map-tree-stroke": "var(--spatial-map-amber-stroke)",
      "--spatial-map-tree-stroke-hover": "var(--spatial-map-amber-stroke-hover)",
    };
  }
  return {
    "--spatial-map-tree-fill": "var(--spatial-map-neutral-fill)",
    "--spatial-map-tree-fill-hover": "var(--spatial-map-neutral-fill-hover)",
    "--spatial-map-tree-stroke": "var(--spatial-map-neutral-stroke)",
    "--spatial-map-tree-stroke-hover": "var(--spatial-map-neutral-stroke-hover)",
  };
}
