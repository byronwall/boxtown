import type { APIEvent } from "@solidjs/start/server";
import { AgentApiError } from "~/lib/agent-api/errors.server";
import { withAgentApi } from "~/lib/agent-api/handler.server";
import { agentJson } from "~/lib/agent-api/response.server";
import {
  addProjectNodeImagesOnDisk,
  deleteProjectNodeImageOnDisk,
  readProjectByIdFromDisk,
} from "~/lib/projects/data.server";

export async function GET(event: APIEvent) {
  return withAgentApi(event, { scopes: ["image:read"] }, async () => {
    const project = await readProjectByIdFromDisk(event.params.projectId);
    const node = project?.spatialMap.nodes.find((item) => item.id === event.params.nodeId);
    if (!project) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }
    if (!node) {
      throw new AgentApiError("node_not_found", "Node not found.", 404, {
        nodeId: event.params.nodeId,
      });
    }

    return agentJson({
      nodeId: node.id,
      imageCount: node.images?.length ?? 0,
      images: node.images ?? [],
    });
  });
}

export async function POST(event: APIEvent) {
  return withAgentApi(event, { scopes: ["image:write"] }, async () => {
    const beforeProject = await readProjectByIdFromDisk(event.params.projectId);
    const beforeNode = beforeProject?.spatialMap.nodes.find((node) => node.id === event.params.nodeId);
    if (!beforeProject) {
      throw new AgentApiError("project_not_found", "Project not found.", 404, {
        projectId: event.params.projectId,
      });
    }
    if (!beforeNode) {
      throw new AgentApiError("node_not_found", "Node not found.", 404, {
        nodeId: event.params.nodeId,
      });
    }

    const formData = await event.request.formData().catch(() => null);
    const images = formData
      ?.getAll("images")
      .filter((value): value is File => value instanceof File && value.size > 0) ?? [];

    if (images.length === 0) {
      throw new AgentApiError("images_required", "At least one image file is required.", 400);
    }

    try {
      const previousImageIds = new Set((beforeNode.images ?? []).map((image) => image.id));
      const project = await addProjectNodeImagesOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        images,
      });
      const node = project.spatialMap.nodes.find((item) => item.id === event.params.nodeId);
      const addedImages = (node?.images ?? []).filter((image) => !previousImageIds.has(image.id));

      return agentJson({
        nodeId: event.params.nodeId,
        imageCount: addedImages.length,
        images: addedImages,
      }, { status: 201 });
    } catch (error) {
      throw new AgentApiError(
        "image_add_failed",
        error instanceof Error ? error.message : "Failed to add images.",
        400,
      );
    }
  });
}

type DeleteImageRequest = {
  imageId?: unknown;
};

export async function DELETE(event: APIEvent) {
  return withAgentApi(event, { scopes: ["image:write"] }, async () => {
    const input = (await event.request.json().catch(() => ({}))) as DeleteImageRequest;
    if (typeof input.imageId !== "string" || input.imageId.trim().length === 0) {
      throw new AgentApiError("image_id_required", "An image id is required.", 400);
    }

    try {
      const project = await deleteProjectNodeImageOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        imageId: input.imageId,
      });
      const node = project.spatialMap.nodes.find((item) => item.id === event.params.nodeId);

      return agentJson({
        nodeId: event.params.nodeId,
        removedImageId: input.imageId,
        imageCount: node?.images?.length ?? 0,
        images: node?.images ?? [],
      });
    } catch (error) {
      throw new AgentApiError(
        "image_remove_failed",
        error instanceof Error ? error.message : "Failed to remove image.",
        400,
      );
    }
  });
}
