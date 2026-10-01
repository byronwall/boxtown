import { useAction } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import {
  BotIcon,
  ChevronLeftIcon,
  DatabaseBackupIcon,
  FilePlusIcon,
  GitBranchPlusIcon,
  HistoryIcon,
  ImageIcon,
  Link2OffIcon,
  MoveIcon,
  PencilIcon,
  PlusIcon,
  Settings2Icon,
  Trash2Icon,
  UserIcon,
} from "lucide-solid";
import { css } from "styled-system/css";
import { Box, HStack, VStack, styled } from "styled-system/jsx";
import { MarkdownRenderer } from "~/components/markdown-renderer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EditInPlace } from "~/components/ui/edit-in-place";
import * as Field from "~/components/ui/field";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
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
import type { ProjectOperationLogEntry, ProjectRecord } from "~/lib/projects/types";
import { Text } from "~/components/ui/text";
import { getMapNodeStatusLabel } from "~/lib/spatial-map/node-status";
import { type MapNode, type MapNodeStatus } from "~/lib/spatial-map/types";
import { SpatialMapGenerateImageControl } from "./SpatialMapGenerateImageControl";
import { SpatialMapImageDropTarget, SpatialMapImageStrip } from "./SpatialMapImages";
import { SpatialMapArchiveNodeControl } from "./SpatialMapArchiveNodeControl";
import { SpatialMapNodePriorityMenu } from "./SpatialMapNodePriorityMenu";
import { SpatialMapNodeStatusMenu } from "./SpatialMapNodeStatusMenu";
import { SpatialMapNodeTypePicker } from "./SpatialMapNodeTypePicker";
import {
  SpatialMapBlockTitle,
  SpatialMapEmptyState,
  SpatialMapInspectorSection,
  SpatialMapRelationMeta,
  SpatialMapRelationName,
} from "./SpatialMapPanelPrimitives";

const InspectorToggleButton = styled("button");
const InspectorResizeHandle = styled("button");

const INSPECTOR_WIDTH_STORAGE_KEY = "spatial-map:inspector-width";
const DEFAULT_INSPECTOR_WIDTH = 348;
const MIN_INSPECTOR_WIDTH = 280;
const MAX_INSPECTOR_WIDTH = 600;

// MarkdownRenderer owns its descendant tags, so markdown spacing remains a
// component-local selector escape hatch rather than a global stylesheet rule.
const contextMarkdownClass = css({
  p: "9px 10px",
  border: "1px solid rgba(34, 41, 36, 0.1)",
  background: "rgba(246, 248, 244, 0.72)",
  color: "var(--spatial-map-copy-muted)",
  fontSize: "12px",
  lineHeight: "1.55",
  "& :where(p, ul, ol, blockquote, pre, table)": {
    mb: "10px",
  },
  "& :where(p, ul, ol, blockquote, pre, table):last-child": {
    mb: "0",
  },
});

// SimpleDialog only accepts a content class for its surface.
const contextDialogClass = css({
  maxW: "min(800px, 90vw)",
  "& .dialog__body": {
    alignItems: "stretch",
  },
});
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";
import { SpatialMapCopyAgentPromptButton } from "./SpatialMapCopyAgentPromptButton";
import { SpatialMapInspectorHeader } from "./SpatialMapInspectorHeader";

interface SpatialMapInspectorProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}

