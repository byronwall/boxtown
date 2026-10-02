import { describe, expect, it } from "vitest";
import type { MapNode } from "~/lib/spatial-map/types";
import { updateProjectNode } from "./optimistic";
import {
  acceptServerProject,
  addLocalChange,
  createProjectSyncState,
  failLocalChange,
  getVisibleProject,
  type ProjectSyncState,
} from "./optimistic-sync";
import type { ProjectRecord } from "./types";

const node = (id: string, label: string, extra: Partial<MapNode> = {}): MapNode => ({
  id,
  label,
  type: "page",
  status: "planned",
  metadata: { purpose: "" },
  context: "",
  rawContext: "",
  images: [],
  archived: false,
  ...extra,
});

let clock = 0;
const tick = () => new Date(Date.UTC(2026, 9, 2, 0, 0, clock++)).toISOString();

const fixture = (): ProjectRecord => ({
  id: "p",
  name: "Fixture",
  description: "",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: tick(),
  nodeMetadataSchema: [{ key: "purpose", label: "Purpose", defaultValue: "" }],
  nodeTypeSchema: [{ name: "page", color: "#999" }, { name: "note", color: "#888" }],
  spatialMap: {
    nodes: [node("root", "Root"), node("child", "Child"), node("other", "Other", { context: "remote baseline" })],
    links: [{ source: "root", target: "child", parentChild: true }],
  },
  operationLog: [],
});

// Simulates the server applying a node edit and logging its mutation id.
function serverApply(project: ProjectRecord, nodeId: string, patch: Partial<MapNode>, mutationId?: string) {
  const next = updateProjectNode(project, nodeId, (item) => ({ ...item, ...patch }));
  return {
    ...next,
    updatedAt: tick(),
    operationLog: [
      {
        id: `op-${clock}`,
        kind: "node.title.updated" as const,
        actor: { kind: "human" as const },
        createdAt: next.updatedAt,
        summary: "",
        nodeIds: [nodeId],
        metadata: mutationId ? { clientMutationId: mutationId } : undefined,
      },
      ...project.operationLog,
    ],
  };
}

function optimistic(state: ProjectSyncState, id: string, nodeId: string, patch: Partial<MapNode>) {
  const visible = getVisibleProject(state);
  return addLocalChange(state, id, visible, updateProjectNode(visible, nodeId, (item) => ({ ...item, ...patch })));
}

const visibleNode = (state: ProjectSyncState, nodeId: string) =>
  getVisibleProject(state).spatialMap.nodes.find((item) => item.id === nodeId);

