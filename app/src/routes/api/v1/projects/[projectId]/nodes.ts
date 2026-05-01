import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentMapNode } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  createChildNodeOnDisk,
  readProjectByIdFromDisk,
} from "~/lib/projects/data.server";
import { isMapNodeStatus } from "~/lib/spatial-map/node-status";
import type { MapNode } from "~/lib/spatial-map/types";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }

    const url = new URL(event.request.url);
    const status = url.searchParams.get("status");
    const type = url.searchParams.get("type");
    const search = url.searchParams.get("search");

    if (status !== null && !isMapNodeStatus(status)) {
      throw new AgentApiError("invalid_status", "A valid node status is required.", 400, {
        status,
      });
    }

    const nodes = project.spatialMap.nodes
      .filter((node) => matchesNodeFilters(node, { status, type, search }))
      .map(toAgentMapNode)
      .sort((left, right) => left.label.localeCompare(right.label));

    return agentJson({ nodes });
  });
}

type CreateNodeRequest = {
  title?: unknown;
  label?: unknown;
  type?: unknown;
  status?: unknown;
  parentNodeId?: unknown;
  parent?: unknown;
  context?: unknown;
  metadata?: unknown;
};

export async function POST(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async () => {
    const input = (await event.request.json().catch(() => null)) as CreateNodeRequest | null;
    if (!input) {
      throw new AgentApiError("invalid_json", "A JSON body is required.", 400);
    }

    const title = getString(input.title) ?? getString(input.label);
    if (!title?.trim()) {
      throw new AgentApiError("invalid_title", "A node title is required.", 400);
    }
    if (input.status !== undefined && !isMapNodeStatus(input.status)) {
      throw new AgentApiError("invalid_status", "A valid node status is required.", 400, {
        status: input.status,
      });
    }

    try {
      const result = await createChildNodeOnDisk({
        projectId: event.params.projectId,
        parentNodeId: getNullableString(input.parentNodeId ?? input.parent),
        title,
        type: getString(input.type),
        status: isMapNodeStatus(input.status) ? input.status : undefined,
        context: getString(input.context),
        metadata: getMetadata(input.metadata),
      });
      const node = result.project.spatialMap.nodes.find((item) => item.id === result.nodeId);
      const parentLink = result.project.spatialMap.links.find(
        (link) => link.parentChild && link.target === result.nodeId,
      ) ?? null;

      return agentJson({
        node: node ? toAgentMapNode(node) : null,
        nodeId: result.nodeId,
        parentLink,
      }, { status: 201 });
    } catch (error) {
      throw new AgentApiError(
        "node_create_failed",
        error instanceof Error ? error.message : "Failed to create node.",
        400,
      );
    }
  });
}

function matchesNodeFilters(
  node: MapNode,
  filters: { status: string | null; type: string | null; search: string | null },
) {
  if (filters.status !== null && node.status !== filters.status) {
    return false;
  }

  if (filters.type !== null && node.type !== filters.type) {
    return false;
  }

  if (filters.search !== null && filters.search.trim().length > 0) {
    const needle = filters.search.trim().toLowerCase();
    return [
      node.id,
      node.label,
      node.type,
      node.context,
      node.rawContext,
      ...Object.values(node.metadata),
    ].some((value) => value.toLowerCase().includes(needle));
  }

  return true;
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getNullableString(value: unknown) {
  if (value === null) {
    return null;
  }
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function getMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}
