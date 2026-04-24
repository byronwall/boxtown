import { For, Show, createMemo, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { getTreeCheckedState, toggleTreeSelection } from "~/lib/context-note-conversion/selection";
import type { ConversionCandidateTreeItem } from "~/lib/context-note-conversion/types";
import { getNodePrimaryMetadataText } from "~/lib/projects/node-metadata";
import type { ProjectRecord } from "~/lib/projects/types";
import { useSpatialMap } from "~/components/spatial-map/SpatialMapContext";
import { getImageFilesFromDataTransfer } from "~/components/spatial-map/SpatialMapImages";
import { isEditableTarget } from "~/components/spatial-map/spatial-map-dom";
import { SourceImagePreview, SourceImagePreviewDialog } from "./SourceImagePreview";
import { useSourceDecompositionFlow } from "./useSourceDecompositionFlow";

interface SourceDecompositionRailProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

export function SourceDecompositionRail(props: SourceDecompositionRailProps) {
  const spatialMap = useSpatialMap();
  const flow = useSourceDecompositionFlow({
    projectId: untrack(() => props.project.id),
    onProjectUpdated: (project) => {
      props.onProjectUpdated?.(project);
      const firstNodeId = flow.snapshot()?.result?.project.spatialMap.nodes.at(-1)?.id;
      if (firstNodeId) {
        queueMicrotask(() => {
          spatialMap.setSelectedNodeId(firstNodeId);
          spatialMap.setInspectorOpen(true);
        });
      }
    },
  });
  const [sourceText, setSourceText] = createSignal("");
  const [sourceImages, setSourceImages] = createSignal<File[]>([]);
  const [previewFileIndex, setPreviewFileIndex] = createSignal<number | null>(null);
  const [isDraggingImage, setIsDraggingImage] = createSignal(false);
  let fileInputRef: HTMLInputElement | undefined;

  const selectedNode = createMemo(() => spatialMap.selectedNode());
  const selectedNodeIdSet = createMemo(() => new Set(flow.selectedNodeIds()));
  const candidateTree = createMemo(() => flow.snapshot()?.candidateBatch?.tree);
  const candidateNodeIds = createMemo(() => flow.snapshot()?.candidateBatch?.nodes.map((node) => node.id) ?? []);
  const canStart = createMemo(() => sourceText().trim().length > 0 || sourceImages().length > 0);
  const canAcceptSelection = createMemo(() => flow.selectedNodeIds().length > 0);

  const closeRail = () => {
    flow.reset();
    spatialMap.closeSourceDecompositionFlow();
  };

  const addImages = (files: File[]) => {
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;
    setSourceImages((current) => dedupeFiles([...current, ...imageFiles]));
  };

  const getCheckedState = (nodeId: string): Checkbox.CheckedState => {
    const selectedIds = selectedNodeIdSet();
    const tree = candidateTree();
    if (!tree) return false;
    return getTreeCheckedState(tree, selectedIds, nodeId);
  };

  const setNodeAndDescendants = (nodeId: string, checked: boolean) => {
    const tree = candidateTree();
    if (!tree) return;
    flow.setSelection(toggleTreeSelection(tree, flow.selectedNodeIds(), nodeId, checked));
  };

  const handlePaste = (event: ClipboardEvent) => {
    if (isEditableTarget(event.target)) {
      return;
    }

    const files = getImageFilesFromDataTransfer(event.clipboardData);
    if (files.length === 0) {
      return;
    }

    event.preventDefault();
    addImages(files);
  };

  onMount(() => {
    window.addEventListener("paste", handlePaste);
    onCleanup(() => {
      window.removeEventListener("paste", handlePaste);
    });
  });

  return (
    <Box class="spatial-map-inspector-rail">
      <button
        type="button"
        class="spatial-map-inspector-toggle"
        onClick={closeRail}
        aria-label="Close source decomposition panel"
      >
        ×
      </button>

      <aside id="spatial-map-source-decomposition" class="spatial-map-inspector spatial-map-add-nodes-rail">
        <VStack alignItems="stretch" gap="3" h="full">
          <VStack alignItems="start" gap="1" class="spatial-map-inspector-header">
            <Text as="span" textStyle="xs" class="spatial-map-kicker">
              Source Decomp
            </Text>
            <Box class="spatial-map-inspector-header-copy">
              <Box as="h2" class="spatial-map-inspector-title">
                Convert inspiration into graph nodes
              </Box>
              <Text as="p" class="spatial-map-inspector-copy">
                Paste or drop screenshots, add optional notes, then review the generated layout,
                block, component, and theme nodes before accepting them.
              </Text>
            </Box>
          </VStack>

          <Box class="spatial-map-inspector-section">
            <InspectorRow label="Project" value={props.project.name} />
            <InspectorRow label="Anchor" value={selectedNode()?.label ?? "No node selected"} />
            <InspectorRow label="Status" value={flow.snapshot()?.status ?? "idle"} mono />
          </Box>

          <Box
            class={`spatial-map-inspector-section spatial-map-source-dropzone${isDraggingImage() ? " is-dragging-image" : ""}`}
            onDragEnter={(event) => {
              if (getImageFilesFromDataTransfer(event.dataTransfer).length === 0) return;
              event.preventDefault();
              setIsDraggingImage(true);
            }}
            onDragOver={(event) => {
              if (getImageFilesFromDataTransfer(event.dataTransfer).length === 0) return;
              event.preventDefault();
            }}
            onDragLeave={() => setIsDraggingImage(false)}
            onDrop={(event) => {
              const files = getImageFilesFromDataTransfer(event.dataTransfer);
              if (files.length === 0) return;
              event.preventDefault();
              setIsDraggingImage(false);
              addImages(files);
            }}
          >
            <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
              Sources
            </Text>
            <Textarea
              rows={4}
              value={sourceText()}
              onInput={(event) => setSourceText(event.currentTarget.value)}
              class="spatial-map-add-nodes-textarea"
              placeholder="Optional: paste notes about interaction goals, target platform, or what you want copied from the source."
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              class="spatial-map-source-file-input"
              onChange={(event) => addImages(Array.from(event.currentTarget.files ?? []))}
            />
            <HStack gap="2" justifyContent="space-between" flexWrap="wrap">
              <Text as="span" class="spatial-map-empty-state">
                Paste, drag/drop, or browse for image sources.
              </Text>
              <Button
                size="xs"
                variant="outline"
                class="spatial-map-button"
                onClick={() => fileInputRef?.click()}
              >
                Browse Images
              </Button>
            </HStack>
            <Show when={sourceImages().length > 0}>
              <VStack alignItems="stretch" gap="1">
                <For each={sourceImages()}>
                  {(file) => (
                    <HStack justifyContent="space-between" alignItems="center" gap="2" class="spatial-map-source-file-row">
                      <HStack gap="2" minW="0">
                        <SourceImagePreview file={file} onOpen={() => setPreviewFileIndex(sourceImages().indexOf(file))} />
                        <Text as="span" class="spatial-map-relation-name">
                          {file.name || "Pasted image"}
                        </Text>
                      </HStack>
                      <button
                        type="button"
                        class="spatial-map-source-file-remove"
                        onClick={() => setSourceImages((current) => current.filter((entry) => entry !== file))}
                      >
                        Remove
                      </button>
                    </HStack>
                  )}
                </For>
              </VStack>
            </Show>
            <HStack gap="2" justifyContent="flex-end">
              <Button
                size="xs"
                class="spatial-map-button spatial-map-button--strong"
                colorPalette="green"
                variant="surface"
                loading={flow.starting()}
                loadingText="Reading"
                disabled={!canStart()}
                onClick={() =>
                  void flow.startRun({
                    sourceText: sourceText(),
                    selectedNodeId: selectedNode()?.id ?? null,
                    images: sourceImages(),
                  })
                }
              >
                Decompose Sources
              </Button>
            </HStack>
          </Box>

          <Show when={flow.snapshot()}>
            {(snapshot) => (
              <>
                <Box class="spatial-map-inspector-section">
                  <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
                    Run progress
                  </Text>
                  <Text as="p" class="spatial-map-inspector-copy">
                    {snapshot().latestMessage}
                  </Text>
                  <VStack alignItems="stretch" gap="1.5">
                    <For each={snapshot().steps}>
                      {(step) => (
                        <Box class={`spatial-map-run-step is-${step.status}`}>
                          <HStack justifyContent="space-between" alignItems="start" gap="3">
                            <Text as="span" class="spatial-map-run-step-label">
                              {step.label}
                            </Text>
                            <Text as="span" class="spatial-map-run-step-status">
                              {step.status}
                            </Text>
                          </HStack>
                          <Text as="p" class="spatial-map-run-step-detail">
                            {step.detail}
                          </Text>
                        </Box>
                      )}
                    </For>
                  </VStack>
                </Box>

                <Show when={snapshot().status === "awaiting-review" && snapshot().candidateBatch}>
                  {(candidateBatch) => (
                    <>
                      <Box class="spatial-map-inspector-section">
                        <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
                          Style commentary
                        </Text>
                        <Text as="p" class="spatial-map-inspector-copy">
                          {candidateBatch().styleCommentary}
                        </Text>
                      </Box>
                      <Box class="spatial-map-inspector-section">
                        <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
                          Available nodes
                        </Text>
                        <Text as="p" class="spatial-map-inspector-copy">
                          {candidateBatch().summary}
                        </Text>
                        <Text as="p" class="spatial-map-empty-state">
                          All candidates start selected. Source images attach only to accepted top-level nodes.
                        </Text>
                        <VStack alignItems="stretch" gap="1.5" class="spatial-map-candidate-tree">
                          <For each={candidateBatch().tree.roots}>
                            {(rootId) => (
                            <CandidateTreeNode
                              item={candidateBatch().tree.items[rootId]!}
                              items={candidateBatch().tree.items}
                              getCheckedState={getCheckedState}
                              onToggle={setNodeAndDescendants}
                              nodeMetadataSchema={props.project.nodeMetadataSchema}
                              level={0}
                            />
                            )}
                          </For>
                        </VStack>
                        <HStack justifyContent="space-between" gap="3" flexWrap="wrap">
                          <Text as="span" class="spatial-map-empty-state">
                            {flow.selectedNodeIds().length} of {candidateNodeIds().length} nodes selected
                          </Text>
                          <Button
                            size="xs"
                            class="spatial-map-button spatial-map-button--strong"
                            colorPalette="green"
                            variant="surface"
                            loading={flow.accepting()}
                            loadingText="Applying"
                            disabled={!canAcceptSelection()}
                            onClick={() => void flow.acceptSelection()}
                          >
                            Accept Selected
                          </Button>
                        </HStack>
                      </Box>
                    </>
                  )}
                </Show>

                <Show when={snapshot().result}>
                  {(result) => (
                    <Box class="spatial-map-inspector-section">
                      <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
                        Decomposition complete
                      </Text>
                      <Text as="p" class="spatial-map-inspector-copy">
                        {result().summary}
                      </Text>
                      <Text as="p" class="spatial-map-empty-state">
                        {result().acceptedNodeCount} nodes / {result().acceptedLinkCount} links added /
                        {result().attachedImageCount} source image attachments
                      </Text>
                      <Text as="p" class="spatial-map-inspector-copy">
                        {result().styleCommentary}
                      </Text>
                    </Box>
                  )}
                </Show>
              </>
            )}
          </Show>

          <Show when={flow.error()}>
            {(error) => (
              <Box class="spatial-map-inspector-section spatial-map-add-nodes-error">
                <Text as="p" class="spatial-map-inspector-copy">
                  {error()}
                </Text>
              </Box>
            )}
          </Show>
        </VStack>
        <SourceImagePreviewDialog
          files={sourceImages()}
          index={previewFileIndex()}
          onIndexChange={setPreviewFileIndex}
          onOpenChange={(open) => {
            if (!open) {
              setPreviewFileIndex(null);
            }
          }}
        />
      </aside>
    </Box>
  );
}

function CandidateTreeNode(props: {
  item: ConversionCandidateTreeItem;
  items: Record<string, ConversionCandidateTreeItem>;
  getCheckedState: (nodeId: string) => Checkbox.CheckedState;
  onToggle: (nodeId: string, checked: boolean) => void;
  nodeMetadataSchema: ProjectRecord["nodeMetadataSchema"];
  level: number;
}) {
  return (
    <VStack alignItems="stretch" gap="1">
      <Checkbox.Root
        checked={props.getCheckedState(props.item.nodeId)}
        onCheckedChange={(details) => props.onToggle(props.item.nodeId, details.checked === true)}
      >
        <Checkbox.HiddenInput />
        <HStack
          alignItems="start"
          gap="2"
          class="spatial-map-candidate-tree-row"
          style={{ "padding-left": `${props.level * 16}px` }}
        >
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <VStack alignItems="start" gap="0.5" flex="1">
            <HStack justifyContent="space-between" w="full" gap="2" flexWrap="wrap">
              <Checkbox.Label class="spatial-map-relation-name">
                {props.item.label}
              </Checkbox.Label>
              <Text as="span" class="spatial-map-relation-meta">
                {props.item.type} · depth {props.item.depth}
              </Text>
            </HStack>
            <Text as="div" class="spatial-map-relation-meta">
              {getNodePrimaryMetadataText(
                { metadata: props.item.metadata },
                props.nodeMetadataSchema,
                "No metadata",
              )}
            </Text>
          </VStack>
        </HStack>
      </Checkbox.Root>

      <For each={props.item.childNodeIds}>
        {(childId) => (
          <CandidateTreeNode
            item={props.items[childId]!}
            items={props.items}
            getCheckedState={props.getCheckedState}
            onToggle={props.onToggle}
            nodeMetadataSchema={props.nodeMetadataSchema}
            level={props.level + 1}
          />
        )}
      </For>
    </VStack>
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

function dedupeFiles(files: File[]) {
  const seen = new Set<string>();
  return files.filter((file) => {
    const key = `${file.name}:${file.type}:${file.size}`;
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}
