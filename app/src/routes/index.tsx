import { createAsync, useSubmission } from "@solidjs/router";
import { ProjectIndexPage } from "~/components/projects/ProjectIndexPage";
import { createProject, getProjects } from "~/lib/projects/data";
import { normalizeActionUrl } from "~/lib/router/action-url";

export default function HomeRoute() {
  const projects = createAsync(() => getProjects());
  const createProjectSubmission = useSubmission(createProject);

  return (
    <ProjectIndexPage
      projects={projects() ?? []}
      createProjectActionUrl={normalizeActionUrl(createProject.url)}
      createProjectSubmission={{ pending: !!createProjectSubmission.pending }}
    />
  );
}
