import { openai } from "@ai-sdk/openai";
import { generateText, Output, type UserContent } from "ai";
import { z } from "zod";
import { buildCandidateTree } from "~/lib/context-note-conversion/tree";
import {
  addProjectNodeImageSourcesOnDisk,
  appendGeneratedNodesToProjectOnDisk,
  readProjectByIdFromDisk,
} from "~/lib/projects/data.server";
import type { MapLink, MapNode } from "~/lib/spatial-map/types";
import { buildSourceDecompositionPrompt } from "./prompts";
import {
  getSourceDecompositionRunSnapshot,
  getSourceDecompositionRunState,
  patchSourceDecompositionRun,
  registerSourceDecompositionRun,
} from "./run-registry";
import type {
  SourceAsset,
  SourceDecompositionCandidateBatch,
  SourceDecompositionRunAcceptRequest,
  SourceDecompositionRunEvent,
  SourceDecompositionRunSnapshot,
  SourceDecompositionRunStartRequest,
  SourceDecompositionRunStep,
  SourceDecompositionRunStepId,
} from "./types";

const sourceDecompositionLinkSchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  parentChild: z.boolean(),
  relationship: z.enum(["related", "dependency", "reuse"]).optional(),
});

const sourceDecompositionBatchSchema = z.object({
  summary: z.string().min(1),
  styleCommentary: z.string().min(1),
  nodes: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      type: z.string().min(1),
      depth: z.number().int().min(0),
      purpose: z.string().min(1),
      implementation: z.string().min(1),
      context: z.string().default(""),
      rawContext: z.string().default(""),
      contextMode: z.literal("structured").default("structured"),
      sourceAssetIds: z.array(z.string().min(1)).default([]),
    }),
  ).min(1).max(12),
  links: z.array(sourceDecompositionLinkSchema),
});

const stepOrder: SourceDecompositionRunStepId[] = [
  "capture-source",
  "decompose-source",
  "await-selection",
  "persist-graph",
  "attach-sources",
  "complete",
];

const stepLabels: Record<SourceDecompositionRunStepId, string> = {
  "capture-source": "Capture source",
  "decompose-source": "Decompose source",
  "await-selection": "Await selection",
  "persist-graph": "Persist graph",
  "attach-sources": "Attach sources",
  complete: "Complete",
};

function getHeavyModel() {
  return process.env.OPENAI_HEAVY_MODEL ?? process.env.OPENAI_MODEL ?? "gpt-5.4";
}

function assertOpenAiKey() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
}

function nowIso() {
  return new Date().toISOString();
}

function createInitialSteps(): SourceDecompositionRunStep[] {
  return stepOrder.map((id) => ({
    id,
    label: stepLabels[id],
    status: "pending",
    detail:
      id === "await-selection"
        ? "Waiting for candidate selection."
        : `${stepLabels[id]} has not started.`,
  }));
}

function createInitialSnapshot(args: {
  runId: string;
  projectId: string;
  sourceText: string;
  sourceAssets: SourceAsset[];
  selectedNodeId: string | null;
}): SourceDecompositionRunSnapshot {
  return {
    runId: args.runId,
    projectId: args.projectId,
    status: "queued",
    steps: createInitialSteps(),
    currentStepId: "capture-source",
    latestMessage: "Initializing source decomposition.",
    sourceText: args.sourceText,
    sourceAssets: args.sourceAssets.map(({ id, originalName, mimeType, size }) => ({
      id,
      originalName,
      mimeType,
      size,
    })),
    selectedNodeId: args.selectedNodeId,
    startedAt: nowIso(),
    elapsedMs: 0,
    acceptedNodeIds: [],
  };
}

function touchSnapshot(snapshot: SourceDecompositionRunSnapshot) {
  snapshot.elapsedMs = Math.max(0, Date.now() - Date.parse(snapshot.startedAt));
}

function activateStep(
  snapshot: SourceDecompositionRunSnapshot,
  stepId: SourceDecompositionRunStepId,
  detail: string,
) {
  touchSnapshot(snapshot);
  snapshot.status = stepId === "await-selection" ? "awaiting-review" : "running";
  snapshot.currentStepId = stepId;
  snapshot.latestMessage = detail;

  for (const step of snapshot.steps) {
    if (step.id === stepId) {
      step.status = "active";
      step.detail = detail;
      step.startedAt ??= nowIso();
    }
  }
}

