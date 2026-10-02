import { describe, expect, it } from "vitest";
import { getNodeImageFrame } from "./spatial-map-image-frame";

const node = { nodeWidth: 284, nodeHeight: 208 };

describe("getNodeImageFrame", () => {
  it("uses the default band before the image size is known", () => {
    expect(getNodeImageFrame(node)).toEqual({ x: 8, width: 268, height: 86 });
  });

  it("gives a portrait image a taller centered frame instead of a strip", () => {
    const frame = getNodeImageFrame({ ...node, aspect: 300 / 800 });
    expect(frame.height).toBe(104);
    expect(frame.width).toBeCloseTo(104 * 0.6, 1);
    expect(frame.x).toBeCloseTo((284 - frame.width) / 2, 1);
  });

  it("keeps a square image square", () => {
    const frame = getNodeImageFrame({ ...node, aspect: 1 });
    expect(frame.width).toBe(frame.height);
  });

  it("shortens the band for a wide image so the label gets room", () => {
    const frame = getNodeImageFrame({ ...node, aspect: 4 });
    expect(frame).toEqual({ x: 8, width: 268, height: 67 });
  });

  it("never exceeds the node bounds", () => {
    for (const aspect of [0.1, 0.5, 1, 2, 10]) {
      const frame = getNodeImageFrame({ nodeWidth: 60, nodeHeight: 48, aspect });
      expect(frame.x + frame.width).toBeLessThanOrEqual(60 - 8 + 0.1);
      expect(frame.height).toBeLessThanOrEqual(48 * 0.5 + 0.1);
    }
  });
});
