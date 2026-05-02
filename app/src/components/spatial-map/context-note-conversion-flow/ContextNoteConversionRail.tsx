import { For, Show, createMemo, untrack } from "solid-js";
import { Box, Grid, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { getTreeCheckedState, toggleTreeSelection } from "~/lib/context-note-conversion/selection";
import type { ConversionCandidateTreeItem } from "~/lib/context-note-conversion/types";
import { getNodePrimaryMetadataText } from "~/lib/projects/node-metadata";
import type { ProjectRecord } from "~/lib/projects/types";
import { SpatialMapInspectorHeader } from "~/components/spatial-map/SpatialMapInspectorHeader";
import { useSpatialMap } from "~/components/spatial-map/SpatialMapContext";
import { useContextNoteConversionFlow } from "./useContextNoteConversionFlow";

interface ContextNoteConversionRailProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

export function ContextNoteConversionRail(props: ContextNoteConversionRailProps) {
  const spatialMap = useSpatialMap();
  const flow = useContextNoteConversionFlow({
    projectId: untrack(() => props.project.id),
    onProjectUpdated: (project) => {
      props.onProjectUpdated?.(project);
      const sourceNodeId = flow.snapshot()?.sourceNodeId;
      if (sourceNodeId) {
        queueMicrotask(() => {
          spatialMap.setSelectedNodeId(sourceNodeId);
          spatialMap.setInspectorOpen(true);
        });
      }
    },
  });
  const selectedNode = createMemo(() => spatialMap.selectedNode());
  const selectedNodeIdSet = createMemo(() => new Set(flow.selectedNodeIds()));
  const candidateTree = createMemo(() => flow.snapshot()?.candidateBatch?.tree);
  const candidateNodeIds = createMemo(() => flow.snapshot()?.candidateBatch?.nodes.map((node) => node.id) ?? []);
  const canSubmitAnswers = createMemo(() => {
    const snapshot = flow.snapshot();
    if (!snapshot || snapshot.status !== "awaiting-input") {
      return false;
    }

    return snapshot.questions.every((question) => Boolean(flow.answerDraft()[question.id]));
  });
  const canAcceptSelection = createMemo(() => flow.selectedNodeIds().length > 0);

  const closeRail = () => {
    flow.reset();
    spatialMap.closeContextNoteConversionFlow();
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

  return (
    <Box class="spatial-map-inspector-rail">
      <aside id="spatial-map-context-note-conversion" class="spatial-map-inspector spatial-map-add-nodes-rail">
        <VStack alignItems="stretch" gap="3" h="full">
          <SpatialMapInspectorHeader
            kicker="Generate From Context"
            title="Generate nodes from selected context"
            description="Answer the generated questions, review the candidate hierarchy, and only add the pieces worth promoting into the map."
            controls="spatial-map-context-note-conversion"
            closeLabel="Close context note conversion panel"
            onClose={closeRail}
          />

          <Box class="spatial-map-inspector-section">
            <InspectorRow label="Project" value={props.project.name} />
            <InspectorRow label="Selection" value={selectedNode()?.label ?? "No node selected"} />
            <InspectorRow label="Status" value={flow.snapshot()?.status ?? "idle"} mono />
            <HStack justifyContent="flex-end">
              <Button
                size="xs"
                class="spatial-map-button spatial-map-button--strong"
                colorPalette="green"
                variant="surface"
                loading={flow.starting()}
                disabled={!selectedNode()}
                onClick={() => {
                  const sourceNodeId = selectedNode()?.id;
                  if (sourceNodeId) {
                    void flow.startRun(sourceNodeId);
                  }
                }}
              >
                Generate Questions
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

                <Show when={snapshot().status === "awaiting-input" && snapshot().questions.length > 0}>
                  <Box class="spatial-map-inspector-section">
                    <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
                      Clarifying questions
                    </Text>
                    <VStack alignItems="stretch" gap="3">
                      <For each={snapshot().questions}>
                        {(question) => (
                          <VStack alignItems="stretch" gap="2">
                            <Box>
                              <Text as="div" class="spatial-map-question-title">
                                {question.prompt}
                              </Text>
                              <Text as="div" class="spatial-map-question-helper">
                                {question.helperText}
                              </Text>
                            </Box>
                            <Grid class="spatial-map-answer-grid">
                              <For each={question.options}>
                                {(option) => (
                                  <Tooltip
                                    content={option.detail}
                                    openDelay={120}
                                    closeDelay={80}
                                    portalled={false}
                                  >
                                    <button
                                      type="button"
                                      class={`spatial-map-answer-option${
                                        flow.answerDraft()[question.id] === option.id ? " is-selected" : ""
                                      }`}
                                      onClick={() => flow.chooseAnswer(question.id, option.id)}
                                      aria-pressed={flow.answerDraft()[question.id] === option.id}
                                    >
                                      {option.label}
                                    </button>
                                  </Tooltip>
                                )}
                              </For>
                            </Grid>
                          </VStack>
                        )}
                      </For>
                    </VStack>
                    <HStack justifyContent="space-between" gap="3" flexWrap="wrap">
                      <Text as="span" class="spatial-map-empty-state">
                        Hover any answer for guidance before you choose it.
                      </Text>
                      <Button
                        size="xs"
                        class="spatial-map-button spatial-map-button--strong"
                        colorPalette="green"
                        variant="surface"
                        loading={flow.submittingAnswers()}
                        loadingText="Thinking"
                        disabled={!canSubmitAnswers()}
                        onClick={() => void flow.submitAnswers()}
                      >
                        Generate Suggestions
                      </Button>
                    </HStack>
                  </Box>
                </Show>

                <Show when={snapshot().status === "awaiting-review" && snapshot().candidateBatch}>
                  {(candidateBatch) => (
                    <Box class="spatial-map-inspector-section">
                      <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
                        Suggested hierarchy
                      </Text>
                      <Text as="p" class="spatial-map-inspector-copy">
                        {candidateBatch().summary}
                      </Text>
                      <Text as="p" class="spatial-map-empty-state">
                        All candidates start selected. Uncheck anything you do not want to add.
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
                  )}
                </Show>

                <Show when={snapshot().result}>
                  {(result) => (
                    <Box class="spatial-map-inspector-section">
                      <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
                        Conversion complete
                      </Text>
                      <Text as="p" class="spatial-map-inspector-copy">
                        {result().summary}
                      </Text>
                      <Text as="p" class="spatial-map-empty-state">
                        {result().acceptedNodeCount} nodes / {result().acceptedLinkCount} links added
                      </Text>
                      <Text as="p" class="spatial-map-inspector-copy">
                        {result().trimSummary}
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
                {props.item.type}
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
