import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { auditProject } from "./audit";
import { createChildNodeOnDisk, createProjectOnDisk, getProjectDataDir, readProjectByIdFromDisk } from "./data.server";
import { ensureProjectMetadataFieldOnDisk } from "./schema-fields.server";
import { readProjectIntegrityIssues } from "./storage/project-directory.server";

let tempRoot = "";
let originalDataDir: string | undefined;

beforeEach(() => {
  originalDataDir = process.env.APP_DATA_DIR;
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "boxtown-audit-"));
  process.env.APP_DATA_DIR = tempRoot;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.APP_DATA_DIR;
  else process.env.APP_DATA_DIR = originalDataDir;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("auditProject", () => {
  it("reports each category without treating open workarounds as complete", async () => {
    const project = await createProjectOnDisk({ name: "Audit Fixture" });
    for (const key of ["solution", "verification", "outcome", "owner"]) {
      await ensureProjectMetadataFieldOnDisk({ projectId: project.id, key });
    }
    const create = (title: string, status: "planned" | "implemented" | "blocked" | "working" | "deprecated", metadata = {}) =>
      createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title, status, metadata });
    const done = await create("Complete fix", "implemented", { solution: "Fixed", verification: "Test passed" });
    const missing = await create("Missing proof", "implemented", { solution: "Fixed" });
    const blocked = await create("Blocked item", "blocked", { solution: "Containment", outcome: "containment" });
    await create("Old idea", "deprecated");
    const working = await create("Unowned", "working");
    const duplicateA = await create("Flaky test", "planned");
    const duplicateB = await create("flaky  test", "planned");

    // Point a node file at a node that no longer exists; the loader repairs it in memory.
    const nodesDir = path.join(getProjectDataDir(project.id), "nodes");
    const doneFile = readdirSync(nodesDir).find((file) => readFileSync(path.join(nodesDir, file), "utf8").includes(done.nodeId))!;
    const raw = readFileSync(path.join(nodesDir, doneFile), "utf8");
    writeFileSync(path.join(nodesDir, doneFile), raw.replace("status: implemented", "status: implemented\nlinks:\n  - target: gone-node\n    relationship: dependency"));

    const loaded = await readProjectByIdFromDisk(project.id);
    const report = auditProject(loaded!, {}, {
      integrityIssues: await readProjectIntegrityIssues(getProjectDataDir(project.id)),
      missingImages: [],
    });
    const byRule = (rule: string) => report.findings.filter((finding) => finding.rule === rule);

    expect(report.selection.nodeCount).toBe(7);
    expect(report.counts.byStatus).toEqual({ implemented: 2, blocked: 1, deprecated: 1, working: 1, planned: 2 });
    expect(report.rules.requireImplemented).toEqual(["solution", "verification"]);
    expect(byRule("implemented-missing-field").map((finding) => finding.nodeId)).toEqual([missing.nodeId]);
    expect(byRule("open-with-solution")).toEqual([expect.objectContaining({
      nodeId: blocked.nodeId,
      severity: "info",
      reason: expect.stringContaining("outcome: containment"),
    })]);
    expect(byRule("working-without-owner").map((finding) => finding.nodeId)).toEqual([working.nodeId]);
    expect(byRule("duplicate-title")[0]?.nodeIds).toEqual([duplicateA.nodeId, duplicateB.nodeId]);
    expect(byRule("graph-integrity")[0]?.reason).toContain("gone-node");
    expect(report.findings[0]?.severity).toBe("error");
  });

  it("limits the report to a subtree", async () => {
    const project = await createProjectOnDisk({ name: "Audit Scope" });
    const root = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Root" });
    await createChildNodeOnDisk({ projectId: project.id, parentNodeId: root.nodeId, title: "Child" });
    await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Elsewhere" });

    const loaded = await readProjectByIdFromDisk(project.id);
    const report = auditProject(loaded!, { subtree: root.nodeId }, { integrityIssues: [], missingImages: [] });

    expect(report.selection.nodeCount).toBe(2);
  });
});
