---
id: page-double-click-should-isolate-not-go-to-canvas
label: Double click should isolate - not go to canvas
type: task
status: implemented
archived: true
rawContext: ""
---
Resolution note:

Implemented in SpatialMapGridView: double-clicking a grid node now isolates that node while clicks on editable controls are ignored so editing does not trigger isolation. Verification: pnpm type-check.