function completeStep(
  snapshot: SourceDecompositionRunSnapshot,
  stepId: SourceDecompositionRunStepId,
  detail: string,
) {
  touchSnapshot(snapshot);
  const step = snapshot.steps.find((entry) => entry.id === stepId);
  if (!step) return;
  step.status = "completed";
  step.detail = detail;
  step.startedAt ??= nowIso();
  step.completedAt = nowIso();
  snapshot.latestMessage = detail;
}

function failSnapshot(snapshot: SourceDecompositionRunSnapshot, message: string) {
  touchSnapshot(snapshot);
  snapshot.status = "failed";
  snapshot.error = message;
  snapshot.latestMessage = message;
  snapshot.completedAt = nowIso();
  const step = snapshot.currentStepId
    ? snapshot.steps.find((entry) => entry.id === snapshot.currentStepId)
    : null;
  if (step) {
    step.status = "failed";
    step.detail = message;
    step.startedAt ??= nowIso();
    step.completedAt = nowIso();
  }
}

function completeSnapshot(snapshot: SourceDecompositionRunSnapshot, message: string) {
  touchSnapshot(snapshot);
  snapshot.status = "completed";
  snapshot.currentStepId = "complete";
  snapshot.latestMessage = message;
  snapshot.completedAt = nowIso();
  completeStep(snapshot, "complete", message);
}

function sanitizeCandidateNodes(nodes: MapNode[]) {
  return nodes.map((node) => ({
    ...node,
    context: node.context ?? "",
    rawContext: node.rawContext ?? node.context ?? "",
    contextMode: "structured" as const,
  }));
}

function sanitizeCandidateLinks(links: z.infer<typeof sourceDecompositionLinkSchema>[]): MapLink[] {
  return links.map((link) =>
    link.parentChild
      ? {
          source: link.source,
          target: link.target,
          parentChild: true,
        }
      : {
          source: link.source,
          target: link.target,
          parentChild: false,
          relationship: link.relationship ?? "related",
        },
  );
}

function createCandidateBatch(
  summary: string,
  styleCommentary: string,
  nodes: MapNode[],
  links: MapLink[],
  sourceAssetIdsByNodeId: Record<string, string[]>,
): SourceDecompositionCandidateBatch {
  const sanitizedNodes = sanitizeCandidateNodes(nodes);
  const sanitizedLinks = links;
  return {
    summary,
    styleCommentary,
    sourceAssetIdsByNodeId,
    nodes: sanitizedNodes,
    links: sanitizedLinks,
    tree: buildCandidateTree(sanitizedNodes, sanitizedLinks),
  };
}

function filterAcceptedBatch(batch: SourceDecompositionCandidateBatch, acceptedNodeIds: string[]) {
  const acceptedSet = new Set(acceptedNodeIds);
  const nodes = batch.nodes.filter((node) => acceptedSet.has(node.id));
  const links = batch.links.filter((link) => {
    const sourceAccepted = acceptedSet.has(link.source);
    const targetAccepted = acceptedSet.has(link.target);
    return (sourceAccepted && targetAccepted) || (sourceAccepted && !batch.tree.items[link.target]) || (!batch.tree.items[link.source] && targetAccepted);
  });

  return {
    summary: batch.summary,
    styleCommentary: batch.styleCommentary,
    sourceAssetIdsByNodeId: Object.fromEntries(
      nodes.map((node) => [node.id, batch.sourceAssetIdsByNodeId[node.id] ?? []]),
    ),
    nodes,
    links,
    tree: buildCandidateTree(nodes, links),
  };
}

async function runStructuredPrompt(args: {
  prompt: string;
  sourceAssets: SourceAsset[];
}) {
  assertOpenAiKey();
  const content: UserContent = [
    { type: "text", text: args.prompt },
    ...args.sourceAssets.map((asset) => ({
      type: "image" as const,
      image: asset.data,
      mediaType: asset.mimeType,
    })),
  ];
  const result = await generateText({
    model: openai(getHeavyModel()),
    messages: [{ role: "user", content }],
    maxRetries: 1,
    experimental_output: Output.object({ schema: sourceDecompositionBatchSchema }),
    providerOptions: { openai: { reasoningEffort: "medium" } },
  });

  return result.experimental_output;
}

