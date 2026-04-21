import { createAsync, useSubmission } from "@solidjs/router";
import { ProjectIndexPage } from "~/components/projects/ProjectIndexPage";
import { createProject, getProjects } from "~/lib/projects/data";

export default function HomeRoute() {
  const projects = createAsync(() => getProjects());
  const createProjectSubmission = useSubmission(createProject);

  return (
    <ProjectIndexPage
      projects={projects() ?? []}
      createProjectAction={createProject}
      createProjectSubmission={{ pending: !!createProjectSubmission.pending }}
    />
  );
}
