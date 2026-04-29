import { createMemo, Show } from "solid-js";
import { Box } from "styled-system/jsx";
import { MarkdownRenderer } from "~/components/markdown-renderer";
import { getNodeMetadataEntries } from "~/lib/projects/node-metadata";
import type { ProjectRecord } from "~/lib/projects/types";
import type { MapNode, MapNodeImage } from "~/lib/spatial-map/types";
import {
  useSpatialMapImages,
  type SpatialMapImageTarget,
} from "./SpatialMapImages";
import { useSpatialMap } from "./SpatialMapContext";
import {
  buildSpatialMapTree,
  sortNodeIds,
  type SpatialMapTree,
} from "./spatial-map-tree";

export function SpatialMapMarkdownView(props: { project: ProjectRecord }) {
  const spatialMap = useSpatialMap();
  const imageUi = useSpatialMapImages();
  const tree = createMemo(() => buildSpatialMapTree(spatialMap.visibleData()));
  const imageTargets = createMemo(() =>
    getMarkdownImageTargets(tree(), spatialMap.visibleData().nodes),
  );
  const markdown = createMemo(() =>
    buildSpatialMapMarkdown({
      tree: tree(),
      nodes: spatialMap.visibleData().nodes,
      nodeMetadataSchema: props.project.nodeMetadataSchema,
    }),
  );

  return (
    <Box class="spatial-map-markdown-viewport">
      <Show
        when={markdown().trim().length > 0}
        fallback={
          <Box class="spatial-map-tree-empty">
            No hierarchy nodes are visible at this depth.
          </Box>
        }
      >
        <Box class="spatial-map-markdown-document">
          <Box
            onClick={(event) =>
              openClickedImage(event, imageTargets(), imageUi)
            }
          >
            <MarkdownRenderer>{markdown()}</MarkdownRenderer>
          </Box>
        </Box>
      </Show>
    </Box>
  );
}

function buildSpatialMapMarkdown(input: {
  tree: SpatialMapTree;
  nodes: MapNode[];
  nodeMetadataSchema: ProjectRecord["nodeMetadataSchema"];
}) {
  const lines: string[] = [];
  const visited = new Set<string>();
  const rootIds =
    input.tree.roots.length > 0
      ? input.tree.roots
      : sortNodeIds(
          input.nodes.map((node) => node.id),
          input.tree.items,
        );

  for (const nodeId of rootIds) {
    appendNodeMarkdown({
      lines,
      tree: input.tree,
      nodeId,
      depth: 0,
      visited,
      nodeMetadataSchema: input.nodeMetadataSchema,
    });
  }

  return lines.join("\n").trim();
}

function getMarkdownImageTargets(tree: SpatialMapTree, nodes: MapNode[]) {
  const targets: SpatialMapImageTarget[] = [];
  const visited = new Set<string>();
  const rootIds =
    tree.roots.length > 0
      ? tree.roots
      : sortNodeIds(
          nodes.map((node) => node.id),
          tree.items,
        );

  for (const nodeId of rootIds) {
    appendNodeImageTargets({ tree, nodeId, visited, targets });
  }

  return targets;
}

function appendNodeImageTargets(input: {
  tree: SpatialMapTree;
  nodeId: string;
  visited: Set<string>;
  targets: SpatialMapImageTarget[];
}) {
  if (input.visited.has(input.nodeId)) {
    return;
  }

  const item = input.tree.items.get(input.nodeId);
  if (!item) {
    return;
  }

  input.visited.add(input.nodeId);
  for (const image of item.node.images ?? []) {
    input.targets.push({ image, node: item.node });
  }
  for (const childNodeId of item.childNodeIds) {
    appendNodeImageTargets({ ...input, nodeId: childNodeId });
  }
}

function appendNodeMarkdown(input: {
  lines: string[];
  tree: SpatialMapTree;
  nodeId: string;
  depth: number;
  visited: Set<string>;
  nodeMetadataSchema: ProjectRecord["nodeMetadataSchema"];
}) {
  if (input.visited.has(input.nodeId)) {
    return;
  }

  const item = input.tree.items.get(input.nodeId);
  if (!item) {
    return;
  }

  input.visited.add(input.nodeId);
  input.lines.push(
    `${"#".repeat(Math.min(input.depth + 1, 6))} ${escapeHeadingText(item.node.label)}`,
  );
  appendContext(input.lines, item.node);
  appendRichContent(input.lines, item.node);
  appendMetadata(input.lines, item.node, input.nodeMetadataSchema);

  for (const childNodeId of item.childNodeIds) {
    appendNodeMarkdown({
      ...input,
      nodeId: childNodeId,
      depth: input.depth + 1,
    });
  }
}

function appendContext(lines: string[], node: MapNode) {
  const context = (node.context || node.rawContext).trim();
  if (context.length === 0) {
    return;
  }

  lines.push("", context);
}

function appendRichContent(lines: string[], node: MapNode) {
  const images = node.images ?? [];
  if (images.length === 0) {
    return;
  }

  lines.push("", "**Rich content**", "");
  for (const image of images) {
    lines.push(formatImageMarkdown(image));
  }
}

function appendMetadata(
  lines: string[],
  node: MapNode,
  nodeMetadataSchema: ProjectRecord["nodeMetadataSchema"],
) {
  const entries = getNodeMetadataEntries(node, nodeMetadataSchema);
  if (entries.length === 0) {
    return;
  }

  lines.push("", "| | |", "| --- | --- |");
  for (const entry of entries) {
    lines.push(formatMetadataTableRow(entry.label, entry.value));
  }
}

function formatImageMarkdown(image: MapNodeImage) {
  const label = escapeImageAltText(
    image.originalName || image.filename || "Attached image",
  );
  const src = encodeMarkdownUrl(image.src);
  if (image.mimeType.startsWith("image/")) {
    return `![${label}](${src})`;
  }

  return `[${escapeInlineMarkdown(label)}](${src})`;
}

function formatMetadataTableRow(label: string, value: string) {
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  const displayValue = lines.length > 0 ? lines.join("<br />") : "Empty";

  return `| **${escapeInlineMarkdown(label)}** | ${escapeInlineMarkdown(displayValue)} |`;
}

function escapeHeadingText(value: string) {
  return (
    value.replace(/\\/g, "\\\\").replace(/#/g, "\\#").trim() || "Untitled node"
  );
}

function escapeImageAltText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function escapeInlineMarkdown(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/([`*_{}\[\]()#+\-.!|>])/g, "\\$1");
}

function encodeMarkdownUrl(value: string) {
  return value.replace(/\)/g, "%29").replace(/\s/g, "%20");
}

function openClickedImage(
  event: MouseEvent,
  imageTargets: SpatialMapImageTarget[],
  imageUi: ReturnType<typeof useSpatialMapImages>,
) {
  const target = event.target;
  if (!(target instanceof Element)) {
    return;
  }

  const imageElement = target.closest("img");
  const src = imageElement?.getAttribute("src") ?? "";
  const imageTarget = imageTargets.find((item) =>
    isSameImageSrc(item.image.src, src),
  );
  if (!imageTarget) {
    return;
  }

  imageUi.openImageTargets(imageTargets, imageTarget.image, {
    canDelete: false,
  });
}

function isSameImageSrc(left: string, right: string) {
  if (left === right) {
    return true;
  }

  if (typeof window === "undefined") {
    return false;
  }

  return (
    new URL(left, window.location.origin).href ===
    new URL(right, window.location.origin).href
  );
}
