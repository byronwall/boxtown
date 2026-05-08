import { For, Show, createEffect, createMemo, untrack } from "solid-js";
import { Box, HStack, VStack } from "styled-system/jsx";
import { WandSparklesIcon } from "lucide-solid";
import { Button } from "~/components/ui/button";
import { Tooltip } from "~/components/ui/tooltip";
import { toaster } from "~/components/ui/toast";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode } from "~/lib/spatial-map/types";
import { SpatialMapCopy, SpatialMapRunStep } from "./SpatialMapPanelPrimitives";
import { useNodeImageGenerationFlow } from "./useNodeImageGenerationFlow";

interface SpatialMapGenerateImageControlProps {
  projectId: string;
  node: MapNode;
  onProjectUpdated?: (project: ProjectRecord, options?: import("~/lib/projects/optimistic").ProjectUpdateOptions) => void;
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
          <Box display="grid" gap="7px">
            <SpatialMapCopy>{snapshot().latestMessage}</SpatialMapCopy>
            <VStack alignItems="stretch" gap="1.5">
              <For each={snapshot().steps}>
                {(step) => (
                  <SpatialMapRunStep status={step.status} label={step.label} detail={step.detail} />
                )}
              </For>
            </VStack>
          </Box>
        )}
      </Show>

      <Show when={flow.error()}>
        {(error) => (
          <Box display="grid" gap="7px" p="7px 8px" border="1px solid rgba(126, 41, 41, 0.28)" background="rgba(246, 235, 235, 0.82)">
            <SpatialMapCopy>{error()}</SpatialMapCopy>
          </Box>
        )}
      </Show>
    </VStack>
  );
}
