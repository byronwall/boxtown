import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createContextNodeOnDisk,
  createProjectOnDisk,
  deleteProjectNodeOnDisk,
  deleteProjectOnDisk,
  mergeGeneratedSpatialMapData,
  readProjectByIdFromDisk,
  readProjectSummariesFromDisk,
  updateProjectNodeContextOnDisk,
} from "./data.server";

describe("mergeGeneratedSpatialMapData", () => {
  it("appends generated nodes, remaps ids, and dedupes links", () => {
    const merged = mergeGeneratedSpatialMapData(
      {
        nodes: [
        {
          id: "page-home",
          label: "Home",
          type: "page",
          depth: 0,
          purpose: "Purpose",
          implementation: "Implementation",
          context: "",
          rawContext: "",
          contextMode: "structured",
        },
      ],
        links: [
          {
            source: "page-home",
            target: "page-home",
            parentChild: false,
            relationship: "related",
          },
        ],
      },
      {
        summary: "Generated",
        nodes: [
          {
            id: "draft-node",
            label: "Billing Center",
            type: "page",
            depth: 1,
            purpose: "Purpose",
            implementation: "Implementation",
            context: "",
            rawContext: "",
            contextMode: "structured",
          },
        ],
        links: [
          {
            source: "page-home",
            target: "draft-node",
            parentChild: true,
          },
          {
            source: "page-home",
            target: "draft-node",
            parentChild: true,
          },
          {
            source: "draft-node",
            target: "missing-node",
            parentChild: false,
            relationship: "related",
          },
        ],
      },
    );

    expect(merged.nodes).toHaveLength(2);
    expect(merged.nodes[1]?.id).toBe("page-billing-center");
    expect(merged.links).toEqual([
      {
        source: "page-home",
        target: "page-home",
        parentChild: false,
        relationship: "related",
      },
      {
        source: "page-home",
        target: "page-billing-center",
        parentChild: true,
      },
    ]);
  });
});

