import { Show, createSignal, onCleanup } from "solid-js";
import { BotIcon, CheckIcon } from "lucide-solid";
import { IconButton } from "~/components/ui/icon-button";
import { toaster } from "~/components/ui/toast";
import { Tooltip } from "~/components/ui/tooltip";
import { buildNodeAgentPrompt } from "~/lib/projects/agent-prompt";
import type { ProjectRecord } from "~/lib/projects/types";

const COPIED_RESET_MS = 1600;

export function SpatialMapCopyAgentPromptButton(props: {
  project: ProjectRecord;
  nodeId: string;
}) {
  const [copied, setCopied] = createSignal(false);
  let resetTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(resetTimer));

  const copyPrompt = async () => {
    const nodeUrl = new URL(window.location.href);
    nodeUrl.search = "";
    nodeUrl.hash = "";
    nodeUrl.searchParams.set("node", props.nodeId);

    const prompt = buildNodeAgentPrompt({
      projectId: props.project.id,
      nodeId: props.nodeId,
      data: props.project.spatialMap,
      metadataSchema: props.project.nodeMetadataSchema,
      nodeUrl: nodeUrl.toString(),
    });

    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      clearTimeout(resetTimer);
      resetTimer = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    } catch (error) {
      toaster.error({
        title: "Prompt was not copied",
        description: error instanceof Error ? error.message : "Clipboard access was denied.",
      });
    }
  };

  return (
    <Tooltip content={copied() ? "Copied agent prompt" : "Copy agent prompt"} openDelay={150} closeDelay={80}>
    <IconButton
      variant="plain"
      size="xs"
      w="24px"
      minW="24px"
      h="24px"
      p="0"
      color="var(--spatial-map-copy-dim)"
      aria-label="Copy agent prompt"
      onClick={() => void copyPrompt()}
    >
      <Show when={copied()} fallback={<BotIcon size={15} />}>
        <CheckIcon size={15} />
      </Show>
    </IconButton>
    </Tooltip>
  );
}
