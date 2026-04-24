import { createAsync, useParams } from "@solidjs/router";
import { Show } from "solid-js";
import { ProjectDetailPage } from "~/components/projects/ProjectDetailPage";
import { getProjectById } from "~/lib/projects/data";
import { PageMeta, formatPageTitle, formatProjectDescription } from "~/lib/seo";

export default function ProjectRoute() {
  const params = useParams();
  const project = createAsync(() => {
    const projectId = params.projectId;

    if (!projectId) {
      throw new Error("Missing project id.");
    }

    return getProjectById(projectId);
  });

  return (
    <Show when={project()}>
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
