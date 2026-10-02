import { useAction } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from "solid-js";
import { ChevronLeftIcon, EllipsisVerticalIcon, HistoryIcon, PlusIcon } from "lucide-solid";
import { css } from "styled-system/css";
import { Box, HStack, VStack, styled } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { EditInPlace } from "~/components/ui/edit-in-place";
import * as Field from "~/components/ui/field";
import { IconButton } from "~/components/ui/icon-button";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import {
  appendClientMutationId,
  createClientMutationId,
  updateProjectNode,
} from "~/lib/projects/optimistic";
import {
  updateProjectNodeContext,
  updateProjectNodeMetadata,
  updateProjectNodeStatus,
  updateProjectNodeTitle,
  updateProjectNodeType,
} from "~/lib/projects/data";
import type { ProjectRecord } from "~/lib/projects/types";
import { Text } from "~/components/ui/text";
import { getMapNodeStatusLabel } from "~/lib/spatial-map/node-status";
import { type MapNode, type MapNodeStatus } from "~/lib/spatial-map/types";
import { SpatialMapImageDropTarget, SpatialMapImageStrip } from "./SpatialMapImages";
import { SpatialMapArchiveImplementedButton } from "./SpatialMapArchiveImplementedButton";
import { SpatialMapArchiveNodeControl } from "./SpatialMapArchiveNodeControl";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapCopyAgentPromptButton } from "./SpatialMapCopyAgentPromptButton";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";
import { SpatialMapActivityList } from "./SpatialMapInspectorActivity";
import { SpatialMapInspectorContextSection } from "./SpatialMapInspectorContext";
import { SpatialMapInspectorEmpty } from "./SpatialMapInspectorEmpty";
import { SpatialMapInspectorHeader } from "./SpatialMapInspectorHeader";
import { SpatialMapNodePriorityMenu } from "./SpatialMapNodePriorityMenu";
import { SpatialMapNodeStatusMenu } from "./SpatialMapNodeStatusMenu";
import { SpatialMapNodeTypePicker } from "./SpatialMapNodeTypePicker";
import {
  SpatialMapCollapsibleGroup,
  SpatialMapEmptyState,
  SpatialMapInspectorSection,
  SpatialMapSectionHeader,
} from "./SpatialMapPanelPrimitives";

const InspectorPlainButton = styled("button");
const InspectorResizeHandle = styled("button");

const INSPECTOR_WIDTH_STORAGE_KEY = "spatial-map:inspector-width";
const DEFAULT_INSPECTOR_WIDTH = 348;
const MIN_INSPECTOR_WIDTH = 280;
const MAX_INSPECTOR_WIDTH = 600;
const RESIZE_GUTTER_WIDTH = 12;

// EditInPlace renders a plain div, so its text treatment is passed as a class.
const metadataValueClass = css({
  color: "var(--spatial-map-copy)",
  fontSize: "12px",
  lineHeight: "1.45",
});

interface SpatialMapInspectorProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}

type SpatialMapInspectorView = "details" | "activity";
type InspectorGroup = "metadata" | "connections" | "activity";
type OptimisticNodeValue = {
  nodeId: string;
  value: string;
};

