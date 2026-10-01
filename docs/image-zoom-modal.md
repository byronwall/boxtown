# Image Zoom Modal

This document describes the spatial map image zoom modal implemented in `app/src/components/spatial-map/SpatialMapImages.tsx` and its shared viewport/action helpers.

## Purpose

The image zoom modal is the full-size viewer for images attached to spatial map nodes. It is used from canvas nodes, tree/grid views, inspector image strips, stashed-node thumbnails, and any caller that opens image targets through `useSpatialMapImages()`.

The modal is more than a preview lightbox. It provides:

- Fit-to-stage image viewing.
- Smooth zoom centered on the cursor or viewport center.
- Pointer-based panning.
- Multi-image navigation for node image collections.
- Thumbnail navigation when more than one image is available.
- Image metadata badges.
- Copy, download, reset, zoom, delete, and close controls.
- Optimistic deletion updates.
- Shared image upload support for paste and drag-and-drop flows.

## Main Files

- `app/src/components/spatial-map/SpatialMapImages.tsx`
  - Owns the provider, context API, thumbnail strips, drop target, modal shell, modal content, image navigation, deletion, upload, and download filename logic.
- `app/src/components/spatial-map/use-contained-image-viewport.ts`
  - Owns fit-to-container, scale, offset, reset, image-size tracking, stage-size tracking, zoom anchoring, and resize handling.
- `app/src/components/spatial-map/image-viewer-actions.ts`
  - Owns clipboard and download behavior for file-backed or URL-backed images.

## Context API

`SpatialMapImageProvider` exposes image features through `useSpatialMapImages()`.

```ts
interface SpatialMapImageContextValue {
  openImage: (
    image: MapNodeImage,
    node: MapNode,
    images?: MapNodeImage[],
  ) => void;
  openImageTargets: (
    targets: SpatialMapImageTarget[],
    activeImage: MapNodeImage,
    options?: { canDelete?: boolean },
  ) => void;
  uploadImages: (nodeId: string, files: File[]) => Promise<void>;
}
```

### `openImage`

`openImage(image, node, images)` opens a node-scoped image set. If `images` is provided and non-empty, the modal can navigate across the full collection. Otherwise it opens only the selected image.

The active index is resolved by matching `src`, so callers can pass the current image object and the node image list without manually computing an index.

### `openImageTargets`

`openImageTargets(targets, activeImage, options)` opens an explicit list of `{ image, node }` targets. This supports collections that may span multiple nodes. `options.canDelete` controls whether the modal exposes the delete button.

### `uploadImages`

`uploadImages(nodeId, files)` filters to `image/*` files, submits them through the `addProjectNodeImages` server action, and applies the resulting project update through `onProjectUpdated`.

The provider also wires a global paste handler that uploads clipboard images to the currently selected spatial-map node, except when the paste target is editable or source decomposition intake is open.

## Open State

The modal state is stored in `ImageViewerState`.

```ts
interface ImageViewerState {
  items: SpatialMapImageTarget[];
  index: number;
  canDelete: boolean;
}
```

- `items` is the navigable collection.
- `index` points at the active image.
- `canDelete` gates destructive controls.

Closing the modal clears the current viewer state, clears pending delete state, clears the loaded image size, and resets the viewport.

## Layout

The modal is rendered with `SimpleDialog` and a local `spatialMapImageViewerDialogClass` hook. The dialog is sized for detailed inspection:

- Width: `min(1340px, 96vw)`.
- Height: `min(860px, calc(100dvh - 28px))`.
- Body: full-height, hidden overflow, no padding.
- Header/footer: compact, bordered, lightly tinted surfaces.

The content area is split into:

- A thumbnail rail when multiple images are available.
- A main stage that contains the pannable and zoomable image.

On larger screens, the thumbnail rail is a left column. On smaller screens, it becomes a horizontal strip above the stage.

## Header Controls

The header contains:

- Dialog title: the active image `originalName`, or `Image` fallback.
- Image position badge: current index and total count.
- MIME type badge.
- File size badge.
- Current zoom percentage badge.
- `Copy` button.
- `Download` button.
- `Zoom Out` button.
- `Reset` button.
- `Zoom In` button.
- `Delete` button, when deletion is allowed.
- Close button.

The zoom badge is derived from `imageViewport.scale()` and updates as the user zooms or resets.

## Zoom Behavior

Zoom state is owned by `createContainedImageViewport()`.

The modal configures:

- Minimum scale: `0.2`.
- Maximum scale: `8`.

The viewport tracks:

- `scale`
- `offset`
- loaded image size
- stage size

The default view is a contained fit:

- The image is scaled down to fit inside the stage.
- The image is not scaled above `1` by the fit operation.
- The fitted image is centered in the stage.
- The fit scale is also capped by the modal maximum scale.

Zoom actions:

- Header `Zoom Out`: multiplies scale by `0.8`.
- Header `Zoom In`: multiplies scale by `1.25`.
- Wheel zoom: converts wheel delta into an exponential zoom factor.
- Reset: restores the contained fit view.
- Double-click on the stage: resets the view.

Wheel zoom is anchored at the pointer location. Button zoom is anchored at the center of the stage.

The viewport clamps zoom between the computed minimum and configured maximum. The computed minimum allows the fit scale when the image is smaller than the configured minimum.

## Panning Behavior

The main image stage uses pointer events:

- `pointerdown` starts a pan session and captures the pointer.
- `pointermove` updates the image offset by the pointer delta.
- `pointerup` releases the pointer capture and ends the session.
- `pointercancel` clears the session.

The stage uses:

- `cursor: grab`
- `touchAction: none`
- `userSelect: none`

The image itself is non-draggable and has `pointerEvents: none`, so pointer input stays on the stage.

