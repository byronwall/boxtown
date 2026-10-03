import { createEffect, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { SpatialMapCanvas } from "~/components/spatial-map/SpatialMapCanvas";
import type { ProjectEventsConnection } from "~/lib/projects/project-events.client";
import { connectProjectEvents } from "~/lib/projects/project-events.client";
import type { ProjectUpdateOptions } from "~/lib/projects/optimistic";
import {
  acceptServerProject,
  addLocalChange,
  createProjectSyncState,
  failLocalChange,
  getVisibleProject,
  type ProjectSyncState,
} from "~/lib/projects/optimistic-sync";
import type { ProjectRecord } from "~/lib/projects/types";

interface ProjectDetailPageProps {
  project: ProjectRecord;
}

export function ProjectDetailPage(props: ProjectDetailPageProps) {
  let sync: ProjectSyncState = createProjectSyncState(untrack(() => props.project));
  const [project, setProject] = createSignal(untrack(() => props.project));
  let eventsConnection: ProjectEventsConnection | null = null;

  const updateSync = (next: ProjectSyncState) => {
    sync = next;
    setProject((previous) => getVisibleProject(sync, previous));
  };

  createEffect(() => {
    const routeProject = props.project;
    untrack(() => updateSync(acceptServerProject(sync, routeProject)));
  });

  onMount(() => {
    eventsConnection = connectProjectEvents({
      projectId: props.project.id,
      onProjectChanged: (nextProject) => updateSync(acceptServerProject(sync, nextProject)),
      onProjectDeleted: () => {
        window.location.href = "/";
      },
    });

    onCleanup(() => {
      eventsConnection?.disconnect();
      eventsConnection = null;
    });
  });

  const handleProjectUpdated = (
    nextProject: ProjectRecord,
    options: ProjectUpdateOptions = {},
  ) => {
    const { clientMutationId, phase } = options;
    if (clientMutationId && phase === "optimistic") {
      updateSync(addLocalChange(sync, clientMutationId, project(), nextProject));
      return;
    }

    // A missing project is never authoritative; treat it as a failed write.
    if (clientMutationId && (phase === "failed" || !nextProject)) {
      updateSync(failLocalChange(sync, clientMutationId));
      return;
    }

    updateSync(acceptServerProject(sync, nextProject, clientMutationId));
    // Other tabs only ever receive confirmed server results.
    eventsConnection?.publishLocalProjectChange(nextProject);
  };

  return (
    <SpatialMapCanvas
      project={project()}
      header={{
        title: project().name,
        backHref: "/",
        backLabel: "Projects",
      }}
      onProjectUpdated={handleProjectUpdated}
    />
  );
}
