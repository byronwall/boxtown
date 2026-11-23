import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createChildNodeOnDisk,
  createProjectOnDisk,
  readProjectByIdFromDisk,
  updateProjectMetadataSchemaOnDisk,
} from "./data.server";
import { getNodeRevision, patchProjectNodeOnDisk } from "./node-patch.server";

let tempRoot = "";
let originalDataDir: string | undefined;

beforeEach(() => {
  originalDataDir = process.env.APP_DATA_DIR;
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "boxtown-node-patch-"));
  process.env.APP_DATA_DIR = tempRoot;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.APP_DATA_DIR;
  else process.env.APP_DATA_DIR = originalDataDir;
  rmSync(tempRoot, { recursive: true, force: true });
});

async function createFixture() {
  const project = await createProjectOnDisk({ name: "Patch Fixture" });
  await updateProjectMetadataSchemaOnDisk({
    projectId: project.id,
    fields: [
      { key: "purpose", label: "Purpose", defaultValue: "" },
      { key: "implementation", label: "Implementation", defaultValue: "" },
      { key: "solution", label: "Solution", defaultValue: "" },
    ],
    nodeTypes: project.nodeTypeSchema,
  });
  const first = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "First" });
  const second = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Second" });
  return { projectId: project.id, nodeId: first.nodeId, otherNodeId: second.nodeId };
}

async function readNode(projectId: string, nodeId: string) {
  const project = await readProjectByIdFromDisk(projectId);
  const node = project!.spatialMap.nodes.find((item) => item.id === nodeId)!;
  return { project: project!, node, revision: getNodeRevision(node, project!.spatialMap.links) };
}

describe("patchProjectNodeOnDisk", () => {
  it("keeps both of two concurrent updates to different metadata keys", async () => {
    const { projectId, nodeId } = await createFixture();

    await Promise.all([
      patchProjectNodeOnDisk({ projectId, nodeId, patch: { metadata: { set: { solution: "S" } } } }),
      patchProjectNodeOnDisk({ projectId, nodeId, patch: { metadata: { set: { implementation: "I" } } } }),
    ]);

    const { node } = await readNode(projectId, nodeId);
    expect(node.metadata).toMatchObject({ solution: "S", implementation: "I" });
  });

  it("commits nothing when one field of a compound patch is invalid", async () => {
    const { projectId, nodeId } = await createFixture();
    const before = await readNode(projectId, nodeId);

    await expect(patchProjectNodeOnDisk({
      projectId,
      nodeId,
      patch: { title: "Renamed", status: "done", metadata: { set: { solution: "S" } } },
    })).rejects.toMatchObject({ code: "invalid_status" });

    const after = await readNode(projectId, nodeId);
    expect(after.node).toEqual(before.node);
    expect(after.project.operationLog.length).toBe(before.project.operationLog.length);
  });

  it("leaves status unchanged when metadata in the same patch is rejected", async () => {
    const { projectId, nodeId } = await createFixture();

    await expect(patchProjectNodeOnDisk({
      projectId,
      nodeId,
      patch: { status: "implemented", metadata: { set: { soluton: "typo" } } },
    })).rejects.toMatchObject({ code: "invalid_metadata_key", details: { keys: ["soluton"] } });

    expect((await readNode(projectId, nodeId)).node.status).toBe("planned");
  });

  it("applies status and metadata together and reports what changed", async () => {
    const { projectId, nodeId } = await createFixture();

    const result = await patchProjectNodeOnDisk({
      projectId,
      nodeId,
      patch: { status: "implemented", metadata: { set: { solution: "Fixed", implementation: "Code" } } },
    });

    expect(result.changedFields).toEqual(["status", "metadata.implementation", "metadata.solution"]);
    expect(result.operationId).toBeTruthy();
    const after = await readNode(projectId, nodeId);
    expect(after.revision).toBe(result.revision);
    expect(after.project.operationLog[0]).toMatchObject({ id: result.operationId, kind: "node.updated" });
  });

  it("rejects a stale revision without changing the node", async () => {
    const { projectId, nodeId } = await createFixture();
    const { revision } = await readNode(projectId, nodeId);
    await patchProjectNodeOnDisk({ projectId, nodeId, patch: { context: "Newer prose" } });

    await expect(patchProjectNodeOnDisk({
      projectId,
      nodeId,
      expectedRevision: revision,
      patch: { context: "Older prose" },
    })).rejects.toMatchObject({ code: "revision_conflict", status: 409 });

    expect((await readNode(projectId, nodeId)).node.context).toBe("Newer prose");
  });

  it("keeps a node's revision when another node changes", async () => {
    const { projectId, nodeId, otherNodeId } = await createFixture();
    const { revision } = await readNode(projectId, nodeId);

    await patchProjectNodeOnDisk({ projectId, nodeId: otherNodeId, patch: { title: "Other renamed" } });
    const result = await patchProjectNodeOnDisk({
      projectId,
      nodeId,
      expectedRevision: revision,
      patch: { context: "Guarded write" },
    });

    expect(result.changedFields).toEqual(["context"]);
  });

  it("accepts the next mutation after one fails", async () => {
    const { projectId, nodeId } = await createFixture();

    await expect(patchProjectNodeOnDisk({ projectId, nodeId, patch: { priority: "huge" } })).rejects.toThrow();
    const result = await patchProjectNodeOnDisk({ projectId, nodeId, patch: { priority: "high" } });

    expect(result.node.priority).toBe("high");
  });

  it("keeps every note when two workers append at the same time", async () => {
    const { projectId, nodeId } = await createFixture();
    await patchProjectNodeOnDisk({ projectId, nodeId, patch: { context: "Original" } });

    await Promise.all([
      patchProjectNodeOnDisk({ projectId, nodeId, patch: { note: { text: "Attempt A failed", heading: "Note" } } }),
      patchProjectNodeOnDisk({ projectId, nodeId, patch: { note: { text: "Attempt B worked" } } }),
    ]);

    const { node, project } = await readNode(projectId, nodeId);
    expect(node.context).toContain("Original");
    expect(node.context).toContain("Note:\n\nAttempt A failed");
    expect(node.context).toContain("Attempt B worked");
    const notes = project.operationLog.filter((entry) => entry.kind === "node.note.added");
    expect(notes.map((entry) => entry.metadata?.note).sort()).toEqual(["Attempt A failed", "Attempt B worked"]);
  });
});
