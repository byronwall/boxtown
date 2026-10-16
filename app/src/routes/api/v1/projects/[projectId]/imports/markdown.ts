import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError, rethrowAsAgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { toAgentOperationActor } from "~/lib/agent-api/operation-actor";
import { toAgentMapNode } from "~/lib/agent-api/projections.server";
import { agentJson } from "~/lib/agent-api/response.server";
import { createContextNodeOnDisk } from "~/lib/projects/data.server";

type MarkdownImportRequest = {
  title?: unknown;
  label?: unknown;
  markdown?: unknown;
  context?: unknown;
  metadata?: unknown;
  splitByHeadingLevel?: unknown;
  maxHeadingDepth?: unknown;
};

export async function POST(event: APIEvent) {
  return withAgentApi(event, { scopes: ["node:write"] }, async (context) => {
    const input = (await event.request.json().catch(() => null)) as MarkdownImportRequest | null;
    if (!input) {
      throw new AgentApiError("invalid_json", "A JSON body is required.", 400);
    }

    const label = getString(input.title) ?? getString(input.label);
    const markdown = getString(input.markdown) ?? getString(input.context);
    if (!label?.trim()) {
      throw new AgentApiError("invalid_title", "A node title is required.", 400);
    }
    if (markdown === undefined) {
      throw new AgentApiError("invalid_markdown", "Markdown content is required.", 400);
    }

    try {
      const result = await createContextNodeOnDisk({
        projectId: event.params.projectId,
        label,
        context: markdown,
        metadata: getMetadata(input.metadata),
        splitByHeadingLevel: input.splitByHeadingLevel === true,
        maxHeadingDepth: getPositiveInteger(input.maxHeadingDepth),
        actor: toAgentOperationActor(context.actor),
      });
      const createdNodeIdSet = new Set(result.createdNodeIds);
      const nodes = result.project.spatialMap.nodes
        .filter((node) => createdNodeIdSet.has(node.id))
        .map(toAgentMapNode);

      return agentJson({
        import: {
          rootNodeId: result.nodeId,
          createdNodeIds: result.createdNodeIds,
          createdNodeCount: result.createdNodeCount,
        },
        nodes,
        links: result.createdLinks,
      }, { status: 201 });
    } catch (error) {
      rethrowAsAgentApiError(error, { code: "markdown_import_failed", message: "Failed to import markdown." });
    }
  });
}

function getString(value: unknown) {
  return typeof value === "string" ? value : undefined;
}

function getMetadata(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function getPositiveInteger(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}