## Resize and Image Load Handling

The viewport uses `ResizeObserver` to track stage size. When the image is still following the fit view, resizing the modal or stage recomputes the fit and keeps the image centered.

When an image loads:

- Natural image dimensions are recorded.
- The viewport schedules a fit reset.

When the active image changes:

- The current pan session is cleared.
- The current image size is cleared.
- The view is reset.
- The next image dimensions are preloaded.
- Stale preload results are ignored with an incrementing request id.

This avoids applying dimensions from a previous image after rapid navigation.

## Multi-Image Navigation

When the active state has more than one item:

- The modal shows the thumbnail rail.
- The stage shows previous and next arrow buttons.
- `ArrowLeft` navigates to the previous image.
- `ArrowRight` navigates to the next image.
- Navigation wraps at both ends.

Each thumbnail:

- Uses the image `src` and `originalName`.
- Shows an ordinal badge.
- Uses `aria-current="true"` for the active thumbnail.
- Applies a subtle selected border and inset treatment.

## Copy

The `Copy` button calls `copyImageTargetToClipboard()`.

For URL-backed modal images, it:

1. Fetches the image `src`.
2. Converts the response to a blob.
3. Uses `navigator.clipboard.write()` with `ClipboardItem`.
4. Uses the blob type, target MIME type, or `image/png` fallback.
5. Checks `ClipboardItem.supports()` when available.

Failure states surface as toasts. Common failures include unsupported browser clipboard APIs, unsupported MIME types, and failed image fetches.

## Download

The `Download` button calls `downloadImageTarget()`.

For URL-backed modal images, it:

1. Fetches the image `src`.
2. Converts the response to a blob.
3. Creates an object URL.
4. Creates a temporary anchor.
5. Triggers a browser download.
6. Revokes the object URL after the click.

The download filename is generated from project and map context:

- Project name.
- Parent-child hierarchy labels from root to current node.
- Incoming dependency chain labels, prefixed with `deps`, when available.
- The original image extension, stored filename extension, or MIME-derived extension.

Filename segments are sanitized for common filesystem-invalid characters, whitespace-normalized, and truncated. Sequential duplicate parts are removed, and the base filename is capped at 180 characters.

## Delete

The `Delete` button is visible when:

- The current image exists.
- The viewer allows deletion.
- The provider was given an `onDeleteImage` handler.

Deletion flow:

1. Generate a client mutation id.
2. Store the previous project for rollback.
3. Set `pendingDeleteImageId`.
4. Optimistically remove the image from the matching node.
5. Call `onProjectUpdated` with `{ phase: "optimistic" }`.
6. Submit `deleteProjectNodeImage` with `projectId`, `nodeId`, and `imageId`.
7. Apply the server project result.
8. Rebuild the modal item list from the returned project.
9. Close the modal if no remaining modal images exist.
10. Clamp the active index if the active item was removed.

On failure, the previous project is restored through `onProjectUpdated`, pending state is cleared, and an error toast is shown.

## Upload Integration

Image upload is not part of the modal surface itself, but it is owned by the same provider so node image interactions share one context.

### Drag and Drop

`SpatialMapImageDropTarget` wraps node-specific UI and accepts dropped image files. It:

- Detects `image/*` files from both `DataTransfer.files` and `DataTransfer.items`.
- Deduplicates files by `name:type:size`.
- Shows a dragging visual state only when image files are present.
- Calls `uploadImages(nodeId, files)` on drop.

### Paste

The provider listens for `paste` on `window`. It accepts clipboard images when:

- The event target is not editable.
- Source decomposition intake is not open.
- A spatial-map node is selected.
- Clipboard data contains image files.

Accepted pasted images upload to the selected node.

## Thumbnail Entry Points

The modal can be opened from several spatial-map surfaces:

- Canvas/stashed node thumbnails in `SpatialMapCanvas.tsx`.
- SVG scene image previews in `SpatialMapScene.tsx`.
- Grid cards in `SpatialMapGridView.tsx`.
- Tree and inspector strips through `SpatialMapImageStrip`.

These entry points use `cursor="zoom-in"`, accessible labels such as `Open {originalName}`, and lazy-loaded thumbnail images.

When a node has multiple images, compact thumbnail surfaces can show a count badge so users know the modal will open a navigable collection.

## Accessibility Notes

The modal includes:

- A dialog title based on the active image name.
- Accessible close button label.
- Accessible previous and next button labels.
- Accessible thumbnail labels.
- `aria-current` on the active thumbnail.
- Keyboard arrow navigation for multi-image collections.
- Image `alt` text from `originalName`.

The current implementation does not define dedicated keyboard shortcuts for zooming, resetting, deleting, copying, or downloading.

## Error Handling

User-visible errors are surfaced through toasts:

- Image upload failure.
- Clipboard copy failure.
- Download failure.
- Delete failure.

Upload and drag/paste decisions also log diagnostic details with the `[spatial-map-images]` prefix.

## Design Constraints

The zoom modal intentionally keeps zoom and pan transforms on the modal image element, not on the scaled spatial-map SVG canvas. This keeps it separate from the spatial map canvas safety rules that prohibit filters and forced compositing hints on map nodes.

The viewer uses direct `transform: translate(...) scale(...)` on the image for pan/zoom. It does not apply blur, drop-shadow, or CSS/SVG filter effects to the spatial map scene.

## Reuse Notes

Use `openImage()` for the common case where all images belong to one node.

Use `openImageTargets()` when the modal collection spans multiple nodes or when deletion must be disabled.

Use `createContainedImageViewport()` for other image preview dialogs that need the same fit, zoom, pan, resize, and reset behavior. The source decomposition preview already reuses this helper and the shared copy/download actions.

