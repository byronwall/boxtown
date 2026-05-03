import { action, query } from "@solidjs/router";
import { getAddNodesRunSnapshot } from "~/lib/add-nodes/run-registry";
import { startAddNodesRun, submitAddNodesRunAnswers } from "~/lib/add-nodes/service";
import type {
  AddNodesRunAnswerRequest,
  AddNodesRunStartRequest,
} from "~/lib/add-nodes/types";
import { getContextNoteConversionRunSnapshot } from "~/lib/context-note-conversion/run-registry";
import {
  acceptContextNoteConversionSelection,
  startContextNoteConversionRun,
  submitContextNoteConversionAnswers,
} from "~/lib/context-note-conversion/service";
import type {
  ContextNoteConversionRunAcceptRequest,
  ContextNoteConversionRunAnswerRequest,
  ContextNoteConversionRunStartRequest,
} from "~/lib/context-note-conversion/types";
import { startNodeImageGenerationRun } from "~/lib/node-images/generation.server";
import { getNodeImageGenerationRunSnapshot } from "~/lib/node-images/run-registry";
import type { NodeImageGenerationStartRequest } from "~/lib/node-images/types";
import {
  acceptSourceDecompositionSelection,
  startSourceDecompositionRun,
} from "~/lib/source-decomposition/service";
import { getSourceDecompositionRunSnapshot } from "~/lib/source-decomposition/run-registry";
import type { SourceDecompositionRunAcceptRequest } from "~/lib/source-decomposition/types";

type RunRef = {
  projectId: string;
  runId: string;
};

export const startAddNodesRunAction = action(
  async (input: { projectId: string; body: AddNodesRunStartRequest }) => {
    "use server";
    return startAddNodesRun({ projectId: input.projectId, input: input.body });
  },
  "start-add-nodes-run",
);

export const submitAddNodesAnswersAction = action(
  async (input: RunRef & { body: AddNodesRunAnswerRequest }) => {
    "use server";
    return submitAddNodesRunAnswers({
      projectId: input.projectId,
      runId: input.runId,
      input: input.body,
    });
  },
  "submit-add-nodes-answers",
);

export const loadAddNodesRun = query(async (input: RunRef) => {
  "use server";
  const snapshot = getAddNodesRunSnapshot(input.runId);
  if (!snapshot || snapshot.projectId !== input.projectId) {
    throw new Error("Run not found.");
  }
  return snapshot;
}, "load-add-nodes-run");

export const startContextNoteConversionRunAction = action(
  async (input: { projectId: string; body: ContextNoteConversionRunStartRequest }) => {
    "use server";
    return startContextNoteConversionRun({ projectId: input.projectId, input: input.body });
  },
  "start-context-note-conversion-run",
);

export const submitContextNoteConversionAnswersAction = action(
  async (input: RunRef & { body: ContextNoteConversionRunAnswerRequest }) => {
    "use server";
    return submitContextNoteConversionAnswers({
      projectId: input.projectId,
      runId: input.runId,
      input: input.body,
    });
  },
  "submit-context-note-conversion-answers",
);

export const acceptContextNoteConversionAction = action(
  async (input: RunRef & { body: ContextNoteConversionRunAcceptRequest }) => {
    "use server";
    return acceptContextNoteConversionSelection({
      projectId: input.projectId,
      runId: input.runId,
      input: input.body,
    });
  },
  "accept-context-note-conversion",
);

export const loadContextNoteConversionRun = query(async (input: RunRef) => {
  "use server";
  const snapshot = getContextNoteConversionRunSnapshot(input.runId);
  if (!snapshot || snapshot.projectId !== input.projectId) {
    throw new Error("Run not found.");
  }
  return snapshot;
}, "load-context-note-conversion-run");

export const startSourceDecompositionRunAction = action(
  async (input: { projectId: string; formData: FormData }) => {
    "use server";
    const sourceText = String(input.formData.get("sourceText") ?? "");
    const selectedNodeId = input.formData.get("selectedNodeId");
    const images = input.formData
      .getAll("images")
      .filter((value): value is File => value instanceof File);

    return startSourceDecompositionRun({
      projectId: input.projectId,
      input: {
        sourceText,
        selectedNodeId: typeof selectedNodeId === "string" && selectedNodeId
          ? selectedNodeId
          : null,
        images,
      },
    });
  },
  "start-source-decomposition-run",
);

export const acceptSourceDecompositionAction = action(
  async (input: RunRef & { body: SourceDecompositionRunAcceptRequest }) => {
    "use server";
    return acceptSourceDecompositionSelection({
      projectId: input.projectId,
      runId: input.runId,
      input: input.body,
    });
  },
  "accept-source-decomposition",
);

export const loadSourceDecompositionRun = query(async (input: RunRef) => {
  "use server";
  const snapshot = getSourceDecompositionRunSnapshot(input.runId);
  if (!snapshot || snapshot.projectId !== input.projectId) {
    throw new Error("Run not found.");
  }
  return snapshot;
}, "load-source-decomposition-run");

export const startNodeImageGenerationAction = action(
  async (input: { projectId: string; body: NodeImageGenerationStartRequest }) => {
    "use server";
    return startNodeImageGenerationRun({ projectId: input.projectId, input: input.body });
  },
  "start-node-image-generation",
);

export const loadNodeImageGenerationRun = query(async (input: RunRef) => {
  "use server";
  const snapshot = getNodeImageGenerationRunSnapshot(input.runId);
  if (!snapshot || snapshot.projectId !== input.projectId) {
    throw new Error("Run not found.");
  }
  return snapshot;
}, "load-node-image-generation-run");
