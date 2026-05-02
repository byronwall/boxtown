import { useSubmission } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal } from "solid-js";
import {
  BotIcon,
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
import { Box, HStack, VStack } from "styled-system/jsx";
import { MarkdownRenderer } from "~/components/markdown-renderer";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { EditInPlace } from "~/components/ui/edit-in-place";
import * as Field from "~/components/ui/field";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import {
  updateProjectNodeContext,
  updateProjectNodeMetadata,
} from "~/lib/projects/data";
import { patchProjectNode } from "~/lib/projects/client-mutations";
import { updateProjectNode } from "~/lib/projects/optimistic";
import type { ProjectOperationLogEntry, ProjectRecord } from "~/lib/projects/types";
import { normalizeActionUrl } from "~/lib/router/action-url";
import { Text } from "~/components/ui/text";
import { getMapNodeStatusLabel } from "~/lib/spatial-map/node-status";
import { type MapNode, type MapNodeStatus } from "~/lib/spatial-map/types";
import { SpatialMapGenerateImageControl } from "./SpatialMapGenerateImageControl";
import { SpatialMapImageDropTarget, SpatialMapImageStrip } from "./SpatialMapImages";
import { SpatialMapNodeStatusMenu } from "./SpatialMapNodeStatusMenu";
import { SpatialMapNodeTypePicker } from "./SpatialMapNodeTypePicker";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";
import { SpatialMapInspectorHeader } from "./SpatialMapInspectorHeader";

interface SpatialMapInspectorProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

type SpatialMapInspectorView = "details" | "activity";
type ActivityTone = "create" | "edit" | "image" | "delete" | "system" | "link";

export function SpatialMapInspector(props: SpatialMapInspectorProps) {
  const spatialMap = useSpatialMap();
  const saveContextSubmission = useSubmission(updateProjectNodeContext, (input) => {
    const formData = input[0];
    return (
      formData instanceof FormData &&
      formData.get("projectId") === props.project.id &&
      formData.get("nodeId") === spatialMap.selectedNodeId()
    );
  });
  const saveMetadataSubmission = useSubmission(updateProjectNodeMetadata, (input) => {
    const formData = input[0];
    return (
      formData instanceof FormData &&
      formData.get("projectId") === props.project.id &&
      formData.get("nodeId") === spatialMap.selectedNodeId()
    );
  });
  const selectedNode = createMemo(() => spatialMap.selectedNode());
  const [contextDraft, setContextDraft] = createSignal("");
  const [metadataDraft, setMetadataDraft] = createSignal<Record<string, string>>({});
  const [editingContext, setEditingContext] = createSignal(false);
  const [contextDialogOpen, setContextDialogOpen] = createSignal(false);
  const [inspectorView, setInspectorView] = createSignal<SpatialMapInspectorView>("details");
  const [titlePending, setTitlePending] = createSignal(false);
  const [statusPending, setStatusPending] = createSignal(false);
  const [typePending, setTypePending] = createSignal(false);
  const [optimisticTitle, setOptimisticTitle] = createSignal<{
    nodeId: string;
    previousTitle: string;
    title: string;
  } | null>(null);
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
  const contextFormId = "spatial-map-context-form";
  const metadataFormId = "spatial-map-metadata-form";
  const selectedNodeActivity = createMemo(() => {
    const nodeId = selectedNode()?.id;
    if (!nodeId) return [];
    return props.project.operationLog.filter((entry) => entry.nodeIds.includes(nodeId)).slice(0, 8);
  });
  const recentProjectActivity = createMemo(() => props.project.operationLog.slice(0, 8));
  const globalProjectActivity = createMemo(() => props.project.operationLog);
  const selectedNodeTitle = createMemo(() => {
    const node = selectedNode();
    if (!node) return "Select an item";

    const optimistic = optimisticTitle();
    return optimistic?.nodeId === node.id ? optimistic.title : node.label;
  });
  const selectedNodeWithOptimisticStatus = createMemo(() => {
    const node = selectedNode();
    if (!node) return null;

    const optimistic = optimisticStatus();
    return optimistic?.nodeId === node.id
      ? { ...node, status: optimistic.status }
      : node;
  });
  const selectedNodeWithOptimisticType = createMemo(() => {
    const node = selectedNode();
    if (!node) return null;

    const optimistic = optimisticType();
    return optimistic?.nodeId === node.id
      ? { ...node, type: optimistic.type }
      : node;
  });
  const metadataIsDirty = createMemo(() => {
    const node = selectedNode();
    if (!node) {
      return false;
    }

    return props.project.nodeMetadataSchema.some((field) => {
      return (metadataDraft()[field.key] ?? "") !== (node.metadata[field.key] ?? "");
    });
  });

  const selectActivityNode = (nodeId: string) => {
    spatialMap.setSelectedNodeId(nodeId);
    spatialMap.setInspectorOpen(true);
  };

  createEffect(() => {
    setContextDraft(selectedNode()?.context ?? "");
    setMetadataDraft(selectedNode()?.metadata ?? {});
    setEditingContext(false);
    setContextDialogOpen(false);
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

  createEffect(() => {
    const result = saveContextSubmission.result;
    if (!result || saveContextSubmission.pending) {
      return;
    }

    const label = result.spatialMap.nodes.find((node) => node.id === spatialMap.selectedNodeId())?.label;
    props.onProjectUpdated?.(result);
    setEditingContext(false);
    toaster.success({
      title: "Context updated",
      description: `${label ?? "This node"} now includes the latest markdown context.`,
    });
    saveContextSubmission.clear();
  });

  createEffect(() => {
    const result = saveMetadataSubmission.result;
    if (!result || saveMetadataSubmission.pending) {
      return;
    }

    const label = result.spatialMap.nodes.find((node) => node.id === spatialMap.selectedNodeId())?.label;
    props.onProjectUpdated?.(result);
    toaster.success({
      title: "Metadata updated",
      description: `${label ?? "This node"} now uses the current project metadata values.`,
    });
    saveMetadataSubmission.clear();
  });

  const rollBackTitle = (error: unknown) => {
    const optimistic = optimisticTitle();
    if (!optimistic) {
      return;
    }

    props.onProjectUpdated?.(
      updateProjectNode(props.project, optimistic.nodeId, (projectNode) => ({
        ...projectNode,
        label: optimistic.previousTitle,
      })),
    );
    setOptimisticTitle(null);
    toaster.error({
      title: "Rename failed",
      description:
        error instanceof Error
          ? error.message
          : "The selected node title could not be updated.",
    });
  };

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

  const submitTitle = async (value: string) => {
    const node = selectedNode();
    if (!node || titlePending()) return;

    const title = value.trim();
    if (!title || title === node.label) return;

    setTitlePending(true);
    setOptimisticTitle({ nodeId: node.id, previousTitle: node.label, title });
    props.onProjectUpdated?.(
      updateProjectNode(props.project, node.id, (projectNode) => ({
        ...projectNode,
        label: title,
      })),
    );

    try {
      const result = await patchProjectNode(props.project.id, node.id, { title });
      const label = result.spatialMap.nodes.find((item) => item.id === node.id)?.label;
      props.onProjectUpdated?.(result);
      toaster.success({
        title: "Node renamed",
        description: `${label ?? "This node"} is now the selected node title.`,
      });
      setOptimisticTitle(null);
    } catch (error) {
      rollBackTitle(error);
    } finally {
      setTitlePending(false);
    }
  };

  const submitStatus = async (status: MapNodeStatus) => {
    const node = selectedNode();
    if (!node || statusPending() || status === node.status) return;

    setStatusPending(true);
    setOptimisticStatus({
      nodeId: node.id,
      previousStatus: node.status,
      status,
    });
    props.onProjectUpdated?.(
      updateProjectNode(props.project, node.id, (projectNode) => ({
        ...projectNode,
        status,
      })),
    );

    try {
      const result = await patchProjectNode(props.project.id, node.id, { status });
      const updatedNode = result.spatialMap.nodes.find((item) => item.id === node.id);
      props.onProjectUpdated?.(result);
      toaster.success({
        title: "Status updated",
        description: `${updatedNode?.label ?? "This node"} is now ${getMapNodeStatusLabel(updatedNode?.status ?? status)}.`,
      });
      setOptimisticStatus(null);
    } catch (error) {
      rollBackStatus(error);
    } finally {
      setStatusPending(false);
    }
  };

  const submitType = async (type: string) => {
    const node = selectedNode();
    if (!node || typePending() || type === node.type) return;

    setTypePending(true);
    setOptimisticType({
      nodeId: node.id,
      previousType: node.type,
      type,
    });
    props.onProjectUpdated?.(
      updateProjectNode(props.project, node.id, (projectNode) => ({
        ...projectNode,
        type,
      })),
    );

    try {
      const result = await patchProjectNode(props.project.id, node.id, { type });
      props.onProjectUpdated?.(result);
      toaster.success({
        title: "Type updated",
        description: `${node.label} is now a ${type} node.`,
      });
      setOptimisticType(null);
    } catch (error) {
      rollBackType(error);
    } finally {
      setTypePending(false);
    }
  };

  return (
    <Box class="spatial-map-inspector-rail">
      <HStack
        class="spatial-map-toggle-group spatial-map-inspector-view-toggle"
        role="tablist"
        aria-label="Inspector view"
      >
        <button
          type="button"
          class={`spatial-map-toggle-button${inspectorView() === "details" ? " is-active" : ""}`}
          role="tab"
          aria-selected={inspectorView() === "details"}
          onClick={() => setInspectorView("details")}
        >
          Details
        </button>
        <button
          type="button"
          class={`spatial-map-toggle-button${inspectorView() === "activity" ? " is-active" : ""}`}
          role="tab"
          aria-selected={inspectorView() === "activity"}
          onClick={() => setInspectorView("activity")}
        >
          Activity
        </button>
      </HStack>

      <aside
        id="spatial-map-inspector"
        class={`spatial-map-inspector${spatialMap.inspectorOpen() ? "" : " is-collapsed"}`}
      >
        <VStack alignItems="start" gap="2" h="full">
          <SpatialMapInspectorHeader
            title={selectedNodeTitle()}
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
            <Box class="spatial-map-inspector-section spatial-map-inspector-global-activity">
              <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-section-title is-heading">
                Global Activity
              </Text>
              <ActivityList
                entries={globalProjectActivity()}
                emptyLabel="No activity yet"
                nodeById={spatialMap.sourceNodesById()}
                selectedNodeId={spatialMap.selectedNodeId()}
                onSelect={selectActivityNode}
              />
            </Box>
          </Show>

          <Show when={inspectorView() === "details"}>
          <Box class="spatial-map-inspector-section spatial-map-inspector-summary">
            <HStack gap="1.5" flexWrap="wrap">
              <Show when={selectedNodeWithOptimisticStatus()}>
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
              <InspectorChip label="ID" value={spatialMap.selectedNode()?.id ?? "None"} />
              <Show when={selectedNodeWithOptimisticType()}>
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
                <HStack class="spatial-map-inspector-action-row" gap="0" flexWrap="wrap">
                  <Button
                    size="xs"
                    colorPalette="green"
                    variant="surface"
                    onClick={() => spatialMap.openContextNoteConversionFlow()}
                  >
                    Generate From Context
                  </Button>
                  <SpatialMapDeleteNodeControl
                    projectId={props.project.id}
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
          </Box>

          <Show when={selectedNode()}>
            {(node) => (
              <SpatialMapImageDropTarget
                nodeId={node().id}
                class="spatial-map-inspector-section spatial-map-image-drop-panel"
              >
                <HStack justifyContent="space-between" alignItems="center" gap="3">
                  <Text
                    as="h3"
                    margin="0"
                    fontSize="sm"
                    fontWeight="semibold"
                    class="spatial-map-inspector-section-title is-heading"
                  >
                    Images
                  </Text>
                </HStack>
                <Show
                  when={(node().images ?? []).length > 0}
                  fallback={<Box class="spatial-map-image-empty" aria-label="No images" />}
                >
                  <SpatialMapImageStrip node={node()} variant="inspector" />
                </Show>
              </SpatialMapImageDropTarget>
            )}
          </Show>

          <Box class="spatial-map-inspector-section">
            <HStack justifyContent="space-between" alignItems="center" gap="3">
              <Text
                as="h3"
                margin="0"
                fontSize="sm"
                fontWeight="semibold"
                class="spatial-map-inspector-section-title is-heading"
              >
                Metadata
              </Text>
              <Show when={selectedNode()}>
                {(node) => (
                  <HStack gap="2">
                    <Show when={metadataIsDirty()}>
                      <Button
                        type="button"
                        size="xs"
                        variant="outline"
                        onClick={() => setMetadataDraft(node().metadata)}
                      >
                        Reset
                      </Button>
                    </Show>
                    <Button
                      type="submit"
                      form={metadataFormId}
                      size="xs"
                      colorPalette="green"
                      variant="surface"
                      loading={saveMetadataSubmission.pending}
                      disabled={!metadataIsDirty()}
                    >
                      Save Metadata
                    </Button>
                  </HStack>
                )}
              </Show>
            </HStack>
            <Show
              when={selectedNode()}
              fallback={
                <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
                  No selection
                </Text>
              }
            >
              {(node) => (
                <form
                  id={metadataFormId}
                  action={normalizeActionUrl(updateProjectNodeMetadata.url)}
                  method="post"
                >
                  <VStack alignItems="stretch" gap="3">
                    <input type="hidden" name="projectId" value={props.project.id} />
                    <input type="hidden" name="nodeId" value={node().id} />
                    <For each={props.project.nodeMetadataSchema}>
                      {(field) => (
                        <Field.Root>
                          <Field.Label>{field.label}</Field.Label>
                          <Textarea
                            name={`metadata.${field.key}`}
                            rows={1}
                            value={metadataDraft()[field.key] ?? ""}
                            onInput={(event) =>
                              setMetadataDraft((current) => ({
                                ...current,
                                [field.key]: event.currentTarget.value,
                              }))
                            }
                            placeholder={field.defaultValue}
                          />
                        </Field.Root>
                      )}
                    </For>
                    <Show when={props.project.nodeMetadataSchema.length === 0}>
                      <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
                        This project does not define any metadata keys yet.
                      </Text>
                    </Show>
                  </VStack>
                </form>
              )}
            </Show>
          </Box>

          <Box class="spatial-map-inspector-section">
            <HStack justifyContent="space-between" alignItems="center" gap="3">
              <Text
                as="h3"
                margin="0"
                fontSize="sm"
                fontWeight="semibold"
                class="spatial-map-inspector-section-title is-heading"
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
                <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
                  No selection
                </Text>
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
                    action={normalizeActionUrl(updateProjectNodeContext.url)}
                    method="post"
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
                          loading={saveContextSubmission.pending}
                        >
                          Save Context
                        </Button>
                      </HStack>
                    </VStack>
                  </form>
                </Show>
              )}
            </Show>
          </Box>

          <Box class="spatial-map-inspector-section">
            <Text as="h3" margin="0 0 6px" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-section-title">
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
          </Box>

          <Box class="spatial-map-inspector-section">
            <Text as="h3" margin="0 0 6px" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-section-title">
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
          </Box>
          </Show>
        </VStack>
      </aside>
    </Box>
  );
}

function ContextPreview(props: { context: string; class?: string }) {
  const hasContent = () => props.context.trim().length > 0;

  return (
    <Show
      when={hasContent()}
      fallback={
        <Box class="spatial-map-context-empty">
          <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
            No context yet. Switch to edit mode to drop in markdown notes, pasted material, or AI working context.
          </Text>
        </Box>
      }
    >
      <Box class={`spatial-map-context-markdown${props.class ? ` ${props.class}` : ""}`}>
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
    <VStack alignItems="stretch" gap="0" class="spatial-map-activity-timeline">
      <For each={props.entries}>
        {(entry) => {
          const targetNode = getTargetNode(entry);
          const isSelected = () => Boolean(targetNode && props.selectedNodeId === targetNode.id);
          const config = getActivityKindConfig(entry.kind);

          return (
            <Show
              when={targetNode}
              fallback={
                <Box class={`spatial-map-activity-entry is-${config.tone}`}>
                  <ActivityEntryContent entry={entry} config={config} />
                </Box>
              }
            >
              {(node) => (
                <button
                  type="button"
                  class={`spatial-map-activity-entry spatial-map-activity-button is-${config.tone}${isSelected() ? " is-selected" : ""}`}
                  onClick={() => props.onSelect(node().id)}
                  aria-pressed={isSelected()}
                >
                  <ActivityEntryContent entry={entry} node={node()} config={config} />
                </button>
              )}
            </Show>
          );
        }}
      </For>
      <Show when={props.entries.length === 0}>
        <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
          {props.emptyLabel}
        </Text>
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
    <Box class="spatial-map-activity-content">
      <Box class="spatial-map-activity-body">
        <HStack justifyContent="space-between" alignItems="start" gap="2" class="spatial-map-activity-head">
          <Text
            as="div"
            margin="0"
            fontSize="sm"
            fontWeight="semibold"
            class="spatial-map-activity-summary"
            title={props.entry.summary}
          >
            {props.entry.summary}
          </Text>
        </HStack>
        <HStack gap="1.5" flexWrap="wrap" mt="1.5" class="spatial-map-activity-meta">
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
            <span class="spatial-map-activity-badge-text">{props.config.label}</span>
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
                <span class="spatial-map-activity-badge-text">{node().label}</span>
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
            <span class="spatial-map-activity-badge-text">{formatActivityActor(props.entry)}</span>
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
      contentClass="spatial-map-context-dialog"
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
      <Text as="span" textStyle="xs" class="spatial-map-inspector-row-label">
        {props.label}
      </Text>
      <Text as="span" textStyle="xs" class="spatial-map-inspector-row-value is-mono">
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
        class="spatial-map-relation-title"
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
            <button
              type="button"
              class={`spatial-map-relation-card${props.selectedNodeId === node.id ? " is-selected" : ""}`}
              onClick={() => props.onSelect(node.id)}
              aria-pressed={props.selectedNodeId === node.id}
            >
              <Text as="div" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-relation-name">
                {node.label}
              </Text>
              <Text as="div" margin="2px 0 0" fontSize="xs" class="spatial-map-relation-meta">
                {item.kind} · {node.type}
              </Text>
            </button>
          );
        }}
      </For>
      {props.items.length === 0 ? (
        <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
          {props.emptyLabel}
        </Text>
      ) : null}
    </VStack>
  );
}
