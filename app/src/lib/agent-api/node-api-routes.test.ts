import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProjectRecord } from "~/lib/projects/types";
import { GET as getNodes } from "~/routes/api/v1/projects/[projectId]/nodes";
import { PATCH as patchMetadata } from "~/routes/api/v1/projects/[projectId]/nodes/[nodeId]/metadata";
import { GET as getSchema } from "~/routes/api/v1/projects/[projectId]/schema";
import { readProjectByIdFromDisk, updateProjectNodeMetadataOnDisk } from "~/lib/projects/data.server";

vi.mock("~/lib/projects/data.server", () => ({
  readProjectByIdFromDisk: vi.fn(),
  updateProjectNodeMetadataOnDisk: vi.fn(),
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
    expect(updateProjectNodeMetadataOnDisk).not.toHaveBeenCalled();
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
