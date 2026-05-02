import { createEffect, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { SpatialMapCanvas } from "~/components/spatial-map/SpatialMapCanvas";
import type { ProjectEventsConnection } from "~/lib/projects/project-events.client";
import { connectProjectEvents } from "~/lib/projects/project-events.client";
import type { ProjectRecord } from "~/lib/projects/types";

interface ProjectDetailPageProps {
  project: ProjectRecord;
}

export function ProjectDetailPage(props: ProjectDetailPageProps) {
  const [project, setProject] = createSignal(untrack(() => props.project));
  let eventsConnection: ProjectEventsConnection | null = null;

  createEffect(() => {
    const routeProject = props.project;
    setProject((currentProject) =>
      routeProject.updatedAt > currentProject.updatedAt ? routeProject : currentProject,
    );
  });

  onMount(() => {
    eventsConnection = connectProjectEvents({
      projectId: props.project.id,
      onProjectChanged: setProject,
      onProjectDeleted: () => {
        window.location.href = "/";
      },
    });

    onCleanup(() => {
      eventsConnection?.disconnect();
      eventsConnection = null;
    });
  });

  const handleProjectUpdated = (nextProject: ProjectRecord) => {
    setProject(nextProject);
    eventsConnection?.publishLocalProjectChange(nextProject);
  };

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
      onProjectUpdated={handleProjectUpdated}
    />
  );
}
