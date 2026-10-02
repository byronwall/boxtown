import type { ProjectOperationActorKind, ProjectOperationLogEntry } from "./types";

// The retained operation log is newest-first; absent nodes have no known editor.
export function getNodeLastEditorKinds(
  operationLog: ProjectOperationLogEntry[],
): Map<string, ProjectOperationActorKind> {
  const editors = new Map<string, ProjectOperationActorKind>();

  for (const operation of operationLog) {
    for (const nodeId of operation.nodeIds) {
      if (!editors.has(nodeId)) {
        editors.set(nodeId, operation.actor.kind);
      }
    }
  }

  return editors;
}
