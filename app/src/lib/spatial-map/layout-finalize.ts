import { SpatialCollisionIndex } from "./layout-collision-index";
import { getAxisOverlap, getLayoutBounds, rectanglesOverlap } from "./layout-geometry";
import type { PositionedMapNode } from "./types";

export function finalizePackedLayout(
  nodes: PositionedMapNode[],
  desiredAspect: number,
) {
  let nextNodes = nodes.map((node) => ({ ...node }));

  for (let pass = 0; pass < 4; pass += 1) {
    const beforeBounds = getLayoutBounds(nextNodes);
    nextNodes = dockFloatingNodes(nextNodes, desiredAspect);
    nextNodes = compactLayoutTowardCenter(nextNodes, desiredAspect);
    nextNodes = rebalanceAspectByDocking(nextNodes, desiredAspect);
    nextNodes = dockFloatingNodes(nextNodes, desiredAspect);

    const afterBounds = getLayoutBounds(nextNodes);
    const shrink =
      beforeBounds.width * beforeBounds.height - afterBounds.width * afterBounds.height;
    if (shrink < 8 && getFloatingNodes(nextNodes).length === 0) break;
  }

  return compactLayoutTowardCenter(nextNodes, desiredAspect);
}

function dockFloatingNodes(nodes: PositionedMapNode[], desiredAspect: number) {
  let nextNodes = nodes.map((node) => ({ ...node }));

  for (let pass = 0; pass < 3; pass += 1) {
    const floatingNodes = getFloatingNodes(nextNodes);
    if (floatingNodes.length === 0) break;

    let moved = false;
    const bounds = getLayoutBounds(nextNodes);
    const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };

    for (const node of floatingNodes) {
      const candidate = findDockingPosition(nextNodes, node, center, desiredAspect);
      if (!candidate) continue;

      nextNodes = nextNodes.map((item) =>
        item.id === node.id ? { ...item, x: candidate.x, y: candidate.y } : item,
      );
      moved = true;
    }

    if (!moved) break;
  }

  return nextNodes;
}

function getFloatingNodes(nodes: PositionedMapNode[]) {
  return nodes
    .filter((node) => !hasTouchingNeighbor(nodes, node))
    .sort((left, right) => {
      const bounds = getLayoutBounds(nodes);
      const centerX = (bounds.minX + bounds.maxX) / 2;
      const centerY = (bounds.minY + bounds.maxY) / 2;
      const leftDistance = Math.hypot(left.x - centerX, left.y - centerY);
      const rightDistance = Math.hypot(right.x - centerX, right.y - centerY);
      if (leftDistance !== rightDistance) return rightDistance - leftDistance;
      return left.id.localeCompare(right.id);
    });
}

function hasTouchingNeighbor(nodes: PositionedMapNode[], node: PositionedMapNode) {
  const index = new SpatialCollisionIndex(nodes);
  return index.queryNode(node, 3).some((candidate) => rectanglesTouch(node, candidate, 3));
}

function countTouchingNeighbors(nodes: PositionedMapNode[], node: PositionedMapNode) {
  const index = new SpatialCollisionIndex(nodes);
  return index.queryNode(node, 3).filter((candidate) => rectanglesTouch(node, candidate, 3))
    .length;
}

function findDockingPosition(
  nodes: PositionedMapNode[],
  node: PositionedMapNode,
  center: { x: number; y: number },
  desiredAspect: number,
) {
  const otherNodes = nodes.filter((item) => item.id !== node.id);
  const index = new SpatialCollisionIndex(otherNodes);
  const anchors = getDockingAnchors(otherNodes, node, center).slice(0, 20);
  let bestCandidate: { x: number; y: number; score: number } | null = null;

  for (const anchor of anchors) {
    for (const position of getDockingCandidates(node, anchor)) {
      if (wouldOverlap(index, node, position)) continue;

      const score = scoreDockingCandidate(otherNodes, node, position, center, desiredAspect);
      if (!bestCandidate || score < bestCandidate.score) {
        bestCandidate = { ...position, score };
      }
    }
  }

  return bestCandidate;
}

function rebalanceAspectByDocking(nodes: PositionedMapNode[], desiredAspect: number) {
  if (nodes.length < 8) return nodes;

  let nextNodes = nodes.map((node) => ({ ...node }));

  for (let pass = 0; pass < 10; pass += 1) {
    const bounds = getLayoutBounds(nextNodes);
    const aspect = bounds.width / Math.max(bounds.height, 1);
    const needsWidth = aspect < desiredAspect * 0.96;
    const needsHeight = aspect > desiredAspect * 1.04;
    if (!needsWidth && !needsHeight) break;

    const node = getAspectEdgeNodes(nextNodes, needsWidth ? "y" : "x")[pass];
    if (!node) break;

    const otherNodes = nextNodes.filter((item) => item.id !== node.id);
    const candidate = findAxisDockingPosition(
      otherNodes,
      node,
      desiredAspect,
      needsWidth ? "x" : "y",
    );
    if (!candidate) continue;

    const currentError = getAspectError(nextNodes, desiredAspect);
    const nextCandidateNodes = nextNodes.map((item) =>
      item.id === node.id ? { ...item, x: candidate.x, y: candidate.y } : item,
    );
    if (getAspectError(nextCandidateNodes, desiredAspect) >= currentError) continue;

    nextNodes = nextCandidateNodes;
  }

  return nextNodes;
}

