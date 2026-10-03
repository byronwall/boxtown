import type { ProjectOperationActorKind } from "./types";

export { getNodeLastEditorKinds as getLastEditorKinds } from "./node-last-editor";

export type LastEditorKind = ProjectOperationActorKind;

export const lastEditorKinds: readonly LastEditorKind[] = ["human", "agent"];

export function isLastEditorKind(value: string): value is LastEditorKind {
  return (lastEditorKinds as readonly string[]).includes(value);
}
