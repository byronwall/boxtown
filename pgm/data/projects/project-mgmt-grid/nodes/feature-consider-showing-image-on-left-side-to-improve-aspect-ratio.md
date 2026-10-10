---
id: feature-consider-showing-image-on-left-side-to-improve-aspect-ratio
label: Consider showing image on left side to improve aspect ratio
type: feature
status: implemented
metadata:
  implementation: Canvas nodes now choose between a top image band and a left image column (spatial-map-image-frame.ts). The layout with the larger preview wins, with a 1.25x bias toward top. Side images stop above the status badge, and the title and type center in the right column. Two-line titles also shrink to fit instead of overlapping the type text. Covered by spatial-map-image-frame.test.ts.
images:
  - id: 55012e03-3ad6-4c71-8829-334be855b9a3
    src: /api/projects/project-mgmt-grid/images/feature-consider-showing-image-on-left-side-to-improve-aspect-ratio/55012e03-3ad6-4c71-8829-334be855b9a3.png
    filename: 55012e03-3ad6-4c71-8829-334be855b9a3.png
    originalName: image.png
    mimeType: image/png
    size: 109843
    createdAt: 2026-10-07T02:06:32.512Z
---
Basically two modes: top+bottom for image and text or left+right. Let image aspect ratio drive choice.  Goal is minimal whitespace and highest density possible.
