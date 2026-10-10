import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import type { MapLink, MapLinkRelationship, MapNode } from "~/lib/spatial-map/types";

// One node per Markdown file: YAML front matter holds the fields, the body holds
// the node context. Long text stays line-oriented so git can merge edits to
// different paragraphs and show readable conflicts for overlapping ones.

export interface NodeFileLink {
  target: string;
  relationship: MapLinkRelationship;
}

export interface ParsedNodeFile {
  // Unvalidated node fields; parseSpatialMapData validates them with the rest of the project.
  node: Record<string, unknown>;
  parentIds: string[];
  links: NodeFileLink[];
}

const FENCE = "---";

export function serializeNodeFile(node: MapNode, links: MapLink[]) {
  const parentIds = links
    .filter((link) => link.parentChild && link.target === node.id)
    .map((link) => link.source)
    .sort();
  const outgoingLinks = links
    .filter((link) => !link.parentChild && link.source === node.id)
    .map((link) => ({ target: link.target, relationship: link.relationship ?? "related" }))
    .sort((left, right) =>
      `${left.target}\n${left.relationship}`.localeCompare(`${right.target}\n${right.relationship}`),
    );

  const frontMatter: Record<string, unknown> = {
    id: node.id,
    label: node.label,
    type: node.type,
    status: node.status,
  };
  if (node.priority) frontMatter.priority = node.priority;
  if (node.archived) frontMatter.archived = true;
  // A node normally has one parent; keep extras as a list rather than dropping them.
  if (parentIds.length === 1) frontMatter.parent = parentIds[0];
  if (parentIds.length > 1) frontMatter.parent = parentIds;
  if (outgoingLinks.length > 0) frontMatter.links = outgoingLinks;
  if (Object.keys(node.metadata).length > 0) frontMatter.metadata = sortKeys(node.metadata);
  if (node.images && node.images.length > 0) frontMatter.images = node.images;
  // rawContext is the context as first created; store it only once it diverges.
  if (node.rawContext !== node.context) frontMatter.rawContext = node.rawContext;

  const yaml = stringifyYaml(frontMatter, { lineWidth: 0 });
  // An empty body means empty context; otherwise the body ends with exactly one extra newline.
  const body = node.context.length > 0 ? `${node.context}\n` : "";
  return `${FENCE}\n${yaml}${FENCE}\n${body}`;
}

export function parseNodeFile(raw: string, fileLabel: string): ParsedNodeFile {
  // Only a file whose fences were converted to CRLF (e.g. by git on Windows) is
  // normalized; carriage returns pasted into context are kept exactly.
  const text = raw.startsWith(`${FENCE}\r\n`) ? raw.replace(/\r\n/g, "\n") : raw;
  if (!text.startsWith(`${FENCE}\n`)) {
    throw new Error(`${fileLabel} must start with a "---" front matter fence.`);
  }

  const closingFence = text.indexOf(`\n${FENCE}\n`, FENCE.length);
  const endsAtFence = text.endsWith(`\n${FENCE}`) && closingFence === -1;
  if (closingFence === -1 && !endsAtFence) {
    throw new Error(`${fileLabel} is missing the closing "---" front matter fence.`);
  }

  const yamlEnd = closingFence === -1 ? text.length - FENCE.length - 1 : closingFence;
  const yaml = text.slice(FENCE.length + 1, yamlEnd + 1);
  const body = closingFence === -1 ? "" : text.slice(closingFence + FENCE.length + 2);

  let frontMatter: unknown;
  try {
    frontMatter = parseYaml(yaml);
  } catch (error) {
    throw new Error(`${fileLabel} has invalid front matter: ${(error as Error).message}`);
  }
  if (!isRecord(frontMatter)) {
    throw new Error(`${fileLabel} front matter must be a mapping of node fields.`);
  }

  const { parent, links, rawContext, ...fields } = frontMatter;
  const context = body.length > 0 ? body.replace(/\n$/, "") : "";

  return {
    node: {
      ...fields,
      context,
      rawContext: rawContext === undefined ? context : rawContext,
    },
    parentIds: parseParentIds(parent, fileLabel),
    links: parseLinks(links, fileLabel),
  };
}

function parseParentIds(value: unknown, fileLabel: string) {
  if (value === undefined || value === null) return [];
  const values = Array.isArray(value) ? value : [value];
  if (!values.every((entry) => typeof entry === "string" && entry.trim().length > 0)) {
    throw new Error(`${fileLabel} "parent" must be a node id or a list of node ids.`);
  }
  return values as string[];
}

function parseLinks(value: unknown, fileLabel: string): NodeFileLink[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new Error(`${fileLabel} "links" must be a list.`);
  }

  return value.map((entry) => {
    if (!isRecord(entry) || typeof entry.target !== "string" || entry.target.trim().length === 0) {
      throw new Error(`${fileLabel} has a link without a "target" node id.`);
    }
    return {
      target: entry.target,
      relationship: (entry.relationship ?? "related") as MapLinkRelationship,
    };
  });
}

function sortKeys(record: Record<string, string>) {
  return Object.fromEntries(Object.entries(record).sort(([left], [right]) => left.localeCompare(right)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
