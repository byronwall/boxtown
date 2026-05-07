import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentOperationActor } from "~/lib/agent-api/operation-actor";
import {
  toAgentMapNode,
  toAgentNodeContexts,
  toAgentNodeSummaries,
} from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  createChildNodeOnDisk,
  readProjectByIdFromDisk,
} from "~/lib/projects/data.server";
import { isMapNodeStatus } from "~/lib/spatial-map/node-status";
import type { ProjectRecord } from "~/lib/projects/types";
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
    const include = url.searchParams.get("include");
    const roots = parseBooleanSearchParam(url.searchParams.get("roots"));
    const compact = parseBooleanSearchParam(url.searchParams.get("compact"));
    const fields = parseFields(url.searchParams.get("fields"));
    const children = url.searchParams.get("children");
    const subtree = url.searchParams.get("subtree");
    const includeSelf = parseBooleanSearchParam(url.searchParams.get("includeSelf"));
    const depth = parsePositiveInteger(url.searchParams.get("depth"));

    if (status !== null && !isMapNodeStatus(status)) {
      throw new AgentApiError("invalid_status", "A valid node status is required.", 400, {
        status,
      });
    }

    const parentNodeIds = new Map(
      project.spatialMap.links
        .filter((link) => link.parentChild)
        .map((link) => [link.target, link.source]),
    );

    if (include === "context") {
      const nodes = toAgentNodeContexts(project)
        .filter((item) => matchesNodeFilters(item.node, {
          status,
          type,
          search,
          roots,
          children,
          subtree,
          depth,
          includeSelf,
          links: project.spatialMap.links,
          parentNodeIds,
        }))
        .map((item) => projectFields(item, fields));

      return agentJson({ nodes });
    }

    if (include === "ancestors" || compact || fields) {
      const nodes = toAgentNodeSummaries(project, { withAncestors: include === "ancestors" })
        .filter((node) => matchesNodeFilters(node, {
          status,
          type,
          search,
          roots,
          children,
          subtree,
          depth,
          includeSelf,
          links: project.spatialMap.links,
          parentNodeIds,
        }))
        .map((node) => projectFields(node, fields));

      return agentJson({ nodes });
    }

    const nodes = project.spatialMap.nodes
      .filter((node) => matchesNodeFilters(node, {
        status,
        type,
        search,
        roots,
        children,
        subtree,
        depth,
        includeSelf,
        links: project.spatialMap.links,
        parentNodeIds,
      }))
      .map(toAgentMapNode)
      .sort((left, right) => left.label.localeCompare(right.label))
      .map((node) => projectFields(node, fields));

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
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
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
        actor: toAgentOperationActor(context.actor),
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
  node: Pick<MapNode, "id" | "label" | "type" | "status"> & {
    titlePath?: string;
    context?: string;
    rawContext?: string;
    metadata?: Record<string, string>;
  },
  filters: {
    status: string | null;
    type: string | null;
    search: string | null;
    roots: boolean;
    children: string | null;
    subtree: string | null;
    depth: number | null;
    includeSelf: boolean;
    links: ProjectRecord["spatialMap"]["links"];
    parentNodeIds: Map<string, string>;
  },
) {
  if (filters.status !== null && node.status !== filters.status) {
    return false;
  }

  if (filters.type !== null && node.type !== filters.type) {
    return false;
  }

  if (filters.roots && filters.parentNodeIds.has(node.id)) {
    return false;
  }

  if (filters.children !== null && filters.parentNodeIds.get(node.id) !== filters.children) {
    return false;
  }

  if (filters.subtree !== null) {
    const distance = getSubtreeDistance(filters.links, filters.subtree, node.id);
    if (distance === null) {
      return false;
    }
    if (!filters.includeSelf && distance === 0) {
      return false;
    }
    if (filters.depth !== null && distance > filters.depth) {
      return false;
    }
  }

  if (filters.search !== null && filters.search.trim().length > 0) {
    const needle = filters.search.trim().toLowerCase();
    return [
      node.id,
      node.label,
      node.titlePath ?? "",
      node.type,
      node.context ?? "",
      node.rawContext ?? "",
      ...Object.values(node.metadata ?? {}),
    ].some((value) => value.toLowerCase().includes(needle));
  }

  return true;
}

function parseBooleanSearchParam(value: string | null) {
  if (value === null) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return !(normalized === "false" || normalized === "0" || normalized === "no");
}

function parseFields(value: string | null) {
  if (!value?.trim()) {
    return null;
  }

  return value.split(",").map((field) => field.trim()).filter(Boolean);
}

function projectFields<T extends object>(value: T, fields: string[] | null) {
  if (!fields) {
    return value;
  }

  return Object.fromEntries(
    fields
      .map((field) => [field, getByPath(value, field)] as const)
      .filter(([, fieldValue]) => fieldValue !== undefined),
  );
}

function getByPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, value);
}

function parsePositiveInteger(value: string | null) {
  if (!value?.trim()) {
    return null;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function getSubtreeDistance(
  links: ProjectRecord["spatialMap"]["links"],
  rootNodeId: string,
  nodeId: string,
) {
  if (nodeId === rootNodeId) {
    return 0;
  }

  const childrenByParent = new Map<string, string[]>();
  for (const link of links) {
    if (!link.parentChild) {
      continue;
    }
    const children = childrenByParent.get(link.source) ?? [];
    children.push(link.target);
    childrenByParent.set(link.source, children);
  }

  const queue: Array<{ id: string; distance: number }> = [{ id: rootNodeId, distance: 0 }];
  const seen = new Set<string>();
  while (queue.length > 0) {
    const current = queue.shift()!;
    if (seen.has(current.id)) {
      continue;
    }
    seen.add(current.id);
    for (const childId of childrenByParent.get(current.id) ?? []) {
      const distance = current.distance + 1;
      if (childId === nodeId) {
        return distance;
      }
      queue.push({ id: childId, distance });
    }
  }

  return null;
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
