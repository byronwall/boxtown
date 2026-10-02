import type { MapNode, MapNodeImage } from "~/lib/spatial-map/types";

export interface ImageViewerItem {
  image: MapNodeImage;
  node: MapNode;
}

export interface ImageViewerState {
  items: ImageViewerItem[];
  index: number;
  canDelete: boolean;
}

// Drops one image from the open viewer. The viewer stays on the same position,
// which now shows the next image (or the previous one when the last image in
// the list was removed). Removing the only image closes the viewer.
export function removeViewerImage(state: ImageViewerState | null, imageId: string): ImageViewerState | null {
  if (!state) return state;
  const removedIndex = state.items.findIndex((item) => item.image.id === imageId);
  if (removedIndex === -1) return state;

  const items = state.items.filter((_, index) => index !== removedIndex);
  if (items.length === 0) return null;
  const index = removedIndex < state.index ? state.index - 1 : state.index;
  return { ...state, items, index: Math.min(index, items.length - 1) };
}

// Keeps only images that still exist on their nodes in an authoritative project.
export function syncViewerImages(state: ImageViewerState | null, nodes: MapNode[]): ImageViewerState | null {
  if (!state) return state;
  const nodesById = new Map(nodes.map((node) => [node.id, node]));
  const current = state.items[state.index];
  const items = state.items.flatMap((item) => {
    const node = nodesById.get(item.node.id);
    const image = node?.images?.find((nodeImage) => nodeImage.id === item.image.id);
    return node && image ? [{ node, image }] : [];
  });
  if (items.length === 0) return null;
  const currentIndex = current ? items.findIndex((item) => item.image.id === current.image.id) : -1;
  return {
    ...state,
    items,
    index: currentIndex === -1 ? Math.min(state.index, items.length - 1) : currentIndex,
  };
}
