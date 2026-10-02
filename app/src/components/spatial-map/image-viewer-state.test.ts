import { describe, expect, it } from "vitest";
import type { MapNode, MapNodeImage } from "~/lib/spatial-map/types";
import { removeViewerImage, syncViewerImages, type ImageViewerState } from "./image-viewer-state";

const image = (id: string): MapNodeImage => ({
  id,
  filename: `${id}.png`,
  originalName: `${id}.png`,
  mimeType: "image/png",
  size: 1,
  src: `/img/${id}.png`,
  createdAt: "2026-10-02T00:00:00.000Z",
});

const node = (images: MapNodeImage[]): MapNode => ({
  id: "n",
  label: "Node",
  type: "page",
  status: "planned",
  metadata: {},
  context: "",
  rawContext: "",
  images,
});

const viewer = (ids: string[], index: number): ImageViewerState => {
  const owner = node(ids.map(image));
  return { items: owner.images!.map((item) => ({ image: item, node: owner })), index, canDelete: true };
};

describe("image viewer state", () => {
  it("shows the next image after deleting the current one", () => {
    const next = removeViewerImage(viewer(["a", "b", "c"], 1), "b");
    expect(next?.items.map((item) => item.image.id)).toEqual(["a", "c"]);
    expect(next?.items[next.index]?.image.id).toBe("c");
  });

  it("falls back to the previous image when the last one in the list is deleted", () => {
    const next = removeViewerImage(viewer(["a", "b"], 1), "b");
    expect(next?.items[next.index]?.image.id).toBe("a");
  });

  it("keeps the current image when an earlier one is removed", () => {
    const next = removeViewerImage(viewer(["a", "b", "c"], 2), "a");
    expect(next?.items[next.index]?.image.id).toBe("c");
  });

  it("closes the viewer when its only image is deleted", () => {
    expect(removeViewerImage(viewer(["a"], 0), "a")).toBeNull();
  });

  it("follows the current image when syncing with server nodes", () => {
    const state = viewer(["a", "b", "c"], 2);
    const synced = syncViewerImages(state, [node([image("b"), image("c")])]);
    expect(synced?.items[synced.index]?.image.id).toBe("c");
  });
});
