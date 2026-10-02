import { describe, expect, it } from "vitest";
import { filterAttributeMenuItems } from "./spatial-map-attribute-filter";

const items = ["page", "component", "bug", "debug-note", "Task"].map((label) => ({ label, value: label }));

describe("filterAttributeMenuItems", () => {
  it("returns every item for an empty query", () => {
    expect(filterAttributeMenuItems(items, "  ")).toBe(items);
  });

  it("matches case-insensitively with prefix matches first", () => {
    expect(filterAttributeMenuItems(items, "BU").map((item) => item.label)).toEqual(["bug", "debug-note"]);
    expect(filterAttributeMenuItems(items, "task").map((item) => item.label)).toEqual(["Task"]);
  });

  it("returns nothing when no label matches", () => {
    expect(filterAttributeMenuItems(items, "zzz")).toEqual([]);
  });
});
