import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createChildNodeOnDisk,
  createProjectOnDisk,
  getProjectDataDir,
  readProjectByIdFromDisk,
} from "~/lib/projects/data.server";
import { patchProjectNodeOnDisk } from "~/lib/projects/node-patch.server";
import { RECENT_HISTORY_LIMIT } from "./history-files";
import { readHistoryPage } from "./history-page.server";

let tempRoot = "";
let originalDataDir: string | undefined;

beforeEach(() => {
  originalDataDir = process.env.APP_DATA_DIR;
  tempRoot = mkdtempSync(path.join(os.tmpdir(), "boxtown-history-"));
  process.env.APP_DATA_DIR = tempRoot;
});

afterEach(() => {
  if (originalDataDir === undefined) delete process.env.APP_DATA_DIR;
  else process.env.APP_DATA_DIR = originalDataDir;
  rmSync(tempRoot, { recursive: true, force: true });
});

describe("durable history", () => {
  it("keeps every entry past the recent window and pages through them without gaps", async () => {
    const project = await createProjectOnDisk({ name: "History Fixture" });
    const { nodeId } = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Node" });
    const total = RECENT_HISTORY_LIMIT + 30;
    // Two entries already exist: project created and node created.
    for (let index = 2; index < total; index += 1) {
      await patchProjectNodeOnDisk({ projectId: project.id, nodeId, patch: { context: `Edit ${index}` } });
    }

    const projectDir = getProjectDataDir(project.id);
    expect(readdirSync(path.join(projectDir, "history"))).toHaveLength(total);
    const loaded = await readProjectByIdFromDisk(project.id);
    expect(loaded?.operationLog).toHaveLength(RECENT_HISTORY_LIMIT);

    const seen: string[] = [];
    let cursor: string | undefined;
    let pageCount = 0;
    do {
      const page = await readHistoryPage(projectDir, { before: cursor, limit: 40 });
      seen.push(...page.entries.map((entry) => entry.id));
      if (pageCount === 0) {
        // A write between pages must not shift the continuation.
        await patchProjectNodeOnDisk({ projectId: project.id, nodeId, patch: { context: "Late edit" } });
      }
      cursor = page.nextCursor ?? undefined;
      pageCount += 1;
    } while (cursor);

    expect(seen).toHaveLength(total);
    expect(new Set(seen).size).toBe(total);
    const oldest = await readHistoryPage(projectDir, { limit: 500 });
    expect(oldest.entries.at(-1)?.kind).toBe("project.created");
  });

  it("filters a page to one node", async () => {
    const project = await createProjectOnDisk({ name: "History Filter" });
    const first = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "First" });
    const second = await createChildNodeOnDisk({ projectId: project.id, parentNodeId: null, title: "Second" });
    await patchProjectNodeOnDisk({ projectId: project.id, nodeId: second.nodeId, patch: { title: "Second renamed" } });

    const page = await readHistoryPage(getProjectDataDir(project.id), { nodeId: first.nodeId });

    expect(page.entries.map((entry) => entry.kind)).toEqual(["node.created"]);
    expect(page.nextCursor).toBeNull();
  });

  it("rejects a malformed cursor", async () => {
    const project = await createProjectOnDisk({ name: "History Cursor" });
    await expect(readHistoryPage(getProjectDataDir(project.id), { before: "bogus" })).rejects.toThrow(
      "History cursor is not valid.",
    );
  });
});
