import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  createContextNodeOnDisk,
  createChildNodeOnDisk,
  createProjectOnDisk,
  deleteProjectNodeOnDisk,
  deleteProjectNodeImageOnDisk,
  deleteProjectOnDisk,
  mergeGeneratedSpatialMapData,
  readProjectByIdFromDisk,
  readProjectSummariesFromDisk,
  updateProjectNodeContextOnDisk,
  updateProjectNodeMetadataOnDisk,
  updateProjectMetadataSchemaOnDisk,
} from "./data.server";
import {
  DEFAULT_NOTE_IMPLEMENTATION,
  DEFAULT_NOTE_PURPOSE,
  createDefaultProjectNodeMetadataSchema,
} from "./node-metadata";
import { createDefaultProjectNodeTypeSchema } from "./node-types";
import type { MapNodeImage } from "~/lib/spatial-map/types";

const defaultSchema = createDefaultProjectNodeMetadataSchema();
const defaultTypeSchema = createDefaultProjectNodeTypeSchema();

describe("mergeGeneratedSpatialMapData", () => {
  it("appends generated nodes, remaps ids, and dedupes links", () => {
    const merged = mergeGeneratedSpatialMapData(
      {
        nodes: [
          buildNode({
            id: "page-home",
            label: "Home",
            type: "page",
            depth: 0,
            metadata: { purpose: "Purpose", implementation: "Implementation" },
          }),
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
          buildNode({
            id: "draft-node",
            label: "Billing Center",
            type: "page",
            depth: 1,
            metadata: { purpose: "Purpose", implementation: "Implementation" },
          }),
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
      defaultSchema,
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
  it("uses APP_DATA_DIR when an explicit data directory is configured", async () => {
    const originalDataDir = process.env.APP_DATA_DIR;
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-configured-data-"));
    const dataDir = path.join(tempRoot, "persistent-data");

    try {
      process.env.APP_DATA_DIR = dataDir;

      const created = await createProjectOnDisk({ name: "Persisted Deploy Data" });
      const persisted = await readProjectByIdFromDisk(created.id);

      expect(persisted?.name).toBe("Persisted Deploy Data");
      expect(
        existsSync(path.join(dataDir, "projects", "persisted-deploy-data", "project.json")),
      ).toBe(true);
    } finally {
      if (originalDataDir === undefined) {
        delete process.env.APP_DATA_DIR;
      } else {
        process.env.APP_DATA_DIR = originalDataDir;
      }
    }
  });

  it("resolves the project data file when the server starts from the repo root", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-root-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const created = await createProjectOnDisk({ name: "Ideal CLI tool" });
      const persisted = await readProjectByIdFromDisk(created.id);

      expect(created.id).toBe("ideal-cli-tool");
      expect(persisted?.name).toBe("Ideal CLI tool");
      expect(persisted?.nodeMetadataSchema).toEqual(defaultSchema);
      expect(persisted?.operationLog[0]?.actor.kind).toBe("human");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("stores an agent actor when one is provided", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-agent-actor-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const created = await createProjectOnDisk({
        name: "Agent Project",
        actor: { kind: "agent", id: "token:esting", label: "Agent token ...esting" },
      });
      const persisted = await readProjectByIdFromDisk(created.id);

      expect(persisted?.operationLog[0]?.actor).toEqual({
        kind: "agent",
        id: "token:esting",
        label: "Agent token ...esting",
      });
    } finally {
      process.chdir(originalCwd);
    }
  });
});

describe("deleteProjectOnDisk", () => {
  it("removes a project from disk", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-delete-"));
    const dataDir = path.join(tempRoot, "app", "data");
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
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeProjectFixture(dataDir, buildProjectFixture({
      id: "context-project",
      spatialMap: {
        nodes: [
          buildNode({
            id: "node-1",
            label: "Node 1",
            type: "page",
            depth: 0,
            metadata: { purpose: "Purpose", implementation: "Implementation" },
          }),
        ],
        links: [],
      },
    }));

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

  it("creates a typed child node with context and metadata", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-child-create-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const project = await createProjectOnDisk({ name: "Child Nodes" });
      const result = await createChildNodeOnDisk({
        projectId: project.id,
        parentNodeId: null,
        title: "Checkout Page",
        type: "page",
        status: "working",
        context: "# Checkout\n\nContext",
        metadata: {
          purpose: "Checkout entry",
          implementation: DEFAULT_NOTE_IMPLEMENTATION,
        },
      });

      const created = result.project.spatialMap.nodes.find((node) => node.id === result.nodeId);
      expect(created).toMatchObject({
        id: "page-checkout-page",
        label: "Checkout Page",
        type: "page",
        status: "working",
        context: "# Checkout\n\nContext",
        rawContext: "# Checkout\n\nContext",
        metadata: { purpose: "Checkout entry" },
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("creates a standalone note node with context and metadata", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-create-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const project = await createProjectOnDisk({ name: "Context Notes" });
      const result = await createContextNodeOnDisk({
        projectId: project.id,
        label: "Loose Notes",
        context: "## Inbox\n\n- Keep this here",
        metadata: {
          purpose: "Captured research notes",
          implementation: DEFAULT_NOTE_IMPLEMENTATION,
        },
      });

      expect(result.nodeId).toBe("note-loose-notes");
      expect(result.createdNodeIds).toEqual(["note-loose-notes"]);
      expect(result.project.spatialMap.nodes.at(-1)).toMatchObject({
        id: "note-loose-notes",
        label: "Loose Notes",
        type: "note",
        metadata: { purpose: "Captured research notes" },
        context: "## Inbox\n\n- Keep this here",
        rawContext: "## Inbox\n\n- Keep this here",
      });
      expect(result.createdNodeCount).toBe(1);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("splits markdown headings into linked context nodes", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-split-"));
    const dataDir = path.join(tempRoot, "app", "data");
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
        metadata: { purpose: "Imported markdown" },
        splitByHeadingLevel: true,
      });

      expect(result.nodeId).toBe("note-imported-notes");
      expect(result.createdNodeCount).toBe(5);
      expect(result.createdNodeIds).toEqual([
        "note-imported-notes",
        "note-overview",
        "note-metrics",
        "note-risks",
        "note-appendix",
      ]);
      expect(result.createdLinks).toEqual([
        { source: "note-imported-notes", target: "note-overview", parentChild: true },
        { source: "note-overview", target: "note-metrics", parentChild: true },
        { source: "note-overview", target: "note-risks", parentChild: true },
        { source: "note-imported-notes", target: "note-appendix", parentChild: true },
      ]);
      expect(result.project.spatialMap.nodes.slice(-5)).toEqual([
        expect.objectContaining({
          id: "note-imported-notes",
          label: "Imported Notes",
          metadata: { purpose: "Imported markdown" },
          context: "Shared intro",
        }),
        expect.objectContaining({
          id: "note-overview",
          label: "Overview",
          metadata: {},
          context: "Overview details",
        }),
        expect.objectContaining({
          id: "note-metrics",
          label: "Metrics",
          metadata: {},
          context: "- Conversion",
        }),
        expect.objectContaining({
          id: "note-risks",
          label: "Risks",
          metadata: {},
          context: "Risk details",
        }),
        expect.objectContaining({
          id: "note-appendix",
          label: "Appendix",
          metadata: {},
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
    const dataDir = path.join(tempRoot, "app", "data");
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
          metadata: {},
          context: "",
        }),
        expect.objectContaining({
          id: "note-overview",
          label: "Overview",
          metadata: {},
          context: "Overview details",
        }),
        expect.objectContaining({
          id: "note-metrics",
          label: "Metrics",
          metadata: {},
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
          metadata: {},
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

  it("splits markdown list items into linked context nodes", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-list-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const project = await createProjectOnDisk({ name: "List Import" });
      const result = await createContextNodeOnDisk({
        projectId: project.id,
        label: "Logo Dodo",
        context: [
          "- Allow control over logo only, logo + word mark, etc.",
          "- Remove the disabled generate button when status is showing",
          "- Pricing should probably just be buy $10 worth of credits",
          "  - Price things so that the margin is like 80% if possible.",
          "- Clicking again on a liked image needs to mark it not liked",
        ].join("\n"),
        splitByListItems: true,
        splitNestedListItems: true,
      });

      expect(result.createdNodeCount).toBe(6);
      expect(result.createdNodeIds).toEqual([
        "note-logo-dodo",
        "note-allow-control-over-logo-only-logo-word-mark-etc",
        "note-remove-the-disabled-generate-button-when-status-is-showing",
        "note-pricing-should-probably-just-be-buy-10-worth-of-credits",
        "note-price-things-so-that-the-margin-is-like-80-if-possible",
        "note-clicking-again-on-a-liked-image-needs-to-mark-it-not-liked",
      ]);
      expect(result.createdLinks).toEqual([
        {
          source: "note-logo-dodo",
          target: "note-allow-control-over-logo-only-logo-word-mark-etc",
          parentChild: true,
        },
        {
          source: "note-logo-dodo",
          target: "note-remove-the-disabled-generate-button-when-status-is-showing",
          parentChild: true,
        },
        {
          source: "note-logo-dodo",
          target: "note-pricing-should-probably-just-be-buy-10-worth-of-credits",
          parentChild: true,
        },
        {
          source: "note-pricing-should-probably-just-be-buy-10-worth-of-credits",
          target: "note-price-things-so-that-the-margin-is-like-80-if-possible",
          parentChild: true,
        },
        {
          source: "note-logo-dodo",
          target: "note-clicking-again-on-a-liked-image-needs-to-mark-it-not-liked",
          parentChild: true,
        },
      ]);
      expect(result.project.spatialMap.nodes.slice(-6)).toEqual([
        expect.objectContaining({
          id: "note-logo-dodo",
          label: "Logo Dodo",
          context: "",
        }),
        expect.objectContaining({
          label: "Allow control over logo only, logo + word mark, etc.",
          context: "",
        }),
        expect.objectContaining({
          label: "Remove the disabled generate button when status is showing",
          context: "",
        }),
        expect.objectContaining({
          label: "Pricing should probably just be buy $10 worth of credits",
          context: "",
        }),
        expect.objectContaining({
          label: "Price things so that the margin is like 80% if possible.",
          context: "",
        }),
        expect.objectContaining({
          label: "Clicking again on a liked image needs to mark it not liked",
          context: "",
        }),
      ]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("keeps nested list items as parent context when recursive list splitting is off", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-list-flat-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(path.join(dataDir, "projects.json"), "[]\n", "utf8");

    try {
      process.chdir(tempRoot);

      const project = await createProjectOnDisk({ name: "Flat List Import" });
      const result = await createContextNodeOnDisk({
        projectId: project.id,
        label: "Logo Dodo",
        context: [
          "- Pricing should probably just be buy $10 worth of credits",
          "  - Price things so that the margin is like 80% if possible.",
          "- Provide an existing image as context",
        ].join("\n"),
        splitByListItems: true,
        splitNestedListItems: false,
      });

      expect(result.createdNodeCount).toBe(3);
      expect(result.createdLinks).toEqual([
        {
          source: "note-logo-dodo",
          target: "note-pricing-should-probably-just-be-buy-10-worth-of-credits",
          parentChild: true,
        },
        {
          source: "note-logo-dodo",
          target: "note-provide-an-existing-image-as-context",
          parentChild: true,
        },
      ]);
      expect(result.project.spatialMap.nodes.slice(-3)).toEqual([
        expect.objectContaining({
          id: "note-logo-dodo",
          label: "Logo Dodo",
          context: "",
        }),
        expect.objectContaining({
          label: "Pricing should probably just be buy $10 worth of credits",
          context: "- Price things so that the margin is like 80% if possible.",
        }),
        expect.objectContaining({
          label: "Provide an existing image as context",
          context: "",
        }),
      ]);
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("treats legacy note nodes as context-only and preserves current context as raw context", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-legacy-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeProjectFixture(dataDir, buildProjectFixture({
      id: "legacy-note-project",
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
    }));

    try {
      process.chdir(tempRoot);

      const persisted = await readProjectByIdFromDisk("legacy-note-project");
      expect(persisted?.spatialMap.nodes[0]).toMatchObject({
        id: "legacy-note",
        metadata: { purpose: "Purpose", implementation: "Implementation" },
        context: "Legacy context",
        rawContext: "Legacy context",
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("drops legacy note boilerplate metadata during migration and writes it back to disk", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-context-boilerplate-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    const projectId = "boilerplate-note-project";
    writeProjectFixture(dataDir, buildProjectFixture({
      id: projectId,
      spatialMap: {
        nodes: [
          {
            id: "legacy-note",
            label: "Legacy Note",
            type: "note",
            depth: 2,
            purpose: DEFAULT_NOTE_PURPOSE,
            implementation: DEFAULT_NOTE_IMPLEMENTATION,
            context: "Legacy context",
          },
        ],
        links: [],
      },
    }));

    try {
      process.chdir(tempRoot);

      const persisted = await readProjectByIdFromDisk(projectId);
      expect(persisted?.spatialMap.nodes[0]?.metadata).toEqual({});

      const writtenBack = JSON.parse(
        readFileSync(path.join(dataDir, "projects", projectId, "project.json"), "utf8"),
      ) as {
        operationLog: Array<{
          kind: string;
          actor: { kind: string };
          payload?: {
            state?: {
              spatialMap: { nodes: Array<{ metadata?: Record<string, string> }> };
            };
          };
        }>;
      };
      expect(writtenBack.operationLog.some((entry) => entry.kind === "project.backfilled")).toBe(false);
      expect(writtenBack.operationLog[0]?.payload?.state?.spatialMap.nodes[0]?.metadata).toEqual({});
      expect(writtenBack.operationLog[0]?.kind).toBe("node.type.updated");
      expect(writtenBack.operationLog[0]?.actor.kind).toBe("human");
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("migrates legacy and project backfill state into node activity entries", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-oplog-migration-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    const projectId = "backfilled-project";
    const node = buildNode({
      id: "page-home",
      label: "Home",
      type: "page",
      depth: 0,
      metadata: { purpose: "Homepage" },
      context: "# Home",
      rawContext: "# Home",
    });
    writeProjectFixture(dataDir, {
      id: projectId,
      name: projectId,
      description: "Test fixture",
      createdAt: "2026-04-20T00:00:00.000Z",
      updatedAt: "2026-04-20T00:00:00.000Z",
      operationLog: [
        {
          id: "legacy-backfill-backfilled-project",
          kind: "project.backfilled",
          actor: { kind: "human", label: "Legacy project owner" },
          createdAt: "2026-04-20T00:00:00.000Z",
          summary: "Backfilled current project state into the canonical operation log.",
          nodeIds: [node.id],
          linkKeys: [],
          payload: {
            state: {
              nodeMetadataSchema: defaultSchema,
              nodeTypeSchema: defaultTypeSchema,
              spatialMap: {
                nodes: [node],
                links: [],
              },
            },
          },
        },
      ],
    });

    try {
      process.chdir(tempRoot);

      const persisted = await readProjectByIdFromDisk(projectId);
      expect(persisted?.spatialMap.nodes[0]).toMatchObject({
        id: "page-home",
        label: "Home",
        metadata: { purpose: "Homepage" },
      });

      const writtenBack = JSON.parse(
        readFileSync(path.join(dataDir, "projects", projectId, "project.json"), "utf8"),
      ) as {
        operationLog: Array<{
          kind: string;
          metadata?: Record<string, string>;
        }>;
      };
      expect(writtenBack.operationLog.map((entry) => entry.kind)).toEqual([
        "node.metadata.updated",
        "node.type.updated",
        "node.created",
        "project.schema.updated",
        "project.created",
      ]);
      expect(writtenBack.operationLog[0]?.metadata?.sourceOperationId).toBe(
        "legacy-backfill-backfilled-project",
      );
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("updates node metadata on disk", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-metadata-update-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeProjectFixture(dataDir, buildProjectFixture({
      id: "metadata-project",
      spatialMap: {
        nodes: [buildNode({ id: "node-1", label: "Node 1", type: "page", depth: 0 })],
        links: [],
      },
    }));

    try {
      process.chdir(tempRoot);

      const project = await updateProjectNodeMetadataOnDisk({
        projectId: "metadata-project",
        nodeId: "node-1",
        metadata: {
          purpose: "Updated purpose",
          implementation: DEFAULT_NOTE_IMPLEMENTATION,
        },
      });

      expect(project.spatialMap.nodes[0]?.metadata).toEqual({ purpose: "Updated purpose" });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("updates project metadata schema and remaps node values", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-schema-update-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeProjectFixture(dataDir, buildProjectFixture({
      id: "schema-project",
      spatialMap: {
        nodes: [
          buildNode({
            id: "node-1",
            label: "Node 1",
            type: "page",
            depth: 0,
            metadata: { purpose: "Mapped purpose", implementation: "Mapped implementation" },
          }),
        ],
        links: [],
      },
    }));

    try {
      process.chdir(tempRoot);

      const project = await updateProjectMetadataSchemaOnDisk({
        projectId: "schema-project",
        nodeTypes: defaultTypeSchema,
        fields: [
          {
            originalKey: "purpose",
            key: "summary",
            label: "Summary",
            defaultValue: "",
          },
          {
            originalKey: "implementation",
            key: "build-plan",
            label: "Build Plan",
            defaultValue: "",
          },
        ],
      });

      expect(project.nodeMetadataSchema.map((field) => field.key)).toEqual([
        "summary",
        "build-plan",
      ]);
      expect(project.spatialMap.nodes[0]?.metadata).toEqual({
        summary: "Mapped purpose",
        "build-plan": "Mapped implementation",
      });
    } finally {
      process.chdir(originalCwd);
    }
  });

  it("deletes a node and prunes attached links", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-node-delete-"));
    const dataDir = path.join(tempRoot, "app", "data");
    mkdirSync(dataDir, { recursive: true });
    writeProjectFixture(dataDir, buildProjectFixture({
      id: "delete-node-project",
      spatialMap: {
        nodes: [
          buildNode({
            id: "node-a",
            label: "Node A",
            type: "page",
            depth: 0,
            metadata: { purpose: "Purpose", implementation: "Implementation" },
          }),
          buildNode({
            id: "node-b",
            label: "Node B",
            type: "note",
            depth: 2,
            metadata: { purpose: "Purpose", implementation: "Implementation" },
            context: "Context",
            rawContext: "Context",
          }),
        ],
        links: [
          { source: "node-a", target: "node-b", parentChild: false, relationship: "related" },
          { source: "node-b", target: "node-a", parentChild: false, relationship: "related" },
        ],
      },
    }));

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

  it("deletes a node image from metadata and disk", async () => {
    const originalCwd = process.cwd();
    const tempRoot = mkdtempSync(path.join(os.tmpdir(), "project-grid-image-delete-"));
    const dataDir = path.join(tempRoot, "app", "data");
    const imageDir = path.join(dataDir, "projects", "delete-image-project", "images", "node-a");
    const imagePath = path.join(imageDir, "image-a.png");
    mkdirSync(imageDir, { recursive: true });
    writeFileSync(imagePath, Buffer.from("fake-png"));
    writeProjectFixture(dataDir, buildProjectFixture({
      id: "delete-image-project",
      spatialMap: {
        nodes: [
          buildNode({
            id: "node-a",
            label: "Node A",
            type: "page",
            depth: 0,
            metadata: { purpose: "Purpose", implementation: "Implementation" },
            images: [
              {
                id: "image-a",
                src: "/api/projects/delete-image-project/images/node-a/image-a.png",
                filename: "image-a.png",
                originalName: "image-a.png",
                mimeType: "image/png",
                size: 8,
                createdAt: "2026-04-20T00:00:00.000Z",
              },
            ],
          }),
        ],
        links: [],
      },
    }));

    try {
      process.chdir(tempRoot);

      const project = await deleteProjectNodeImageOnDisk({
        projectId: "delete-image-project",
        nodeId: "node-a",
        imageId: "image-a",
      });

      expect(project.spatialMap.nodes[0]?.images).toEqual([]);
      expect(existsSync(imagePath)).toBe(false);
    } finally {
      process.chdir(originalCwd);
    }
  });
});

function buildNode(input: {
  id: string;
  label: string;
  type: string;
  depth: number;
  metadata?: Record<string, string>;
  context?: string;
  rawContext?: string;
  images?: MapNodeImage[];
}) {
  return {
    id: input.id,
    label: input.label,
    type: input.type,
    status: "planned" as const,
    depth: input.depth,
    metadata: input.metadata ?? {},
    context: input.context ?? "",
    rawContext: input.rawContext ?? "",
    images: input.images ?? [],
  };
}

function buildProjectFixture(input: {
  id: string;
  spatialMap: Record<string, unknown>;
}) {
  return {
    id: input.id,
    name: input.id,
    description: "Test fixture",
    createdAt: "2026-04-20T00:00:00.000Z",
    updatedAt: "2026-04-20T00:00:00.000Z",
    nodeMetadataSchema: defaultSchema,
    spatialMap: input.spatialMap,
  };
}

function writeProjectFixture(dataDir: string, project: Record<string, unknown>) {
  const projectDir = path.join(dataDir, "projects", String(project.id));
  mkdirSync(projectDir, { recursive: true });
  writeFileSync(path.join(projectDir, "project.json"), `${JSON.stringify(project, null, 2)}\n`, "utf8");
}
