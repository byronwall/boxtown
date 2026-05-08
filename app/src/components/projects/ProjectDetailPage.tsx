import { createEffect, createSignal, onCleanup, onMount, untrack } from "solid-js";
import { SpatialMapCanvas } from "~/components/spatial-map/SpatialMapCanvas";
import type { ProjectEventsConnection } from "~/lib/projects/project-events.client";
import { connectProjectEvents } from "~/lib/projects/project-events.client";
import {
  getProjectClientMutationId,
  hasSameProjectState,
  type ProjectUpdateOptions,
} from "~/lib/projects/optimistic";
import type { ProjectRecord } from "~/lib/projects/types";

interface ProjectDetailPageProps {
  project: ProjectRecord;
}

export function ProjectDetailPage(props: ProjectDetailPageProps) {
  const [project, setProject] = createSignal(untrack(() => props.project));
  const pendingLocalMutations = new Map<string, ProjectRecord>();
  const acknowledgedLocalMutations = new Map<string, ProjectRecord>();
  let eventsConnection: ProjectEventsConnection | null = null;

  const rememberAcknowledgedLocalMutation = (
    clientMutationId: string,
    acknowledgedProject: ProjectRecord,
  ) => {
    acknowledgedLocalMutations.set(clientMutationId, acknowledgedProject);
    window.setTimeout(() => {
      if (acknowledgedLocalMutations.get(clientMutationId) === acknowledgedProject) {
        acknowledgedLocalMutations.delete(clientMutationId);
      }
    }, 10000);
  };

  const isLocalMutationAcknowledgement = (
    clientMutationId: string | undefined,
    nextProject: ProjectRecord,
  ) => {
    if (!clientMutationId) {
      return false;
    }

    const pendingProject = pendingLocalMutations.get(clientMutationId);
    if (pendingProject && hasSameProjectState(pendingProject, nextProject)) {
      pendingLocalMutations.delete(clientMutationId);
      rememberAcknowledgedLocalMutation(clientMutationId, nextProject);
      return true;
    }

    const acknowledgedProject = acknowledgedLocalMutations.get(clientMutationId);
    return Boolean(acknowledgedProject && hasSameProjectState(acknowledgedProject, nextProject));
  };

  createEffect(() => {
    const routeProject = props.project;
    const clientMutationId = getProjectClientMutationId(routeProject);
    if (isLocalMutationAcknowledgement(clientMutationId, routeProject)) {
      return;
    }

    setProject((currentProject) =>
      routeProject.updatedAt > currentProject.updatedAt ? routeProject : currentProject,
    );
  });

  onMount(() => {
    eventsConnection = connectProjectEvents({
      projectId: props.project.id,
      onProjectChanged: (nextProject) => {
        const clientMutationId = getProjectClientMutationId(nextProject);
        if (isLocalMutationAcknowledgement(clientMutationId, nextProject)) {
          return;
        }

        setProject(nextProject);
      },
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
    if (options.clientMutationId && options.phase === "optimistic") {
      pendingLocalMutations.set(options.clientMutationId, nextProject);
      setProject(nextProject);
      eventsConnection?.publishLocalProjectChange(nextProject);
      return;
    }

    const clientMutationId = options.clientMutationId ?? getProjectClientMutationId(nextProject);
    if (isLocalMutationAcknowledgement(clientMutationId, nextProject)) {
      eventsConnection?.publishLocalProjectChange(nextProject);
      return;
    }

    if (clientMutationId) {
      pendingLocalMutations.delete(clientMutationId);
      rememberAcknowledgedLocalMutation(clientMutationId, nextProject);
    }
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
