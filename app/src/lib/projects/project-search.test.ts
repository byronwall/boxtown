import { describe, expect, it } from "vitest";
import { searchProjects } from "./project-search";
import type { ProjectSummary } from "./types";

const projects = [
  createProject("grid", "Project Mgmt Grid", "2026-09-01"),
  createProject("site", "Marketing Site", "2026-09-20"),
  createProject("annot", "Image Annotation", "2026-09-10"),
];

describe("searchProjects", () => {
  it("lists other projects by most recent update when the query is empty", () => {
    expect(searchProjects(projects, "", "grid").map((item) => item.id)).toEqual(["site", "annot"]);
  });

  it("ranks name prefixes before substrings and ids", () => {
    const extra = [...projects, createProject("mark-2", "Old Landing", "2026-01-01")];
    expect(searchProjects(extra, "mar").map((item) => item.id)).toEqual(["site", "mark-2"]);
    expect(searchProjects(extra, "grid", "grid")).toEqual([]);
  });
});

function createProject(id: string, name: string, updatedAt: string): ProjectSummary {
  return { id, name, description: "", createdAt: updatedAt, updatedAt, nodeCount: 0, linkCount: 0 };
}
