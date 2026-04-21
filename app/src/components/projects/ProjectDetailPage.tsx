import { createEffect, createSignal, untrack } from "solid-js";
import { SpatialMapCanvas } from "~/components/spatial-map/SpatialMapCanvas";
import type { ProjectRecord } from "~/lib/projects/types";

interface ProjectDetailPageProps {
  project: ProjectRecord;
}

export function ProjectDetailPage(props: ProjectDetailPageProps) {
  const [project, setProject] = createSignal(untrack(() => props.project));

  createEffect(() => {
    setProject(props.project);
  });

  return (
    <SpatialMapCanvas
      project={project()}
      header={{
        eyebrow: "Project grid",
        title: project().name,
        subtitle: project().description,
        backHref: "/",
        backLabel: "All projects",
      }}
      onProjectUpdated={setProject}
    />
  );
}
