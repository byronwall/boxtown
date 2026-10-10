import { isMapLinkRelationship } from "~/lib/spatial-map/links";
import type { MapLink } from "~/lib/spatial-map/types";
import type { ParsedNodeFile } from "./node-file";

// Git can merge two branches cleanly and still leave a project that no single
// branch ever had: a child of a node deleted elsewhere, a link to a missing
// node, or a parent cycle from two crossing moves. These are repaired the same
// way the app would have handled them, and each repair is reported.

export interface AssembledProjectGraph {
  nodes: Record<string, unknown>[];
  links: MapLink[];
  issues: string[];
}

export function assembleProjectGraph(
  files: Array<ParsedNodeFile & { fileLabel: string }>,
): AssembledProjectGraph {
  const issues: string[] = [];
  const nodeIds = new Set(files.map((file) => String(file.node.id)));
  const parentIdsByChild = new Map<string, string[]>();
  const links: MapLink[] = [];

  for (const file of files) {
    const nodeId = String(file.node.id);
    const parentIds: string[] = [];
    for (const parentId of file.parentIds) {
      if (parentId === nodeId) {
        issues.push(`${file.fileLabel}: ignored "${nodeId}" listed as its own parent.`);
      } else if (!nodeIds.has(parentId)) {
        issues.push(`${file.fileLabel}: parent "${parentId}" no longer exists, so the node moved to the root.`);
      } else if (!parentIds.includes(parentId)) {
        parentIds.push(parentId);
      }
    }
    parentIdsByChild.set(nodeId, parentIds);

    for (const link of file.links) {
      if (!nodeIds.has(link.target)) {
        issues.push(`${file.fileLabel}: dropped a ${link.relationship} link to missing node "${link.target}".`);
        continue;
      }
      if (!isMapLinkRelationship(link.relationship)) {
        issues.push(`${file.fileLabel}: dropped a link with unknown relationship "${link.relationship}".`);
        continue;
      }
      links.push({ source: nodeId, target: link.target, parentChild: false, relationship: link.relationship });
    }
  }

  breakParentCycles(parentIdsByChild, issues);

  const parentLinks: MapLink[] = [];
  for (const [childId, parentIds] of parentIdsByChild) {
    for (const parentId of parentIds) {
      parentLinks.push({ source: parentId, target: childId, parentChild: true });
    }
  }

  return { nodes: files.map((file) => file.node), links: [...parentLinks, ...links], issues };
}

// Crossing moves on two branches ("A under B" and "B under A") merge cleanly
// into a cycle. Cut each cycle at its lowest node id so every clone repairs it
// the same way.
function breakParentCycles(parentIdsByChild: Map<string, string[]>, issues: string[]) {
  const state = new Map<string, "visiting" | "done">();

  const visit = (nodeId: string, path: string[]) => {
    state.set(nodeId, "visiting");
    for (const parentId of [...(parentIdsByChild.get(nodeId) ?? [])]) {
      if (state.get(parentId) === "visiting") {
        const cycle = path.slice(path.indexOf(parentId));
        const cutNodeId = [...cycle].sort()[0]!;
        const cutParentId = cycle[(cycle.indexOf(cutNodeId) + 1) % cycle.length]!;
        parentIdsByChild.set(
          cutNodeId,
          (parentIdsByChild.get(cutNodeId) ?? []).filter((id) => id !== cutParentId),
        );
        issues.push(
          `Parent cycle ${[...cycle, parentId].join(" → ")}: moved "${cutNodeId}" out from under "${cutParentId}".`,
        );
        continue;
      }
      if (!state.has(parentId)) visit(parentId, [...path, parentId]);
    }
    state.set(nodeId, "done");
  };

  for (const nodeId of [...parentIdsByChild.keys()].sort()) {
    if (!state.has(nodeId)) visit(nodeId, [nodeId]);
  }
}
