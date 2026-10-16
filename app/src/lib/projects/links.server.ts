import { createRelationshipLink, getLinkKey, isMapLinkRelationship, mapLinkRelationships } from "~/lib/spatial-map/links";
import type { MapLink, MapLinkRelationship } from "~/lib/spatial-map/types";
import {
  appendProjectOperation,
  deleteProjectLinkOnDisk,
  getMutationMetadata,
  readProjectByIdFromDisk,
  serializedMutation,
  writeProjectAndPublish,
} from "./data.server";
import { ProjectMutationError } from "./mutation-error";
import type { ProjectOperationActor, ProjectRecord } from "./types";

export interface ProjectLinkInput {
  projectId: string;
  source: string;
  target: string;
  relationship?: string;
  actor?: ProjectOperationActor;
  clientMutationId?: string;
}

// Non-hierarchy links touching a node, in both directions.
export function listNodeRelations(project: ProjectRecord, nodeId: string) {
  return project.spatialMap.links
    .filter((link) => !link.parentChild && (link.source === nodeId || link.target === nodeId))
    .map((link) => ({
      source: link.source,
      target: link.target,
      relationship: link.relationship ?? "related",
      direction: link.source === nodeId ? "outgoing" : "incoming",
    }));
}

// Adds one relationship link. Adding a link that already exists is a no-op,
// and hierarchy and other links are left as they are.
export const createProjectLinkOnDisk = serializedMutation(async function createProjectLinkOnDisk(
  input: ProjectLinkInput,
): Promise<{ link: MapLink; created: boolean; project: ProjectRecord }> {
  const relationship = requireRelationship(input.relationship);
  if (input.source === input.target) {
    throw new ProjectMutationError("invalid_link", "A node cannot link to itself.");
  }
  const current = await requireProject(input.projectId);
  const nodeIds = new Set(current.spatialMap.nodes.map((node) => node.id));
  const missing = [input.source, input.target].filter((id) => !nodeIds.has(id));
  if (missing.length > 0) {
    throw new ProjectMutationError("node_not_found", `Node not found: ${missing.join(", ")}.`, 404, { nodeIds: missing });
  }

  const link = createRelationshipLink({ source: input.source, target: input.target, relationship });
  const existing = current.spatialMap.links.find((item) => getLinkKey(item) === getLinkKey(link));
  if (existing) return { link: existing, created: false, project: current };

  const nextRecord = appendProjectOperation({
    ...current,
    updatedAt: new Date().toISOString(),
    spatialMap: { ...current.spatialMap, links: [...current.spatialMap.links, link] },
  }, {
    kind: "link.created",
    actor: input.actor,
    summary: `Added ${relationship} link from ${input.source} to ${input.target}.`,
    nodeIds: [input.source, input.target],
    linkKeys: [getLinkKey(link)],
    metadata: getMutationMetadata(input),
  });
  await writeProjectAndPublish(nextRecord);
  return { link, created: true, project: nextRecord };
});

export async function removeProjectLinkOnDisk(input: ProjectLinkInput) {
  const relationship = requireRelationship(input.relationship);
  try {
    await deleteProjectLinkOnDisk({ ...input, relationship });
  } catch (error) {
    if (error instanceof Error && error.message === "Link not found.") {
      throw new ProjectMutationError("link_not_found", "Link not found.", 404, {
        source: input.source,
        target: input.target,
        relationship,
      });
    }
    throw error;
  }
  return { source: input.source, target: input.target, relationship };
}

function requireRelationship(value: string | undefined): MapLinkRelationship {
  const relationship = value?.trim() || "related";
  if (!isMapLinkRelationship(relationship)) {
    throw new ProjectMutationError(
      "invalid_relationship",
      `relationship must be one of: ${mapLinkRelationships.join(", ")}.`,
      400,
      { relationship: value },
    );
  }
  return relationship;
}

async function requireProject(projectId: string) {
  const project = await readProjectByIdFromDisk(projectId);
  if (!project) throw new ProjectMutationError("project_not_found", "Project not found.", 404, { projectId });
  return project;
}
