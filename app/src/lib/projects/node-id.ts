// Shared by the server and the optimistic client path so both derive the same
// node id for a new node (see AGENTS.md: optimistic ids must match the server).

// Node ids end up in image file paths, so long titles must not produce long ids.
export const MAX_NODE_ID_BASE_LENGTH = 80;
const NODE_ID_HASH_LENGTH = 6;

export function slugifyIdPart(value: string, fallback: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || fallback;
}

export function createNodeIdBase(label: string, type: string) {
  const slug = slugifyIdPart(`${type}-${label}`, "node");
  if (slug.length <= MAX_NODE_ID_BASE_LENGTH) {
    return slug;
  }

  // Keep a readable prefix and append a hash of the full slug so distinct long
  // titles that share a prefix still get distinct ids.
  const hash = hashString(slug).slice(0, NODE_ID_HASH_LENGTH);
  const prefixLength = MAX_NODE_ID_BASE_LENGTH - NODE_ID_HASH_LENGTH - 1;
  let prefix = slug.slice(0, prefixLength);
  const lastDash = prefix.lastIndexOf("-");
  if (lastDash > prefixLength / 2) {
    prefix = prefix.slice(0, lastDash);
  }

  return `${prefix.replace(/-+$/g, "")}-${hash}`;
}

export function createUniqueNodeId(label: string, type: string, existingIds: Set<string>) {
  const baseId = createNodeIdBase(label, type);
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

// Ids created before the length cap can still exceed filesystem name limits
// (255 bytes). Such directories could never be created, so shortening only
// these long segments cannot orphan existing images.
const MAX_IMAGE_DIR_SEGMENT_LENGTH = 200;

export function getNodeImageDirSegment(nodeId: string) {
  const segment = nodeId.replace(/[^a-zA-Z0-9_-]+/g, "_") || "unknown";
  if (segment.length <= MAX_IMAGE_DIR_SEGMENT_LENGTH) {
    return segment;
  }

  return `${segment.slice(0, MAX_NODE_ID_BASE_LENGTH)}-${hashString(segment).slice(0, NODE_ID_HASH_LENGTH)}`;
}

// FNV-1a: deterministic and dependency-free, so it runs the same on client and server.
export function hashString(value: string) {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  return (hash >>> 0).toString(36).padStart(NODE_ID_HASH_LENGTH, "0");
}
