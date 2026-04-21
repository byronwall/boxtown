import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  buildAdjacencyMap,
  createInitialLayout,
  stepLayout,
} from "~/lib/spatial-map/layout";
import { parseSpatialMapData } from "~/lib/spatial-map/validate";

const dataPath = path.join(process.cwd(), "src", "data", "spatial-map.json");
const parsedData = parseSpatialMapData(
  JSON.parse(readFileSync(dataPath, "utf8")),
);

describe("spatial map data", () => {
  it("parses the JSON seed file", () => {
    expect(parsedData.nodes.length).toBeGreaterThan(0);
    expect(parsedData.links.length).toBeGreaterThan(0);
  });
});

describe("spatial map layout", () => {
  it("creates a deterministic starting layout with sized nodes", () => {
    const layout = createInitialLayout(parsedData);
    expect(layout).toHaveLength(parsedData.nodes.length);
    expect(layout.every((node) => node.width > 0 && node.height > 0)).toBe(true);
  });

  it("steps the force layout without losing nodes", () => {
    const initial = createInitialLayout(parsedData);
    const adjacency = buildAdjacencyMap(parsedData);
    const next = stepLayout(initial, adjacency, initial[0]?.id ?? null);

    expect(next).toHaveLength(initial.length);
    expect(next.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });
});
