import { For, Show, createMemo, untrack } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import * as Checkbox from "~/components/ui/checkbox";
import { Tooltip } from "~/components/ui/tooltip";
import { getTreeCheckedState, toggleTreeSelection } from "~/lib/context-note-conversion/selection";
import type { ConversionCandidateTreeItem } from "~/lib/context-note-conversion/types";
import { getNodePrimaryMetadataText } from "~/lib/projects/node-metadata";
import type { ProjectRecord } from "~/lib/projects/types";
import { SpatialMapInspectorHeader } from "~/components/spatial-map/SpatialMapInspectorHeader";
import { useSpatialMap } from "~/components/spatial-map/SpatialMapContext";
import {
  SpatialMapAnswerGrid,
  SpatialMapBlockTitle,
  SpatialMapCandidateRow,
  SpatialMapCopy,
  SpatialMapEmptyState,
  SpatialMapFlowRail,
  SpatialMapInspectorRow,
  SpatialMapInspectorSection,
  SpatialMapOptionButton,
  SpatialMapQuestionHelper,
  SpatialMapQuestionTitle,
  SpatialMapRelationMeta,
  SpatialMapRelationName,
  SpatialMapRunStep,
} from "~/components/spatial-map/SpatialMapPanelPrimitives";
import { useContextNoteConversionFlow } from "./useContextNoteConversionFlow";

interface ContextNoteConversionRailProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
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
    <SpatialMapFlowRail id="spatial-map-context-note-conversion">
        <VStack alignItems="stretch" gap="3" h="full">
          <SpatialMapInspectorHeader
            kicker="Generate From Context"
            title="Generate nodes from selected context"
            description="Answer the generated questions, review the candidate hierarchy, and only add the pieces worth promoting into the map."
            controls="spatial-map-context-note-conversion"
            closeLabel="Close context note conversion panel"
            onClose={closeRail}
          />

          <SpatialMapInspectorSection>
            <SpatialMapInspectorRow label="Project" value={props.project.name} />
            <SpatialMapInspectorRow label="Selection" value={selectedNode()?.label ?? "No node selected"} />
            <SpatialMapInspectorRow label="Status" value={flow.snapshot()?.status ?? "idle"} mono />
            <HStack justifyContent="flex-end">
              <Button
                size="xs"
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

                <Show when={snapshot().status === "awaiting-input" && snapshot().questions.length > 0}>
                  <SpatialMapInspectorSection>
                    <SpatialMapBlockTitle>Clarifying questions</SpatialMapBlockTitle>
                    <VStack alignItems="stretch" gap="3">
                      <For each={snapshot().questions}>
                        {(question) => (
                          <VStack alignItems="stretch" gap="2">
                            <Box>
                              <SpatialMapQuestionTitle>{question.prompt}</SpatialMapQuestionTitle>
                              <SpatialMapQuestionHelper>{question.helperText}</SpatialMapQuestionHelper>
                            </Box>
                            <SpatialMapAnswerGrid>
                              <For each={question.options}>
                                {(option) => (
                                  <Tooltip
                                    content={option.detail}
                                    openDelay={120}
                                    closeDelay={80}
                                    portalled={false}
                                  >
                                    <SpatialMapOptionButton
                                      selected={flow.answerDraft()[question.id] === option.id}
                                      onClick={() => flow.chooseAnswer(question.id, option.id)}
                                    >
                                      {option.label}
                                    </SpatialMapOptionButton>
                                  </Tooltip>
                                )}
                              </For>
                            </SpatialMapAnswerGrid>
                          </VStack>
                        )}
                      </For>
                    </VStack>
                    <HStack justifyContent="space-between" gap="3" flexWrap="wrap">
                      <SpatialMapEmptyState as="span">
                        Hover any answer for guidance before you choose it.
                      </SpatialMapEmptyState>
                      <Button
                        size="xs"
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
                  </SpatialMapInspectorSection>
                </Show>

                <Show when={snapshot().status === "awaiting-review" && snapshot().candidateBatch}>
                  {(candidateBatch) => (
                    <SpatialMapInspectorSection>
                      <SpatialMapBlockTitle>Suggested hierarchy</SpatialMapBlockTitle>
                      <SpatialMapCopy>{candidateBatch().summary}</SpatialMapCopy>
                      <SpatialMapEmptyState>
                        All candidates start selected. Uncheck anything you do not want to add.
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
                  )}
                </Show>

                <Show when={snapshot().result}>
                  {(result) => (
                    <SpatialMapInspectorSection>
                      <SpatialMapBlockTitle>Conversion complete</SpatialMapBlockTitle>
                      <SpatialMapCopy>{result().summary}</SpatialMapCopy>
                      <SpatialMapEmptyState>
                        {result().acceptedNodeCount} nodes / {result().acceptedLinkCount} links added
                      </SpatialMapEmptyState>
                      <SpatialMapCopy>{result().trimSummary}</SpatialMapCopy>
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
                <SpatialMapRelationName as="span">
                {props.item.label}
                </SpatialMapRelationName>
              </Checkbox.Label>
              <SpatialMapRelationMeta as="span">
                {props.item.type}
              </SpatialMapRelationMeta>
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