type SpatialMapInspectorView = "details" | "activity";
type ActivityTone = "create" | "edit" | "image" | "delete" | "system" | "link";
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
  const [contextDraft, setContextDraft] = createSignal("");
  const [editingContext, setEditingContext] = createSignal(false);
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
  const contextFormId = "spatial-map-context-form";
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
  const globalProjectActivity = createMemo(() => props.project.operationLog);
  const selectedNodeTitle = createMemo(() => {
    const node = selectedNode();
    const optimistic = optimisticTitle();
    if (node && optimistic?.nodeId === node.id) {
      return optimistic.value;
    }

    return node?.label ?? "Select an item";
  });
  const selectedNodeForStatus = createMemo(() => {
    return selectedNode();
  });
  const selectedNodeForType = createMemo(() => {
    return selectedNode();
  });
  const selectActivityNode = (nodeId: string) => {
    spatialMap.setSelectedNodeId(nodeId);
    spatialMap.setInspectorOpen(true);
  };

  createEffect(() => {
    setContextDraft(selectedNode()?.context ?? "");
    setEditingContext(false);
    setContextDialogOpen(false);
  });

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
    setContextDialogOpen(true);
    spatialMap.clearContextPreviewRequest();
  });

  const saveContext = async (formData: FormData) => {
    if (contextPending()) {
      return;
    }

    setContextPending(true);
    const previousProject = props.project;
    const nodeId = formData.get("nodeId");
    const nextContext = formData.get("context");
    const clientMutationId = createClientMutationId();
    if (typeof nodeId === "string" && typeof nextContext === "string") {
      props.onProjectUpdated?.(
        updateProjectNode(props.project, nodeId, (projectNode) => ({
          ...projectNode,
          context: nextContext,
        })),
        { clientMutationId, phase: "optimistic" },
      );
    }
    try {
      const result = await submitSaveContext(appendClientMutationId(formData, clientMutationId));
      const label = result.spatialMap.nodes.find((node) => node.id === spatialMap.selectedNodeId())?.label;
      props.onProjectUpdated?.(result, { clientMutationId, phase: "server" });
      setEditingContext(false);
      toaster.success({
        title: "Context updated",
        description: `${label ?? "This node"} now includes the latest markdown context.`,
      });
    } catch (error) {
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
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
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
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
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
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
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
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
      props.onProjectUpdated?.(previousProject, { clientMutationId, phase: "server" });
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
      overflow="visible"
      transition="width 160ms ease, flex-basis 160ms ease"
    >
      <HStack
        class="spatial-map-toggle-group spatial-map-inspector-view-toggle"
        position="absolute"
        top="-28px"
        left="12px"
        right="9px"
        zIndex="5"
        minH="24px"
        display={spatialMap.inspectorOpen() ? "grid" : "none"}
        gridTemplateColumns="repeat(2, minmax(0, 1fr))"
        flexShrink="0"
        overflow="hidden"
        border="1px solid var(--spatial-map-panel-border-strong)"
        borderColor="rgba(96, 101, 95, 0.44)"
        borderRadius="6px"
        background="rgba(246, 248, 244, 0.94)"
        boxShadow="0 1px 0 rgba(34, 41, 36, 0.08)"
        role="tablist"
        aria-label="Inspector view"
      >
        <InspectorToggleButton
          type="button"
          class={`spatial-map-toggle-button${inspectorView() === "details" ? " is-active" : ""}`}
          minW="0"
          h="24px"
          borderWidth="0 1px 0 0"
          borderColor="rgba(24, 29, 26, 0.24)"
          background={inspectorView() === "details" ? "rgba(229, 239, 229, 0.96)" : "transparent"}
          color={inspectorView() === "details" ? "var(--spatial-map-accent-strong)" : undefined}
          boxShadow={
            inspectorView() === "details"
              ? "inset 0 0 0 1px rgba(45, 111, 72, 0.42), inset 0 -2px 0 rgba(45, 111, 72, 0.86)"
              : undefined
          }
          fontSize="10px"
          fontWeight="700"
          letterSpacing="0.04em"
          textTransform="uppercase"
          role="tab"
          aria-selected={inspectorView() === "details"}
          onClick={() => setInspectorView("details")}
        >
          Details
        </InspectorToggleButton>
        <InspectorToggleButton
          type="button"
          class={`spatial-map-toggle-button${inspectorView() === "activity" ? " is-active" : ""}`}
          minW="0"
          h="24px"
          borderWidth="0"
          borderColor="rgba(24, 29, 26, 0.24)"
          background={inspectorView() === "activity" ? "rgba(229, 239, 229, 0.96)" : "transparent"}
          color={inspectorView() === "activity" ? "var(--spatial-map-accent-strong)" : undefined}
          boxShadow={
            inspectorView() === "activity"
              ? "inset 0 0 0 1px rgba(45, 111, 72, 0.42), inset 0 -2px 0 rgba(45, 111, 72, 0.86)"
              : undefined
          }
          fontSize="10px"
          fontWeight="700"
          letterSpacing="0.04em"
          textTransform="uppercase"
          role="tab"
          aria-selected={inspectorView() === "activity"}
          onClick={() => setInspectorView("activity")}
        >
          Activity
        </InspectorToggleButton>
      </HStack>

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
        p={spatialMap.inspectorOpen() ? "12px" : "8px 4px"}
        opacity="1"
        borderLeft="1px solid"
        borderLeftColor="rgba(96, 101, 95, 0.38)"
        background="linear-gradient(180deg, rgba(248, 250, 248, 0.92), rgba(235, 239, 233, 0.96))"
        boxShadow={{
          base: "-12px 0 0 rgba(17, 22, 19, 0.08)",
          md: "inset 1px 0 0 rgba(255, 255, 255, 0.64), -12px 0 30px rgba(29, 33, 28, 0.04)",
        }}
        transition={resizingInspector() ? "padding 160ms ease, opacity 120ms ease" : "width 160ms ease, padding 160ms ease, opacity 120ms ease"}
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
        <InspectorResizeHandle
          type="button"
          aria-label="Resize inspector"
          display={spatialMap.inspectorOpen() ? "flex" : "none"}
          position="absolute"
          left="-7px"
          top="50%"
          transform="translateY(-50%)"
          zIndex="3"
          alignItems="center"
          justifyContent="center"
          w="14px"
          h="56px"
          border="0"
          borderRadius="999px"
          background={resizingInspector() ? "rgba(45, 111, 72, 0.18)" : "rgba(248, 250, 248, 0.72)"}
          boxShadow="inset 0 0 0 1px rgba(96, 101, 95, 0.34), 0 2px 8px rgba(29, 33, 28, 0.08)"
          cursor="col-resize"
          p="0"
          _before={{
            content: '""',
            display: "block",
            w: "2px",
            h: "24px",
            borderRadius: "999px",
            background: resizingInspector() ? "rgba(45, 111, 72, 0.82)" : "rgba(96, 101, 95, 0.62)",
          }}
          _hover={{
            background: "rgba(229, 239, 229, 0.96)",
          }}
          onPointerDown={startInspectorResize}
          onMouseDown={startInspectorMouseResize}
        />
        <Show when={spatialMap.inspectorOpen()}>
        <VStack alignItems="start" gap="2" h="full">
          <SpatialMapInspectorHeader
            title={selectedNodeTitle()}
            actions={
              <Show when={selectedNode()}>
                {(node) => (
                  <SpatialMapCopyAgentPromptButton project={props.project} nodeId={node().id} />
                )}
              </Show>
            }
            titleContent={
              <Show when={Boolean(selectedNode())} fallback={selectedNodeTitle()}>
                <EditInPlace
                  value={selectedNodeTitle()}
                  disabled={titlePending()}
                  aria-label="Selected node title"
                  class="spatial-map-inspector-title-edit"
                  onConfirm={(value) => {
                    void submitTitle(value);
                  }}
                />
              </Show>
            }
          />

          <Show when={inspectorView() === "activity"}>
            <SpatialMapInspectorSection minH="0" overflow="auto">
              <SpatialMapBlockTitle>Global Activity</SpatialMapBlockTitle>
              <ActivityList
                entries={globalProjectActivity()}
                emptyLabel="No activity yet"
                nodeById={spatialMap.sourceNodesById()}
                selectedNodeId={spatialMap.selectedNodeId()}
                onSelect={selectActivityNode}
              />
            </SpatialMapInspectorSection>
          </Show>

          <Show when={inspectorView() === "details"}>
          <SpatialMapInspectorSection>
            <HStack gap="1.5" flexWrap="wrap">
              <Show when={selectedNodeForStatus()}>
                {(node) => (
                  <SpatialMapNodeStatusMenu
                    node={node()}
                    pending={statusPending()}
                    showLabel
                    variant="inspector"
                    onChange={(status) => {
                      void submitStatus(status);
                    }}
                  />
                )}
              </Show>
              <Show when={selectedNode()}>
                {(node) => (
                  <SpatialMapNodePriorityMenu
                    project={props.project}
                    node={node()}
                    showLabel
                    variant="inspector"
                    onProjectUpdated={props.onProjectUpdated}
                  />
                )}
              </Show>
              <InspectorChip label="ID" value={spatialMap.selectedNode()?.id ?? "None"} />
              <Show when={selectedNodeForType()}>
                {(node) => (
                  <SpatialMapNodeTypePicker
                    project={props.project}
                    type={node().type}
                    pending={typePending()}
                    showLabel
                    variant="inspector"
                    onChange={(type) => {
                      void submitType(type);
                    }}
                  />
                )}
              </Show>
            </HStack>
            <Show when={selectedNode()}>
              {(node) => (
                <HStack gap="0" flexWrap="wrap" justifyContent="flex-start" w="fit-content" pt="1px" border="1px solid rgba(96, 101, 95, 0.26)" borderRadius="6px" background="rgba(246, 248, 244, 0.78)">
                  <Button
                    size="xs"
                    colorPalette="green"
                    variant="surface"
                    title="Add a child node (C)"
                    onClick={() => openAddChildDraft(node().id)}
                  >
                    <PlusIcon size={14} />
                    Add Child
                  </Button>
                  <Button
                    size="xs"
                    colorPalette="green"
                    variant="surface"
                    onClick={() => spatialMap.openContextNoteConversionFlow()}
                  >
                    Generate From Context
                  </Button>
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
                  />
                  <SpatialMapGenerateImageControl
                    projectId={props.project.id}
                    node={node()}
                    onProjectUpdated={props.onProjectUpdated}
                    compact
                  />
                </HStack>
              )}
            </Show>
          </SpatialMapInspectorSection>

	          <Show when={selectedNode()}>
	            {(node) => (
	              <SpatialMapImageDropTarget
	                nodeId={node().id}
	                class="spatial-map-image-drop-panel"
	              >
	                <HStack justifyContent="space-between" alignItems="center" gap="3">
	                  <SpatialMapBlockTitle>Images</SpatialMapBlockTitle>
	                </HStack>
	                <Show
	                  when={(node().images ?? []).length > 0}
	                  fallback={
	                    <Box
	                      h="34px"
	                      border="1px solid rgba(96, 101, 95, 0.28)"
	                      borderRadius="6px"
	                      background="linear-gradient(90deg, rgba(31, 36, 33, 0.055) 1px, transparent 1px), linear-gradient(rgba(31, 36, 33, 0.055) 1px, transparent 1px), rgba(248, 250, 248, 0.86)"
	                      backgroundSize="14px 14px"
	                      aria-label="No images"
	                    />
	                  }
	                >
                  <SpatialMapImageStrip node={node()} variant="inspector" />
                </Show>
              </SpatialMapImageDropTarget>
            )}
          </Show>

          <SpatialMapInspectorSection>
            <HStack justifyContent="space-between" alignItems="center" gap="3">
              <Text
                as="h3"
                margin="0"
                fontSize="sm"
                fontWeight="semibold"
                color="var(--spatial-map-copy)"
                letterSpacing="0.02em"
              >
                Metadata
              </Text>
            </HStack>
            <Show
              when={selectedNode()}
              fallback={
                <SpatialMapEmptyState>
                  No selection
                </SpatialMapEmptyState>
              }
            >
              {(node) => (
                <VStack alignItems="stretch" gap="3">
                  <For each={props.project.nodeMetadataSchema}>
                    {(field) => {
                      const metadataValue = createMemo(() => {
                        const item = node();
                        return optimisticMetadata()[`${item.id}:${field.key}`] ?? item.metadata[field.key] ?? "";
                      });

                      return (
                        <Field.Root>
                          <Field.Label>{field.label}</Field.Label>
                          <EditInPlace
                            value={metadataValue()}
                            aria-label={`${field.label} metadata`}
                            placeholder={field.defaultValue || "Add metadata"}
                            class="spatial-map-metadata-edit"
                            disabled={metadataPending()}
                            shouldAllowMultiline
                            onConfirm={(value) => {
                              void submitMetadataField(field.key, value);
                            }}
                          />
                        </Field.Root>
                      );
                    }}
                  </For>
                  <Show when={props.project.nodeMetadataSchema.length === 0}>
                    <SpatialMapEmptyState>
                      This project does not define any metadata keys yet.
                    </SpatialMapEmptyState>
                  </Show>
                </VStack>
              )}
            </Show>
          </SpatialMapInspectorSection>

          <SpatialMapInspectorSection>
            <HStack justifyContent="space-between" alignItems="center" gap="3">
              <Text
                as="h3"
                margin="0"
                fontSize="sm"
                fontWeight="semibold"
                color="var(--spatial-map-copy)"
                letterSpacing="0.02em"
              >
                Context
              </Text>
              <Show when={selectedNode()}>
                {(node) => (
                  <HStack gap="2">
                    <Button
                      size="xs"
                      variant="surface"
                      onClick={() => setContextDialogOpen(true)}
                    >
                      Expand
                    </Button>
                    <Button
                      size="xs"
                      variant={editingContext() ? "outline" : "surface"}
                      onClick={() => setEditingContext((current) => !current)}
                    >
                      {editingContext() ? "Preview" : "Edit"}
                    </Button>
                    <ContextPreviewDialog
                      open={contextDialogOpen()}
                      onOpenChange={setContextDialogOpen}
                      nodeLabel={node().label}
                      context={node().context}
                    />
                  </HStack>
                )}
              </Show>
            </HStack>

            <Show
              when={selectedNode()}
              fallback={
                <SpatialMapEmptyState>
                  No selection
                </SpatialMapEmptyState>
              }
            >
              {(node) => (
                <Show
                  when={editingContext()}
                  fallback={
                        <ContextPreview context={node().context} />
                  }
                >
                  <form
                    id={contextFormId}
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveContext(new FormData(event.currentTarget));
                    }}
                  >
                    <VStack alignItems="stretch" gap="3">
                      <input type="hidden" name="projectId" value={props.project.id} />
                      <input type="hidden" name="nodeId" value={node().id} />
                      <Field.Root>
                        <Field.Label>Markdown Context</Field.Label>
                        <Textarea
                          name="context"
                          variant="spatial"
                          size="sm"
                          autoResize={false}
                          minH="180px"
                          resize="vertical"
                          value={contextDraft()}
                          onInput={(event) => setContextDraft(event.currentTarget.value)}
                          rows={14}
                          placeholder={
                            "# Context\n\nDrop loose notes, copied snippets, requirements, or AI working material here."
                          }
                        />
                        <Field.HelperText>
                          Stored as plain text and rendered as markdown when not editing.
                        </Field.HelperText>
                      </Field.Root>

                      <HStack justifyContent="flex-end" gap="2">
                        <Button
                          size="xs"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            setContextDraft(selectedNode()?.context ?? "");
                            setEditingContext(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          form={contextFormId}
                          size="xs"
                          colorPalette="green"
                          variant="surface"
                          loading={contextPending()}
                        >
                          Save Context
                        </Button>
                      </HStack>
                    </VStack>
                  </form>
                </Show>
              )}
            </Show>
          </SpatialMapInspectorSection>

          <SpatialMapInspectorSection>
            <Text as="h3" margin="0 0 6px" fontSize="sm" fontWeight="semibold" color="var(--spatial-map-copy-dim)" letterSpacing="0.02em">
              Connections
            </Text>
            <InspectorRelationList
              emptyLabel="No outgoing links"
              items={spatialMap.selectedNodeRelations().outgoing}
              nodeById={spatialMap.sourceNodesById()}
              selectedNodeId={spatialMap.selectedNodeId()}
              title="Outgoing"
              onSelect={(nodeId) => spatialMap.setSelectedNodeId(nodeId)}
            />
            <InspectorRelationList
              emptyLabel="No incoming links"
              items={spatialMap.selectedNodeRelations().incoming}
              nodeById={spatialMap.sourceNodesById()}
              selectedNodeId={spatialMap.selectedNodeId()}
              title="Incoming"
              onSelect={(nodeId) => spatialMap.setSelectedNodeId(nodeId)}
            />
          </SpatialMapInspectorSection>

          <SpatialMapInspectorSection>
            <Text as="h3" margin="0 0 6px" fontSize="sm" fontWeight="semibold" color="var(--spatial-map-copy-dim)" letterSpacing="0.02em">
              Activity
            </Text>
            <Show
              when={selectedNode() ? selectedNodeActivity() : recentProjectActivity()}
              keyed
            >
              {(entries) => (
                <ActivityList
                  entries={entries}
                  emptyLabel={selectedNode() ? "No activity for this node yet" : "No activity yet"}
                  nodeById={spatialMap.sourceNodesById()}
                  selectedNodeId={spatialMap.selectedNodeId()}
                  onSelect={selectActivityNode}
                />
              )}
            </Show>
          </SpatialMapInspectorSection>
          </Show>
        </VStack>
        </Show>
      </Box>
    </Box>
  );
}

