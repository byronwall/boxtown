import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onMount,
  Show,
} from "solid-js";
import { css } from "styled-system/css";
import { Box, VStack, styled } from "styled-system/jsx";

import { MarkdownRenderer } from "~/components/markdown-renderer";
import { SimpleDialog } from "~/components/ui/simple-dialog";
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
    inset: "0 0 -32px",
    background: "color-mix(in srgb, var(--spatial-map-tree-stroke) 84%, #f8faf7)",
    borderRadius: "inherit",
    WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 38%, #000 62%, transparent 100%)",
    maskImage: "linear-gradient(90deg, transparent 0, #000 38%, #000 62%, transparent 100%)",
  },
  "& .spatial-map-tree-rail--terminal::before": {
    bottom: "0",
  },
  "& .spatial-map-tree-metadata": {
    w: "100%",
    borderCollapse: "collapse",
    fontSize: "12px",
  },
  "& .spatial-map-tree-metadata th": {
    w: "34%",
    p: "4px 8px 4px 0",
    color: "var(--spatial-map-copy-dim)",
    fontWeight: "700",
    textAlign: "left",
    verticalAlign: "top",
  },
  "& .spatial-map-tree-metadata td": {
    p: "4px 0",
    color: "var(--spatial-map-copy-muted)",
    verticalAlign: "top",
  },
  "& .spatial-map-tree-context :where(p, ul, ol, blockquote, pre, table)": {
    mb: "14px",
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
  onProjectUpdated?: (project: ProjectRecord) => void;
}) {
  const spatialMap = useSpatialMap();
  const tree = createMemo(() => buildSpatialMapTree(spatialMap.visibleData()));
  let viewportRef: HTMLDivElement | undefined;
  const [statusPending, setStatusPending] = createSignal(false);
  const [typePending, setTypePending] = createSignal(false);
  const [optimisticStatus, setOptimisticStatus] = createSignal<{
    nodeId: string;
    previousStatus: MapNodeStatus;
    status: MapNodeStatus;
  } | null>(null);
  const [optimisticType, setOptimisticType] = createSignal<{
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

  const submitType = async (nodeId: string, type: string) => {
    const node = spatialMap.sourceNodesById().get(nodeId);
    if (!node || typePending() || node.type === type) return;

    setTypePending(true);
    setOptimisticType({
      nodeId,
      previousType: node.type,
      type,
    });
    props.onProjectUpdated?.(
      updateProjectNode(props.project, nodeId, (projectNode) => ({
        ...projectNode,
        type,
      })),
    );

    try {
      const result = await patchProjectNode(props.project.id, nodeId, { type });
      props.onProjectUpdated?.(result);
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
      p={{ base: "0 8px 8px", md: "0 8px 8px" }}
      border="1px solid rgba(96, 101, 95, 0.46)"
      borderRadius={{ base: "6px", md: "8px" }}
      background={`
        linear-gradient(90deg, rgba(35, 42, 37, 0.035) 1px, transparent 1px),
        linear-gradient(rgba(35, 42, 37, 0.035) 1px, transparent 1px),
        linear-gradient(180deg, rgba(248, 250, 248, 0.88), rgba(235, 239, 233, 0.96))
      `}
      backgroundSize="40px 40px, 40px 40px, auto"
      boxShadow="inset 0 1px 0 rgba(255, 255, 255, 0.64), 0 12px 30px rgba(29, 33, 28, 0.06)"
      style={{ "--spatial-map-tree-sticky-offset": "58px" }}
    >
      <Show
        when={tree().roots.length > 0}
        fallback={
          <Box
            m="0"
            p="12px"
            border="1px solid rgba(34, 41, 36, 0.16)"
            background="rgba(244, 246, 242, 0.82)"
            color="var(--spatial-map-copy-muted)"
            fontSize="11px"
            lineHeight="1.35"
            letterSpacing="0.04em"
            textTransform="none"
          >
            No hierarchy nodes are visible at this level.
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
          w="min(100%, 86ch)"
          maxW="100%"
          minW="0"
          m="0 auto"
          p="18px 20px 24px"
          border="1px solid rgba(44, 52, 46, 0.28)"
          borderRadius="6px"
          background="rgba(252, 253, 252, 0.92)"
          color="var(--spatial-map-copy)"
          boxShadow="inset 3px 0 0 rgba(45, 111, 72, 0.28), 0 12px 30px rgba(29, 33, 28, 0.06)"
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
                      onStatusChange={submitStatus}
                      onTypeChange={submitType}
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
  onStatusChange: (nodeId: string, status: MapNodeStatus) => void;
  onTypeChange: (nodeId: string, type: string) => void;
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
          aria-expanded={children().length > 0 ? true : undefined}
          aria-selected={isSelected()}
          data-spatial-map-tree-node-id={props.item.node.id}
          data-spatial-map-tree-path={props.path}
          class={`spatial-map-tree-row spatial-map-tree-row--${nodeWithOptimisticType().type}${railLevels().length === 0 ? " spatial-map-tree-row--root" : ""}${isSelected() ? " is-selected" : ""}`}
          display="grid"
          gridTemplateColumns={railLevels().length === 0 ? "minmax(0, 1fr)" : "max-content minmax(0, 1fr)"}
          alignItems="stretch"
          gap="16px"
          boxSizing="border-box"
          w="100%"
          maxW="100%"
          minW="0"
          minH="0"
          p="0 0 22px"
          border="0"
          borderRadius="0"
          background={isSelected() ? "rgba(229, 239, 229, 0.38)" : "transparent"}
          color="var(--spatial-map-copy)"
          fontFamily="inherit"
          textAlign="left"
          scrollMarginTop="calc(var(--spatial-map-tree-sticky-offset) + 18px)"
          appearance="none"
          cursor="pointer"
          transition="background-color 180ms ease, box-shadow 180ms ease, outline-color 180ms ease"
          _hover={{ background: "rgba(229, 239, 229, 0.22)", boxShadow: "none" }}
          _focusVisible={{
            outline: "2px solid rgba(23, 62, 39, 0.58)",
            outlineOffset: "6px",
            boxShadow: "none",
          }}
          style={{
            "--spatial-map-tree-depth": String(props.depth),
            ...getTreeToneStyle(nodeWithOptimisticType().type),
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
          <Box
            as="article"
            minW="0"
            display="grid"
            gap="12px"
            boxSizing="border-box"
            p={railLevels().length === 0 ? "14px 28px 2px 0" : "0 12px 2px 0"}
            borderTop={railLevels().length === 0 ? "1px solid rgba(34, 41, 36, 0.16)" : undefined}
          >
            <NodeHeading node={props.item.node} depth={props.depth} />
            <Show when={(props.item.node.images ?? []).length > 0}>
              <Box maxW="100%">
                <SpatialMapImageStrip node={props.item.node} variant="tree" />
              </Box>
            </Show>
            <Box
              display="flex"
              flexWrap="wrap"
              gap="6px"
              color="#303b34"
              fontSize="10px"
              fontWeight="600"
              letterSpacing="0.08em"
              textTransform="none"
            >
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
              <Box
                as="span"
                display="inline-flex"
                alignItems="center"
                minH="21px"
                p="0 8px"
                border="1px solid rgba(44, 52, 46, 0.34)"
                borderRadius="4px"
                background="rgba(246, 248, 244, 0.94)"
                color="#303b34"
                boxShadow="inset 0 1px 0 rgba(255, 255, 255, 0.28)"
              >
                {children().length}{" "}
                {children().length === 1 ? "child" : "children"}
              </Box>
            </Box>
            <Show when={context().length > 0}>
              <TreeContext content={context()} nodeLabel={props.item.node.label} />
            </Show>
            <Show when={metadataEntries().length > 0}>
              <Box maxW="100%" overflowX="auto">
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

      <Show when={children().length > 0}>
        <VStack
          alignItems="stretch"
          gap="1"
          class="spatial-map-tree-children"
          position="relative"
          w="100%"
          maxW="100%"
          minW="0"
          mt="0"
          pt="6px"
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
                  onStatusChange={props.onStatusChange}
                  onTypeChange={props.onTypeChange}
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
        color="#202622"
        fontSize="1.02rem"
        lineHeight="1.7"
        maxH="200px"
        overflow="hidden"
      >
        <MarkdownRenderer>{props.content}</MarkdownRenderer>
      </Box>
      <Show when={canExpand()}>
        <TreeContextButton
          type="button"
          mt="8px"
          p="0"
          border="0"
          background="transparent"
          color="#3e6950"
          cursor="pointer"
          fontFamily="inherit"
          fontSize="0.88rem"
          fontWeight="700"
          lineHeight="1.2"
          _hover={{ color: "#244b35", textDecoration: "underline" }}
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
        title={`${props.nodeLabel} Context`}
        description="Large markdown view for longer context notes and working material."
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
  const size = () =>
    level() === 1
      ? "clamp(1.9rem, 4vw, 2.65rem)"
      : level() === 2
        ? "1.7rem"
        : level() === 3
          ? "1.36rem"
          : "1.1rem";
  const lineHeight = () =>
    level() === 1 ? "1.05" : level() === 2 ? "1.1" : level() === 3 ? "1.16" : "1.18";
  const fontWeight = () =>
    level() === 1 ? "800" : level() === 2 ? "760" : level() === 3 ? "720" : "700";

  return (
    <Box
      as={headingTag()}
      class={`spatial-map-tree-heading spatial-map-tree-heading--${level()}`}
      m="0"
      color="#111714"
      fontSize={size()}
      lineHeight={lineHeight()}
      fontWeight={fontWeight()}
      letterSpacing="0"
      textWrap="pretty"
    >
      {props.node.label}
    </Box>
  );
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
