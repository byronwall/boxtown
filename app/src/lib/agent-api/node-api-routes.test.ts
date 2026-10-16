import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectRecord } from "~/lib/projects/types";
import { GET as getNodes } from "~/routes/api/v1/projects/[projectId]/nodes";
import { DELETE as deleteNode } from "~/routes/api/v1/projects/[projectId]/nodes/[nodeId]";
import { PATCH as patchMetadata } from "~/routes/api/v1/projects/[projectId]/nodes/[nodeId]/metadata";
import { GET as getSchema } from "~/routes/api/v1/projects/[projectId]/schema";
import {
  deleteProjectNodeOnDisk,
  readProjectByIdFromDisk,
  writeProjectAndPublish,
} from "~/lib/projects/data.server";

vi.mock("~/lib/projects/data.server", () => ({
  appendProjectOperation: vi.fn(),
  deleteProjectNodeOnDisk: vi.fn(),
  getMutationMetadata: vi.fn(),
  readProjectByIdFromDisk: vi.fn(),
  serializedMutation: (mutate: unknown) => mutate,
  writeProjectAndPublish: vi.fn(),
}));

const project = {
  id: "demo",
  name: "Demo",
  description: "",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  nodeMetadataSchema: [
    { key: "purpose", label: "Purpose", defaultValue: "" },
  ],
  nodeTypeSchema: [
    { name: "task", color: "#cccccc" },
    { name: "page", color: "#dddddd" },
  ],
  spatialMap: {
    nodes: [
      {
        id: "root-task",
        label: "Root Task",
        type: "task",
        status: "planned",
        metadata: { purpose: "Root" },
        context: "",
        rawContext: "",
        images: [],
      },
      {
        id: "child-task",
        label: "Child Task",
        type: "task",
        status: "working",
        metadata: {} as Record<string, string>,
        context: "",
        rawContext: "",
        images: [],
      },
    ],
    links: [
      { source: "root-task", target: "child-task", parentChild: true },
    ],
  },
  operationLog: [],
} satisfies ProjectRecord;

describe("agent node API projections", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("returns compact project schema", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(project);

    const response = await getSchema(createEvent("http://localhost/api/v1/projects/demo/schema"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.schema.projectId).toBe("demo");
    expect(body.schema.statuses.map((status: { value: string }) => status.value)).toContain("planned");
    expect(body.schema.nodeTypes).toEqual(project.nodeTypeSchema);
    expect(body.schema.metadataFields).toEqual(project.nodeMetadataSchema);
  });

  it("filters node list to roots and requested fields", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(project);

    const response = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?roots=true&compact=true&fields=id,label,status,parentNodeId,childCount",
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.nodes).toEqual([
      {
        id: "root-task",
        label: "Root Task",
        status: "planned",
        parentNodeId: null,
        childCount: 1,
      },
    ]);
  });

  it("filters node list by priority, with none for unprioritized", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue({
      ...project,
      spatialMap: {
        ...project.spatialMap,
        nodes: project.spatialMap.nodes.map((node) =>
          node.id === "child-task" ? { ...node, priority: "high" as const } : node,
        ),
      },
    });

    const high = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?compact=true&fields=id,priority&priority=high",
    ));
    expect((await high.json()).nodes).toEqual([{ id: "child-task", priority: "high" }]);

    const none = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?compact=true&fields=id&priority=none",
    ));
    expect((await none.json()).nodes).toEqual([{ id: "root-task" }]);

    const invalid = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?priority=someday",
    ));
    expect(invalid.status).toBe(400);
  });

  it("hides archived subtrees unless includeArchived is set", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const archivedProject = {
      ...project,
      spatialMap: {
        ...project.spatialMap,
        nodes: project.spatialMap.nodes.map((node) =>
          node.id === "root-task" ? { ...node, archived: true } : node,
        ),
      },
    };
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(archivedProject);

    const hidden = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?compact=true&fields=id",
    ));
    expect((await hidden.json()).nodes).toEqual([]);

    const shown = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?compact=true&fields=id,archived&includeArchived=true",
    ));
    expect((await shown.json()).nodes).toEqual([
      { id: "child-task", archived: false },
      { id: "root-task", archived: true },
    ]);
  });

  it("supports subtree filters and dot-path fields", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(project);

    const response = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?subtree=root-task&depth=1&compact=true&fields=id,label,metadata.purpose",
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.nodes).toEqual([
      {
        id: "child-task",
        label: "Child Task",
      },
    ]);
  });

  it("can include the subtree root", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(project);

    const response = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?subtree=root-task&includeSelf=true&compact=true&fields=id,label,metadata.purpose",
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.nodes).toEqual([
      {
        id: "child-task",
        label: "Child Task",
      },
      {
        id: "root-task",
        label: "Root Task",
        "metadata.purpose": "Root",
      },
    ]);
  });

  it("rejects invalid node status filters", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(project);

    const response = await getNodes(createEvent(
      "http://localhost/api/v1/projects/demo/nodes?status=done",
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_status");
  });

  it("rejects metadata keys outside the project schema", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(project);

    const response = await patchMetadata(createEvent(
      "http://localhost/api/v1/projects/demo/nodes/root-task/metadata",
      {
        params: { projectId: "demo", nodeId: "root-task" },
        method: "PATCH",
        body: { set: { mvp_tier: "core" } },
      },
    ));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("invalid_metadata_key");
    expect(body.error.details.fields).toEqual(["purpose"]);
    expect(writeProjectAndPublish).not.toHaveBeenCalled();
  });

  it("deletes a node and reports removed ids", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(project);
    vi.mocked(deleteProjectNodeOnDisk).mockResolvedValue({
      ...project,
      spatialMap: { nodes: [project.spatialMap.nodes[1]], links: [] },
    });

    const response = await deleteNode(createEvent(
      "http://localhost/api/v1/projects/demo/nodes/root-task",
      { params: { projectId: "demo", nodeId: "root-task" }, method: "DELETE" },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.deletedNodeIds).toEqual(["root-task"]);
    expect(deleteProjectNodeOnDisk).toHaveBeenCalledWith(
      expect.objectContaining({ projectId: "demo", nodeId: "root-task", includeChildren: false }),
    );
  });

  it("returns 404 when deleting a missing node", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.mocked(readProjectByIdFromDisk).mockResolvedValue(project);

    const response = await deleteNode(createEvent(
      "http://localhost/api/v1/projects/demo/nodes/missing?children=true",
      { params: { projectId: "demo", nodeId: "missing" }, method: "DELETE" },
    ));

    expect(response.status).toBe(404);
    expect(deleteProjectNodeOnDisk).not.toHaveBeenCalled();
  });
});

function createEvent(
  url: string,
  options: {
    params?: Record<string, string>;
    method?: string;
    body?: unknown;
  } = {},
) {
  return {
    params: options.params ?? { projectId: "demo" },
    request: new Request(url, {
      method: options.method ?? "GET",
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      headers: options.body === undefined ? undefined : { "content-type": "application/json" },
    }),
  } as never;
}
