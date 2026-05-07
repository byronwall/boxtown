import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentNodeContextTree } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import { readProjectByIdFromDisk } from "~/lib/projects/data.server";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }

    const contextTree = toAgentNodeContextTree(project, event.params.nodeId);
    if (!contextTree) {
      throw new AgentApiError("node_not_found", "Node not found.", 404, {
        nodeId: event.params.nodeId,
      });
    }

    const url = new URL(event.request.url);
    const compact = parseBooleanSearchParam(url.searchParams.get("compact"));
    const fields = parseFields(url.searchParams.get("fields"));

    if (compact || fields) {
      return agentJson(compactContextTree(contextTree, fields));
    }

    return agentJson(contextTree);
  });
}

function compactContextTree(
  contextTree: NonNullable<ReturnType<typeof toAgentNodeContextTree>>,
  fields: string[] | null,
) {
  const nodeFields = fields ?? ["id", "title", "status", "type", "parentNodeId", "childCount", "imageCount"];
  return {
    node: projectFields(contextTree.node, nodeFields),
    titlePath: contextTree.inheritedContext.titlePath,
    inheritedContext: {
      metadata: contextTree.inheritedContext.metadata,
      contextBlocks: contextTree.inheritedContext.contextBlocks,
      rawContextBlocks: contextTree.inheritedContext.rawContextBlocks,
      images: contextTree.inheritedContext.images,
      hasDirectContext: contextTree.inheritedContext.hasDirectContext,
      hasInheritedContext: contextTree.inheritedContext.hasInheritedContext,
      missingContext: contextTree.inheritedContext.missingContext,
    },
  };
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

function projectFields<T extends object>(value: T, fields: string[]) {
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
