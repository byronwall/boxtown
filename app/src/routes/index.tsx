import { createAsync, useSubmission } from "@solidjs/router";
import { ProjectIndexPage } from "~/components/projects/ProjectIndexPage";
import { createProject, getProjects } from "~/lib/projects/data";
import { normalizeActionUrl } from "~/lib/router/action-url";
import { PageMeta } from "~/lib/seo";

export default function HomeRoute() {
  const projects = createAsync(() => getProjects());
  const createProjectSubmission = useSubmission(createProject);

  return (
    <>
      <PageMeta
        title="Product Grid Mgmt"
        description="Create, import, and operate product structure maps with project-level context, node metadata, relationship links, and visual UI inventories."
      />
      <ProjectIndexPage
        projects={projects() ?? []}
        createProjectActionUrl={normalizeActionUrl(createProject.url)}
        createProjectSubmission={{ pending: !!createProjectSubmission.pending }}
      />
    </>
  );
}