export function SpatialMapInspector(props: SpatialMapInspectorProps) {
  const spatialMap = useSpatialMap();
  const submitSaveContext = useAction(updateProjectNodeContext);
  const submitSaveMetadata = useAction(updateProjectNodeMetadata);
  const submitSaveTitle = useAction(updateProjectNodeTitle);
  const submitSaveStatus = useAction(updateProjectNodeStatus);
  const submitSaveType = useAction(updateProjectNodeType);
  const selectedNode = createMemo(() => spatialMap.selectedNode());
  const [groupOverrides, setGroupOverrides] = createSignal<Partial<Record<InspectorGroup, boolean>>>({});
  const [contextDialogOpen, setContextDialogOpen] = createSignal(false);
  const [inspectorView, setInspectorView] = createSignal<SpatialMapInspectorView>("details");
  const [optimisticTitle, setOptimisticTitle] = createSignal<OptimisticNodeValue | null>(null);
  const [optimisticMetadata, setOptimisticMetadata] = createSignal<Record<string, string>>({});
  const [titlePending, setTitlePending] = createSignal(false);
  const [statusPending, setStatusPending] = createSignal(false);
  const [typePending, setTypePending] = createSignal(false);
  const [contextPending, setContextPending] = createSignal(false);
  const [metadataPending, setMetadataPending] = createSignal(false);
  const [inspectorWidth, setInspectorWidth] = createSignal(DEFAULT_INSPECTOR_WIDTH);
  const [resizingInspector, setResizingInspector] = createSignal(false);
  let resizeStartX = 0;
  let resizeStartWidth = DEFAULT_INSPECTOR_WIDTH;

  const inspectorWidthCss = createMemo(() =>
    spatialMap.inspectorOpen() ? `min(90vw, ${inspectorWidth()}px, max(50vw, ${MAX_INSPECTOR_WIDTH}px))` : "0px",
  );

  const getMaxInspectorWidth = () =>
    typeof window === "undefined"
      ? MAX_INSPECTOR_WIDTH
      : Math.max(window.innerWidth * 0.5, MAX_INSPECTOR_WIDTH);

  const clampInspectorWidth = (width: number) =>
    Math.min(getMaxInspectorWidth(), Math.max(MIN_INSPECTOR_WIDTH, Math.round(width)));

  const setPersistedInspectorWidth = (width: number) => {
    const nextWidth = clampInspectorWidth(width);
    setInspectorWidth(nextWidth);
    window.localStorage.setItem(INSPECTOR_WIDTH_STORAGE_KEY, String(nextWidth));
  };

  const handleInspectorResizeMove = (event: PointerEvent) => {
    setPersistedInspectorWidth(resizeStartWidth + resizeStartX - event.clientX);
  };

  const handleInspectorMouseResizeMove = (event: MouseEvent) => {
    setPersistedInspectorWidth(resizeStartWidth + resizeStartX - event.clientX);
  };

  const stopInspectorResize = () => {
    setResizingInspector(false);
    if (typeof window === "undefined") return;
    window.removeEventListener("pointermove", handleInspectorResizeMove);
    window.removeEventListener("pointerup", stopInspectorResize);
    window.removeEventListener("pointercancel", stopInspectorResize);
    window.removeEventListener("mousemove", handleInspectorMouseResizeMove);
    window.removeEventListener("mouseup", stopInspectorResize);
  };

  const startInspectorResize = (event: PointerEvent) => {
    if (!spatialMap.inspectorOpen()) return;
    event.preventDefault();
    resizeStartX = event.clientX;
    resizeStartWidth = inspectorWidth();
    setResizingInspector(true);
    window.addEventListener("pointermove", handleInspectorResizeMove);
    window.addEventListener("pointerup", stopInspectorResize);
    window.addEventListener("pointercancel", stopInspectorResize);
  };

  const startInspectorMouseResize = (event: MouseEvent) => {
    if (!spatialMap.inspectorOpen()) return;
    event.preventDefault();
    resizeStartX = event.clientX;
    resizeStartWidth = inspectorWidth();
    setResizingInspector(true);
    window.addEventListener("mousemove", handleInspectorMouseResizeMove);
    window.addEventListener("mouseup", stopInspectorResize);
  };

  onMount(() => {
    const storedWidth = window.localStorage.getItem(INSPECTOR_WIDTH_STORAGE_KEY);
    if (storedWidth !== null) {
      const parsedWidth = Number(storedWidth);
      if (Number.isFinite(parsedWidth)) {
        setInspectorWidth(clampInspectorWidth(parsedWidth));
      }
    }
  });

  onCleanup(stopInspectorResize);

  const selectedNodeActivity = createMemo(() => {
    const nodeId = selectedNode()?.id;
    if (!nodeId) return [];
    return props.project.operationLog.filter((entry) => entry.nodeIds.includes(nodeId)).slice(0, 8);
  });
  const recentProjectActivity = createMemo(() => props.project.operationLog.slice(0, 8));
  const relationCount = createMemo(() => {
    const relations = spatialMap.selectedNodeRelations();
    return relations.outgoing.length + relations.incoming.length;
  });
  // Secondary groups open on their own only when they have something to show.
  const isGroupOpen = (group: InspectorGroup, hasContent: boolean) => groupOverrides()[group] ?? hasContent;
  const toggleGroup = (group: InspectorGroup, hasContent: boolean) => {
    setGroupOverrides((current) => ({ ...current, [group]: !(current[group] ?? hasContent) }));
  };
  const globalProjectActivity = createMemo(() => props.project.operationLog);
  const selectedNodeTitle = createMemo(() => {
    const node = selectedNode();
    const optimistic = optimisticTitle();
    if (node && optimistic?.nodeId === node.id) {
      return optimistic.value;
    }

    return node?.label ?? "Nothing selected";
  });
  const headerTitle = () => (inspectorView() === "activity" ? "Project activity" : selectedNodeTitle());
  const selectActivityNode = (nodeId: string) => {
    spatialMap.setSelectedNodeId(nodeId);
    spatialMap.setInspectorOpen(true);
  };

  createEffect(
    on(
      () => selectedNode()?.id,
      () => {
        setContextDialogOpen(false);
        setGroupOverrides({});
      },
    ),
  );

  createEffect(() => {
    const node = selectedNode();
    const optimistic = optimisticTitle();
    if (node && optimistic?.nodeId === node.id && optimistic.value === node.label) {
      setOptimisticTitle(null);
    }
  });

  createEffect(() => {
    const node = selectedNode();
    const currentOptimisticMetadata = optimisticMetadata();
    if (!node || Object.keys(currentOptimisticMetadata).length === 0) return;

    const nextOptimisticMetadata = { ...currentOptimisticMetadata };
    let didChange = false;
    for (const field of props.project.nodeMetadataSchema) {
      const optimisticKey = `${node.id}:${field.key}`;
      const optimisticValue = nextOptimisticMetadata[optimisticKey];
      if (optimisticValue !== undefined && optimisticValue === (node.metadata[field.key] ?? "")) {
        delete nextOptimisticMetadata[optimisticKey];
        didChange = true;
      }
    }

    if (didChange) {
      setOptimisticMetadata(nextOptimisticMetadata);
    }
  });

  createEffect(() => {
    const request = spatialMap.contextPreviewRequest();
    if (!request) {
      return;
    }

    if (spatialMap.selectedNodeId() !== request.nodeId) {
      spatialMap.setSelectedNodeId(request.nodeId);
      return;
    }

    spatialMap.setInspectorOpen(true);
    setInspectorView("details");
    setContextDialogOpen(true);
    spatialMap.clearContextPreviewRequest();
  });

  const saveContext = async (nodeId: string, nextContext: string) => {
    if (contextPending()) {
      return;
    }

    setContextPending(true);
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    props.onProjectUpdated?.(
      updateProjectNode(props.project, nodeId, (projectNode) => ({
        ...projectNode,
        context: nextContext,
      })),
      { clientMutationId, phase: "optimistic" },
    );
    try {
      // The server action still reads FormData.
      const formData = new FormData();
      formData.set("projectId", props.project.id);
      formData.set("nodeId", nodeId);
      formData.set("context", nextContext);
      const result = await submitSaveContext(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      toaster.error({
        title: "Context was not saved",
        description:
          error instanceof Error ? error.message : "The selected node context could not be saved.",
      });
    } finally {
      setContextPending(false);
    }
  };

  const saveMetadata = async (formData: FormData) => {
    if (metadataPending()) {
      return false;
    }

    setMetadataPending(true);
    const previousProject = props.project;
    const nodeId = formData.get("nodeId");
    const clientMutationId = createClientMutationId();
    if (typeof nodeId === "string") {
      const metadata = Object.fromEntries(
        [...formData.entries()]
          .filter(([key, value]) => key.startsWith("metadata.") && typeof value === "string")
          .map(([key, value]) => [key.slice("metadata.".length), value as string]),
      );
      props.onProjectUpdated?.(
        updateProjectNode(props.project, nodeId, (projectNode) => ({
          ...projectNode,
          metadata,
        })),
        { clientMutationId, phase: "optimistic" },
      );
    }
    try {
      const result = await submitSaveMetadata(appendClientMutationId(formData, clientMutationId));
      const label = result.spatialMap.nodes.find((node) => node.id === spatialMap.selectedNodeId())?.label;
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: "Metadata updated",
        description: `${label ?? "This node"} now uses the current project metadata values.`,
      });
      return true;
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      toaster.error({
        title: "Metadata was not saved",
        description:
          error instanceof Error ? error.message : "The selected node metadata could not be saved.",
      });
      return false;
    } finally {
      setMetadataPending(false);
    }
  };

  const submitMetadataField = async (fieldKey: string, value: string) => {
    const node = selectedNode();
    if (!node || metadataPending()) return;

    const nextValue = value.trim();
    if (nextValue === (node.metadata[fieldKey] ?? "")) return;

    const optimisticKey = `${node.id}:${fieldKey}`;
    setOptimisticMetadata((current) => ({ ...current, [optimisticKey]: nextValue }));

    const formData = new FormData();
    formData.set("projectId", props.project.id);
    formData.set("nodeId", node.id);
    for (const field of props.project.nodeMetadataSchema) {
      formData.set(
        `metadata.${field.key}`,
        field.key === fieldKey ? nextValue : (node.metadata[field.key] ?? ""),
      );
    }

    const saved = await saveMetadata(formData);
    if (!saved) {
      setOptimisticMetadata((current) => {
        const { [optimisticKey]: _acceptedValue, ...rest } = current;
        return rest;
      });
    }
  };

  const submitTitle = async (value: string) => {
    const node = selectedNode();
    if (!node || titlePending()) return;

    const title = value.trim();
    if (!title || title === node.label) return;

    setOptimisticTitle({ nodeId: node.id, value: title });
    setTitlePending(true);
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    props.onProjectUpdated?.(
      updateProjectNode(props.project, node.id, (projectNode) => ({
        ...projectNode,
        label: title,
      })),
      { clientMutationId, phase: "optimistic" },
    );
    try {
      const formData = new FormData();
      formData.set("projectId", props.project.id);
      formData.set("nodeId", node.id);
      formData.set("title", title);
      const result = await submitSaveTitle(appendClientMutationId(formData, clientMutationId));
      const label = result.spatialMap.nodes.find((item) => item.id === node.id)?.label;
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: "Node renamed",
        description: `${label ?? "This node"} is now the selected node title.`,
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      setOptimisticTitle((current) => (current?.nodeId === node.id ? null : current));
      toaster.error({
        title: "Rename failed",
        description:
          error instanceof Error
            ? error.message
            : "The selected node title could not be updated.",
      });
    } finally {
      setTitlePending(false);
    }
  };

  // The child draft only renders on the canvas, so switch there first and wait
  // a frame for the canvas camera before anchoring the draft to the node.
  const openAddChildDraft = (nodeId: string) => {
    if (spatialMap.viewMode() === "canvas") {
      spatialMap.openChildNodeDraft(nodeId, { anchorToParent: true });
      return;
    }

    spatialMap.setViewMode("canvas");
    requestAnimationFrame(() => {
      spatialMap.openChildNodeDraft(nodeId, { anchorToParent: true });
    });
  };

  const submitStatus = async (status: MapNodeStatus) => {
    const node = selectedNode();
    if (!node || statusPending() || status === node.status) return;

    setStatusPending(true);
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    props.onProjectUpdated?.(
      updateProjectNode(props.project, node.id, (projectNode) => ({
        ...projectNode,
        status,
      })),
      { clientMutationId, phase: "optimistic" },
    );
    try {
      const formData = new FormData();
      formData.set("projectId", props.project.id);
      formData.set("nodeId", node.id);
      formData.set("status", status);
      const result = await submitSaveStatus(appendClientMutationId(formData, clientMutationId));
      const updatedNode = result.spatialMap.nodes.find((item) => item.id === node.id);
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: "Status updated",
        description: `${updatedNode?.label ?? "This node"} is now ${getMapNodeStatusLabel(updatedNode?.status ?? status)}.`,
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      toaster.error({
        title: "Status update failed",
        description:
          error instanceof Error
            ? error.message
            : "The selected node status could not be updated.",
      });
    } finally {
      setStatusPending(false);
    }
  };

  const submitType = async (type: string) => {
    const node = selectedNode();
    if (!node || typePending() || type === node.type) return;

    setTypePending(true);
    const previousProject = props.project;
    const clientMutationId = createClientMutationId();
    props.onProjectUpdated?.(
      updateProjectNode(props.project, node.id, (projectNode) => ({
        ...projectNode,
        type,
      })),
      { clientMutationId, phase: "optimistic" },
    );
    try {
      const formData = new FormData();
      formData.set("projectId", props.project.id);
      formData.set("nodeId", node.id);
      formData.set("type", type);
      const result = await submitSaveType(appendClientMutationId(formData, clientMutationId));
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      toaster.success({
        title: "Type updated",
        description: `${node.label} is now a ${type} node.`,
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "failed" });
      toaster.error({
        title: "Type update failed",
        description:
          error instanceof Error
            ? error.message
            : "The selected node type could not be updated.",
      });
    } finally {
      setTypePending(false);
    }
  };

  return (
    <Box
      position="relative"
      display="flex"
      alignItems="stretch"
      h="100%"
      minH="0"
      w={spatialMap.inspectorOpen() ? "auto" : "34px"}
      minW={spatialMap.inspectorOpen() ? undefined : "34px"}
      flexBasis={spatialMap.inspectorOpen() ? "auto" : "34px"}
      transition="width 160ms ease, flex-basis 160ms ease"
    >
      {/* The handle owns its own column between the panes so it never covers content. */}
      <InspectorResizeHandle
        type="button"
        aria-label="Resize inspector"
        title="Drag to resize"
        hideBelow="md"
        display={spatialMap.inspectorOpen() ? "flex" : "none"}
        flexShrink="0"
        alignItems="center"
        justifyContent="center"
        alignSelf="stretch"
        p="0"
        border="0"
        background={resizingInspector() ? "rgba(45, 111, 72, 0.18)" : "transparent"}
        color={resizingInspector() ? "var(--spatial-map-accent-strong)" : "var(--spatial-map-copy-dim)"}
        cursor="col-resize"
        _active={{ transform: "none" }}
        touchAction="none"
        transition="background-color 120ms ease, color 120ms ease"
        _hover={{ background: "rgba(96, 101, 95, 0.18)", color: "var(--spatial-map-copy)" }}
        _focusVisible={{ outline: "none", boxShadow: "inset 0 0 0 1px rgba(37, 95, 58, 0.56)" }}
        style={{ width: `${RESIZE_GUTTER_WIDTH}px` }}
        onPointerDown={startInspectorResize}
        onMouseDown={startInspectorMouseResize}
      >
        <EllipsisVerticalIcon size={14} aria-hidden="true" />
      </InspectorResizeHandle>

      <Box
        as="aside"
        id="spatial-map-inspector"
        class={`spatial-map-inspector${spatialMap.inspectorOpen() ? "" : " is-collapsed"}`}
        position={{ base: "absolute", md: "relative" }}
        right={{ base: "0", md: undefined }}
        top={{ base: "0", md: undefined }}
        bottom={{ base: "0", md: undefined }}
        zIndex={{ base: "2", md: undefined }}
        w="auto"
        flexShrink="0"
        h="100%"
        minH="0"
        overflow={spatialMap.inspectorOpen() ? "auto" : "hidden"}
        overflowX="hidden"
        p={spatialMap.inspectorOpen() ? "10px 12px 16px" : "8px 4px"}
        borderLeft="1px solid var(--spatial-map-panel-border)"
        background="var(--spatial-map-panel-strong)"
        boxShadow={{ base: "-8px 0 24px rgba(17, 22, 19, 0.12)", md: "none" }}
        transition={resizingInspector() ? "padding 160ms ease" : "width 160ms ease, padding 160ms ease"}
        overscrollBehavior="contain"
        style={{
          width: spatialMap.inspectorOpen() ? inspectorWidthCss() : "34px",
          "flex-basis": spatialMap.inspectorOpen() ? inspectorWidthCss() : "34px",
          "min-width": spatialMap.inspectorOpen() ? inspectorWidthCss() : "34px",
        }}
      >
        <Show when={!spatialMap.inspectorOpen()}>
          <Button
            type="button"
            size="xs"
            variant="plain"
            colorPalette="green"
            minW="24px"
            w="24px"
            h="24px"
            p="0"
            aria-label="Show inspector panel"
            aria-expanded="false"
            aria-controls="spatial-map-inspector"
            title="Show inspector panel"
            onClick={() => spatialMap.setInspectorOpen(true)}
          >
            <ChevronLeftIcon size={15} />
          </Button>
        </Show>
        <Show when={spatialMap.inspectorOpen()}>
          <VStack alignItems="stretch" gap="2" minH="full">
            <SpatialMapInspectorHeader
              title={headerTitle()}
              actions={
                <>
                  <Show when={inspectorView() === "details"}>
                    <SpatialMapArchiveImplementedButton
                      project={props.project}
                      compact
                      onProjectUpdated={props.onProjectUpdated}
                    />
                  </Show>
                  <Show when={inspectorView() === "details" && selectedNode()}>
                    {(node) => (
                      <SpatialMapCopyAgentPromptButton project={props.project} nodeId={node().id} />
                    )}
                  </Show>
                  <Tooltip
                    content={inspectorView() === "activity" ? "Back to node details" : "Show project activity"}
                    openDelay={150}
                    closeDelay={80}
                  >
                  <IconButton
                    variant="plain"
                    size="xs"
                    w="24px"
                    minW="24px"
                    h="24px"
                    p="0"
                    color={inspectorView() === "activity" ? "var(--spatial-map-accent-strong)" : "var(--spatial-map-copy-dim)"}
                    background={inspectorView() === "activity" ? "rgba(229, 239, 229, 0.96)" : "transparent"}
                    aria-label="Project activity"
                    aria-pressed={inspectorView() === "activity"}
                    onClick={() => setInspectorView((view) => (view === "activity" ? "details" : "activity"))}
                  >
                    <HistoryIcon size={15} />
                  </IconButton>
                  </Tooltip>
                </>
              }
              titleContent={
                <Show when={inspectorView() === "details" && selectedNode()} fallback={headerTitle()}>
                  <EditInPlace
                    value={selectedNodeTitle()}
                    disabled={titlePending()}
                    aria-label="Selected node title"
                    onConfirm={(value) => {
                      void submitTitle(value);
                    }}
                  />
                </Show>
              }
            />

            <Show when={inspectorView() === "activity"}>
              <SpatialMapInspectorSection>
                <SpatialMapActivityList
                  entries={globalProjectActivity()}
                  emptyLabel="No activity yet"
                  nodeById={spatialMap.sourceNodesById()}
                  selectedNodeId={spatialMap.selectedNodeId()}
                  showNode
                  onSelect={selectActivityNode}
                />
              </SpatialMapInspectorSection>
            </Show>

            <Show when={inspectorView() === "details"}>
              <Show
                when={selectedNode()}
                fallback={
                  <SpatialMapInspectorEmpty
                    project={props.project}
                    recentActivity={recentProjectActivity()}
                    onProjectUpdated={props.onProjectUpdated}
                    onSelectNode={selectActivityNode}
                  />
                }
              >
                {(node) => (
                  <>
                    <VStack alignItems="stretch" gap="6px" minW="0" mt="-4px">
                      <InspectorNodeId value={node().id} />
                      <HStack gap="1" flexWrap="wrap">
                        <SpatialMapNodeStatusMenu
                          node={node()}
                          pending={statusPending()}
                          variant="inspector"
                          onChange={(status) => {
                            void submitStatus(status);
                          }}
                        />
                        <SpatialMapNodePriorityMenu
                          project={props.project}
                          node={node()}
                          variant="inspector"
                          onProjectUpdated={props.onProjectUpdated}
                        />
                        <SpatialMapNodeTypePicker
                          project={props.project}
                          type={node().type}
                          pending={typePending()}
                          variant="inspector"
                          onChange={(type) => {
                            void submitType(type);
                          }}
                        />
                      </HStack>
                      <HStack gap="1">
                        <Button
                          size="2xs"
                          colorPalette="green"
                          variant="surface"
                          title="Add a child node (C)"
                          onClick={() => openAddChildDraft(node().id)}
                        >
                          <PlusIcon size={13} />
                          Add child
                        </Button>
                        <Box flex="1" />
                        <SpatialMapArchiveNodeControl
                          project={props.project}
                          node={node()}
                          onProjectUpdated={props.onProjectUpdated}
                        />
                        <SpatialMapDeleteNodeControl
                          project={props.project}
                          node={node()}
                          onProjectUpdated={props.onProjectUpdated}
                          compact
                          size="2xs"
                        />
                      </HStack>
                    </VStack>

                    <SpatialMapInspectorContextSection
                      node={node()}
                      pending={contextPending()}
                      dialogOpen={contextDialogOpen()}
                      onDialogOpenChange={setContextDialogOpen}
                      onSave={(nodeId, context) => {
                        void saveContext(nodeId, context);
                      }}
                    />

                    <SpatialMapImageDropTarget nodeId={node().id} class="spatial-map-image-drop-panel">
                      <SpatialMapSectionHeader title="Images" count={(node().images ?? []).length}>
                        <SpatialMapEmptyState as="span">Drop or paste to add</SpatialMapEmptyState>
                      </SpatialMapSectionHeader>
                      <Show when={(node().images ?? []).length > 0}>
                        <SpatialMapImageStrip node={node()} variant="inspector" />
                      </Show>
                    </SpatialMapImageDropTarget>

                    <SpatialMapInspectorSection gap="0px">
                      <InspectorMetadataGroup
                        project={props.project}
                        node={node()}
                        pending={metadataPending()}
                        optimisticValues={optimisticMetadata()}
                        open={(hasContent) => isGroupOpen("metadata", hasContent)}
                        onToggle={(hasContent) => toggleGroup("metadata", hasContent)}
                        onConfirm={(fieldKey, value) => {
                          void submitMetadataField(fieldKey, value);
                        }}
                      />
                      <SpatialMapCollapsibleGroup
                        title="Connections"
                        summary={relationCount()}
                        open={isGroupOpen("connections", relationCount() > 0)}
                        onToggle={() => toggleGroup("connections", relationCount() > 0)}
                      >
                        <InspectorRelationList
                          outgoing={spatialMap.selectedNodeRelations().outgoing}
                          incoming={spatialMap.selectedNodeRelations().incoming}
                          nodeById={spatialMap.sourceNodesById()}
                          onSelect={(nodeId) => spatialMap.setSelectedNodeId(nodeId)}
                        />
                      </SpatialMapCollapsibleGroup>
                      <SpatialMapCollapsibleGroup
                        title="Activity"
                        summary={selectedNodeActivity().length}
                        open={isGroupOpen("activity", false)}
                        onToggle={() => toggleGroup("activity", false)}
                      >
                        <SpatialMapActivityList
                          entries={selectedNodeActivity()}
                          emptyLabel="No activity for this node yet"
                          nodeById={spatialMap.sourceNodesById()}
                          selectedNodeId={spatialMap.selectedNodeId()}
                          onSelect={selectActivityNode}
                        />
                      </SpatialMapCollapsibleGroup>
                    </SpatialMapInspectorSection>
                  </>
                )}
              </Show>
            </Show>
          </VStack>
        </Show>
      </Box>
    </Box>
  );
}