function getAspectEdgeNodes(nodes: PositionedMapNode[], axis: "x" | "y") {
  const bounds = getLayoutBounds(nodes);
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  const touchCountById = new Map(
    nodes.map((node) => [node.id, countTouchingNeighbors(nodes, node)]),
  );

  return [...nodes].sort((left, right) => {
    const leftEdgeDistance =
      axis === "x"
        ? Math.abs(left.x - centerX) + left.width / 2
        : Math.abs(left.y - centerY) + left.height / 2;
    const rightEdgeDistance =
      axis === "x"
        ? Math.abs(right.x - centerX) + right.width / 2
        : Math.abs(right.y - centerY) + right.height / 2;
    if (leftEdgeDistance !== rightEdgeDistance) return rightEdgeDistance - leftEdgeDistance;

    const touchDiff =
      (touchCountById.get(left.id) ?? 0) - (touchCountById.get(right.id) ?? 0);
    if (touchDiff !== 0) return touchDiff;

    return left.id.localeCompare(right.id);
  });
}

function findAxisDockingPosition(
  nodes: PositionedMapNode[],
  node: PositionedMapNode,
  desiredAspect: number,
  dockAxis: "x" | "y",
) {
  const index = new SpatialCollisionIndex(nodes);
  const bounds = getLayoutBounds(nodes);
  const center = { x: (bounds.minX + bounds.maxX) / 2, y: (bounds.minY + bounds.maxY) / 2 };
  let bestCandidate: { x: number; y: number; score: number } | null = null;

  for (const anchor of getDockingAnchors(nodes, node, center).slice(0, 36)) {
    const candidates = getDockingCandidates(node, anchor).filter((candidate) =>
      dockAxis === "x"
        ? Math.abs(candidate.x - anchor.x) > Math.abs(candidate.y - anchor.y)
        : Math.abs(candidate.y - anchor.y) > Math.abs(candidate.x - anchor.x),
    );

    for (const position of candidates) {
      if (wouldOverlap(index, node, position)) continue;

      const score = scoreDockingCandidate(nodes, node, position, center, desiredAspect);
      if (!bestCandidate || score < bestCandidate.score) {
        bestCandidate = { ...position, score };
      }
    }
  }

  return bestCandidate;
}

function getAspectError(nodes: PositionedMapNode[], desiredAspect: number) {
  const bounds = getLayoutBounds(nodes);
  const aspect = bounds.width / Math.max(bounds.height, 1);
  return Math.abs(Math.log(aspect / desiredAspect));
}

function getDockingAnchors(
  nodes: PositionedMapNode[],
  node: PositionedMapNode,
  center: { x: number; y: number },
) {
  return [...nodes].sort((left, right) => {
    const leftScore =
      Math.hypot(left.x - node.x, left.y - node.y) * 0.35 +
      Math.hypot(left.x - center.x, left.y - center.y) * 0.65;
    const rightScore =
      Math.hypot(right.x - node.x, right.y - node.y) * 0.35 +
      Math.hypot(right.x - center.x, right.y - center.y) * 0.65;
    if (leftScore !== rightScore) return leftScore - rightScore;
    return left.id.localeCompare(right.id);
  });
}

function getDockingCandidates(node: PositionedMapNode, anchor: PositionedMapNode) {
  return [
    { x: anchor.x, y: anchor.y - (anchor.height + node.height) / 2 },
    { x: anchor.x + (anchor.width + node.width) / 2, y: anchor.y },
    { x: anchor.x, y: anchor.y + (anchor.height + node.height) / 2 },
    { x: anchor.x - (anchor.width + node.width) / 2, y: anchor.y },
  ];
}

function scoreDockingCandidate(
  nodes: PositionedMapNode[],
  node: PositionedMapNode,
  position: { x: number; y: number },
  center: { x: number; y: number },
  desiredAspect: number,
) {
  const bounds = getLayoutBounds([...nodes, { ...node, x: position.x, y: position.y }]);
  const aspect = bounds.width / Math.max(bounds.height, 1);
  const aspectPenalty = Math.abs(Math.log(aspect / desiredAspect)) * 240;
  const distancePenalty = Math.hypot(position.x - center.x, position.y - center.y) * 0.28;
  const areaPenalty = bounds.width * bounds.height * 0.0004;

  return aspectPenalty + distancePenalty + areaPenalty;
}

function wouldOverlap(
  index: SpatialCollisionIndex,
  node: PositionedMapNode,
  position: { x: number; y: number },
) {
  return index
    .queryRect(position.x, position.y, node.width, node.height, node.id)
    .some((candidate) =>
      rectanglesOverlap(
        position.x,
        position.y,
        node.width,
        node.height,
        candidate.x,
        candidate.y,
        candidate.width,
        candidate.height,
      ),
    );
}

