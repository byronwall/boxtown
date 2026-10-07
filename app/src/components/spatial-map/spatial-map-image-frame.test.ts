import { describe, expect, it } from "vitest";
import { getNodeImageFrame } from "./spatial-map-image-frame";

const node = { nodeWidth: 284, nodeHeight: 208 };

describe("getNodeImageFrame", () => {
  it("uses the default top band before the image size is known", () => {
    expect(getNodeImageFrame(node)).toEqual({ placement: "top", x: 8, y: 8, width: 268, height: 86 });
  });

  it("puts a portrait image on the left of a wide node", () => {
    const frame = getNodeImageFrame({ ...node, aspect: 300 / 800 });
    expect(frame.placement).toBe("side");
    expect(frame.x).toBe(8);
    // Portrait shapes are clamped to 0.6 and fill the height above the badge.
    expect(frame.height).toBeCloseTo(208 - 8 - 28, 0);
    expect(frame.width).toBeCloseTo(frame.height * 0.6, 0);
  });

  it("puts a square image on the left and keeps it square", () => {
    const frame = getNodeImageFrame({ ...node, aspect: 1 });
    expect(frame.placement).toBe("side");
    expect(frame.width).toBe(frame.height);
    expect(frame.x + frame.width).toBeLessThanOrEqual(284 * 0.45);
  });

  it("keeps a wide image on top with a shorter band so the label gets room", () => {
    const frame = getNodeImageFrame({ ...node, aspect: 4 });
    expect(frame).toEqual({ placement: "top", x: 8, y: 8, width: 268, height: 67 });
  });

  it("keeps a moderately wide image on top", () => {
    expect(getNodeImageFrame({ ...node, aspect: 2 }).placement).toBe("top");
  });

  it("keeps a portrait image on top of a tall node", () => {
    const frame = getNodeImageFrame({ nodeWidth: 200, nodeHeight: 420, aspect: 0.7 });
    expect(frame.placement).toBe("top");
  });

  it("never exceeds the node bounds", () => {
    for (const size of [{ nodeWidth: 60, nodeHeight: 48 }, node, { nodeWidth: 950, nodeHeight: 560 }]) {
      for (const aspect of [0.1, 0.5, 1, 2, 10]) {
        const frame = getNodeImageFrame({ ...size, aspect });
        expect(frame.x).toBeGreaterThanOrEqual(0);
        expect(frame.y).toBeGreaterThanOrEqual(0);
        expect(frame.x + frame.width).toBeLessThanOrEqual(size.nodeWidth - 8 + 0.1);
        expect(frame.y + frame.height).toBeLessThanOrEqual(size.nodeHeight + 0.1);
        if (frame.placement === "side") {
          expect(frame.x + frame.width).toBeLessThanOrEqual(size.nodeWidth * 0.45 + 0.1);
        }
      }
    }
  });
});
