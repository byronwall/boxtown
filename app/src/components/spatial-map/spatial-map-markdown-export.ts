import type { ProjectRecord } from "~/lib/projects/types";
import { toaster } from "~/components/ui/toast";
import type { MapLink, MapNode, SpatialMapData } from "~/lib/spatial-map/types";

interface BuildVisibleNodesMarkdownOptions {
  project: ProjectRecord;
  visibleData: SpatialMapData;
  origin?: string;
}

export function buildVisibleNodesMarkdown(
  options: BuildVisibleNodesMarkdownOptions,
) {
  const { project, visibleData } = options;
  const nodeIds = new Set(visibleData.nodes.map((node) => node.id));
  const visibleLinks = visibleData.links.filter(
    (link) => nodeIds.has(link.source) && nodeIds.has(link.target),
  );
  const lines: string[] = [];

  lines.push(`# ${project.name}`);
  lines.push("");
  lines.push("## Export Overview");
  lines.push(
    "This markdown is an LLM-ready context export for the nodes currently visible in the project map.",
  );
  lines.push(
    "It includes project-level context, metadata and node type schemas, detailed visible node records, image URLs, and relationships between visible nodes.",
  );
  lines.push(
    "Treat each `###` heading under `Visible Nodes` as one node record. Use node IDs for stable references, labels for human-facing names, metadata/context fields as source material, and the final relationship list as the visible graph structure.",
  );
  lines.push("");
  lines.push("## Project Context");
  pushField(lines, "Project ID", project.id);
  pushField(lines, "Description", project.description);
  pushField(lines, "Created", project.createdAt);
  pushField(lines, "Updated", project.updatedAt);
  pushField(lines, "Visible nodes", String(visibleData.nodes.length));
  pushField(lines, "Visible links", String(visibleLinks.length));
  lines.push("");

  if (project.nodeMetadataSchema.length > 0) {
    lines.push("## Metadata Schema");
    for (const field of project.nodeMetadataSchema) {
      lines.push(`- ${field.label} (\`${field.key}\`)`);
      if (field.defaultValue.trim()) {
        lines.push(`  - Default: ${field.defaultValue}`);
      }
    }
    lines.push("");
  }

  if (project.nodeTypeSchema.length > 0) {
    lines.push("## Node Type Schema");
    for (const type of project.nodeTypeSchema) {
      lines.push(`- ${type.name}: ${type.color}`);
    }
    lines.push("");
  }

  lines.push("## Visible Nodes");
  if (visibleData.nodes.length === 0) {
    lines.push("");
    lines.push("No nodes are visible in the current map view.");
  }

  for (const node of visibleData.nodes) {
    appendNode(lines, node, visibleLinks, visibleData.nodes, options.origin);
  }

  if (visibleLinks.length > 0) {
    lines.push("");
    lines.push("## Visible Relationships");
    for (const link of visibleLinks) {
      const source = getNodeLabel(visibleData.nodes, link.source);
      const target = getNodeLabel(visibleData.nodes, link.target);
      const relationship = link.relationship ?? "unspecified";
      const kind = link.parentChild ? "parent-child" : relationship;
      lines.push(`- ${source} -> ${target}`);
      lines.push(`  - Type: ${kind}`);
      lines.push(`  - Source ID: \`${link.source}\``);
      lines.push(`  - Target ID: \`${link.target}\``);
    }
  }

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
}

function appendNode(
  lines: string[],
  node: MapNode,
  links: MapLink[],
  nodes: MapNode[],
  origin?: string,
) {
  const outgoing = links.filter((link) => link.source === node.id);
  const incoming = links.filter((link) => link.target === node.id);

  lines.push("");
  lines.push(`### ${node.label}`);
  pushField(lines, "ID", `\`${node.id}\``);
  pushField(lines, "Type", node.type);
  pushField(lines, "Status", node.status);

  lines.push("");
  lines.push("#### Metadata");
  const metadataEntries = Object.entries(node.metadata);
  if (metadataEntries.length === 0) {
    lines.push("- None");
  } else {
    for (const [key, value] of metadataEntries) {
      lines.push(`- ${key}: ${value || "(empty)"}`);
    }
  }

  lines.push("");
  lines.push("#### Context");
  lines.push(node.context.trim() || "(empty)");

  if (node.rawContext.trim() && node.rawContext.trim() !== node.context.trim()) {
    lines.push("");
    lines.push("#### Raw Context");
    lines.push(node.rawContext.trim());
  }

  lines.push("");
  lines.push("#### Images");
  if (!node.images || node.images.length === 0) {
    lines.push("- None");
  } else {
    for (const image of node.images) {
      lines.push(`- ${image.originalName || image.filename}`);
      lines.push(`  - ID: \`${image.id}\``);
      lines.push(`  - URL: ${toAbsoluteUrl(image.src, origin)}`);
      lines.push(`  - Filename: ${image.filename}`);
      lines.push(`  - MIME type: ${image.mimeType}`);
      lines.push(`  - Size: ${image.size} bytes`);
      lines.push(`  - Created: ${image.createdAt}`);
    }
  }

  lines.push("");
  lines.push("#### Visible Relations");
  if (outgoing.length === 0 && incoming.length === 0) {
    lines.push("- None in the current visible node set");
    return;
  }

  for (const link of outgoing) {
    lines.push(
      `- Outgoing to ${getNodeLabel(nodes, link.target)}: ${describeLink(link)}`,
    );
  }
  for (const link of incoming) {
    lines.push(
      `- Incoming from ${getNodeLabel(nodes, link.source)}: ${describeLink(link)}`,
    );
  }
}

function pushField(lines: string[], label: string, value: string) {
  if (!value.trim()) {
    return;
  }
  lines.push(`- ${label}: ${value}`);
}

function getNodeLabel(nodes: MapNode[], nodeId: string) {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  return node ? `${node.label} (\`${node.id}\`)` : `Unknown node (\`${nodeId}\`)`;
}

function describeLink(link: MapLink) {
  if (link.parentChild) {
    return "parent-child";
  }
  return link.relationship ?? "related";
}

function toAbsoluteUrl(src: string, origin?: string) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(src)) {
    return src;
  }

  if (!origin) {
    return src;
  }

  try {
    return new URL(src, origin).toString();
  } catch {
    return src;
  }
}

export async function copyVisibleNodesAsMarkdown(project: ProjectRecord, visibleData: SpatialMapData) {
  try {
    const markdown = buildVisibleNodesMarkdown({
      project,
      visibleData,
      origin: typeof window === "undefined" ? undefined : window.location.origin,
    });

    await navigator.clipboard.writeText(markdown);
    toaster.success({
      title: "Markdown copied",
      description: `${visibleData.nodes.length} visible nodes are now in your clipboard.`,
    });
  } catch (error) {
    toaster.error({
      title: "Copy failed",
      description:
        error instanceof Error
          ? error.message
          : "The visible node markdown could not be copied.",
    });
  }
}
