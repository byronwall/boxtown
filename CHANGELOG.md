# Changelog

Notable changes to Product Grid Management, newest first. Entries are grouped by date and written for someone using the app, not as a commit log.

## 2026-10-01

### Added

- The map filter menu has a Reset filters action that clears every filter and hides archived nodes again. It stays available when no nodes match.

### Changed

- Node filters and the grid name filter now stay in the URL, so a link or a refresh restores the same view.

### Fixed

- Selecting nodes in the metadata grid no longer shifts the table. The bulk actions now take the place of the count summary in the grid header instead of adding a row, and Set status is a menu.

## 2026-09-30

### Added

- The node grid can archive every unarchived implemented node in the project with one action.

### Changed

- The inspector sidebar is rebuilt for density. Under the title it shows the node id (click to copy), one row of status, priority, and type chips, and one compact action row. Context comes first, then images, then Metadata, Connections, and Activity as collapsible one-line groups that open on their own only when they have content.
- Node context is edited in place: click the rendered markdown, type, and click away or press Cmd/Ctrl+Enter to save. Esc cancels. The Edit, Save, and Cancel buttons are gone, and routine saves no longer show a toast.
- Activity is a dense list (icon, summary, actor, short relative time) instead of a stack of cards.
- The pane resize handle is its own gutter column between the workspace and the inspector, marked with a vertical ellipsis. It no longer overlaps content.
- Project-wide activity moved from the Details/Activity tab strip to a history icon in the inspector header.
- Outgoing and incoming connections are one list with direction markers.
- With nothing selected, the inspector shows project counts by status, project-level actions (new node, new context node, copy visible nodes as Markdown, project settings), and recent activity.
- The project toolbar is flatter and shorter (40px, 24px controls). Controls are ordered view, depth, filter, create, more, and the depth switch has a "Depth" label.
- While a node is isolated the toolbar shows an "Isolated: name ×" chip instead of a bare × button.
- The view and depth switches mark the active option with a fill only; the underline marker is gone.
- The toolbar's Create menu now includes "New node" alongside "New context node".

- The app shell is standard and full-bleed. Every page has one top header bar with the logo as a home link; the padded, rounded frame and the "< Back" link floating above it are gone. On a project page the header reads "Projects / project name" and holds the toolbar controls.
- The project list is a single centered column: a create row, an "Import archive" button that imports as soon as a ZIP is chosen, and a flat list of projects with download and delete icon buttons.
- Canvas controls are one compact bar in the top-right corner (zoom, Fit, Edges, Linked, and a Type / Status color switch) instead of tabs hanging from the top edge. The canvas now fills its pane.
- The node stash is a flat pane with a count and compact rows.
- The tree view is a flat reading column with a smaller heading scale, tighter spacing, and a slimmer sticky path bar.
- The grid view is flat and denser: a 36px header with counts, column toggles, filter, and a Nodes / Links switch, and rows of about 30px without zebra striping.

- Tree view rows are one line each: a collapse chevron in a left gutter, the heading with a child count, and status and type chips in aligned columns on the right. Branches collapse and expand, with Expand all and Collapse all in the sticky bar. A priority chip appears when a node has one.
- In the grid, the header row and the select and name columns stay in view while scrolling, columns resize by dragging their divider line, and type and status use the same chips as the rest of the app.
- Dialogs, menus, and popovers share one look: an opaque surface with a thin border and a small shadow over a quiet scrim, compact headers, and 32px footer buttons. Project settings, new context node, the delete dialogs, the image viewer, the command menu, and the move-node panel were all brought onto it.
- The whole app now uses the workspace mono type stack, including dialogs and menus that previously fell back to a sans font.
- Titles and buttons use sentence case.

### Added

- Every button has a pressed state: a slight scale-down while held, with a smaller scale and a darker fill on full-width rows.
- Tooltips on the inspector's icon-only buttons (archive, delete, copy agent prompt, project activity).
- `DESIGN.md` gained "Density and Cleanup Principles", "Press feedback", "Activity lists", and "Pane resize handle" sections, and the inspector rail section now describes the current layout.

### Fixed

- Tree view headings now follow the intended size scale; the top level was rendering smaller than its children.
- The logo no longer fills the page for a moment on refresh, and a loading page shows the header bar instead of a blank screen.
- The toolbar's controls now sit at the right edge on wide screens instead of floating in the middle.
- Status, priority, and type chips now render with their tone colors. They previously showed a dark border and no fill, in the inspector and in the tree view.
- Tooltips no longer render behind the main workspace panel.
- Long metadata placeholders truncate with an ellipsis instead of running off the edge of the inspector.