function rectanglesTouch(
  left: PositionedMapNode,
  right: PositionedMapNode,
  tolerance: number,
) {
  const overlapX = getAxisOverlap(left.x, left.width, right.x, right.width);
  const overlapY = getAxisOverlap(left.y, left.height, right.y, right.height);

  return (
    (Math.abs(overlapX) <= tolerance && overlapY >= -tolerance) ||
    (Math.abs(overlapY) <= tolerance && overlapX >= -tolerance)
  );
}

function compactLayoutTowardCenter(nodes: PositionedMapNode[], desiredAspect: number) {
  let nextNodes = nodes.map((node) => ({ ...node }));

  for (let pass = 0; pass < 7; pass += 1) {
    const beforeBounds = getLayoutBounds(nextNodes);
    const aspect = beforeBounds.width / Math.max(beforeBounds.height, 1);
    const axisOrder: Array<"x" | "y"> =
      aspect < desiredAspect ? ["y", "x"] : ["x", "y"];

    for (const axis of axisOrder) {
      const currentBounds = getLayoutBounds(nextNodes);
      const currentAspect = currentBounds.width / Math.max(currentBounds.height, 1);
      const worsensAspect =
        (axis === "x" && currentAspect < desiredAspect * 0.98) ||
        (axis === "y" && currentAspect > desiredAspect * 1.02);
      if (worsensAspect) continue;

      nextNodes = compactAxisTowardCenter(
        nextNodes,
        axis,
        axis === "x"
          ? (currentBounds.minX + currentBounds.maxX) / 2
          : (currentBounds.minY + currentBounds.maxY) / 2,
      );
    }

    const afterBounds = getLayoutBounds(nextNodes);
    const shrink =
      beforeBounds.width * beforeBounds.height - afterBounds.width * afterBounds.height;
    if (shrink < 8) break;
  }

  return nextNodes;
}

function compactAxisTowardCenter(
  nodes: PositionedMapNode[],
  axis: "x" | "y",
  center: number,
) {
  const nextNodes = nodes.map((node) => ({ ...node }));
  const sortedNodes = [...nextNodes].sort((left, right) => {
    const leftDistance = Math.abs((axis === "x" ? left.x : left.y) - center);
    const rightDistance = Math.abs((axis === "x" ? right.x : right.y) - center);
    if (leftDistance !== rightDistance) return rightDistance - leftDistance;
    return left.id.localeCompare(right.id);
  });

  for (const node of sortedNodes) {
    const delta = getCompactionDelta(nextNodes, node, axis, center);
    if (Math.abs(delta) < 0.5) continue;
    if (axis === "x") node.x += delta;
    else node.y += delta;
  }

  return nextNodes;
}

function getCompactionDelta(
  nodes: PositionedMapNode[],
  node: PositionedMapNode,
  axis: "x" | "y",
  center: number,
) {
  const current = axis === "x" ? node.x : node.y;
  const desiredDelta = center - current;
  const travel = Math.abs(desiredDelta);
  if (travel < 0.5) return 0;

  const direction = Math.sign(desiredDelta);
  const sweptCenter = current + desiredDelta / 2;
  const collisionIndex = new SpatialCollisionIndex(nodes);
  const candidates =
    axis === "x"
      ? collisionIndex.queryRect(sweptCenter, node.y, node.width + travel, node.height, node.id)
      : collisionIndex.queryRect(node.x, sweptCenter, node.width, node.height + travel, node.id);
  let maxTravel = travel;

  for (const candidate of candidates) {
    const gap = getCandidateGap(node, candidate, axis, direction);
    if (gap !== null) maxTravel = Math.min(maxTravel, gap);
  }

  return direction * maxTravel;
}

function getCandidateGap(
  node: PositionedMapNode,
  candidate: PositionedMapNode,
  axis: "x" | "y",
  direction: number,
) {
  if (axis === "x") {
    if (getAxisOverlap(node.y, node.height, candidate.y, candidate.height) <= 0) return null;
    if (direction > 0 && candidate.x <= node.x) return null;
    if (direction < 0 && candidate.x >= node.x) return null;
    const gap =
      direction > 0
        ? candidate.x - candidate.width / 2 - (node.x + node.width / 2)
        : node.x - node.width / 2 - (candidate.x + candidate.width / 2);
    return Math.max(0, gap);
  }

  if (getAxisOverlap(node.x, node.width, candidate.x, candidate.width) <= 0) return null;
  if (direction > 0 && candidate.y <= node.y) return null;
  if (direction < 0 && candidate.y >= node.y) return null;
  const gap =
    direction > 0
      ? candidate.y - candidate.height / 2 - (node.y + node.height / 2)
      : node.y - node.height / 2 - (candidate.y + candidate.height / 2);
  return Math.max(0, gap);
}
