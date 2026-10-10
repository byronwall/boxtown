import { describe, expect, it } from "vitest";
import type { MapLink, MapNode } from "~/lib/spatial-map/types";
import { assignHistoryFileNames } from "./history-files";
import { parseNodeFile, serializeNodeFile } from "./node-file";
import { assembleProjectGraph } from "./project-integrity";

function node(overrides: Partial<MapNode> & { id: string }): MapNode {
  return {
    label: overrides.id,
    type: "task",
    status: "planned",
    metadata: {},
    context: "",
    rawContext: "",
    images: [],
    ...overrides,
  };
}

function roundTrip(input: MapNode, links: MapLink[] = []) {
  return parseNodeFile(serializeNodeFile(input, links), "nodes/test.md");
}

describe("node files", () => {
  it("round-trips every node field, including awkward text", () => {
    const input = node({
      id: "feature-tricky",
      label: "yes: a \"quoted\" # title",
      status: "needs-review",
      priority: "high" as MapNode["priority"],
      archived: true,
      metadata: { zeta: "last", implementation: "line one\n  indented\n---\nnull" },
      context: "# Heading\n\n---\n\nBody with trailing space \n",
      rawContext: "original",
      images: [{
        id: "img-1",
        src: "/api/projects/p/images/feature-tricky/a.png",
        filename: "a.png",
        originalName: "a b.png",
        mimeType: "image/png",
        size: 12,
        createdAt: "2026-10-07T02:27:56.886Z",
      }],
    });
    const links: MapLink[] = [
      { source: "parent", target: "feature-tricky", parentChild: true },
      { source: "feature-tricky", target: "other", parentChild: false, relationship: "dependency" },
    ];

    const parsed = roundTrip(input, links);

    expect(parsed.node).toEqual(input);
    expect(parsed.parentIds).toEqual(["parent"]);
    expect(parsed.links).toEqual([{ target: "other", relationship: "dependency" }]);
  });

  it("keeps context and rawContext distinct only when they differ", () => {
    const same = serializeNodeFile(node({ id: "a", context: "Same", rawContext: "Same" }), []);
    expect(same).not.toContain("rawContext");
    expect(parseNodeFile(same, "a.md").node.rawContext).toBe("Same");

    for (const context of ["", "\n", "no newline", "ends with newline\n"]) {
      expect(roundTrip(node({ id: "a", context, rawContext: context })).node.context).toBe(context);
    }
  });

  it("writes metadata keys in a stable order", () => {
    const left = serializeNodeFile(node({ id: "a", metadata: { b: "2", a: "1" } }), []);
    const right = serializeNodeFile(node({ id: "a", metadata: { a: "1", b: "2" } }), []);
    expect(left).toBe(right);
  });

  it("keeps carriage returns pasted into context", () => {
    const context = "Pasted\r\nfrom a browser\r\n";
    expect(roundTrip(node({ id: "a", context, rawContext: context })).node.context).toBe(context);
  });

  it("reads files saved with Windows line endings", () => {
    const raw = serializeNodeFile(node({ id: "a", context: "One\nTwo" }), []).replace(/\n/g, "\r\n");
    expect(parseNodeFile(raw, "a.md").node.context).toBe("One\nTwo");
  });

  it("names the file in parse errors", () => {
    expect(() => parseNodeFile("id: a\n", "nodes/a.md")).toThrow("nodes/a.md");
    expect(() => parseNodeFile("---\nid: [\n---\n", "nodes/a.md")).toThrow("nodes/a.md");
  });
});

describe("project integrity after merges", () => {
  const file = (id: string, parentIds: string[] = [], links: Array<{ target: string }> = []) => ({
    node: { id },
    parentIds,
    links: links.map((link) => ({ ...link, relationship: "related" as const })),
    fileLabel: `nodes/${id}.md`,
  });

  it("moves children of a deleted parent to the root and drops dangling links", () => {
    const graph = assembleProjectGraph([file("child", ["gone"], [{ target: "missing" }]), file("kept")]);
    expect(graph.links).toEqual([]);
    expect(graph.issues).toHaveLength(2);
  });

  it("cuts parent cycles from crossing moves the same way every time", () => {
    const forward = assembleProjectGraph([file("a", ["b"]), file("b", ["a"])]);
    const backward = assembleProjectGraph([file("b", ["a"]), file("a", ["b"])]);
    expect(forward.links).toEqual([{ source: "a", target: "b", parentChild: true }]);
    expect(backward.links).toEqual(forward.links);
    expect(forward.issues[0]).toContain("Parent cycle");
  });
});

describe("history file names", () => {
  const entry = (id: string, createdAt: string) => ({
    id,
    kind: "node.created" as const,
    actor: { kind: "human" as const },
    createdAt,
    summary: id,
    nodeIds: [],
  });

  it("orders entries that share a timestamp and keeps existing names", () => {
    const stamp = "2026-04-20T00:00:00.000Z";
    const names = assignHistoryFileNames([entry("newer", stamp), entry("older", stamp)], []);
    expect(names.get("older")).toBe("20260420T000000000Z-0000-older.json");
    expect(names.get("newer")).toBe("20260420T000000000Z-0001-newer.json");

    const again = assignHistoryFileNames(
      [entry("latest", stamp), entry("newer", stamp), entry("older", stamp)],
      names.values(),
    );
    expect(again.get("newer")).toBe(names.get("newer"));
    expect(again.get("latest")).toBe("20260420T000000000Z-0002-latest.json");
  });
});
