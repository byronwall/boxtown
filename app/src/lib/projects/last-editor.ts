import type { ProjectOperationActorKind, ProjectOperationLogEntry } from "./types";

export type LastEditorKind = ProjectOperationActorKind;

export const lastEditorKinds: readonly LastEditorKind[] = ["human", "agent"];

// Latest actor per node from the retained operation log (newest first). Nodes
// with no retained entry are absent: their last editor is unknown and must not
// be treated as human.
export function getLastEditorKinds(operationLog: ProjectOperationLogEntry[]) {
  const lastEditors = new Map<string, LastEditorKind>();
  for (const entry of operationLog) {
    const kind = entry.actor?.kind;
    if (kind !== "human" && kind !== "agent") continue;
    for (const nodeId of entry.nodeIds) {
      if (!lastEditors.has(nodeId)) lastEditors.set(nodeId, kind);
    }
  }
  return lastEditors;
}

export function isLastEditorKind(value: string): value is LastEditorKind {
  return (lastEditorKinds as readonly string[]).includes(value);
}
