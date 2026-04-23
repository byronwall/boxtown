import { createSignal, onCleanup } from "solid-js";
import type { NodeImageGenerationRunSnapshot } from "~/lib/node-images/types";
import type { ProjectRecord } from "~/lib/projects/types";
import {
  loadNodeImageGenerationRunRequest,
  startNodeImageGenerationRequest,
  subscribeNodeImageGenerationRun,
} from "./node-image-generation.api";

interface UseNodeImageGenerationFlowOptions {
  projectId: string;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

function isTerminal(snapshot: NodeImageGenerationRunSnapshot) {
  return snapshot.status === "completed" || snapshot.status === "failed";
}

export function useNodeImageGenerationFlow(options: UseNodeImageGenerationFlowOptions) {
  const [snapshot, setSnapshot] = createSignal<NodeImageGenerationRunSnapshot | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [starting, setStarting] = createSignal(false);
  let unsubscribe: (() => void) | null = null;
  let pollingTimer: number | null = null;

  function stopPolling() {
    if (pollingTimer !== null) {
      window.clearInterval(pollingTimer);
      pollingTimer = null;
    }
  }

  function stopLiveUpdates() {
    unsubscribe?.();
    unsubscribe = null;
    stopPolling();
  }

  function applySnapshot(nextSnapshot: NodeImageGenerationRunSnapshot) {
    setSnapshot(nextSnapshot);

    if (nextSnapshot.status === "completed" && nextSnapshot.result?.project) {
      options.onProjectUpdated?.(nextSnapshot.result.project);
    }

    if (isTerminal(nextSnapshot)) {
      stopLiveUpdates();
    }
  }

  function startPolling(runId: string) {
    if (pollingTimer !== null) return;

    const poll = async () => {
      try {
        applySnapshot(await loadNodeImageGenerationRunRequest(options.projectId, runId));
      } catch (pollError) {
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Failed to refresh node image generation progress.",
        );
        stopLiveUpdates();
      }
    };

    void poll();
    pollingTimer = window.setInterval(() => void poll(), 1000);
  }

  function startStream(runId: string) {
    unsubscribe = subscribeNodeImageGenerationRun(options.projectId, runId, {
      onSnapshot: applySnapshot,
      onError: () => {
        unsubscribe?.();
        unsubscribe = null;
        startPolling(runId);
      },
    });
  }

  async function startRun(input: { nodeId: string }) {
    if (starting() || (snapshot() && !isTerminal(snapshot()!))) {
      return;
    }

    stopLiveUpdates();
    setStarting(true);
    setError(null);

    try {
      const started = await startNodeImageGenerationRequest(options.projectId, input);
      applySnapshot(started.snapshot);
      startStream(started.runId);
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Failed to start node image generation.",
      );
    } finally {
      setStarting(false);
    }
  }

  function reset() {
    stopLiveUpdates();
    setSnapshot(null);
    setError(null);
  }

  onCleanup(() => stopLiveUpdates());

  return {
    snapshot,
    error,
    starting,
    startRun,
    reset,
  };
}