function ContextPreview(props: { context: string; class?: string }) {
  const hasContent = () => props.context.trim().length > 0;

  return (
    <Show
      when={hasContent()}
      fallback={
        <Box border="1px solid rgba(34, 41, 36, 0.1)" background="rgba(246, 248, 244, 0.72)" p="9px 10px">
          <SpatialMapEmptyState>
            No context yet. Switch to edit mode to drop in markdown notes, pasted material, or AI working context.
          </SpatialMapEmptyState>
        </Box>
      }
    >
      <Box class={props.class ? `${contextMarkdownClass} ${props.class}` : contextMarkdownClass}>
        <MarkdownRenderer>{props.context}</MarkdownRenderer>
      </Box>
    </Show>
  );
}

function ActivityList(props: {
  entries: ProjectOperationLogEntry[];
  emptyLabel: string;
  nodeById: Map<string, MapNode>;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  const getTargetNode = (entry: ProjectOperationLogEntry) => {
    const nodeId = entry.nodeIds.find((item) => props.nodeById.has(item));
    return nodeId ? props.nodeById.get(nodeId) ?? null : null;
  };

  return (
    <VStack alignItems="stretch" gap="7px" position="relative" w="100%" minW="0" overflowX="hidden">
      <For each={props.entries}>
        {(entry) => {
          const targetNode = getTargetNode(entry);
          const isSelected = () => Boolean(targetNode && props.selectedNodeId === targetNode.id);
          const config = getActivityKindConfig(entry.kind);

          return (
            <Show
              when={targetNode}
              fallback={
                <Box w="100%" minW="0" maxW="100%" p="0" border="1px solid transparent" background="transparent" color="inherit" style={getActivityToneStyle(config.tone)}>
                  <ActivityEntryContent entry={entry} config={config} />
                </Box>
              }
            >
              {(node) => (
                <InspectorToggleButton
                  type="button"
                  w="100%"
                  maxW="100%"
                  minW="0"
                  p="0"
                  border="1px solid transparent"
                  background="transparent"
                  color="inherit"
                  cursor="pointer"
                  textAlign="left"
                  style={getActivityToneStyle(config.tone)}
                  _hover={{ "& .activity-body": { borderColor: "var(--activity-accent-border)", background: "rgba(250, 251, 248, 0.94)" } }}
                  _focusVisible={{ outline: "none", "& .activity-body": { borderColor: "rgba(37, 95, 58, 0.56)", boxShadow: "inset 0 0 0 1px rgba(37, 95, 58, 0.24), inset 0 1px 0 rgba(255, 255, 255, 0.56)" } }}
                  onClick={() => props.onSelect(node().id)}
                  aria-pressed={isSelected()}
                >
                  <ActivityEntryContent entry={entry} node={node()} config={config} />
                </InspectorToggleButton>
              )}
            </Show>
          );
        }}
      </For>
      <Show when={props.entries.length === 0}>
        <SpatialMapEmptyState>
          {props.emptyLabel}
        </SpatialMapEmptyState>
      </Show>
    </VStack>
  );
}

function ActivityEntryContent(props: {
  entry: ProjectOperationLogEntry;
  node?: MapNode;
  config: ActivityKindConfig;
}) {
  const Icon = props.config.icon;
  const ActorIcon = props.entry.actor.kind === "agent" ? BotIcon : UserIcon;

  return (
    <Box w="100%" minW="0" maxW="100%">
      <Box class="activity-body" minW="0" maxW="100%" overflow="hidden" flex="1" p="7px 8px" border="1px solid rgba(34, 41, 36, 0.13)" background="rgba(245, 246, 242, 0.82)" boxShadow="inset 0 1px 0 rgba(255, 255, 255, 0.56)">
        <HStack justifyContent="space-between" alignItems="start" gap="2" minW="0" maxW="100%">
          <Text
            as="div"
            margin="0"
            fontSize="sm"
            fontWeight="semibold"
            minW="0"
            maxW="100%"
            color="var(--spatial-map-copy)"
            lineHeight="1.28"
            overflowWrap="anywhere"
            overflow="hidden"
            display="-webkit-box"
            style={{ "-webkit-box-orient": "vertical", "-webkit-line-clamp": "3" }}
            title={props.entry.summary}
          >
            {props.entry.summary}
          </Text>
        </HStack>
        <HStack gap="1.5" flexWrap="wrap" mt="1.5" minW="0" maxW="100%">
          <Badge
            as="span"
            variant="spatial"
            size="2xs"
            borderColor="var(--activity-accent-border)"
            bg="var(--activity-accent-soft)"
            color="var(--activity-accent)"
            fontFamily="mono"
            fontWeight="bold"
            maxW="100%"
            minW="0"
          >
            <Icon size={11} strokeWidth={2.3} />
            <Box as="span" display="block" flex="1 1 auto" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{props.config.label}</Box>
          </Badge>
          <Show when={props.node}>
            {(node) => (
              <Badge
                as="span"
                variant="spatial"
                size="2xs"
                fontFamily="mono"
                maxW="100%"
                minW="0"
                overflow="hidden"
                textOverflow="ellipsis"
                title={node().label}
              >
                <Box as="span" display="block" flex="1 1 auto" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{node().label}</Box>
              </Badge>
            )}
          </Show>
          <Badge
            as="span"
            variant="spatial"
            size="2xs"
            fontFamily="mono"
            maxW="100%"
            minW="0"
          >
            <ActorIcon size={11} strokeWidth={2.25} />
            <Box as="span" display="block" flex="1 1 auto" minW="0" overflow="hidden" textOverflow="ellipsis" whiteSpace="nowrap">{formatActivityActor(props.entry)}</Box>
          </Badge>
          <Badge
            as="time"
            variant="spatial"
            size="2xs"
            title={formatActivityDate(props.entry.createdAt)}
            bg="transparent"
            borderColor="rgba(75, 84, 72, 0.12)"
            color="fg.muted"
            fontFamily="mono"
          >
            {formatRelativeActivityDate(props.entry.createdAt)}
          </Badge>
        </HStack>
      </Box>
    </Box>
  );
}

type ActivityKindConfig = {
  label: string;
  tone: ActivityTone;
  icon: typeof HistoryIcon;
};

function getActivityKindConfig(kind: ProjectOperationLogEntry["kind"]): ActivityKindConfig {
  switch (kind) {
    case "node.image.deleted":
    case "node.deleted":
      return { label: "Deleted", tone: "delete", icon: Trash2Icon };
    case "node.images.added":
      return { label: "Image", tone: "image", icon: ImageIcon };
    case "node.metadata.updated":
    case "node.context.updated":
    case "node.title.updated":
    case "node.status.updated":
    case "node.archive.updated":
    case "node.priority.updated":
    case "node.type.updated":
      return { label: "Updated", tone: "edit", icon: PencilIcon };
    case "node.created":
      return { label: "Created", tone: "create", icon: PlusIcon };
    case "nodes.generated":
      return { label: "Generated", tone: "create", icon: GitBranchPlusIcon };
    case "context.nodes.imported":
      return { label: "Imported", tone: "create", icon: FilePlusIcon };
    case "project.schema.updated":
      return { label: "Schema", tone: "system", icon: Settings2Icon };
    case "project.backfilled":
      return { label: "Backfill", tone: "system", icon: DatabaseBackupIcon };
    case "link.deleted":
      return { label: "Link", tone: "link", icon: Link2OffIcon };
    case "node.moved":
      return { label: "Moved", tone: "link", icon: MoveIcon };
    case "project.created":
    default:
      return { label: "Project", tone: "system", icon: HistoryIcon };
  }
}

function getActivityToneStyle(tone: ActivityTone) {
  const tones: Record<ActivityTone, Record<string, string>> = {
    create: {
      "--activity-accent": "rgba(42, 104, 67, 0.94)",
      "--activity-accent-soft": "rgba(42, 104, 67, 0.11)",
      "--activity-accent-border": "rgba(42, 104, 67, 0.28)",
    },
    edit: {
      "--activity-accent": "rgba(82, 93, 61, 0.94)",
      "--activity-accent-soft": "rgba(133, 150, 91, 0.16)",
      "--activity-accent-border": "rgba(82, 93, 61, 0.26)",
    },
    image: {
      "--activity-accent": "rgba(43, 101, 116, 0.94)",
      "--activity-accent-soft": "rgba(43, 101, 116, 0.12)",
      "--activity-accent-border": "rgba(43, 101, 116, 0.26)",
    },
    delete: {
      "--activity-accent": "rgba(143, 68, 62, 0.96)",
      "--activity-accent-soft": "rgba(143, 68, 62, 0.11)",
      "--activity-accent-border": "rgba(143, 68, 62, 0.26)",
    },
    system: {
      "--activity-accent": "rgba(92, 85, 117, 0.94)",
      "--activity-accent-soft": "rgba(92, 85, 117, 0.1)",
      "--activity-accent-border": "rgba(92, 85, 117, 0.24)",
    },
    link: {
      "--activity-accent": "rgba(125, 91, 44, 0.94)",
      "--activity-accent-soft": "rgba(125, 91, 44, 0.12)",
      "--activity-accent-border": "rgba(125, 91, 44, 0.26)",
    },
  };

  return tones[tone];
}

function formatActivityActor(entry: ProjectOperationLogEntry) {
  return entry.actor.label ?? (entry.actor.kind === "agent" ? "Agent" : "Human");
}

function formatActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toISOString().slice(0, 16).replace("T", " ");
}

function formatRelativeActivityDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  const diffMs = Date.now() - date.getTime();
  const absMs = Math.abs(diffMs);
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (absMs < minute) return "just now";
  if (absMs < hour) {
    const minutes = Math.max(1, Math.round(absMs / minute));
    return diffMs >= 0 ? `${minutes}m ago` : `in ${minutes}m`;
  }
  if (absMs < day) {
    const hours = Math.round(absMs / hour);
    return diffMs >= 0 ? `${hours}h ago` : `in ${hours}h`;
  }
  if (absMs < 7 * day) {
    const days = Math.round(absMs / day);
    return diffMs >= 0 ? `${days}d ago` : `in ${days}d`;
  }

  return date.toISOString().slice(0, 10);
}

function ContextPreviewDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nodeLabel: string;
  context: string;
}) {
  return (
    <SimpleDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={`${props.nodeLabel} Context`}
      description="Large markdown view for longer context notes and working material."
      maxW="min(800px, 90vw)"
      contentClass={contextDialogClass}
      footer={
        <HStack justifyContent="flex-end">
          <Button
            size="sm"
            variant="outline"
            onClick={() => props.onOpenChange(false)}
          >
            Close
          </Button>
        </HStack>
      }
    >
      <ContextPreview context={props.context} class="is-dialog" />
    </SimpleDialog>
  );
}

