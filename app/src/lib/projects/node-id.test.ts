import { describe, expect, it } from "vitest";
import {
  MAX_NODE_ID_BASE_LENGTH,
  createNodeIdBase,
  createUniqueNodeId,
  getNodeImageDirSegment,
} from "./node-id";

const longTitle =
  "Getting an empty text box on a dead click after creating text should remove empty text boxes; dead click after a text entry should deselect, not create more text";

describe("createNodeIdBase", () => {
  it("keeps short ids unchanged", () => {
    expect(createNodeIdBase("Checkout Page", "page")).toBe("page-checkout-page");
  });

  it("caps long ids and keeps them deterministic", () => {
    const id = createNodeIdBase(longTitle, "page");
    expect(id.length).toBeLessThanOrEqual(MAX_NODE_ID_BASE_LENGTH);
    expect(id.startsWith("page-getting-an-empty-text-box")).toBe(true);
    expect(id).toMatch(/^[a-z0-9-]+-[a-z0-9]{6}$/);
    expect(createNodeIdBase(longTitle, "page")).toBe(id);
  });

  it("gives distinct ids to long titles that share a prefix", () => {
    expect(createNodeIdBase(`${longTitle} one`, "page")).not.toBe(
      createNodeIdBase(`${longTitle} two`, "page"),
    );
  });
});

describe("createUniqueNodeId", () => {
  it("adds a numeric suffix on collision", () => {
    const base = createNodeIdBase(longTitle, "task");
    expect(createUniqueNodeId(longTitle, "task", new Set([base]))).toBe(`${base}-2`);
  });
});

describe("getNodeImageDirSegment", () => {
  it("leaves existing ids alone and shortens only oversized ones", () => {
    expect(getNodeImageDirSegment("page-checkout")).toBe("page-checkout");
    const legacyId = `page-${"very-long-title-".repeat(20)}`;
    expect(getNodeImageDirSegment(legacyId).length).toBeLessThanOrEqual(MAX_NODE_ID_BASE_LENGTH + 7);
  });
});
