import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import {
  VIEWPORT_HEIGHT,
  VIEWPORT_WIDTH,
  buildAdjacencyMap,
  createInitialLayout,
  stepLayout,
} from "~/lib/spatial-map/layout";
import type { PositionedMapNode } from "~/lib/spatial-map/types";
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

  it("settles without overlapping nodes while allowing shared borders", () => {
    const layout = createInitialLayout(parsedData);
    const overlappingPairs: string[] = [];

    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        if (rectanglesOverlap(layout[i], layout[j])) {
          overlappingPairs.push(`${layout[i].id}:${layout[j].id}`);
        }
      }
    }

    expect(overlappingPairs).toEqual([]);
  });

  it("packs nodes tightly enough to create shared borders", () => {
    const layout = createInitialLayout(parsedData);
    let touchingPairs = 0;

    for (let i = 0; i < layout.length; i += 1) {
      for (let j = i + 1; j < layout.length; j += 1) {
        if (rectanglesTouch(layout[i], layout[j])) {
          touchingPairs += 1;
        }
      }
    }

    expect(touchingPairs).toBeGreaterThanOrEqual(20);
  });

  it("keeps the packed bounds reasonably close to the viewport aspect ratio", () => {
    const layout = createInitialLayout(parsedData);
    const bounds = getLayoutBounds(layout);
    const viewportAspect = VIEWPORT_WIDTH / VIEWPORT_HEIGHT;
    const layoutAspect = bounds.width / bounds.height;

    expect(layoutAspect).toBeGreaterThanOrEqual(viewportAspect * 0.72);
    expect(layoutAspect).toBeLessThanOrEqual(viewportAspect * 1.2);
  });

  it("steps the force layout without losing nodes", () => {
    const initial = createInitialLayout(parsedData);
    const adjacency = buildAdjacencyMap(parsedData);
    const next = stepLayout(initial, adjacency, initial[0]?.id ?? null);

    expect(next).toHaveLength(initial.length);
    expect(next.every((node) => Number.isFinite(node.x) && Number.isFinite(node.y))).toBe(true);
  });
});

function rectanglesOverlap(a: PositionedMapNode, b: PositionedMapNode) {
  return (
    getAxisOverlap(a.x, a.width, b.x, b.width) > 0 &&
    getAxisOverlap(a.y, a.height, b.y, b.height) > 0
  );
}

function rectanglesTouch(a: PositionedMapNode, b: PositionedMapNode) {
  const overlapX = getAxisOverlap(a.x, a.width, b.x, b.width);
  const overlapY = getAxisOverlap(a.y, a.height, b.y, b.height);
  const tolerance = 4;

  const sharesVerticalBorder =
    Math.abs(overlapX) <= tolerance && overlapY >= -tolerance;
  const sharesHorizontalBorder =
    Math.abs(overlapY) <= tolerance && overlapX >= -tolerance;

  return (
    (sharesVerticalBorder || sharesHorizontalBorder) &&
    !(overlapX > 0 && overlapY > 0)
  );
}

function getLayoutBounds(nodes: PositionedMapNode[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const node of nodes) {
    minX = Math.min(minX, node.x - node.width / 2);
    minY = Math.min(minY, node.y - node.height / 2);
    maxX = Math.max(maxX, node.x + node.width / 2);
    maxY = Math.max(maxY, node.y + node.height / 2);
  }

  return {
    width: maxX - minX,
    height: maxY - minY,
  };
}

function getAxisOverlap(
  aCenter: number,
  aSize: number,
  bCenter: number,
  bSize: number,
) {
  return (aSize + bSize) / 2 - Math.abs(aCenter - bCenter);
}
