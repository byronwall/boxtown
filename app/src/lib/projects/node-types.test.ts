import { describe, expect, it } from "vitest";
import {
  getDefaultProjectNodeType,
  normalizeProjectNodeTypeSchema,
  resolveNewNodeType,
} from "./node-types";

const schema = [
  { name: "bug", color: "#dd9292" },
  { name: "task", color: "#92bedd" },
];

describe("default node type", () => {
  it("falls back to the parent type, then the first type", () => {
    expect(getDefaultProjectNodeType(schema)).toBeNull();
    expect(resolveNewNodeType(schema, "task")).toBe("task");
    expect(resolveNewNodeType(schema, null)).toBe("bug");
  });

  it("prefers the flagged default over the parent type", () => {
    const withDefault = [schema[0]!, { ...schema[1]!, isDefault: true }];
    expect(resolveNewNodeType(withDefault, "bug")).toBe("task");
  });

  it("keeps at most one default when normalizing", () => {
    const normalized = normalizeProjectNodeTypeSchema([
      { name: "Bug", color: "#dd9292", isDefault: true },
      { name: "task", color: "#92bedd", isDefault: true },
    ]);
    expect(normalized).toEqual([
      { name: "bug", color: "#dd9292", isDefault: true },
      { name: "task", color: "#92bedd" },
    ]);
  });
});
