import { useSubmission } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, onMount } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { MarkdownRenderer } from "~/components/markdown-renderer";
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
import type { ProjectRecord } from "~/lib/projects/types";
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
  const [isHydrated, setIsHydrated] = createSignal(false);
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
  const isContextOnlyNode = createMemo(() => selectedNode()?.contextMode === "context-only");
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

  onMount(() => {
    setIsHydrated(true);
  });

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
              <InspectorChip label="Mode" value={selectedNode()?.contextMode ?? "Unknown"} />
            </HStack>
            <Show when={selectedNode()}>
              {(node) => (
                <HStack class="spatial-map-inspector-action-row" gap="0" flexWrap="wrap">
                  <Show when={isContextOnlyNode()}>
                    <Button
                      size="xs"
                      class="spatial-map-button spatial-map-button--strong"
                      colorPalette="green"
                      variant="surface"
                      onClick={() => spatialMap.openContextNoteConversionFlow()}
                    >
                      Convert to Proper Node
                    </Button>
                  </Show>
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

          <Show when={isHydrated() && isContextOnlyNode() && selectedNode()}>
            {(node) => (
              <Box class="spatial-map-inspector-section">
                <HStack justifyContent="space-between" alignItems="center" gap="3">
                  <Text
                    as="h3"
                    margin="0"
                    fontSize="sm"
                    fontWeight="semibold"
                    class="spatial-map-inspector-section-title is-heading"
                  >
                    Raw Context
                  </Text>
                  <Button
                    size="xs"
                    variant="surface"
                    class="spatial-map-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(node().rawContext);
                        toaster.success({
                          title: "Raw context copied",
                          description: "The original note content is now in your clipboard.",
                        });
                      } catch {
                        toaster.error({
                          title: "Copy failed",
                          description: "The raw context could not be copied from this browser session.",
                        });
                      }
                    }}
                  >
                    Copy
                  </Button>
                </HStack>
                <RawContextPreview context={node().rawContext} />
              </Box>
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
                        class="spatial-map-button"
                        onClick={() => setMetadataDraft(node().metadata)}
                      >
                        Reset
                      </Button>
                    </Show>
                    <Button
                      type="submit"
                      form={metadataFormId}
                      size="xs"
                      class="spatial-map-button spatial-map-button--strong"
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
                      class="spatial-map-button"
                      onClick={() => setContextDialogOpen(true)}
                    >
                      Expand
                    </Button>
                    <Button
                      size="xs"
                      variant={editingContext() ? "outline" : "surface"}
                      class="spatial-map-button"
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
                    <Show
                      when={!isContextOnlyNode() || isHydrated()}
                      fallback={
                        <Box class="spatial-map-context-empty">
                          <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
                            Context preview will appear once the note finishes hydrating.
                          </Text>
                        </Box>
                      }
                    >
                      <ContextPreview
                        context={node().context}
                        plainText={node().contextMode === "context-only"}
                      />
                    </Show>
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
                          class="spatial-map-context-textarea"
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
                          class="spatial-map-button"
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
                          class="spatial-map-button spatial-map-button--strong"
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
        </VStack>
      </aside>
    </Box>
  );
}

function ContextPreview(props: { context: string; class?: string; plainText?: boolean }) {
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
      <Show
        when={!props.plainText}
        fallback={
          <Box class={`spatial-map-context-markdown${props.class ? ` ${props.class}` : ""}`}>
            <Text as="pre" margin="0" fontSize="sm" class="spatial-map-raw-context">
              {props.context}
            </Text>
          </Box>
        }
      >
        <Box class={`spatial-map-context-markdown${props.class ? ` ${props.class}` : ""}`}>
          <MarkdownRenderer>{props.context}</MarkdownRenderer>
        </Box>
      </Show>
    </Show>
  );
}

function RawContextPreview(props: { context: string }) {
  const hasContent = () => props.context.trim().length > 0;

  return (
    <Show
      when={hasContent()}
      fallback={
        <Box class="spatial-map-context-empty">
          <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
            No raw context was captured for this node.
          </Text>
        </Box>
      }
    >
      <Box class="spatial-map-context-markdown">
        <Text
          as="pre"
          margin="0"
          fontSize="sm"
          class="spatial-map-raw-context"
        >
          {props.context}
        </Text>
      </Box>
    </Show>
  );
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
            class="spatial-map-button"
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
    <HStack gap="1.5" class="spatial-map-inspector-chip">
      <Text as="span" textStyle="xs" class="spatial-map-inspector-row-label">
        {props.label}
      </Text>
      <Text as="span" textStyle="xs" class="spatial-map-inspector-row-value is-mono">
        {props.value}
      </Text>
    </HStack>
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
