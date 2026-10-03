import { describe, expect, it } from "vitest";
import { formatCameraParam, getCameraFromView, parseCameraParam } from "./spatial-map-camera";

describe("camera URL state", () => {
  it("round-trips center and width", () => {
    const param = formatCameraParam({ x: 100, y: 50, width: 800, height: 600 });
    expect(param).toBe("500,350,800");
    expect(getCameraFromView(parseCameraParam(param)!, 2)).toEqual({ x: 100, y: 150, width: 800, height: 400 });
  });

  it("rejects malformed or out-of-range values", () => {
    for (const value of ["", "1,2", "1,2,3,4", "a,b,c", "1,,800", "NaN,0,800", "Infinity,0,800", "0,0,10", "0,0,9999999", "9e9,0,800"]) {
      expect(parseCameraParam(value)).toBeNull();
    }
  });

  it("falls back to the scene aspect when the viewport aspect is invalid", () => {
    const camera = getCameraFromView({ centerX: 0, centerY: 0, width: 1600 }, 0);
    expect(camera.height).toBe(960);
  });
});
