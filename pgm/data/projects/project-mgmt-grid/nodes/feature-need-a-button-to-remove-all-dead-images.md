---
id: feature-need-a-button-to-remove-all-dead-images
label: Need a button to remove all "dead" images
type: feature
status: implemented
metadata:
  implementation: The project list has a Remove unused images button (image-off icon) per project. The dialog counts image files that no node references, archived nodes included, with their size, and removes them after confirmation (image-cleanup.server.ts). Cleanup runs in the serialized mutation queue so in-flight uploads are never treated as unused.
---
There are images that are not linked anywhere else.
