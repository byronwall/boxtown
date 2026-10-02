import type { MapLink, MapNode, SpatialMapData } from "~/lib/spatial-map/types";
import type { ProjectRecord } from "./types";

// Client-side project reconciliation: one authoritative server project plus
// ordered local changes that have not settled yet. The visible project is the
// server project with the unsettled changes replayed on top, so a server or
// websocket update never erases another pending edit, and a pending edit never
// erases an unrelated remote change.

type ProjectSettings = Pick<ProjectRecord, "name" | "description" | "nodeMetadataSchema" | "nodeTypeSchema">;

export interface ProjectLocalChange {
  id: string;
  nodePatches: Map<string, Partial<MapNode>>;
  addedNodes: MapNode[];
  removedNodeIds: Set<string>;
  addedLinks: MapLink[];
  removedLinkKeys: Set<string>;
  settings: Partial<ProjectSettings>;
}

export interface ProjectSyncState {
  server: ProjectRecord;
  pending: ProjectLocalChange[];
}

const settingsKeys = ["name", "description", "nodeMetadataSchema", "nodeTypeSchema"] as const;

export function createProjectSyncState(server: ProjectRecord): ProjectSyncState {
  return { server, pending: [] };
}

// Records the difference between the visible project and the optimistic
// snapshot a control produced, so it can be replayed onto newer server state.
export function addLocalChange(
  state: ProjectSyncState,
  id: string,
  visible: ProjectRecord,
  snapshot: ProjectRecord,
): ProjectSyncState {
  const change = diffProjects(id, visible, snapshot);
  return { ...state, pending: [...state.pending.filter((item) => item.id !== id), change] };
}

// A failed write removes only its own change. Any snapshot sent with the
// failure is stale and never becomes the authoritative base.
export function failLocalChange(state: ProjectSyncState, id: string): ProjectSyncState {
  return { ...state, pending: state.pending.filter((item) => item.id !== id) };
}

// Accepts a server result, route refresh, websocket refresh, or confirmed
// broadcast. Older projects do not replace a newer base, but an acknowledgement
// still settles its change. Any change whose mutation id appears in the
// accepted history is settled too, which also recovers lost responses.
export function acceptServerProject(
  state: ProjectSyncState,
  project: ProjectRecord,
  settledId?: string,
): ProjectSyncState {
  const server = project.updatedAt >= state.server.updatedAt ? project : state.server;
  const settledIds = getProjectMutationIds(server);
  if (settledId) settledIds.add(settledId);
  return { server, pending: state.pending.filter((item) => !settledIds.has(item.id)) };
}

export function getProjectMutationIds(project: ProjectRecord) {
  const ids = new Set<string>();
  for (const entry of project.operationLog) {
    const id = entry.metadata?.clientMutationId;
    if (id) ids.add(id);
  }
  return ids;
}

// Builds the visible project. Nodes, links, and the whole spatial map keep
// their previous identity when nothing visible changed, so bookkeeping-only
// updates (operation log, updatedAt) do not restart map transitions.
export function getVisibleProject(state: ProjectSyncState, previous?: ProjectRecord): ProjectRecord {
  const next = state.pending.reduce(applyLocalChange, state.server);
  if (!previous) return next;

  const spatialMap = reuseSpatialMap(previous.spatialMap, next.spatialMap);
  const settings = Object.fromEntries(
    settingsKeys.map((key) => [key, sameValue(previous[key], next[key]) ? previous[key] : next[key]]),
  ) as ProjectSettings;
  return { ...next, ...settings, spatialMap };
}

export function applyLocalChange(project: ProjectRecord, change: ProjectLocalChange): ProjectRecord {
  const existingIds = new Set(project.spatialMap.nodes.map((node) => node.id));
  const nodes = project.spatialMap.nodes
    .filter((node) => !change.removedNodeIds.has(node.id))
    .map((node) => {
      const patch = change.nodePatches.get(node.id);
      return patch ? { ...node, ...patch } : node;
    });
  for (const node of change.addedNodes) {
    if (!existingIds.has(node.id)) nodes.push(node);
  }

  const existingLinks = new Set(project.spatialMap.links.map(getLinkKey));
  const links = project.spatialMap.links.filter((link) => !change.removedLinkKeys.has(getLinkKey(link)));
  for (const link of change.addedLinks) {
    if (!existingLinks.has(getLinkKey(link)) && !change.removedNodeIds.has(link.source)) links.push(link);
  }

  return { ...project, ...change.settings, spatialMap: { ...project.spatialMap, nodes, links } };
}