async function createSourceAssets(files: File[]) {
  const imageFiles = files.filter((file) => file.size > 0 && file.type.startsWith("image/"));
  return Promise.all(
    imageFiles.map(async (file) => ({
      id: crypto.randomUUID(),
      originalName: file.name || "source-image",
      mimeType: file.type,
      size: file.size,
      data: Buffer.from(await file.arrayBuffer()),
    })),
  );
}

export async function startSourceDecompositionRun(args: {
  projectId: string;
  input: SourceDecompositionRunStartRequest;
}) {
  const project = await readProjectByIdFromDisk(args.projectId);
  if (!project) {
    throw new Error("Project not found.");
  }

  const sourceText = args.input.sourceText.trim();
  const sourceAssets = await createSourceAssets(args.input.images);
  if (!sourceText && sourceAssets.length === 0) {
    throw new Error("Add at least one source image or source note.");
  }

  const selectedNode = args.input.selectedNodeId
    ? project.spatialMap.nodes.find((node) => node.id === args.input.selectedNodeId) ?? null
    : null;
  const runId = `source-decomposition-${crypto.randomUUID()}`;
  const snapshot = createInitialSnapshot({
    runId,
    projectId: project.id,
    sourceText,
    sourceAssets,
    selectedNodeId: selectedNode?.id ?? null,
  });

  registerSourceDecompositionRun(snapshot, {
    project,
    selectedNode,
    sourceAssets,
  });

  void runDecompositionPhase(runId);

  return { runId, snapshot };
}

async function runDecompositionPhase(runId: string) {
  try {
    patchSourceDecompositionRun(runId, (run) => {
      activateStep(run.snapshot, "capture-source", "Preparing source assets and project context.");
      completeStep(run.snapshot, "capture-source", "Source assets and project context captured.");
      activateStep(run.snapshot, "decompose-source", "Reading visual structure and generating candidate nodes.");
    });

    const state = getSourceDecompositionRunState(runId);
    if (!state) {
      throw new Error("Source decomposition run is no longer available.");
    }

    const generated = await runStructuredPrompt({
      prompt: buildSourceDecompositionPrompt({
        project: state.project,
        selectedNode: state.selectedNode,
        sourceText: getSourceDecompositionRunSnapshot(runId)?.sourceText ?? "",
        sourceAssets: getSourceDecompositionRunSnapshot(runId)?.sourceAssets ?? [],
      }),
      sourceAssets: state.sourceAssets,
    });
    const batch = createCandidateBatch(
      generated.summary,
      generated.styleCommentary,
      generated.nodes,
      sanitizeCandidateLinks(generated.links),
      Object.fromEntries(
        generated.nodes.map((node) => [
          node.id,
          node.sourceAssetIds.length > 0
            ? node.sourceAssetIds
            : state.sourceAssets.map((asset) => asset.id),
        ]),
      ),
    );

    patchSourceDecompositionRun(runId, (run) => {
      run.state.candidateBatch = batch;
      run.snapshot.candidateBatch = batch;
      completeStep(run.snapshot, "decompose-source", `Prepared ${batch.nodes.length} candidate nodes for review.`);
      activateStep(run.snapshot, "await-selection", "Review the generated node list and uncheck anything you do not want to add.");
    });
  } catch (error) {
    patchSourceDecompositionRun(runId, (run) => {
      failSnapshot(
        run.snapshot,
        error instanceof Error ? error.message : "Failed to decompose source material.",
      );
    });
  }
}

