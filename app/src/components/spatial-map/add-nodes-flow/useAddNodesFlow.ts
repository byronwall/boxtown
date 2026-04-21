import { createEffect, createSignal, onCleanup } from "solid-js";
import type { AddNodesRunSnapshot } from "~/lib/add-nodes/types";
import type { ProjectRecord } from "~/lib/projects/types";
import {
  loadAddNodesRunRequest,
  startAddNodesRunRequest,
  submitAddNodesAnswersRequest,
  subscribeAddNodesRun,
} from "./addNodesFlow.api";

interface UseAddNodesFlowOptions {
  projectId: string;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

function isTerminal(snapshot: AddNodesRunSnapshot) {
  return snapshot.status === "completed" || snapshot.status === "failed";
}

export function useAddNodesFlow(options: UseAddNodesFlowOptions) {
  const [brief, setBrief] = createSignal("");
  const [snapshot, setSnapshot] = createSignal<AddNodesRunSnapshot | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [starting, setStarting] = createSignal(false);
  const [submittingAnswers, setSubmittingAnswers] = createSignal(false);
  const [answerDraft, setAnswerDraft] = createSignal<Record<string, string>>({});
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

  function applySnapshot(nextSnapshot: AddNodesRunSnapshot) {
    setSnapshot(nextSnapshot);
    setAnswerDraft(nextSnapshot.answers);

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
        applySnapshot(await loadAddNodesRunRequest(options.projectId, runId));
      } catch (pollError) {
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Failed to refresh the add-nodes flow.",
        );
        stopLiveUpdates();
      }
    };

    void poll();
    pollingTimer = window.setInterval(() => void poll(), 1000);
  }

  function startStream(runId: string) {
    unsubscribe = subscribeAddNodesRun(options.projectId, runId, {
      onSnapshot: applySnapshot,
      onError: () => {
        unsubscribe?.();
        unsubscribe = null;
        startPolling(runId);
      },
    });
  }

  async function startRun(input?: { brief?: string; selectedNodeId?: string | null }) {
    const activeBrief = (input?.brief ?? brief()).trim();
    if (!activeBrief) {
      setError("Enter a short brief before generating clarification questions.");
      return;
    }

    stopLiveUpdates();
    setStarting(true);
    setError(null);
    setAnswerDraft({});
    try {
      const started = await startAddNodesRunRequest(options.projectId, {
        brief: activeBrief,
        selectedNodeId: input?.selectedNodeId ?? null,
      });
      setBrief(activeBrief);
      applySnapshot(started.snapshot);
      startStream(started.runId);
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Failed to start the add-nodes flow.",
      );
    } finally {
      setStarting(false);
    }
  }

  async function submitAnswers() {
    const activeSnapshot = snapshot();
    if (!activeSnapshot) return;

    setSubmittingAnswers(true);
    setError(null);
    try {
      unsubscribe?.();
      unsubscribe = null;
      stopPolling();
      const nextSnapshot = await submitAddNodesAnswersRequest(
        options.projectId,
        activeSnapshot.runId,
        { answers: answerDraft() },
      );
      applySnapshot(nextSnapshot);
      if (!isTerminal(nextSnapshot)) {
        startStream(nextSnapshot.runId);
      }
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to submit add-nodes answers.",
      );
    } finally {
      setSubmittingAnswers(false);
    }
  }

  function chooseAnswer(questionId: string, optionId: string) {
    setAnswerDraft((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  }

  function reset() {
    stopLiveUpdates();
    setSnapshot(null);
    setError(null);
    setAnswerDraft({});
  }

  createEffect(() => {
    const activeSnapshot = snapshot();
    if (!activeSnapshot || activeSnapshot.questions.length === 0) {
      return;
    }

    setAnswerDraft((current) => {
      if (Object.keys(current).length > 0) {
        return current;
      }

      const nextDraft: Record<string, string> = {};
      for (const question of activeSnapshot.questions) {
        if (activeSnapshot.answers[question.id]) {
          nextDraft[question.id] = activeSnapshot.answers[question.id]!;
        }
      }
      return nextDraft;
    });
  });

  onCleanup(() => stopLiveUpdates());

  return {
    brief,
    setBrief,
    snapshot,
    error,
    starting,
    submittingAnswers,
    answerDraft,
    startRun,
    submitAnswers,
    chooseAnswer,
    reset,
  };
}
