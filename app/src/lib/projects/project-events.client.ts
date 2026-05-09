import type { ProjectSocketEvent } from "~/ws/project-events";
import type { ProjectRecord } from "./types";

interface ConnectProjectEventsInput {
  projectId: string;
  onProjectChanged: (project: ProjectRecord, event: ProjectSocketEvent) => void;
  onProjectDeleted: () => void;
}

export interface ProjectEventsConnection {
  disconnect: () => void;
  publishLocalProjectChange: (project: ProjectRecord) => void;
}

const RECONNECT_BASE_DELAY_MS = 500;
const RECONNECT_MAX_DELAY_MS = 5000;
const PROJECT_EVENTS_CHANNEL_NAME = "pgm:project-events";
const JOBS_SOCKET_PROBE_HEADER = "x-pgm-websocket-route";
const JOBS_SOCKET_PROBE_VALUE = "jobs";

type ProjectBroadcastMessage =
  | {
      type: "project:changed";
      project: ProjectRecord;
      sourceId: string;
    }
  | {
      type: "project:deleted";
      projectId: string;
      sourceId: string;
    };

export function connectProjectEvents(input: ConnectProjectEventsInput): ProjectEventsConnection {
  let socket: WebSocket | null = null;
  let reconnectTimer: number | undefined;
  let reconnectAttempt = 0;
  let stopped = false;
  let socketOpen = false;
  let socketAvailable: boolean | null = null;
  let socketProbeInFlight: Promise<boolean> | null = null;
  let refreshInFlight: Promise<void> | null = null;
  let refreshAgain = false;
  let latestProjectUpdatedAt = "";
  const sourceId = crypto.randomUUID();
  const channel = "BroadcastChannel" in window
    ? new BroadcastChannel(PROJECT_EVENTS_CHANNEL_NAME)
    : null;

  const applyProject = (project: ProjectRecord, event: ProjectSocketEvent) => {
    latestProjectUpdatedAt = project.updatedAt;
    input.onProjectChanged(project, event);
  };

  const refreshProject = (event: ProjectSocketEvent, force = false) => {
    if (refreshInFlight) {
      refreshAgain = true;
      return;
    }

    refreshInFlight = fetchProject(input.projectId)
      .then((project) => {
        if (project) {
          if (force || project.updatedAt !== latestProjectUpdatedAt) {
            applyProject(project, event);
          }
          return;
        }

        input.onProjectDeleted();
      })
      .catch((error) => {
        console.error("project-events:refresh-failed", error);
      })
      .finally(() => {
        refreshInFlight = null;
        if (refreshAgain && !stopped) {
          refreshAgain = false;
          refreshProject(event, force);
        }
      });
  };

  const scheduleReconnect = () => {
    if (stopped || reconnectTimer !== undefined || socketAvailable === false) return;

    const delay = Math.min(
      RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempt,
      RECONNECT_MAX_DELAY_MS,
    );
    reconnectAttempt += 1;
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = undefined;
      connect();
    }, delay);
  };

  const connect = () => {
    if (stopped) return;

    if (socketAvailable !== true) {
      socketProbeInFlight ??= probeProjectEventsSocket();
      socketProbeInFlight
        .then((available) => {
          socketAvailable = available;
          if (available && !stopped) {
            connect();
          }
        })
        .finally(() => {
          socketProbeInFlight = null;
        });
      return;
    }

    let opened = false;
    socket = new WebSocket(getProjectEventsSocketUrl());
    socket.addEventListener("open", () => {
      opened = true;
      socketOpen = true;
      reconnectAttempt = 0;
      socket?.send(JSON.stringify({ type: "jobs:ping" }));
      refreshProject(createClientReconcileEvent(input.projectId), true);
    });
    socket.addEventListener("message", (messageEvent) => {
      const event = parseProjectSocketEvent(messageEvent.data);
      if (!event) return;

      console.info("project-events:received", event);
      if (event.type === "project:changed" && event.projectId === input.projectId) {
        refreshProject(event);
      }
      if (event.type === "project:deleted" && event.projectId === input.projectId) {
        input.onProjectDeleted();
      }
    });
    socket.addEventListener("close", () => {
      socketOpen = false;
      scheduleReconnect();
    });
    socket.addEventListener("error", () => {
      if (!opened) {
        socketAvailable = false;
      }
      socket?.close();
    });
  };

  const catchUpIfDisconnected = () => {
    if (document.visibilityState === "hidden") return;
    if (!socketOpen) {
      refreshProject(createClientReconcileEvent(input.projectId), true);
    }
  };

  channel?.addEventListener("message", (event: MessageEvent<ProjectBroadcastMessage>) => {
    const message = event.data;
    if (!message || message.sourceId === sourceId) return;

    if (message.type === "project:changed" && message.project.id === input.projectId) {
      applyProject(message.project, createClientReconcileEvent(input.projectId));
    }
    if (message.type === "project:deleted" && message.projectId === input.projectId) {
      input.onProjectDeleted();
    }
  });

  connect();
  window.addEventListener("focus", catchUpIfDisconnected);
  document.addEventListener("visibilitychange", catchUpIfDisconnected);
  window.addEventListener("online", catchUpIfDisconnected);

  return {
    disconnect: () => {
      stopped = true;
      if (reconnectTimer !== undefined) {
        window.clearTimeout(reconnectTimer);
      }
      window.removeEventListener("focus", catchUpIfDisconnected);
      document.removeEventListener("visibilitychange", catchUpIfDisconnected);
      window.removeEventListener("online", catchUpIfDisconnected);
      channel?.close();
      socket?.close();
    },
    publishLocalProjectChange: (project: ProjectRecord) => {
      latestProjectUpdatedAt = project.updatedAt;
      channel?.postMessage({
        type: "project:changed",
        project,
        sourceId,
      } satisfies ProjectBroadcastMessage);
    },
  };
}

async function fetchProject(projectId: string) {
  const response = await fetch(getAppUrl(`/api/projects/${encodeURIComponent(projectId)}`), {
    cache: "no-store",
  });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Failed to refresh project ${projectId}: ${response.status}`);
  }

  return response.json() as Promise<ProjectRecord>;
}

function getProjectEventsSocketUrl() {
  const url = new URL(getAppUrl("/ws/jobs"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  return url;
}

async function probeProjectEventsSocket() {
  try {
    const response = await fetch(getAppUrl("/ws/jobs"), {
      cache: "no-store",
    });
    return response.headers.get(JOBS_SOCKET_PROBE_HEADER) === JOBS_SOCKET_PROBE_VALUE;
  } catch {
    return false;
  }
}

function getAppUrl(pathname: string) {
  const serverBase = import.meta.env.SERVER_BASE_URL || "/";
  const normalizedBase =
    serverBase === "/" ? "" : `/${serverBase.replace(/^\/+|\/+$/g, "")}`;
  return new URL(`${normalizedBase}${pathname}`, window.location.href);
}

function parseProjectSocketEvent(data: unknown): ProjectSocketEvent | null {
  if (typeof data !== "string") return null;

  try {
    const parsed = JSON.parse(data) as Partial<ProjectSocketEvent>;
    return parsed.type === "project:changed" ||
      parsed.type === "project:deleted" ||
      parsed.type === "projects:changed"
      ? parsed as ProjectSocketEvent
      : null;
  } catch {
    return null;
  }
}

function createClientReconcileEvent(projectId: string): ProjectSocketEvent {
  return {
    type: "project:changed",
    projectId,
    projectUpdatedAt: "",
    operation: null,
    serverTime: new Date().toISOString(),
  };
}