function diffProjects(id: string, before: ProjectRecord, after: ProjectRecord): ProjectLocalChange {
  const beforeNodes = new Map(before.spatialMap.nodes.map((node) => [node.id, node]));
  const afterNodeIds = new Set(after.spatialMap.nodes.map((node) => node.id));
  const nodePatches = new Map<string, Partial<MapNode>>();
  const addedNodes: MapNode[] = [];

  for (const node of after.spatialMap.nodes) {
    const previous = beforeNodes.get(node.id);
    if (!previous) {
      addedNodes.push(node);
      continue;
    }
    const patch: Partial<MapNode> = {};
    const keys = new Set([...Object.keys(previous), ...Object.keys(node)]) as Set<keyof MapNode>;
    for (const key of keys) {
      if (!sameValue(normalizeField(key, previous[key]), normalizeField(key, node[key]))) {
        Object.assign(patch, { [key]: node[key] });
      }
    }
    if (Object.keys(patch).length > 0) nodePatches.set(node.id, patch);
  }

  const beforeLinks = new Set(before.spatialMap.links.map(getLinkKey));
  const afterLinks = new Set(after.spatialMap.links.map(getLinkKey));
  const settings: Partial<ProjectSettings> = {};
  for (const key of settingsKeys) {
    if (!sameValue(before[key], after[key])) Object.assign(settings, { [key]: after[key] });
  }

  return {
    id,
    nodePatches,
    addedNodes,
    removedNodeIds: new Set([...beforeNodes.keys()].filter((nodeId) => !afterNodeIds.has(nodeId))),
    addedLinks: after.spatialMap.links.filter((link) => !beforeLinks.has(getLinkKey(link))),
    removedLinkKeys: new Set([...beforeLinks].filter((key) => !afterLinks.has(key))),
    settings,
  };
}

function reuseSpatialMap(previous: SpatialMapData, next: SpatialMapData): SpatialMapData {
  const previousNodes = new Map(previous.nodes.map((node) => [node.id, node]));
  let changed = previous.nodes.length !== next.nodes.length;
  const nodes = next.nodes.map((node, index) => {
    const prior = previousNodes.get(node.id);
    if (prior && sameNode(prior, node)) {
      if (previous.nodes[index] !== prior) changed = true;
      return prior;
    }
    changed = true;
    return node;
  });

  const previousLinks = new Map(previous.links.map((link) => [getLinkKey(link), link]));
  let linksChanged = previous.links.length !== next.links.length;
  const links = next.links.map((link, index) => {
    const prior = previousLinks.get(getLinkKey(link));
    if (prior && sameValue(prior, link)) {
      if (previous.links[index] !== prior) linksChanged = true;
      return prior;
    }
    linksChanged = true;
    return link;
  });

  if (!changed && !linksChanged) return previous;
  return {
    ...next,
    nodes: changed ? nodes : previous.nodes,
    links: linksChanged ? links : previous.links,
  };
}

export function sameNode(left: MapNode, right: MapNode) {
  return sameValue(normalizeNode(left), normalizeNode(right));
}

// Optional fields have several equivalent empty forms between the optimistic
// client copy and the parsed server copy.
function normalizeNode(node: MapNode) {
  return Object.fromEntries(
    Object.entries(node)
      .map(([key, value]) => [key, normalizeField(key as keyof MapNode, value)])
      .filter(([, value]) => value !== undefined),
  );
}

function normalizeField(key: keyof MapNode, value: unknown) {
  if (value === null || value === undefined) return undefined;
  if (key === "images" && Array.isArray(value) && value.length === 0) return undefined;
  if (key === "archived" && value === false) return undefined;
  return value;
}

function getLinkKey(link: MapLink) {
  return `${link.source}->${link.target}:${link.parentChild ? "child" : "link"}`;
}

function sameValue(left: unknown, right: unknown) {
  return stableStringify(left) === stableStringify(right);
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}
