import type { ProjectRecord } from "~/lib/projects/types";
import { getLinkLabel } from "~/lib/spatial-map/links";
import type { MapNode } from "~/lib/spatial-map/types";
import type { ClarifyingQuestion } from "./types";

function summarizeNode(node: MapNode) {
  return `${node.id} | ${node.label} | ${node.type} | ${node.contextMode} | depth ${node.depth} | purpose: ${node.purpose}`;
}

function summarizeGraph(project: ProjectRecord) {
  return [
    `Project: ${project.name}`,
    `Description: ${project.description}`,
    `Node count: ${project.spatialMap.nodes.length}`,
    `Link count: ${project.spatialMap.links.length}`,
    "",
    "Existing nodes:",
    ...project.spatialMap.nodes.map(summarizeNode),
    "",
    "Existing links:",
    ...project.spatialMap.links.map(
      (link) => `${link.source} -> ${link.target} (${getLinkLabel(link)})`,
    ),
  ].join("\n");
}

function summarizeQuestions(questions: ClarifyingQuestion[], answers: Record<string, string>) {
  return questions
    .map((question) => {
      const selectedOption = question.options.find((option) => option.id === answers[question.id]);
      return [
        `Question: ${question.prompt}`,
        `Helper: ${question.helperText}`,
        `Selected: ${selectedOption?.label ?? "No answer"}`,
        selectedOption ? `Selected detail: ${selectedOption.detail}` : null,
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

export function buildQuestionPrompt(input: {
  project: ProjectRecord;
  sourceNode: MapNode;
}) {
  return [
    "You are preparing a context-note conversion workflow for a technical graph.",
    "Generate exactly 3 or 4 clarifying questions for turning one loose context note into structured graph nodes.",
    "Each question must have 3 or 4 concise options.",
    "Prefer questions about decomposition strategy, structural depth, relationship style, and evidence preservation.",
    "Do not ask for confirmation or approval.",
    "",
    `Source note: ${summarizeNode(input.sourceNode)}`,
    "Source note current context:",
    input.sourceNode.context || "(empty)",
    "",
    summarizeGraph(input.project),
  ].join("\n");
}

export function buildSuggestionPrompt(input: {
  project: ProjectRecord;
  sourceNode: MapNode;
  questions: ClarifyingQuestion[];
  answers: Record<string, string>;
}) {
  return [
    "You are converting a freeform context note into structured technical graph nodes.",
    "Generate 3 to 10 candidate structured nodes extracted from the note.",
    'Do not reproduce the source note itself as a candidate node. The source note remains a context inbox.',
    'Use contextMode \"structured\" for every generated node.',
    "Keep labels compact and concrete.",
    "Purpose and implementation should each be one sentence.",
    "For parent/child structure, emit links with parentChild: true and no relationship.",
    'For non-parent/child adjacency, emit parentChild: false with relationship "related", "dependency", or "reuse".',
    "Create parentChild links first to anchor true depth before adding cross-cutting relationship links.",
    "Generated links may connect to existing nodes when helpful, but only generated nodes should appear in the review tree.",
    "",
    `Source note: ${summarizeNode(input.sourceNode)}`,
    "Source note current context:",
    input.sourceNode.context || "(empty)",
    "",
    "Clarification answers:",
    summarizeQuestions(input.questions, input.answers),
    "",
    summarizeGraph(input.project),
  ].join("\n");
}

export function buildTrimPrompt(input: {
  sourceNode: MapNode;
  acceptedSummary: string;
  acceptedNodes: MapNode[];
}) {
  return [
    "You are trimming a context note after accepted structured nodes were added to a graph.",
    "Return the remaining context that was not incorporated into the accepted structured nodes.",
    "Preserve unique details, caveats, open questions, and snippets not represented by the accepted nodes.",
    "Remove material that is already captured by the accepted structure.",
    "It is valid for the remaining context to be empty.",
    "",
    `Source note: ${summarizeNode(input.sourceNode)}`,
    `Accepted summary: ${input.acceptedSummary}`,
    "",
    "Accepted structured nodes:",
    ...input.acceptedNodes.map(summarizeNode),
    "",
    "Original current context to trim:",
    input.sourceNode.context || "(empty)",
  ].join("\n");
}
