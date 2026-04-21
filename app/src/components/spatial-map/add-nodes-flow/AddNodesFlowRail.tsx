import { For, Show, createMemo, untrack } from "solid-js";
import { Box, Grid, HStack, VStack } from "styled-system/jsx";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Textarea } from "~/components/ui/textarea";
import { Tooltip } from "~/components/ui/tooltip";
import type { ProjectRecord } from "~/lib/projects/types";
import { useSpatialMap } from "~/components/spatial-map/SpatialMapContext";
import { useAddNodesFlow } from "./useAddNodesFlow";

interface AddNodesFlowRailProps {
  project: ProjectRecord;
  onProjectUpdated?: (project: ProjectRecord) => void;
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
    <Box class="spatial-map-inspector-rail">
      <button
        type="button"
        class="spatial-map-inspector-toggle"
        onClick={closeRail}
        aria-label="Close add nodes panel"
      >
        ×
      </button>

      <aside id="spatial-map-add-nodes" class="spatial-map-inspector spatial-map-add-nodes-rail">
        <VStack alignItems="stretch" gap="3" h="full">
          <VStack alignItems="start" gap="1" class="spatial-map-inspector-header">
            <Text as="span" textStyle="xs" class="spatial-map-kicker">
              Add Nodes
            </Text>
            <Box class="spatial-map-inspector-header-copy">
              <Box as="h2" class="spatial-map-inspector-title">
                Expand project graph
              </Box>
              <Text as="p" class="spatial-map-inspector-copy">
                Start with a short brief, answer the generated questions, and persist a new node cluster
                directly into this project.
              </Text>
            </Box>
          </VStack>

          <Box class="spatial-map-inspector-section">
            <InspectorRow label="Project" value={props.project.name} />
            <InspectorRow label="Selection" value={selectedNode()?.label ?? "No node selected"} />
            <InspectorRow
              label="Status"
              value={flow.snapshot()?.status ?? "idle"}
              mono
            />
          </Box>

          <Box class="spatial-map-inspector-section">
            <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
              Brief
            </Text>
            <Textarea
              rows={4}
              value={flow.brief()}
              onInput={(event) => flow.setBrief(event.currentTarget.value)}
              class="spatial-map-add-nodes-textarea"
              placeholder="Add a billing setup flow with plan selection, invoice history, and admin handoff nodes."
            />
            <HStack gap="2" justifyContent="space-between" flexWrap="wrap">
              <Text as="span" class="spatial-map-empty-state">
                Tailored questions use the brief, graph content, and current selection.
              </Text>
              <Button
                size="xs"
                class="spatial-map-button spatial-map-button--strong"
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
                        loadingText="Generating"
                        disabled={!canSubmitAnswers()}
                        onClick={() => void flow.submitAnswers()}
                      >
                        Add Nodes
                      </Button>
                    </HStack>
                  </Box>
                </Show>

                <Show when={snapshot().result}>
                  {(result) => (
                    <Box class="spatial-map-inspector-section">
                      <Text as="h3" margin="0" fontSize="sm" fontWeight="semibold" class="spatial-map-inspector-block-title">
                        Suggested follow-up items
                      </Text>
                      <Text as="p" class="spatial-map-inspector-copy">
                        {result().summary}
                      </Text>
                      <HStack gap="2" flexWrap="wrap">
                        <Text as="span" class="spatial-map-empty-state">
                          {result().nodeCount} nodes / {result().linkCount} links added
                        </Text>
                      </HStack>
                      <VStack alignItems="stretch" gap="2">
                        <For each={result().suggestions}>
                          {(suggestion) => (
                            <button
                              type="button"
                              class="spatial-map-follow-up-card"
                              onClick={() => {
                                flow.setBrief(suggestion.brief);
                                void flow.startRun({
                                  brief: suggestion.brief,
                                  selectedNodeId: selectedNode()?.id ?? null,
                                });
                              }}
                            >
                              <Text as="div" class="spatial-map-relation-name">
                                {suggestion.label}
                              </Text>
                              <Text as="div" class="spatial-map-relation-meta">
                                {suggestion.guidance}
                              </Text>
                            </button>
                          )}
                        </For>
                      </VStack>
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
