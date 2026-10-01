# Changelog

Notable changes to Product Grid Management, newest first. Entries are grouped by date and written for someone using the app, not as a commit log.

## 2026-09-30

### Changed

- The inspector sidebar is rebuilt for density. Under the title it shows the node id (click to copy), one row of status, priority, and type chips, and one compact action row. Context comes first, then images, then Metadata, Connections, and Activity as collapsible one-line groups that open on their own only when they have content.
- Node context is edited in place: click the rendered markdown, type, and click away or press Cmd/Ctrl+Enter to save. Esc cancels. The Edit, Save, and Cancel buttons are gone, and routine saves no longer show a toast.
- Activity is a dense list (icon, summary, actor, short relative time) instead of a stack of cards.
- The pane resize handle is its own gutter column between the workspace and the inspector, marked with a vertical ellipsis. It no longer overlaps content.
- Project-wide activity moved from the Details/Activity tab strip to a history icon in the inspector header.
- Outgoing and incoming connections are one list with direction markers.
- With nothing selected, the inspector shows project counts by status, project-level actions (new node, new context node, copy visible nodes as Markdown, project settings), and recent activity.

### Added

- Every button has a pressed state: a slight scale-down while held, with a smaller scale and a darker fill on full-width rows.
- Tooltips on the inspector's icon-only buttons (archive, delete, copy agent prompt, project activity).
- `DESIGN.md` gained "Density and Cleanup Principles", "Press feedback", "Activity lists", and "Pane resize handle" sections, and the inspector rail section now describes the current layout.

### Fixed

- Selecting nodes in the metadata grid no longer shifts the table when the bulk action bar appears.
- Status, priority, and type chips now render with their tone colors. They previously showed a dark border and no fill, in the inspector and in the tree view.
- Tooltips no longer render behind the main workspace panel.
- Long metadata placeholders truncate with an ellipsis instead of running off the edge of the inspector.