function InspectorChip(props: { label: string; value: string }) {
  return (
    <Badge
      gap="1.5"
      variant="spatial"
      size="sm"
      maxW="100%"
      minW="0"
    >
      <Text as="span" flexShrink="0" color="var(--spatial-map-copy-dim)" fontSize="11px" fontWeight="700" letterSpacing="0.09em" lineHeight="1">
        {props.label}
      </Text>
      <Text as="span" minW="0" maxW="178px" overflow="hidden" color="var(--spatial-map-copy)" fontFamily={`"SFMono-Regular", "SF Mono", "Roboto Mono", "Consolas", monospace`} fontSize="10px" fontWeight="600" textOverflow="ellipsis" whiteSpace="nowrap">
        {props.value}
      </Text>
    </Badge>
  );
}

function InspectorRelationList(props: {
  title: string;
  emptyLabel: string;
  items: { kind: string; nodeId: string }[];
  nodeById: Map<string, MapNode>;
  selectedNodeId: string | null;
  onSelect: (nodeId: string) => void;
}) {
  return (
    <VStack alignItems="start" gap="1" mt="2">
      <Text
        as="h4"
        margin="0"
        fontSize="xs"
        fontWeight="semibold"
        color="var(--spatial-map-copy-dim)"
      >
        {props.title}
      </Text>
      <For each={props.items}>
        {(item) => {
          const node = props.nodeById.get(item.nodeId);
          if (!node) {
            return null;
          }

          return (
            <InspectorToggleButton
              type="button"
              w="100%"
              p="7px 8px"
              border="1px solid"
              borderColor={props.selectedNodeId === node.id ? "rgba(45, 111, 72, 0.74)" : "rgba(44, 52, 46, 0.24)"}
              borderRadius="6px"
              background={props.selectedNodeId === node.id ? "rgba(229, 239, 229, 0.96)" : "rgba(239, 242, 237, 0.84)"}
              color="inherit"
              textAlign="left"
              cursor="pointer"
              boxShadow={props.selectedNodeId === node.id ? "inset 4px 0 0 var(--spatial-map-accent), inset 0 0 0 1px rgba(45, 111, 72, 0.12)" : undefined}
              transition="background-color 180ms ease, border-color 180ms ease, box-shadow 180ms ease"
              _hover={{ borderColor: "rgba(45, 111, 72, 0.58)", boxShadow: "inset 4px 0 0 rgba(45, 111, 72, 0.24)" }}
              _focusVisible={{ outline: "none", borderColor: "rgba(45, 111, 72, 0.74)", boxShadow: "inset 4px 0 0 var(--spatial-map-accent)" }}
              onClick={() => props.onSelect(node.id)}
              aria-pressed={props.selectedNodeId === node.id}
            >
              <SpatialMapRelationName>{node.label}</SpatialMapRelationName>
              <SpatialMapRelationMeta>
                {item.kind} · {node.type}
              </SpatialMapRelationMeta>
            </InspectorToggleButton>
          );
        }}
      </For>
      {props.items.length === 0 ? (
        <SpatialMapEmptyState>
          {props.emptyLabel}
        </SpatialMapEmptyState>
      ) : null}
    </VStack>
  );
}