function InspectorMetadataGroup(props: {
  project: ProjectRecord;
  node: MapNode;
  pending: boolean;
  optimisticValues: Record<string, string>;
  open: (hasContent: boolean) => boolean;
  onToggle: (hasContent: boolean) => void;
  onConfirm: (fieldKey: string, value: string) => void;
}) {
  const fields = () => props.project.nodeMetadataSchema;
  const valueFor = (fieldKey: string) =>
    props.optimisticValues[`${props.node.id}:${fieldKey}`] ?? props.node.metadata[fieldKey] ?? "";
  const filledCount = createMemo(() => fields().filter((field) => valueFor(field.key).trim().length > 0).length);

  return (
    <SpatialMapCollapsibleGroup
      title="Metadata"
      summary={`${filledCount()}/${fields().length}`}
      open={props.open(filledCount() > 0)}
      onToggle={() => props.onToggle(filledCount() > 0)}
    >
      <For each={fields()}>
        {(field) => (
          <Field.Root gap="0.5" minW="0">
            <Field.Label color="var(--spatial-map-copy-dim)" fontSize="11px" fontWeight="500" lineHeight="1.2">
              {field.label}
            </Field.Label>
            <EditInPlace
              value={valueFor(field.key)}
              aria-label={`${field.label} metadata`}
              placeholder={field.defaultValue || "Add metadata"}
              class={metadataValueClass}
              disabled={props.pending}
              shouldAllowMultiline
              onConfirm={(value) => props.onConfirm(field.key, value)}
            />
          </Field.Root>
        )}
      </For>
      <Show when={fields().length === 0}>
        <SpatialMapEmptyState>This project does not define any metadata keys yet.</SpatialMapEmptyState>
      </Show>
    </SpatialMapCollapsibleGroup>
  );
}

