import { For, Show, createEffect, createMemo, untrack } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { WandSparklesIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Text } from "~/components/ui/text";
import { Tooltip } from "~/components/ui/tooltip";
import { toaster } from "~/components/ui/toast";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode } from "~/lib/spatial-map/types";
import { useNodeImageGenerationFlow } from "./useNodeImageGenerationFlow";

interface SpatialMapGenerateImageControlProps {
  projectId: string;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord) => void;
  compact?: boolean;
}

export function SpatialMapGenerateImageControl(
  props: SpatialMapGenerateImageControlProps,
) {
  const flow = useNodeImageGenerationFlow({
    projectId: untrack(() => props.projectId),
    onProjectUpdated: untrack(() => props.onProjectUpdated),
  });
  const isRunning = createMemo(() => {
    const snapshot = flow.snapshot();
    return flow.starting() || Boolean(snapshot && snapshot.status !== "completed" && snapshot.status !== "failed");
  });
  let toastedRunId: string | null = null;

  createEffect(() => {
    const snapshot = flow.snapshot();
    if (!snapshot?.result || toastedRunId === snapshot.runId) {
      return;
    }

    toastedRunId = snapshot.runId;
    toaster.success({
      title: "Mockup image generated",
      description: `${props.node.label} now has a generated UI image attached.`,
    });
  });

  return (
    <VStack alignItems="stretch" gap="2" width={props.compact ? "auto" : "100%"}>
      <Show
        when={props.compact}
        fallback={
          <HStack gap="2" justifyContent="flex-end">
            <Button
              size="xs"
              variant="surface"
              loading={isRunning()}
              loadingText="Generating"
              disabled={isRunning()}
              onClick={() => void flow.startRun({ nodeId: props.node.id })}
            >
              Generate Mockup
            </Button>
          </HStack>
        }
      >
        <Tooltip content="Generate mockup" openDelay={150} closeDelay={80}>
          <Button
            size="xs"
            variant="surface" px="0"
            loading={isRunning()}
            disabled={isRunning()}
            onClick={() => void flow.startRun({ nodeId: props.node.id })}
            aria-label="Generate mockup"
          >
            <Box as={WandSparklesIcon} boxSize="4" />
          </Button>
        </Tooltip>
      </Show>

      <Show when={flow.snapshot()}>
        {(snapshot) => (
          <Box class="spatial-map-node-image-progress">
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
        )}
      </Show>

      <Show when={flow.error()}>
        {(error) => (
          <Box class="spatial-map-node-image-progress spatial-map-add-nodes-error">
            <Text as="p" class="spatial-map-inspector-copy">
              {error()}
            </Text>
          </Box>
        )}
      </Show>
    </VStack>
  );
}