describe("createProjectOnDisk", () => {
  it("resolves the project data file when the server starts from the repo root", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-root-"));
    const dataDir = path.join(tempRoot, "app", "src", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const created = await createProjectOnDisk({ name: "Ideal CLI tool" });
      const persisted = await readProjectByIdFromDisk(created.id);

      expect(created.id).toBe("ideal-cli-tool");
      expect(persisted?.name).toBe("Ideal CLI tool");
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("deleteProjectOnDisk", () => {
  it("removes a project from disk", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-delete-"));
    const dataDir = path.join(tempRoot, "app", "src", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const created = await createProjectOnDisk({ name: "Disposable project" });
      await deleteProjectOnDisk(created.id);

      const persisted = await readProjectByIdFromDisk(created.id);
      const summaries = await readProjectSummariesFromDisk();

      expect(persisted).toBeNull();
      expect(summaries).toHaveLength(0);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("context node persistence", () => {
  it("updates node context on disk", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-update-"));
    const dataDir = path.join(tempRoot, "app", "src", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      path.join(dataDir, "projects.json"),
      `${JSON.stringify(
        [
          {
            id: "context-project",
            name: "Context Project",
            description: "Test fixture",
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-20T00:00:00.000Z",
            spatialMap: {
              nodes: [
                {
                  id: "node-1",
                  label: "Node 1",
                  type: "page",
                  depth: 0,
                  purpose: "Purpose",
                  implementation: "Implementation",
                  context: "",
                  rawContext: "",
                  contextMode: "structured",
                },
              ],
              links: [],
            },
          },
        ],
        null,
        2,
      )}\n`,
      "utf8",
    );

    try {
      process.chdir(tempRoot);

      await updateProjectNodeContextOnDisk({
        projectId: "context-project",
        nodeId: "node-1",
        context: "# Stored context",
      });

      const persisted = await readProjectByIdFromDisk("context-project");
      expect(persisted?.spatialMap.nodes[0]?.context).toBe("# Stored context");
      expect(persisted?.spatialMap.nodes[0]?.rawContext).toBe("");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("creates a standalone note node with context", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-create-"));
    const dataDir = path.join(tempRoot, "app", "src", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const project = await createProjectOnDisk({ name: "Context Notes" });
      const result = await createContextNodeOnDisk({
        projectId: project.id,
        label: "Loose Notes",
        context: "## Inbox\n\n- Keep this here",
      });

      expect(result.nodeId).toBe("note-loose-notes");
      expect(result.project.spatialMap.nodes.at(-1)).toMatchObject({
        id: "note-loose-notes",
        label: "Loose Notes",
        type: "note",
        depth: 2,
        context: "## Inbox\n\n- Keep this here",
        rawContext: "## Inbox\n\n- Keep this here",
        contextMode: "context-only",
      });
      expect(result.createdNodeCount).toBe(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("splits markdown headings into linked context nodes", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-split-"));
    const dataDir = path.join(tempRoot, "app", "src", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const project = await createProjectOnDisk({ name: "Heading Import" });
      const result = await createContextNodeOnDisk({
        projectId: project.id,
        label: "Imported Notes",
        context: [
          "Shared intro",
          "",
          "# Overview",
          "Overview details",
          "",
          "## Metrics",
          "- Conversion",
          "",
          "## Risks",
          "Risk details",
          "",
          "# Appendix",
          "Appendix notes",
        ].join("\n"),
        splitByHeadingLevel: true,
      });

      expect(result.nodeId).toBe("note-imported-notes");
      expect(result.createdNodeCount).toBe(5);
      expect(result.project.spatialMap.nodes.slice(-5)).toEqual([
        expect.objectContaining({
          id: "note-imported-notes",
          label: "Imported Notes",
          depth: 2,
          context: "Shared intro",
        }),
        expect.objectContaining({
          id: "note-overview",
          label: "Overview",
          depth: 3,
          context: "Overview details",
        }),
        expect.objectContaining({
          id: "note-metrics",
          label: "Metrics",
          depth: 4,
          context: "- Conversion",
        }),
        expect.objectContaining({
          id: "note-risks",
          label: "Risks",
          depth: 4,
          context: "Risk details",
        }),
        expect.objectContaining({
          id: "note-appendix",
          label: "Appendix",
          depth: 3,
          context: "Appendix notes",
        }),
      ]);
      expect(result.project.spatialMap.links).toEqual([
        { source: "note-imported-notes", target: "note-overview", parentChild: true },
        { source: "note-overview", target: "note-metrics", parentChild: true },
        { source: "note-overview", target: "note-risks", parentChild: true },
        { source: "note-imported-notes", target: "note-appendix", parentChild: true },
      ]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("rolls headings below the selected import depth into parent context", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-depth-"));
    const dataDir = path.join(tempRoot, "app", "src", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const project = await createProjectOnDisk({ name: "Depth Import" });
      const result = await createContextNodeOnDisk({
        projectId: project.id,
        label: "Imported Notes",
        context: [
          "# Overview",
          "Overview details",
          "",
          "## Metrics",
          "Metric summary",
          "",
          "### Web",
          "Web details",
          "",
          "#### Mobile",
          "Mobile details",
          "",
          "## Risks",
          "Risk details",
        ].join("\n"),
        splitByHeadingLevel: true,
        maxHeadingDepth: 2,
      });

      expect(result.createdNodeCount).toBe(4);
      expect(result.project.spatialMap.nodes.slice(-4)).toEqual([
        expect.objectContaining({
          id: "note-imported-notes",
          label: "Imported Notes",
          depth: 2,
          context: "",
        }),
        expect.objectContaining({
          id: "note-overview",
          label: "Overview",
          depth: 3,
          context: "Overview details",
        }),
        expect.objectContaining({
          id: "note-metrics",
          label: "Metrics",
          depth: 4,
          context: [
            "Metric summary",
            "",
            "### Web",
            "Web details",
            "",
            "#### Mobile",
            "Mobile details",
          ].join("\n"),
        }),
        expect.objectContaining({
          id: "note-risks",
          label: "Risks",
          depth: 4,
          context: "Risk details",
        }),
      ]);
      expect(result.project.spatialMap.links).toEqual([
        { source: "note-imported-notes", target: "note-overview", parentChild: true },
        { source: "note-overview", target: "note-metrics", parentChild: true },
        { source: "note-overview", target: "note-risks", parentChild: true },
      ]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("treats legacy note nodes as context-only and preserves current context as raw context", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-legacy-"));
    const dataDir = path.join(tempRoot, "app", "src", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      path.join(dataDir, "projects.json"),
      `${JSON.stringify(
        [
          {
            id: "legacy-note-project",
            name: "Legacy Note Project",
            description: "Test fixture",
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-20T00:00:00.000Z",
            spatialMap: {
              nodes: [
                {
                  id: "legacy-note",
                  label: "Legacy Note",
                  type: "note",
                  depth: 2,
                  purpose: "Purpose",
                  implementation: "Implementation",
                  context: "Legacy context",
                },
              ],
              links: [],
            },
          },
        ],
        null,
        2,
      )}\n`,
      "utf8",
    );

    try {
      process.chdir(tempRoot);

      const persisted = await readProjectByIdFromDisk("legacy-note-project");
      expect(persisted?.spatialMap.nodes[0]).toMatchObject({
        id: "legacy-note",
        context: "Legacy context",
        rawContext: "Legacy context",
        contextMode: "context-only",
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("deletes a node and prunes attached links", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-node-delete-"));
    const dataDir = path.join(tempRoot, "app", "src", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(
      path.join(dataDir, "projects.json"),
      `${JSON.stringify(
        [
          {
            id: "delete-node-project",
            name: "Delete Node Project",
            description: "Test fixture",
            createdAt: "2026-04-20T00:00:00.000Z",
            updatedAt: "2026-04-20T00:00:00.000Z",
            spatialMap: {
              nodes: [
                {
                  id: "node-a",
                  label: "Node A",
                  type: "page",
                  depth: 0,
                  purpose: "Purpose",
                  implementation: "Implementation",
                  context: "",
                  rawContext: "",
                  contextMode: "structured",
                },
                {
                  id: "node-b",
                  label: "Node B",
                  type: "note",
                  depth: 2,
                  purpose: "Purpose",
                  implementation: "Implementation",
                  context: "Context",
                  rawContext: "Context",
                  contextMode: "context-only",
                },
              ],
              links: [
                { source: "node-a", target: "node-b", parentChild: false, relationship: "related" },
                { source: "node-b", target: "node-a", parentChild: false, relationship: "related" },
              ],
            },
          },
        ],
        null,
        2,
      )}\n`,
      "utf8",
    );

    try {
      process.chdir(tempRoot);

      const project = await deleteProjectNodeOnDisk({
        projectId: "delete-node-project",
        nodeId: "node-b",
      });

      expect(project.spatialMap.nodes).toHaveLength(1);
      expect(project.spatialMap.nodes[0]?.id).toBe("node-a");
      expect(project.spatialMap.links).toHaveLength(0);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
