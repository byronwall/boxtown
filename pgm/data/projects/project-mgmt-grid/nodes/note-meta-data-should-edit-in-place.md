---
id: note-meta-data-should-edit-in-place
label: Meta data should edit in place
type: task
status: implemented
archived: true
metadata:
  implementation: Use the edit in place comp and apply edits on ENTER instead of requiring the save button to be hit.  Do not need reset any more either... it resets on blur.
rawContext: ""
---
Resolution note:

Metadata fields now use EditInPlace in the inspector and commit individual edits on Enter, preserving other metadata values. Removed the separate metadata draft Reset/Save button flow.
