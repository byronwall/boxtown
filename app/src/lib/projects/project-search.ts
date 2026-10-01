import type { ProjectSummary } from "./types";

// Ranks projects for the command menu: name prefix, then name substring, then id match.
// An empty query lists the most recently updated projects first.
export function searchProjects(
  projects: ProjectSummary[],
  rawQuery: string,
  currentProjectId?: string,
) {
  const query = rawQuery.trim().toLowerCase();
  const others = projects.filter((project) => project.id !== currentProjectId);

  if (!query) {
    return [...others].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }

  return others
    .map((project) => {
      const name = project.name.toLowerCase();
      const index = name.indexOf(query);
      const idIndex = project.id.toLowerCase().indexOf(query);
      const score = index === 0 ? 0 : index > 0 ? 1 : idIndex >= 0 ? 2 : -1;
      return { project, score };
    })
    .filter((item) => item.score >= 0)
    .sort((left, right) => left.score - right.score || left.project.name.localeCompare(right.project.name))
    .map((item) => item.project);
}
