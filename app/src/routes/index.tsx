import { createAsync } from "@solidjs/router";
import { ProjectIndexPage } from "~/components/projects/ProjectIndexPage";
import { getProjects } from "~/lib/projects/data";
import { PageMeta } from "~/lib/seo";

export default function HomeRoute() {
  const projects = createAsync(() => getProjects());

  return (
    <>
      <PageMeta
        title="Product Grid Mgmt"
        description="Create, import, and operate product structure maps with project-level context, node metadata, relationship links, and visual UI inventories."
      />
      <ProjectIndexPage
        projects={projects.latest ?? []}
      />
    </>
  );
}
