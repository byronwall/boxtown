import { describe, expect, it } from "vitest";
import { mergeGeneratedSpatialMapData } from "./data.server";

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
          },
        ],
        links: [
          {
            source: "page-home",
            target: "page-home",
            kind: "related",
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
          },
        ],
        links: [
          {
            source: "page-home",
            target: "draft-node",
            kind: "hierarchy",
          },
          {
            source: "page-home",
            target: "draft-node",
            kind: "hierarchy",
          },
          {
            source: "draft-node",
            target: "missing-node",
            kind: "related",
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
        kind: "related",
      },
      {
        source: "page-home",
        target: "page-billing-center",
        kind: "hierarchy",
      },
    ]);
  });
});
