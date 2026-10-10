---
id: task-odd-animation-when-adding-a-node-things-move-too-much
label: Odd animation when adding a node - things move too much - seems like we're missing an optimistic update
type: task
status: implemented
archived: true
metadata:
  implementation: "Reconciled 2026-10-05: Optimistic creation and the server use the same createUniqueNodeId function. Server confirmation reuses the visible graph when only default fields or history change, avoiding a second enter transition. Commit 46fb26ee is merged; the creation-acknowledgement check passed."
---
