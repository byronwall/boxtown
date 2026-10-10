---
id: feature-zoom-resets-when-tab-gets-focus-again
label: Zoom resets when tab gets focus again
type: feature
status: implemented
archived: true
metadata:
  implementation: "Reconciled 2026-10-05: SpatialMapUrlSync saves camera center and width in cam and restores them on load. The controller holds the restored view through automatic fits and data refreshes. Stable graph identity avoids fits on bookkeeping updates. Commits 2f36553c and 46fb26ee are merged; camera checks passed."
---
Needs to be bumpless.  Ideally zoom and pan are also in the URL so there is no shift on reload.
