import type { MapNode, SpatialMapData } from "~/lib/spatial-map/types";
import type { ProjectNodeMetadataField } from "./types";

export interface NodeAgentPromptInput {
  projectId: string;
  nodeId: string;
  data: SpatialMapData;
  metadataSchema?: ProjectNodeMetadataField[];
  nodeUrl?: string;
}

// Builds a paste-ready markdown prompt for a coding agent: the node, its
// inherited ancestor context, and the boxtown commands to reload and close it.
export function buildNodeAgentPrompt(input: NodeAgentPromptInput) {
  const nodesById = new Map(input.data.nodes.map((node) => [node.id, node]));
  const node = nodesById.get(input.nodeId);
  if (!node) {
    return "";
  }

  const ancestors = getAncestorNodes(input.data, nodesById, node.id);
  const labels = new Map((input.metadataSchema ?? []).map((field) => [field.key, field.label]));
  const titlePath = [...ancestors, node].map((item) => item.label).join(" > ");
  const lines = [
    `# ${node.label}`,
    "",
    `Path: ${titlePath}`,
    `Status: ${node.status}`,
    `Type: ${node.type}`,
    `Node: \`${node.id}\` in project \`${input.projectId}\``,
  ];
  if (input.nodeUrl) {
    lines.push(`Link: ${input.nodeUrl}`);
  }

  lines.push("", "## Task", "", formatNodeBody(node, labels) || "_No direct context on this node._");

  const ancestorSections = ancestors
    .map((ancestor) => ({ ancestor, body: formatNodeBody(ancestor, labels) }))
    .filter((item) => item.body.length > 0);
  if (ancestorSections.length > 0) {
    lines.push("", "## Inherited Context", "");
    for (const { ancestor, body } of ancestorSections) {
      lines.push(`### ${ancestor.label}`, "", body, "");
    }
  }

  const scope = `--project ${input.projectId}`;
  lines.push(
    "",
    "## Tracker",
    "",
    "Use the `boxtown` CLI to load more context and to report back when done:",
    "",
    "```bash",
    `boxtown node view ${node.id} ${scope} --with-context --compact --json`,
    `boxtown node resolve ${node.id} ${scope} --status implemented --note "What changed." --json`,
    "```",
  );

  return `${lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd()}\n`;
}

function getAncestorNodes(
  data: SpatialMapData,
  nodesById: Map<string, MapNode>,
  nodeId: string,
) {
  const parentById = new Map<string, string>();
  for (const link of data.links) {
    if (link.parentChild && !parentById.has(link.target)) {
      parentById.set(link.target, link.source);
    }
  }

  const ancestors: MapNode[] = [];
  const seen = new Set([nodeId]);
  let parentId = parentById.get(nodeId);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = nodesById.get(parentId);
    if (!parent) {
      break;
    }
    ancestors.unshift(parent);
    parentId = parentById.get(parentId);
  }

  return ancestors;
}

function formatNodeBody(node: MapNode, labels: Map<string, string>) {
  const parts: string[] = [];
  const context = node.context.trim();
  if (context) {
    parts.push(context);
  }

  const metadata = Object.entries(node.metadata ?? {}).filter(([, value]) => value.trim());
  if (metadata.length > 0) {
    parts.push(
      metadata.map(([key, value]) => `- **${labels.get(key) ?? key}:** ${value.trim()}`).join("\n"),
    );
  }

  return parts.join("\n\n");
}
