import { createEffect, createSignal, onCleanup } from "solid-js";
import type { ContextNoteConversionRunSnapshot } from "~/lib/context-note-conversion/types";
import type { ProjectRecord } from "~/lib/projects/types";
import {
  acceptContextNoteConversionRequest,
  loadContextNoteConversionRunRequest,
  startContextNoteConversionRunRequest,
  submitContextNoteConversionAnswersRequest,
  subscribeContextNoteConversionRun,
} from "./contextNoteConversion.api";

interface UseContextNoteConversionFlowOptions {
  projectId: string;
  onProjectUpdated?: (project: ProjectRecord) => void;
}

function isTerminal(snapshot: ContextNoteConversionRunSnapshot) {
  return snapshot.status === "completed" || snapshot.status === "failed";
}

export function useContextNoteConversionFlow(options: UseContextNoteConversionFlowOptions) {
  const [snapshot, setSnapshot] = createSignal<ContextNoteConversionRunSnapshot | null>(null);
  const [error, setError] = createSignal<string | null>(null);
  const [starting, setStarting] = createSignal(false);
  const [submittingAnswers, setSubmittingAnswers] = createSignal(false);
  const [accepting, setAccepting] = createSignal(false);
  const [answerDraft, setAnswerDraft] = createSignal<Record<string, string>>({});
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

  function applySnapshot(nextSnapshot: ContextNoteConversionRunSnapshot) {
    setSnapshot(nextSnapshot);
    setAnswerDraft(nextSnapshot.answers);

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
        applySnapshot(await loadContextNoteConversionRunRequest(options.projectId, runId));
      } catch (pollError) {
        setError(
          pollError instanceof Error
            ? pollError.message
            : "Failed to refresh the note conversion flow.",
        );
        stopLiveUpdates();
      }
    };

    void poll();
    pollingTimer = window.setInterval(() => void poll(), 1000);
  }

  function startStream(runId: string) {
    unsubscribe = subscribeContextNoteConversionRun(options.projectId, runId, {
      onSnapshot: applySnapshot,
      onError: () => {
        unsubscribe?.();
        unsubscribe = null;
        startPolling(runId);
      },
    });
  }

  async function startRun(sourceNodeId: string) {
    stopLiveUpdates();
    setStarting(true);
    setError(null);
    setAnswerDraft({});
    setSelectedNodeIds([]);

    try {
      const started = await startContextNoteConversionRunRequest(options.projectId, { sourceNodeId });
      applySnapshot(started.snapshot);
      startStream(started.runId);
    } catch (startError) {
      setError(
        startError instanceof Error ? startError.message : "Failed to start note conversion.",
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
      const nextSnapshot = await submitContextNoteConversionAnswersRequest(
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
          : "Failed to submit note conversion answers.",
      );
    } finally {
      setSubmittingAnswers(false);
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
      const nextSnapshot = await acceptContextNoteConversionRequest(
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
          : "Failed to accept note conversion suggestions.",
      );
    } finally {
      setAccepting(false);
    }
  }

  function chooseAnswer(questionId: string, optionId: string) {
    setAnswerDraft((current) => ({
      ...current,
      [questionId]: optionId,
    }));
  }

  function setSelection(nextNodeIds: string[]) {
    setSelectedNodeIds([...new Set(nextNodeIds)]);
  }

  function reset() {
    stopLiveUpdates();
    setSnapshot(null);
    setError(null);
    setAnswerDraft({});
    setSelectedNodeIds([]);
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
    snapshot,
    error,
    starting,
    submittingAnswers,
    accepting,
    answerDraft,
    selectedNodeIds,
    startRun,
    submitAnswers,
    acceptSelection,
    chooseAnswer,
    setSelection,
    reset,
  };
}
