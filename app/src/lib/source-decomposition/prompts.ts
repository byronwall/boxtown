import type { ProjectRecord } from "~/lib/projects/types";
import { getLinkLabel } from "~/lib/spatial-map/links";
import type { MapNode } from "~/lib/spatial-map/types";
import type { SourceAssetSummary } from "./types";

function summarizeNode(node: MapNode) {
  return `${node.id} | ${node.label} | ${node.type} | depth ${node.depth} | purpose: ${node.purpose}`;
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

function summarizeAssets(assets: SourceAssetSummary[]) {
  return assets
    .map((asset, index) => `${index + 1}. ${asset.id} | ${asset.originalName} | ${asset.mimeType} | ${asset.size} bytes`)
    .join("\n");
}

export function buildSourceDecompositionPrompt(input: {
  project: ProjectRecord;
  selectedNode: MapNode | null;
  sourceText: string;
  sourceAssets: SourceAssetSummary[];
}) {
  return [
    "You are decomposing inspiration screenshots and source notes into a technical app graph.",
    "Generate candidate nodes that correspond to the visible product structure: app layout, pages, regions, blocks, components, reusable patterns, data states, and implementation themes.",
    "Do not ask questions. Infer a practical rebuild plan from the sources.",
    "Return 5 to 12 nodes unless the source clearly implies fewer.",
    "Use compact concrete labels. Prefer node types such as app, layout, page, region, block, component, interaction, style-system, data-state, or asset.",
    "Depth must represent the hierarchy: broad app/layout nodes at low depth, nested blocks/components at higher depth.",
    "Purpose should describe what the node represents in the source.",
    "Implementation should describe what it would take to rebuild that part.",
    "Context should include concise rebuild notes and any relevant source evidence.",
    "For each node, include sourceAssetIds listing the source image ids that directly informed that node.",
    "Include a general styleCommentary covering styles, colors, fonts, density, hierarchy, spacing, and theme cues.",
    "Links may target existing nodes or newly generated nodes.",
    "For parent/child structure, emit links with parentChild: true and no relationship.",
    'For non-parent/child adjacency, emit parentChild: false with relationship "related", "dependency", or "reuse".',
    "Create parentChild links first so the candidate tree is useful for selection.",
    "",
    input.sourceText.trim() ? `Source text:\n${input.sourceText.trim()}` : "Source text: none provided",
    "",
    "Source images:",
    input.sourceAssets.length > 0 ? summarizeAssets(input.sourceAssets) : "No source images provided.",
    "",
    input.selectedNode
      ? `Selected anchor node: ${summarizeNode(input.selectedNode)}`
      : "Selected anchor node: none",
    "",
    summarizeGraph(input.project),
  ].join("\n");
}