function InspectorNodeId(props: { value: string }) {
  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(props.value);
      toaster.success({ title: "Node ID copied" });
    } catch (error) {
      toaster.error({
        title: "Node ID was not copied",
        description: error instanceof Error ? error.message : "Clipboard access was denied.",
      });
    }
  };

  return (
    <InspectorPlainButton
      type="button"
      display="block"
      maxW="100%"
      w="fit-content"
      p="0"
      border="0"
      background="transparent"
      overflow="hidden"
      color="var(--spatial-map-copy-dim)"
      fontFamily="mono"
      fontSize="11px"
      lineHeight="1.3"
      textAlign="left"
      textOverflow="ellipsis"
      whiteSpace="nowrap"
      cursor="copy"
      _hover={{ color: "var(--spatial-map-copy)" }}
      _focusVisible={{ outline: "none", color: "var(--spatial-map-copy)", textDecoration: "underline" }}
      title={`Copy node ID: ${props.value}`}
      onClick={() => void copyId()}
    >
      {props.value}
    </InspectorPlainButton>
  );
}

type InspectorRelation = { kind: string; nodeId: string };

function InspectorRelationList(props: {
  outgoing: InspectorRelation[];
  incoming: InspectorRelation[];
  nodeById: Map<string, MapNode>;
  onSelect: (nodeId: string) => void;
}) {
  const rows = createMemo(() => [
    ...props.outgoing.map((item) => ({ ...item, direction: "outgoing" as const })),
    ...props.incoming.map((item) => ({ ...item, direction: "incoming" as const })),
  ]);

  return (
    <Box minW="0">
      <For each={rows()}>
        {(item) => (
          <Show when={props.nodeById.get(item.nodeId)}>
            {(node) => (
              <InspectorPlainButton
                type="button"
                display="grid"
                _active={{ transform: "scale(0.99)", background: "rgba(34, 41, 36, 0.1)" }}
                gridTemplateColumns="14px minmax(0, 1fr) auto"
                alignItems="baseline"
                columnGap="6px"
                w="100%"
                p="3px 4px"
                border="0"
                borderRadius="4px"
                background="transparent"
                color="inherit"
                font="inherit"
                textAlign="left"
                cursor="pointer"
                _hover={{ background: "rgba(34, 41, 36, 0.06)" }}
                _focusVisible={{ outline: "none", boxShadow: "inset 0 0 0 1px rgba(37, 95, 58, 0.56)" }}
                title={`${item.direction === "outgoing" ? "Links to" : "Linked from"} ${node().label}`}
                onClick={() => props.onSelect(node().id)}
              >
                <Text as="span" color="var(--spatial-map-copy-dim)" fontSize="12px" aria-hidden="true">
                  {item.direction === "outgoing" ? "→" : "←"}
                </Text>
                <Text
                  as="span"
                  color="var(--spatial-map-copy)"
                  fontSize="12px"
                  lineHeight="1.35"
                  overflow="hidden"
                  textOverflow="ellipsis"
                  whiteSpace="nowrap"
                >
                  {node().label}
                </Text>
                <Text as="span" color="var(--spatial-map-copy-dim)" fontSize="11px" whiteSpace="nowrap">
                  {item.kind} · {node().type}
                </Text>
              </InspectorPlainButton>
            )}
          </Show>
        )}
      </For>
      <Show when={rows().length === 0}>
        <SpatialMapEmptyState>No links to or from this node.</SpatialMapEmptyState>
      </Show>
    </Box>
  );
}
