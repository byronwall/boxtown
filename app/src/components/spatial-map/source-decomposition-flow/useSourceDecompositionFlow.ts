import { createSignal, onCleanup } from "solid-js";
import type { ProjectRecord } from "~/lib/projects/types";
import type { SourceDecompositionRunSnapshot } from "~/lib/source-decomposition/types";
import {
  acceptSourceDecompositionRequest,
  loadSourceDecompositionRunRequest,
  startSourceDecompositionRunRequest,
  subscribeSourceDecompositionRun,
} from "./sourceDecomposition.api";

interface UseSourceDecompositionFlowOptions {
  projectId: string;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

function isTerminal(snapshot: SourceDecompositionRunSnapshot) {
  return snapshot.status === "completed" || snapshot.status === "failed";
}

export function useSourceDecompositionFlow(options: UseSourceDecompositionFlowOptions) {
  const [snapshot, setSnapshot] = createSignal<SourceDecompositionRunSnapshot | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [starting, setStarting] = createSignal(false);
  const [accepting, setAccepting] = createSignal(false);
  const [selectedNodeIds, setSelectedNodeIds] = createSignal<string[]>([]);
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

  function applySnapshot(nextSnapshot: SourceDecompositionRunSnapshot) {
    setSnapshot(nextSnapshot);

    if (nextSnapshot.status === "awaiting-review" && nextSnapshot.candidateBatch) {
      setSelectedNodeIds((current) =>
        current.length > 0 ? current : nextSnapshot.candidateBatch!.nodes.map((node) => node.id),
      );
    }

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
        applySnapshot(await loadSourceDecompositionRunRequest(options.projectId, runId));
      } catch (pollError) {
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Failed to refresh the source decomposition flow.",
        );
        stopLiveUpdates();
      }
    };

    void poll();
    pollingTimer = window.setInterval(() => void poll(), 1000);
  }

  function startStream(runId: string) {
    unsubscribe = subscribeSourceDecompositionRun(options.projectId, runId, {
      onSnapshot: applySnapshot,
      onError: () => {
        unsubscribe?.();
        unsubscribe = null;
        startPolling(runId);
      },
    });
  }

  async function startRun(input: {
    sourceText: string;
    selectedNodeId: string | null;
    images: File[];
  }) {
    stopLiveUpdates();
    setStarting(true);
    setError(null);
    setSelectedNodeIds([]);

    try {
      const formData = new FormData();
      formData.set("sourceText", input.sourceText);
      if (input.selectedNodeId) {
        formData.set("selectedNodeId", input.selectedNodeId);
      }
      for (const image of input.images) {
        formData.append("images", image);
      }

      const started = await startSourceDecompositionRunRequest(options.projectId, formData);
      applySnapshot(started.snapshot);
      startStream(started.runId);
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Failed to start source decomposition.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function acceptSelection() {
    const activeSnapshot = snapshot();
    if (!activeSnapshot) return;

    setAccepting(true);
    setError(null);
    try {
      unsubscribe?.();
      unsubscribe = null;
      stopPolling();
      const nextSnapshot = await acceptSourceDecompositionRequest(
        options.projectId,
        activeSnapshot.runId,
        { acceptedNodeIds: selectedNodeIds() },
      );
      applySnapshot(nextSnapshot);
      if (!isTerminal(nextSnapshot)) {
        startStream(nextSnapshot.runId);
      }
    } catch (acceptError) {
      setError(
        acceptError instanceof Error
          ? acceptError.message
          : "Failed to accept source decomposition suggestions.",
      );
    } finally {
      setAccepting(false);
    }
  }

  function setSelection(nextNodeIds: string[]) {
    setSelectedNodeIds([...new Set(nextNodeIds)]);
  }

  function reset() {
    stopLiveUpdates();
    setSnapshot(null);
    setError(null);
    setSelectedNodeIds([]);
  }

  onCleanup(() => stopLiveUpdates());

  return {
    snapshot,
    error,
    starting,
    accepting,
    selectedNodeIds,
    startRun,
    acceptSelection,
    setSelection,
    reset,
  };
}