export async function acceptSourceDecompositionSelection(args: {
  projectId: string;
  runId: string;
  input: SourceDecompositionRunAcceptRequest;
}) {
  const snapshot = getSourceDecompositionRunSnapshot(args.runId);
  const state = getSourceDecompositionRunState(args.runId);

  if (!snapshot || !state || snapshot.projectId !== args.projectId) {
    throw new Error("Run not found.");
  }
  if (snapshot.status !== "awaiting-review" || !state.candidateBatch) {
    throw new Error("This run is not waiting for candidate selection.");
  }

  const acceptedNodeIds = [...new Set(args.input.acceptedNodeIds)];
  if (acceptedNodeIds.length === 0) {
    throw new Error("Select at least one candidate node to continue.");
  }

  const candidateNodeIds = new Set(state.candidateBatch.nodes.map((node) => node.id));
  for (const nodeId of acceptedNodeIds) {
    if (!candidateNodeIds.has(nodeId)) {
      throw new Error(`Invalid candidate node "${nodeId}".`);
    }
  }

  patchSourceDecompositionRun(args.runId, (run) => {
    run.snapshot.acceptedNodeIds = acceptedNodeIds;
    completeStep(run.snapshot, "await-selection", `Accepted ${acceptedNodeIds.length} candidate nodes for persistence.`);
    activateStep(run.snapshot, "persist-graph", "Writing accepted nodes into the project graph.");
  });

  void runAcceptancePhase(args.runId, acceptedNodeIds);
  return getSourceDecompositionRunSnapshot(args.runId);
}

async function runAcceptancePhase(runId: string, acceptedNodeIds: string[]) {
  try {
    const state = getSourceDecompositionRunState(runId);
    const snapshot = getSourceDecompositionRunSnapshot(runId);
    if (!state || !snapshot || !state.candidateBatch) {
      throw new Error("Source decomposition run is no longer available.");
    }

    const acceptedBatch = filterAcceptedBatch(state.candidateBatch, acceptedNodeIds);
    const beforeProject = await readProjectByIdFromDisk(snapshot.projectId);
    if (!beforeProject) {
      throw new Error("Project not found.");
    }

    const persistedProject = await appendGeneratedNodesToProjectOnDisk({
      projectId: snapshot.projectId,
      generated: {
        summary: acceptedBatch.summary,
        nodes: acceptedBatch.nodes,
        links: acceptedBatch.links,
      },
    });
    const persistedNodeIds = persistedProject.spatialMap.nodes
      .slice(beforeProject.spatialMap.nodes.length)
      .map((node) => node.id);

    patchSourceDecompositionRun(runId, (run) => {
      run.state.project = persistedProject;
      run.state.persistedNodeIds = persistedNodeIds;
      completeStep(run.snapshot, "persist-graph", `Persisted ${persistedNodeIds.length} accepted nodes.`);
      activateStep(run.snapshot, "attach-sources", "Attaching uploaded source images to the accepted nodes.");
    });

    const sourceAssetsById = new Map(state.sourceAssets.map((asset) => [asset.id, asset]));
    let imageAttachedProject = persistedProject;
    let attachedImageCount = 0;
    for (const [index, persistedNodeId] of persistedNodeIds.entries()) {
      const candidateNode = acceptedBatch.nodes[index];
      const sourceAssetIds = candidateNode
        ? acceptedBatch.sourceAssetIdsByNodeId[candidateNode.id] ?? []
        : [];
      const relevantAssets = sourceAssetIds
        .map((assetId) => sourceAssetsById.get(assetId))
        .filter((asset): asset is SourceAsset => Boolean(asset));
      const images = relevantAssets.length > 0 ? relevantAssets : state.sourceAssets;
      imageAttachedProject = await addProjectNodeImageSourcesOnDisk({
        projectId: snapshot.projectId,
        nodeIds: [persistedNodeId],
        images,
      });
      attachedImageCount += images.length;
    }

    patchSourceDecompositionRun(runId, (run) => {
      run.state.project = imageAttachedProject;
      run.snapshot.result = {
        summary: acceptedBatch.summary,
        styleCommentary: acceptedBatch.styleCommentary,
        acceptedNodeCount: persistedNodeIds.length,
        acceptedLinkCount: acceptedBatch.links.length,
        attachedImageCount,
        project: imageAttachedProject,
      };
      completeStep(run.snapshot, "attach-sources", `Attached ${attachedImageCount} source image references.`);
      completeSnapshot(run.snapshot, `Added ${persistedNodeIds.length} nodes from source decomposition.`);
    });
  } catch (error) {
    patchSourceDecompositionRun(runId, (run) => {
      failSnapshot(
        run.snapshot,
        error instanceof Error ? error.message : "Failed to persist source decomposition.",
      );
    });
  }
}

export function encodeSourceDecompositionEvent(event: SourceDecompositionRunEvent) {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}
