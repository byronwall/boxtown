import type { PositionedMapNode } from "./types";

type Bounds = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

const DEFAULT_CELL_SIZE = 256;

export class SpatialCollisionIndex {
  private readonly cells = new Map<string, PositionedMapNode[]>();

  constructor(
    nodes: PositionedMapNode[] = [],
    private readonly cellSize = DEFAULT_CELL_SIZE,
  ) {
    for (const node of nodes) {
      this.insert(node);
    }
  }

  insert(node: PositionedMapNode) {
    for (const key of this.getKeys(getNodeBounds(node))) {
      const bucket = this.cells.get(key);
      if (bucket) {
        bucket.push(node);
      } else {
        this.cells.set(key, [node]);
      }
    }
  }

  queryNode(node: PositionedMapNode, padding = 0) {
    return this.queryBounds(
      {
        minX: node.x - node.width / 2 - padding,
        minY: node.y - node.height / 2 - padding,
        maxX: node.x + node.width / 2 + padding,
        maxY: node.y + node.height / 2 + padding,
      },
      node.id,
    );
  }

  queryRect(
    x: number,
    y: number,
    width: number,
    height: number,
    excludeId?: string,
  ) {
    return this.queryBounds(
      {
        minX: x - width / 2,
        minY: y - height / 2,
        maxX: x + width / 2,
        maxY: y + height / 2,
      },
      excludeId,
    );
  }

  private queryBounds(bounds: Bounds, excludeId?: string) {
    const result: PositionedMapNode[] = [];
    const seen = new Set<string>();

    for (const key of this.getKeys(bounds)) {
      for (const node of this.cells.get(key) ?? []) {
        if (node.id === excludeId || seen.has(node.id)) {
          continue;
        }

        seen.add(node.id);
        result.push(node);
      }
    }

    return result.sort((left, right) => left.id.localeCompare(right.id));
  }

  private getKeys(bounds: Bounds) {
    const minCellX = Math.floor(bounds.minX / this.cellSize);
    const maxCellX = Math.floor(bounds.maxX / this.cellSize);
    const minCellY = Math.floor(bounds.minY / this.cellSize);
    const maxCellY = Math.floor(bounds.maxY / this.cellSize);
    const keys: string[] = [];

    for (let cellY = minCellY; cellY <= maxCellY; cellY += 1) {
      for (let cellX = minCellX; cellX <= maxCellX; cellX += 1) {
        keys.push(`${cellX}:${cellY}`);
      }
    }

    return keys;
  }
}

function getNodeBounds(node: PositionedMapNode): Bounds {
  return {
    minX: node.x - node.width / 2,
    minY: node.y - node.height / 2,
    maxX: node.x + node.width / 2,
    maxY: node.y + node.height / 2,
  };
}
