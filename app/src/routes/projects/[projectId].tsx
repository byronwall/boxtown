import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { ProjectDetailPage } from "~/components/projects/ProjectDetailPage";
import { getProjectById } from "~/lib/projects/data";
import type { ProjectRecord } from "~/lib/projects/types";
import { PageMeta, formatPageTitle, formatProjectDescription } from "~/lib/seo";

export default function ProjectRoute() {
  const params = useParams();
  let lastLoaded: ProjectRecord | undefined;
  const project = createAsync(async () => {
    const projectId = params.projectId;

    if (!projectId) {
      throw new Error("Missing project id.");
    }

    try {
      lastLoaded = await getProjectById(projectId);
      return lastLoaded;
    } catch (error) {
      // A failed background refresh (for example after a successful save)
      // keeps the loaded project; later events or refreshes catch it up.
      if (lastLoaded?.id === projectId) {
        console.error("project-route:refresh-failed", error);
        return lastLoaded;
      }
      throw error;
    }
  });

  const stableProject = () => project.latest;

  return (
    <Show when={stableProject()}>
      {(resolvedProject) => (
        <>
          <PageMeta
            title={formatPageTitle(resolvedProject().name)}
            description={formatProjectDescription({
              description: resolvedProject().description,
              nodeCount: resolvedProject().spatialMap.nodes.length,
              linkCount: resolvedProject().spatialMap.links.length,
            })}
          />
          <ProjectDetailPage project={resolvedProject()} />
        </>
      )}
    </Show>
  );
}
