import { useSubmission } from "@solidjs/router";
import { For, Show, createEffect, createMemo, createSignal, onMount } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { MarkdownRenderer } from "~/components/markdown-renderer";
import { Button } from "~/components/ui/button";
import * as Field from "~/components/ui/field";
import { SimpleDialog } from "~/components/ui/simple-dialog";
import { Textarea } from "~/components/ui/textarea";
import { toaster } from "~/components/ui/toast";
import {
  updateProjectNodeContext,
  updateProjectNodeMetadata,
} from "~/lib/projects/data";
import type { ProjectRecord } from "~/lib/projects/types";
import { normalizeActionUrl } from "~/lib/router/action-url";
import { Text } from "~/components/ui/text";
import type { MapNode } from "~/lib/spatial-map/types";
import { SpatialMapGenerateImageControl } from "./SpatialMapGenerateImageControl";
import { SpatialMapImageDropTarget, SpatialMapImageStrip } from "./SpatialMapImages";
import { useSpatialMap } from "./SpatialMapContext";
import { SpatialMapDeleteNodeControl } from "./SpatialMapDeleteNodeControl";

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
  const contextFormId = "spatial-map-context-form";
  const metadataFormId = "spatial-map-metadata-form";
  const isContextOnlyNode = createMemo(() => selectedNode()?.contextMode === "context-only");
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

  return (
    <Box class="spatial-map-inspector-rail">
      <aside
        id="spatial-map-inspector"
        class={`spatial-map-inspector${spatialMap.inspectorOpen() ? "" : " is-collapsed"}`}
      >
        <VStack alignItems="start" gap="2" h="full">
          <Box class="spatial-map-inspector-header">
            <VStack alignItems="start" gap="1" class="spatial-map-inspector-header-copy">
              <Text as="span" textStyle="xs" class="spatial-map-kicker">
                Inspector rail
              </Text>
              <Box as="h2" class="spatial-map-inspector-title">
                {spatialMap.selectedNode()?.label ?? "Select an item"}
              </Box>
              <Text as="p" class="spatial-map-inspector-copy">
                {spatialMap.selectedNode()
                  ? "Lock another node to compare structure without losing current context."
                  : "Choose any node to inspect metadata, role, and network relationships."}
              </Text>
            </VStack>
            <InspectorToggle inToolbar={false} />
          </Box>

          <Box class="spatial-map-inspector-section">
            <InspectorRow label="ID" value={spatialMap.selectedNode()?.id ?? "None"} mono />
            <InspectorRow label="Type" value={spatialMap.selectedNode()?.type ?? "Unknown"} />
            <InspectorRow label="Mode" value={selectedNode()?.contextMode ?? "Unknown"} />
            <InspectorRow label="Depth" value={String(spatialMap.selectedNode()?.depth ?? 0)} />
            <Show when={selectedNode()}>
              {(node) => (
                <HStack justifyContent="space-between" gap="2" flexWrap="wrap">
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
                  <Text as="span" margin="0" fontSize="xs" class="spatial-map-empty-state">
                    Drop or paste
                  </Text>
                </HStack>
                <Show
                  when={(node().images ?? []).length > 0}
                  fallback={
                    <Box class="spatial-map-context-empty">
                      <Text as="p" margin="0" fontSize="sm" class="spatial-map-empty-state">
                        Drop image files here, onto the canvas node, or paste while this node is selected.
                      </Text>
                    </Box>
                  }
                >
                  <SpatialMapImageStrip node={node()} variant="inspector" />
                </Show>
                <SpatialMapGenerateImageControl
                  projectId={props.project.id}
                  node={node()}
                  onProjectUpdated={props.onProjectUpdated}
                />
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
                  Select a node to edit its project metadata values.
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
                  Select a node to view or edit its markdown context.
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

export function InspectorToggle(props: { inToolbar: boolean }) {
  const spatialMap = useSpatialMap();

  return (
    <button
      type="button"
      class={`spatial-map-inspector-toggle${props.inToolbar ? " is-toolbar" : ""}`}
      onClick={() => spatialMap.setInspectorOpen((current) => !current)}
      aria-expanded={spatialMap.inspectorOpen()}
      aria-controls="spatial-map-inspector"
      aria-label={spatialMap.inspectorOpen() ? "Hide inspector panel" : "Show inspector panel"}
      title={spatialMap.inspectorOpen() ? "Hide inspector panel" : "Show inspector panel"}
    >
      <span aria-hidden="true" class="spatial-map-inspector-toggle-icon">
        {spatialMap.inspectorOpen() ? ">" : "<"}
      </span>
    </button>
  );
}

function InspectorRow(props: { label: string; value: string; mono?: boolean }) {
  return (
    <HStack justifyContent="space-between" alignItems="start" gap="3" class="spatial-map-inspector-row">
      <Text as="span" textStyle="xs" class="spatial-map-inspector-row-label">
        {props.label}
      </Text>
      <Text
        as="span"
        textStyle="sm"
        class={props.mono ? "spatial-map-inspector-row-value is-mono" : "spatial-map-inspector-row-value"}
        textAlign="right"
      >
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
                {item.kind} · {node.type} · depth {node.depth}
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
