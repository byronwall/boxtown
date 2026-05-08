import { For, Show, createMemo, untrack } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip } from "~/components/ui/tooltip";
import type { ProjectRecord } from "~/lib/projects/types";
import { SpatialMapInspectorHeader } from "~/components/spatial-map/SpatialMapInspectorHeader";
import { useSpatialMap } from "~/components/spatial-map/SpatialMapContext";
import {
  SpatialMapAnswerGrid,
  SpatialMapBlockTitle,
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
import { useAddNodesFlow } from "./useAddNodesFlow";

interface AddNodesFlowRailProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
}

export function AddNodesFlowRail(props: AddNodesFlowRailProps) {
  const spatialMap = useSpatialMap();
  const flow = useAddNodesFlow({
    projectId: untrack(() => props.project.id),
    onProjectUpdated: untrack(() => props.onProjectUpdated),
  });
  const selectedNode = createMemo(() => spatialMap.selectedNode());
  const canSubmitAnswers = createMemo(() => {
    const snapshot = flow.snapshot();
    if (!snapshot || snapshot.status !== "awaiting-input") {
      return false;
    }

    return snapshot.questions.every((question) => Boolean(flow.answerDraft()[question.id]));
  });

  const closeRail = () => {
    flow.reset();
    spatialMap.closeAddNodesFlow();
  };

  return (
    <SpatialMapFlowRail id="spatial-map-add-nodes">
        <VStack alignItems="stretch" gap="3" h="full">
          <SpatialMapInspectorHeader
            kicker="Add Nodes"
            title="Expand project graph"
            description="Start with a short brief, answer the generated questions, and persist a new node cluster directly into this project."
            controls="spatial-map-add-nodes"
            closeLabel="Close add nodes panel"
            onClose={closeRail}
          />

          <SpatialMapInspectorSection>
            <SpatialMapInspectorRow label="Project" value={props.project.name} />
            <SpatialMapInspectorRow label="Selection" value={selectedNode()?.label ?? "No node selected"} />
            <SpatialMapInspectorRow
              label="Status"
              value={flow.snapshot()?.status ?? "idle"}
              mono
            />
          </SpatialMapInspectorSection>

          <SpatialMapInspectorSection>
            <SpatialMapBlockTitle>Brief</SpatialMapBlockTitle>
            <Textarea
              rows={4}
              variant="spatial"
              size="sm"
              autoResize={false}
              minH="112px"
              resize="vertical"
              value={flow.brief()}
              onInput={(event) => flow.setBrief(event.currentTarget.value)}
              placeholder="Add a billing setup flow with plan selection, invoice history, and admin handoff nodes."
            />
            <HStack gap="2" justifyContent="space-between" flexWrap="wrap">
              <SpatialMapEmptyState as="span">
                Tailored questions use the brief, graph content, and current selection.
              </SpatialMapEmptyState>
              <Button
                size="xs"
                colorPalette="green"
                variant="surface"
                loading={flow.starting()}
                loadingText="Preparing"
                onClick={() =>
                  void flow.startRun({
                    brief: flow.brief(),
                    selectedNodeId: selectedNode()?.id ?? null,
                  })
                }
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
                        loadingText="Generating"
                        disabled={!canSubmitAnswers()}
                        onClick={() => void flow.submitAnswers()}
                      >
                        Add Nodes
                      </Button>
                    </HStack>
                  </SpatialMapInspectorSection>
                </Show>

                <Show when={snapshot().result}>
                  {(result) => (
                    <SpatialMapInspectorSection>
                      <SpatialMapBlockTitle>Suggested follow-up items</SpatialMapBlockTitle>
                      <SpatialMapCopy>{result().summary}</SpatialMapCopy>
                      <HStack gap="2" flexWrap="wrap">
                        <SpatialMapEmptyState as="span">
                          {result().nodeCount} nodes / {result().linkCount} links added
                        </SpatialMapEmptyState>
                      </HStack>
                      <VStack alignItems="stretch" gap="2">
                        <For each={result().suggestions}>
                          {(suggestion) => (
                            <SpatialMapOptionButton
                              onClick={() => {
                                flow.setBrief(suggestion.brief);
                                void flow.startRun({
                                  brief: suggestion.brief,
                                  selectedNodeId: selectedNode()?.id ?? null,
                                });
                              }}
                            >
                              <SpatialMapRelationName>{suggestion.label}</SpatialMapRelationName>
                              <SpatialMapRelationMeta>{suggestion.guidance}</SpatialMapRelationMeta>
                            </SpatialMapOptionButton>
                          )}
                        </For>
                      </VStack>
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
