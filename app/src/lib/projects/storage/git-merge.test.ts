import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createChildNodeOnDisk,
  createProjectOnDisk,
  moveProjectNodeOnDisk,
  readProjectByIdFromDisk,
  updateProjectNodeContextOnDisk,
  updateProjectNodeStatusOnDisk,
} from "~/lib/projects/data.server";
import { createDefaultProjectNodeMetadataSchema } from "~/lib/projects/node-metadata";

// End-to-end proof of the storage layout: real branches, real `git merge`.

let repoDir = "";
let originalDataDir: string | undefined;

function git(...args: string[]) {
  return execFileSync(
    "git",
    ["-c", "user.name=Test", "-c", "user.email=test@example.com", "-c", "commit.gpgsign=false", ...args],
    { cwd: repoDir, encoding: "utf8", stdio: "pipe" },
  );
}

function commitAll(message: string) {
  git("add", "-A");
  git("commit", "-q", "-m", message);
}

beforeEach(() => {
  repoDir = mkdtempSync(path.join(os.tmpdir(), "project-grid-git-merge-"));
  originalDataDir = process.env.APP_DATA_DIR;
  process.env.APP_DATA_DIR = path.join(repoDir, "data");
  git("init", "-q", "-b", "main");
  vi.spyOn(console, "info").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  if (originalDataDir === undefined) delete process.env.APP_DATA_DIR;
  else process.env.APP_DATA_DIR = originalDataDir;
  rmSync(repoDir, { recursive: true, force: true });
});

async function seedProject() {
  const project = await createProjectOnDisk({ name: "Merge Test" });
  const shared = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Shared issue" });
  await updateProjectNodeContextOnDisk({
    projectId: project.id,
    nodeId: shared.nodeId,
    context: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph.",
  });
  commitAll("seed");
  return { projectId: project.id, sharedId: shared.nodeId };
}

describe("merging branches that both edit project data", () => {
  it("merges added issues and edits to different nodes and paragraphs without conflicts", async () => {
    const { projectId, sharedId } = await seedProject();
    const other = await createChildNodeOnDisk({ projectId, parentNodeId: null, title: "Other issue" });
    commitAll("add other");

    git("checkout", "-q", "-b", "feature-a");
    await createChildNodeOnDisk({ projectId, parentNodeId: null, title: "Added on A" });
    await updateProjectNodeStatusOnDisk({ projectId, nodeId: other.nodeId, status: "implemented" });
    await updateProjectNodeContextOnDisk({
      projectId,
      nodeId: sharedId,
      context: "First paragraph, edited on A.\n\nSecond paragraph.\n\nThird paragraph.",
    });
    commitAll("feature a");

    git("checkout", "-q", "main");
    git("checkout", "-q", "-b", "feature-b");
    await createChildNodeOnDisk({ projectId, parentNodeId: null, title: "Added on B" });
    await updateProjectNodeContextOnDisk({
      projectId,
      nodeId: sharedId,
      context: "First paragraph.\n\nSecond paragraph.\n\nThird paragraph, edited on B.",
    });
    commitAll("feature b");

    git("merge", "-q", "--no-edit", "feature-a");

    const merged = await readProjectByIdFromDisk(projectId);
    const labels = merged?.spatialMap.nodes.map((node) => node.label).sort();
    expect(labels).toEqual(["Added on A", "Added on B", "Other issue", "Shared issue"]);
    expect(merged?.spatialMap.nodes.find((node) => node.id === other.nodeId)?.status).toBe("implemented");
    expect(merged?.spatialMap.nodes.find((node) => node.id === sharedId)?.context).toBe(
      "First paragraph, edited on A.\n\nSecond paragraph.\n\nThird paragraph, edited on B.",
    );
    // Both branches' activity survives, newest first.
    const kinds = merged?.operationLog.map((entry) => entry.summary) ?? [];
    expect(kinds.filter((summary) => summary.includes("Added on"))).toHaveLength(2);
    expect(git("status", "--porcelain")).toBe("");
  });

  it("reports the conflicted file when both branches edit the same line", async () => {
    const { projectId, sharedId } = await seedProject();
    git("checkout", "-q", "-b", "feature-a");
    await updateProjectNodeStatusOnDisk({ projectId, nodeId: sharedId, status: "implemented" });
    commitAll("a");
    git("checkout", "-q", "main");
    await updateProjectNodeStatusOnDisk({ projectId, nodeId: sharedId, status: "blocked" });
    commitAll("main");

    expect(() => git("merge", "-q", "--no-edit", "feature-a")).toThrow();
    await expect(readProjectByIdFromDisk(projectId)).rejects.toThrow(
      `nodes/${sharedId}.md has unresolved git merge conflict markers`,
    );
  });

  it("repairs a parent cycle created by crossing moves on two branches", async () => {
    const { projectId } = await seedProject();
    const a = await createChildNodeOnDisk({ projectId, parentNodeId: null, title: "Node A" });
    const b = await createChildNodeOnDisk({ projectId, parentNodeId: null, title: "Node B" });
    commitAll("two roots");

    git("checkout", "-q", "-b", "move-a");
    await moveProjectNodeOnDisk({ projectId, nodeId: a.nodeId, parentNodeId: b.nodeId });
    commitAll("a under b");
    git("checkout", "-q", "main");
    await moveProjectNodeOnDisk({ projectId, nodeId: b.nodeId, parentNodeId: a.nodeId });
    commitAll("b under a");
    git("merge", "-q", "--no-edit", "move-a");

    const merged = await readProjectByIdFromDisk(projectId);
    const parentLinks = merged?.spatialMap.links.filter((link) => link.parentChild) ?? [];
    expect(parentLinks).toHaveLength(1);
  });

  it("migrates the same legacy project identically on two branches", async () => {
    const projectDir = path.join(repoDir, "data", "projects", "legacy");
    mkdirSync(projectDir, { recursive: true });
    writeFileSync(path.join(projectDir, "project.json"), `${JSON.stringify({
      id: "legacy",
      name: "Legacy",
      description: "Before the per-node layout",
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
      nodeMetadataSchema: createDefaultProjectNodeMetadataSchema(),
      spatialMap: {
        nodes: [{ id: "task-one", label: "One", type: "task", context: "Body" }],
        links: [],
      },
    }, null, 2)}\n`);
    commitAll("legacy");

    git("checkout", "-q", "-b", "feature-a");
    await createChildNodeOnDisk({ projectId: "legacy", parentNodeId: null, title: "From A" });
    commitAll("a migrates and adds");
    git("checkout", "-q", "main");
    await createChildNodeOnDisk({ projectId: "legacy", parentNodeId: null, title: "From main" });
    commitAll("main migrates and adds");
    git("merge", "-q", "--no-edit", "feature-a");

    const merged = await readProjectByIdFromDisk("legacy");
    expect(merged?.spatialMap.nodes.map((node) => node.label).sort()).toEqual(["From A", "From main", "One"]);
    // Each branch kept a local backup of the old file; the project .gitignore keeps them out of git.
    expect(readdirSync(projectDir).some((name) => name.startsWith("project.json.v1-"))).toBe(true);
    expect(git("status", "--porcelain")).toBe("");
  });
});
