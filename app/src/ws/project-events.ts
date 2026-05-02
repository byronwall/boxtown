import type {
  ProjectOperationActor,
  ProjectOperationKind,
  ProjectOperationLogEntry,
  ProjectRecord,
} from "~/lib/projects/types";

export type ProjectSocketEvent =
  | {
      type: "project:changed";
      projectId: string;
      projectUpdatedAt: string;
      operation: {
        id: string;
        kind: ProjectOperationKind;
        actor: ProjectOperationActor;
        createdAt: string;
        summary: string;
        nodeIds: string[];
        linkKeys?: string[];
      } | null;
      serverTime: string;
    }
  | {
      type: "project:deleted";
      projectId: string;
      serverTime: string;
    }
  | {
      type: "projects:changed";
      projectIds: string[];
      serverTime: string;
    };

type ProjectSocketEventListener = (event: ProjectSocketEvent) => void;

interface ProjectSocketEventState {
  listeners: Set<ProjectSocketEventListener>;
}

const projectSocketEventGlobal = globalThis as typeof globalThis & {
  __pgmProjectSocketEvents?: ProjectSocketEventState;
};
const projectSocketEventState =
  projectSocketEventGlobal.__pgmProjectSocketEvents ??= {
    listeners: new Set<ProjectSocketEventListener>(),
  };

export function subscribeProjectSocketEvents(listener: ProjectSocketEventListener) {
  projectSocketEventState.listeners.add(listener);
  return () => {
    projectSocketEventState.listeners.delete(listener);
  };
}

export function publishProjectSocketEvent(event: ProjectSocketEvent) {
  for (const listener of projectSocketEventState.listeners) {
    listener(event);
  }
}

export function publishProjectRecordChanged(project: ProjectRecord) {
  publishProjectSocketEvent({
    type: "project:changed",
    projectId: project.id,
    projectUpdatedAt: project.updatedAt,
    operation: toSocketOperation(project.operationLog[0] ?? null),
    serverTime: new Date().toISOString(),
  });
  publishProjectsChanged([project.id]);
}

export function publishProjectDeleted(projectId: string) {
  publishProjectSocketEvent({
    type: "project:deleted",
    projectId,
    serverTime: new Date().toISOString(),
  });
  publishProjectsChanged([projectId]);
}

export function publishProjectsChanged(projectIds: string[]) {
  publishProjectSocketEvent({
    type: "projects:changed",
    projectIds,
    serverTime: new Date().toISOString(),
  });
}

function toSocketOperation(operation: ProjectOperationLogEntry | null) {
  if (!operation) return null;

  return {
    id: operation.id,
    kind: operation.kind,
    actor: operation.actor,
    createdAt: operation.createdAt,
    summary: operation.summary,
    nodeIds: operation.nodeIds,
    linkKeys: operation.linkKeys,
  };
}
