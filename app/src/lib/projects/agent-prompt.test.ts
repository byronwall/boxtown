import { describe, expect, it } from "vitest";
import { buildNodeAgentPrompt } from "./agent-prompt";
import type { MapNode, SpatialMapData } from "~/lib/spatial-map/types";

const data: SpatialMapData = {
  nodes: [
    createNode("area", "Canvas", "Canvas renders a scaled SVG."),
    createNode("bug", "Nodes flicker", "", { implementation: "Check transforms" }),
    createNode("other", "Unrelated", "Should not appear"),
  ],
  links: [{ source: "area", target: "bug", parentChild: true }],
};

describe("buildNodeAgentPrompt", () => {
  it("includes the node, inherited context and pgm commands", () => {
    const prompt = buildNodeAgentPrompt({
      projectId: "demo",
      nodeId: "bug",
      data,
      metadataSchema: [{ key: "implementation", label: "Implementation", defaultValue: "" }],
      nodeUrl: "https://example.test/projects/demo?node=bug",
    });

    expect(prompt).toContain("# Nodes flicker");
    expect(prompt).toContain("Path: Canvas > Nodes flicker");
    expect(prompt).toContain("- **Implementation:** Check transforms");
    expect(prompt).toContain("### Canvas\n\nCanvas renders a scaled SVG.");
    expect(prompt).toContain("pgm node resolve bug --project demo --status implemented");
    expect(prompt).toContain("Link: https://example.test/projects/demo?node=bug");
    expect(prompt).not.toContain("Unrelated");
  });

  it("returns an empty string for an unknown node", () => {
    expect(buildNodeAgentPrompt({ projectId: "demo", nodeId: "missing", data })).toBe("");
  });
});

function createNode(
  id: string,
  label: string,
  context: string,
  metadata: Record<string, string> = {},
): MapNode {
  return { id, label, type: "task", status: "planned", metadata, context, rawContext: "" };
}