describe("project optimistic sync", () => {
  it("keeps a delayed title and a pending status in either acknowledgement order", () => {
    for (const order of [["title", "status"], ["status", "title"]] as const) {
      const base = fixture();
      let state = createProjectSyncState(base);
      state = optimistic(state, "title", "root", { label: "Renamed" });
      state = optimistic(state, "status", "root", { status: "implemented" });

      // The server serializes writes, so the second ack includes both edits.
      const first = order[0] === "title"
        ? serverApply(base, "root", { label: "Renamed" }, "title")
        : serverApply(base, "root", { status: "implemented" }, "status");
      state = acceptServerProject(state, first, order[0]);
      expect(visibleNode(state, "root")).toMatchObject({ label: "Renamed", status: "implemented" });

      const second = serverApply(first, "root", order[1] === "title" ? { label: "Renamed" } : { status: "implemented" }, order[1]);
      state = acceptServerProject(state, second, order[1]);
      expect(state.pending).toHaveLength(0);
      expect(visibleNode(state, "root")).toMatchObject({ label: "Renamed", status: "implemented" });
    }
  });

  it("keeps a newer same-field edit visible when an older acknowledgement arrives", () => {
    const base = fixture();
    let state = createProjectSyncState(base);
    state = optimistic(state, "a", "root", { label: "First" });
    state = optimistic(state, "b", "root", { label: "Second" });
    state = acceptServerProject(state, serverApply(base, "root", { label: "First" }, "a"), "a");
    expect(visibleNode(state, "root")?.label).toBe("Second");
  });

  it("accepts an unrelated remote edit and its history while a local edit is pending", () => {
    const base = fixture();
    let state = createProjectSyncState(base);
    state = optimistic(state, "local", "root", { label: "Local" });
    const remote = serverApply(base, "other", { context: "remote change" });
    state = acceptServerProject(state, remote);
    const visible = getVisibleProject(state);
    expect(visibleNode(state, "root")?.label).toBe("Local");
    expect(visibleNode(state, "other")?.context).toBe("remote change");
    expect(visible.operationLog).toHaveLength(1);
  });

  it("drops only the failed change and ignores its stale snapshot", () => {
    const base = fixture();
    let state = createProjectSyncState(base);
    state = optimistic(state, "title", "root", { label: "Renamed" });
    state = optimistic(state, "status", "child", { status: "implemented" });
    state = failLocalChange(state, "title");
    expect(visibleNode(state, "root")?.label).toBe("Root");
    expect(visibleNode(state, "child")?.status).toBe("implemented");
    expect(state.pending.map((item) => item.id)).toEqual(["status"]);
  });

  it("recovers a successful write from later authoritative history after a failed refresh", () => {
    const base = fixture();
    let state = createProjectSyncState(base);
    state = optimistic(state, "title", "root", { label: "Renamed" });
    // The action rejected after persistence, so the client reported a failure.
    state = failLocalChange(state, "title");
    expect(visibleNode(state, "root")?.label).toBe("Root");
    // A later websocket refresh delivers the persisted value; nothing replays.
    state = acceptServerProject(state, serverApply(base, "root", { label: "Renamed" }, "title"));
    expect(visibleNode(state, "root")?.label).toBe("Renamed");
    expect(state.pending).toHaveLength(0);
  });

  it("settles a pending change found anywhere in retained history", () => {
    const base = fixture();
    let state = createProjectSyncState(base);
    state = optimistic(state, "lost", "root", { label: "Renamed" });
    const acked = serverApply(base, "root", { label: "Renamed" }, "lost");
    const later = serverApply(acked, "other", { context: "remote" });
    state = acceptServerProject(state, later);
    expect(state.pending).toHaveLength(0);
  });

  it("keeps spatial map identity for a bookkeeping-only acknowledgement", () => {
    const base = fixture();
    let state = createProjectSyncState(base);
    state = optimistic(state, "status", "root", { status: "implemented" });
    const before = getVisibleProject(state);
    const ack = serverApply(base, "root", { status: "implemented" }, "status");
    state = acceptServerProject(state, ack, "status");
    const after = getVisibleProject(state, before);
    expect(after.spatialMap).toBe(before.spatialMap);
    expect(after.operationLog).toBe(ack.operationLog);
  });

  it("treats an acknowledged child with server-added empty fields as the same node", () => {
    const base = fixture();
    let state = createProjectSyncState(base);
    const visible = getVisibleProject(state);
    const optimisticChild: MapNode = { id: "page-new", label: "New", type: "page", status: "planned", metadata: {}, context: "", rawContext: "" };
    state = addLocalChange(state, "create", visible, {
      ...visible,
      spatialMap: {
        nodes: [...visible.spatialMap.nodes, optimisticChild],
        links: [...visible.spatialMap.links, { source: "child", target: "page-new", parentChild: true }],
      },
    });
    const shown = getVisibleProject(state, visible);
    const created = {
      ...base,
      updatedAt: tick(),
      spatialMap: {
        // Server parsing adds empty images/archived and may order keys differently.
        nodes: [...base.spatialMap.nodes, { images: [], archived: false, ...optimisticChild }],
        links: [...base.spatialMap.links, { source: "child", target: "page-new", parentChild: true }],
      },
      operationLog: [{ id: "op", kind: "node.created" as const, actor: { kind: "human" as const }, createdAt: "", summary: "", nodeIds: ["page-new"], metadata: { clientMutationId: "create" } }],
    };
    state = acceptServerProject(state, created, "create");
    const acknowledged = getVisibleProject(state, shown);
    expect(acknowledged.spatialMap).toBe(shown.spatialMap);
    expect(acknowledged.spatialMap.nodes.filter((item) => item.id === "page-new")).toHaveLength(1);
  });
});
