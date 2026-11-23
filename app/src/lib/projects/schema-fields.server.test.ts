import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createChildNodeOnDisk,
  createContextNodeOnDisk,
  createProjectOnDisk,
  readProjectByIdFromDisk,
} from "./data.server";
import { patchProjectNodeOnDisk } from "./node-patch.server";
import { ensureProjectMetadataFieldOnDisk } from "./schema-fields.server";

let tempRoot = "";
let originalDataDir: string | undefined;

beforeEach(() => {
  originalDataDir = process.env.APP_DATA_DIR;
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "boxtown-schema-"));
  process.env.APP_DATA_DIR = tempRoot;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.APP_DATA_DIR;
  else process.env.APP_DATA_DIR = originalDataDir;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("metadata schema validation", () => {
  it("rejects unknown metadata on create and import without creating a node", async () => {
    const project = await createProjectOnDisk({ name: "Schema Create" });

    await expect(createChildNodeOnDisk({
      projectId: project.id,
      parentNodeId: null,
      title: "Lifecycle",
      metadata: { lifecycle: "open" },
    })).rejects.toMatchObject({ code: "invalid_metadata_key", details: { keys: ["lifecycle"] } });
    await expect(createContextNodeOnDisk({
      projectId: project.id,
      label: "Import",
      context: "# Notes",
      metadata: { lifecycle: "open" },
    })).rejects.toMatchObject({ code: "invalid_metadata_key" });

    expect((await readProjectByIdFromDisk(project.id))?.spatialMap.nodes).toEqual([]);
  });

  it("ensures a field once and keeps existing fields and values", async () => {
    const project = await createProjectOnDisk({ name: "Schema Ensure" });
    const { nodeId } = await createChildNodeOnDisk({
      projectId: project.id,
      parentNodeId: null,
      title: "Node",
      metadata: { purpose: "Keep me" },
    });

    const first = await ensureProjectMetadataFieldOnDisk({ projectId: project.id, key: "solution", label: "Solution" });
    const second = await ensureProjectMetadataFieldOnDisk({ projectId: project.id, key: "solution", label: "Solution" });
    await patchProjectNodeOnDisk({ projectId: project.id, nodeId, patch: { metadata: { set: { solution: "Done" } } } });

    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    const loaded = await readProjectByIdFromDisk(project.id);
    expect(loaded?.nodeMetadataSchema.map((field) => field.key)).toEqual(["purpose", "implementation", "solution"]);
    expect(loaded?.spatialMap.nodes[0]?.metadata).toEqual({ purpose: "Keep me", solution: "Done" });
  });

  it("refuses a conflicting definition and suggests a normalized key", async () => {
    const project = await createProjectOnDisk({ name: "Schema Conflict" });

    await expect(ensureProjectMetadataFieldOnDisk({ projectId: project.id, key: "purpose", label: "Goal" }))
      .rejects.toMatchObject({ code: "metadata_field_conflict", status: 409 });
    await expect(ensureProjectMetadataFieldOnDisk({ projectId: project.id, key: "blockedBy" }))
      .rejects.toMatchObject({ details: { suggestedKey: "blocked-by" } });
  });
});
