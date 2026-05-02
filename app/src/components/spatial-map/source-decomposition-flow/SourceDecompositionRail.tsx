import { For, Show, createMemo, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { HStack, VStack, styled } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import { Textarea } from "~/components/ui/textarea";
import { getTreeCheckedState, toggleTreeSelection } from "~/lib/context-note-conversion/selection";
import type { ConversionCandidateTreeItem } from "~/lib/context-note-conversion/types";
import { getNodePrimaryMetadataText } from "~/lib/projects/node-metadata";
import type { ProjectRecord } from "~/lib/projects/types";
import { useSpatialMap } from "~/components/spatial-map/SpatialMapContext";
import { getImageFilesFromDataTransfer } from "~/components/spatial-map/SpatialMapImages";
import { SpatialMapInspectorHeader } from "~/components/spatial-map/SpatialMapInspectorHeader";
import {
  SpatialMapBlockTitle,
  SpatialMapCandidateRow,
  SpatialMapCopy,
  SpatialMapEmptyState,
  SpatialMapFlowRail,
  SpatialMapInspectorRow,
  SpatialMapInspectorSection,
  SpatialMapRelationMeta,
  SpatialMapRelationName,
  SpatialMapRunStep,
} from "~/components/spatial-map/SpatialMapPanelPrimitives";
import { isEditableTarget } from "~/components/spatial-map/spatial-map-dom";
import { SourceImagePreview, SourceImagePreviewDialog } from "./SourceImagePreview";
import { useSourceDecompositionFlow } from "./useSourceDecompositionFlow";

const SourceFileRemoveButton = styled("button");

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
    <SpatialMapFlowRail id="spatial-map-source-decomposition">
        <VStack alignItems="stretch" gap="3" h="full">
          <SpatialMapInspectorHeader
            kicker="Source Decomp"
            title="Convert inspiration into graph nodes"
            description="Paste or drop screenshots, add optional notes, then review the generated layout, block, component, and theme nodes before accepting them."
            controls="spatial-map-source-decomposition"
            closeLabel="Close source decomposition panel"
            onClose={closeRail}
          />

          <SpatialMapInspectorSection>
            <SpatialMapInspectorRow label="Project" value={props.project.name} />
            <SpatialMapInspectorRow label="Anchor" value={selectedNode()?.label ?? "No node selected"} />
            <SpatialMapInspectorRow label="Status" value={flow.snapshot()?.status ?? "idle"} mono />
          </SpatialMapInspectorSection>

          <SpatialMapInspectorSection
            dragging={isDraggingImage()}
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
            <SpatialMapBlockTitle>Sources</SpatialMapBlockTitle>
            <Textarea
              rows={4}
              variant="spatial"
              size="sm"
              autoResize={false}
              minH="112px"
              resize="vertical"
              value={sourceText()}
              onInput={(event) => setSourceText(event.currentTarget.value)}
              placeholder="Optional: paste notes about interaction goals, target platform, or what you want copied from the source."
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              style={{ display: "none" }}
              onChange={(event) => addImages(Array.from(event.currentTarget.files ?? []))}
            />
            <HStack gap="2" justifyContent="space-between" flexWrap="wrap">
              <SpatialMapEmptyState as="span">
                Paste, drag/drop, or browse for image sources.
              </SpatialMapEmptyState>
              <Button
                size="xs"
                variant="outline"
                onClick={() => fileInputRef?.click()}
              >
                Browse Images
              </Button>
            </HStack>
            <Show when={sourceImages().length > 0}>
              <VStack alignItems="stretch" gap="1">
                <For each={sourceImages()}>
                  {(file) => (
                    <HStack
                      justifyContent="space-between"
                      alignItems="center"
                      gap="2"
                      p="6px 7px"
                      border="1px solid rgba(44, 52, 46, 0.24)"
                      borderRadius="6px"
                      background="rgba(239, 242, 237, 0.84)"
                    >
                      <HStack gap="2" minW="0">
                        <SourceImagePreview file={file} onOpen={() => setPreviewFileIndex(sourceImages().indexOf(file))} />
                        <SpatialMapRelationName as="span">
                          {file.name || "Pasted image"}
                        </SpatialMapRelationName>
                      </HStack>
                      <SourceFileRemoveButton
                        type="button"
                        border="0"
                        background="transparent"
                        color="var(--spatial-map-copy-dim)"
                        cursor="pointer"
                        fontFamily="inherit"
                        fontSize="10px"
                        letterSpacing="0.1em"
                        lineHeight="1"
                        p="2px 0"
                        textTransform="none"
                        _hover={{ color: "var(--spatial-map-copy)", outline: "none", textDecoration: "underline", textUnderlineOffset: "3px" }}
                        _focusVisible={{ color: "var(--spatial-map-copy)", outline: "none", textDecoration: "underline", textUnderlineOffset: "3px" }}
                        onClick={() => setSourceImages((current) => current.filter((entry) => entry !== file))}
                      >
                        Remove
                      </SourceFileRemoveButton>
                    </HStack>
                  )}
                </For>
              </VStack>
            </Show>
            <HStack gap="2" justifyContent="flex-end">
              <Button
                size="xs"
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
          </SpatialMapInspectorSection>

          <Show when={flow.snapshot()}>
            {(snapshot) => (
              <>
                <SpatialMapInspectorSection>
                  <SpatialMapBlockTitle>Run progress</SpatialMapBlockTitle>
                  <SpatialMapCopy>{snapshot().latestMessage}</SpatialMapCopy>
                  <VStack alignItems="stretch" gap="1.5">
                    <For each={snapshot().steps}>
                      {(step) => (
                        <SpatialMapRunStep status={step.status} label={step.label} detail={step.detail} />
                      )}
                    </For>
                  </VStack>
                </SpatialMapInspectorSection>

                <Show when={snapshot().status === "awaiting-review" && snapshot().candidateBatch}>
                  {(candidateBatch) => (
                    <>
                      <SpatialMapInspectorSection>
                        <SpatialMapBlockTitle>Style commentary</SpatialMapBlockTitle>
                        <SpatialMapCopy>{candidateBatch().styleCommentary}</SpatialMapCopy>
                      </SpatialMapInspectorSection>
                      <SpatialMapInspectorSection>
                        <SpatialMapBlockTitle>Available nodes</SpatialMapBlockTitle>
                        <SpatialMapCopy>{candidateBatch().summary}</SpatialMapCopy>
                        <SpatialMapEmptyState>
                          All candidates start selected. Source images attach only to accepted top-level nodes.
                        </SpatialMapEmptyState>
                        <VStack alignItems="stretch" gap="1.5" pt="2px">
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
                          <SpatialMapEmptyState as="span">
                            {flow.selectedNodeIds().length} of {candidateNodeIds().length} nodes selected
                          </SpatialMapEmptyState>
                          <Button
                            size="xs"
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
                      </SpatialMapInspectorSection>
                    </>
                  )}
                </Show>

                <Show when={snapshot().result}>
                  {(result) => (
                    <SpatialMapInspectorSection>
                      <SpatialMapBlockTitle>Decomposition complete</SpatialMapBlockTitle>
                      <SpatialMapCopy>{result().summary}</SpatialMapCopy>
                      <SpatialMapEmptyState>
                        {result().acceptedNodeCount} nodes / {result().acceptedLinkCount} links added /
                        {result().attachedImageCount} source image attachments
                      </SpatialMapEmptyState>
                      <SpatialMapCopy>{result().styleCommentary}</SpatialMapCopy>
                    </SpatialMapInspectorSection>
                  )}
                </Show>
              </>
            )}
          </Show>

          <Show when={flow.error()}>
            {(error) => (
              <SpatialMapInspectorSection error>
                <SpatialMapCopy>{error()}</SpatialMapCopy>
              </SpatialMapInspectorSection>
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
      </SpatialMapFlowRail>
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
        class="group"
        checked={props.getCheckedState(props.item.nodeId)}
        onCheckedChange={(details) => props.onToggle(props.item.nodeId, details.checked === true)}
      >
        <Checkbox.HiddenInput />
        <SpatialMapCandidateRow level={props.level}>
          <Checkbox.Control>
            <Checkbox.Indicator />
          </Checkbox.Control>
          <VStack alignItems="start" gap="0.5" flex="1">
            <HStack justifyContent="space-between" w="full" gap="2" flexWrap="wrap">
              <Checkbox.Label>
                <SpatialMapRelationName as="span">{props.item.label}</SpatialMapRelationName>
              </Checkbox.Label>
              <SpatialMapRelationMeta as="span">{props.item.type}</SpatialMapRelationMeta>
            </HStack>
            <SpatialMapRelationMeta>
              {getNodePrimaryMetadataText(
                { metadata: props.item.metadata },
                props.nodeMetadataSchema,
                "No metadata",
              )}
            </SpatialMapRelationMeta>
          </VStack>
        </SpatialMapCandidateRow>
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
