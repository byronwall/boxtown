import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createChildNodeOnDisk, createProjectOnDisk, readProjectByIdFromDisk } from "./data.server";
import { createProjectLinkOnDisk, listNodeRelations, removeProjectLinkOnDisk } from "./links.server";

let tempRoot = "";
let originalDataDir: string | undefined;

beforeEach(() => {
  originalDataDir = process.env.APP_DATA_DIR;
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "boxtown-links-"));
  process.env.APP_DATA_DIR = tempRoot;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.APP_DATA_DIR;
  else process.env.APP_DATA_DIR = originalDataDir;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("relationship links", () => {
  it("adds and removes a dependency without touching hierarchy or other links", async () => {
    const project = await createProjectOnDisk({ name: "Links" });
    const parent = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Parent" });
    const child = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: parent.nodeId, title: "Child" });
    const other = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Other" });
    await createProjectLinkOnDisk({ projectId: project.id, source: child.nodeId, target: other.nodeId });
    const before = await readProjectByIdFromDisk(project.id);

    const added = await createProjectLinkOnDisk({
      projectId: project.id,
      source: child.nodeId,
      target: parent.nodeId,
      relationship: "dependency",
    });
    const repeated = await createProjectLinkOnDisk({
      projectId: project.id,
      source: child.nodeId,
      target: parent.nodeId,
      relationship: "dependency",
    });
    const withDependency = await readProjectByIdFromDisk(project.id);
    expect(added.created).toBe(true);
    expect(repeated.created).toBe(false);
    expect(listNodeRelations(withDependency!, child.nodeId).map((link) => link.relationship).sort())
      .toEqual(["dependency", "related"]);

    await removeProjectLinkOnDisk({
      projectId: project.id,
      source: child.nodeId,
      target: parent.nodeId,
      relationship: "dependency",
    });
    const after = await readProjectByIdFromDisk(project.id);
    expect(after?.spatialMap.links).toEqual(before?.spatialMap.links);
  });

  it("rejects missing endpoints, self links, and unknown relationships", async () => {
    const project = await createProjectOnDisk({ name: "Links Invalid" });
    const node = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Node" });

    await expect(createProjectLinkOnDisk({ projectId: project.id, source: node.nodeId, target: "missing" }))
      .rejects.toMatchObject({ code: "node_not_found" });
    await expect(createProjectLinkOnDisk({ projectId: project.id, source: node.nodeId, target: node.nodeId }))
      .rejects.toMatchObject({ code: "invalid_link" });
    await expect(createProjectLinkOnDisk({
      projectId: project.id,
      source: node.nodeId,
      target: "missing",
      relationship: "duplicate",
    })).rejects.toMatchObject({ code: "invalid_relationship" });
    await expect(removeProjectLinkOnDisk({ projectId: project.id, source: node.nodeId, target: "missing" }))
      .rejects.toMatchObject({ code: "link_not_found" });
  });
});
