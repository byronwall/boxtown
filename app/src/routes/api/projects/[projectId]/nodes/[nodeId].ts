import type { APIEvent } from "@solidjs/start/server";
import {
  updateProjectNodeStatusOnDisk,
  updateProjectNodeTitleOnDisk,
  updateProjectNodeTypeOnDisk,
} from "~/lib/projects/data.server";
import { isMapNodeStatus } from "~/lib/spatial-map/node-status";

type PatchProjectNodeRequest = {
  title?: unknown;
  status?: unknown;
  type?: unknown;
};

export async function PATCH(event: APIEvent) {
  try {
    const input = (await event.request.json()) as PatchProjectNodeRequest;
    let project = null;

    if (typeof input.title === "string") {
      project = await updateProjectNodeTitleOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        title: input.title,
      });
    }

    if (input.status !== undefined) {
      if (!isMapNodeStatus(input.status)) {
        throw new Error("A valid node status is required.");
      }

      project = await updateProjectNodeStatusOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        status: input.status,
      });
    }

    if (typeof input.type === "string") {
      project = await updateProjectNodeTypeOnDisk({
        projectId: event.params.projectId,
        nodeId: event.params.nodeId,
        type: input.type,
      });
    }

    if (!project) {
      throw new Error("A node title, status, or type is required.");
    }

    return new Response(JSON.stringify(project), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Failed to update node.",
      }),
      {
        status: 400,
        headers: {
          "content-type": "application/json; charset=utf-8",
        },
      },
    );
  }
}
