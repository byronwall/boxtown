# Changelog

Notable changes to Boxtown (formerly Product Grid Management), newest first. Entries are grouped by date and written for someone using the app, not as a commit log.

## 2026-11-22

### Fixed

- Installing the `boxtown` package with npm 12 now adds the `boxtown` command. Before, npm 12 dropped it.

### Changed

- Product Grid Management is now **Boxtown**. The app title, the CLI, and the agent skill use the new name.
- The CLI command is `boxtown` instead of `pgm`. Install it with `npm install -g boxtown`. The old `@byronwallrus/product-grid-cli` package gets no more updates.
- CLI environment variables start with `BOXTOWN_` instead of `PRODUCT_GRID_` or `PGM_`. For example, `BOXTOWN_SERVER` and `BOXTOWN_TOKEN`.
- The CLI config file moved from a `product-grid` folder to a `boxtown` folder. Run `boxtown auth login --token <token>` again to set your server and token.
- The agent skill is now `boxtown-context`. Run `boxtown skill install` to install it again.
- The repo's local data folder moved from `pgm/data` to `boxtown/data`. `boxtown viewer` uses `./boxtown/data` by default.
- Project exports download as `<project>.boxtown.zip`. Older `.product-grid.zip` files still import.

## 2026-10-16

### Fixed

- When a `--local` command can't connect to a running viewer because local network access is blocked, it now says so right away. It no longer waits and reports that the viewer is still starting. Other connection errors name the cause, such as nothing listening, a timeout, or a blocked socket.
- Project history is no longer capped at 250 entries. Older history files used to be deleted as new ones were written; now every entry is kept. The app still loads only the most recent 250, so big histories don't slow down editing.

- Two agents updating different metadata fields on the same node at the same time no longer erase each other's change. Metadata `set` and `unset` now merge with the latest saved node.
- A node update that changes several fields is now all or nothing. An invalid status, priority, type, or metadata key rejects the whole request, so a valid title or status is no longer saved alongside an error.

- Creating or importing a node with a metadata field the project doesn't define now fails, with no node created. It used to look successful while silently dropping the field. Every unknown-field error lists the project's existing fields and shows the command to add a new one.
- `pgm node resolve`, `pgm node complete`, `node batch-update`, and `node agent-update` now save the status and notes for each node in one request. A rejected note no longer leaves the node marked implemented without it.
- `node batch-update` and `node agent-update` exit with code 8 when any item isn't applied. They also report each item, in input order, as `applied`, `rejected`, `conflict`, or `unknown`, with the saved values and history entry id. An item with an unknown field or status is rejected before anything is sent. When the connection drops mid-request, the item is reported as `unknown` with a command to check it, instead of as failed.
- `agent-update` writes `blockedBy` and `filesChanged` to the `blocked-by` and `files-changed` fields. An unrecognized key in an update now fails that item instead of being dropped.
- Metadata keys typed in camelCase, such as `blockedBy`, become `blocked-by` instead of `blockedby`.

### Added

- `pgm project audit` is a read-only report for a project or a subtree. It counts nodes by status and type and lists findings with a rule, severity, node id, and reason: implemented nodes missing `solution` or `verification` (or the fields you pass with `--require`), open nodes that have solution text (to review, not to mark wrong), working nodes with no owner, possible duplicate titles, missing image files, and broken parents, links, or cycles in the stored files, including ones the loader repaired. `--output` saves a Markdown copy, and `--fail-on warning` exits with code 9 when findings exist.
- `pgm target inspect` shows where commands will go without starting anything. For a server, it shows the URL, project, whether a token is set, where each came from, and whether the server answers. For `--local`, it shows the data folder and the viewer running for it. Write receipts also include the target, so a write to the wrong server or folder is easy to spot.
- `pgm relation list|add|remove` manages related, dependency, and reuse links between nodes, with matching `/nodes/<id>/relations` API routes. Adding a link that already exists does nothing, and parent/child structure is never changed. Added links show in node activity.
- `pgm node note add <node-id> --text "..."` (or `--text-file`) adds a note to the end of a node's context on the server. Notes added by several agents at once are all kept, and each note's text is also saved in its history entry. `pgm node complete --note` uses this too, so it no longer reads and rewrites the whole context.
- `pgm node resolve --solution` (or `--solution-file`) records the proven fix in the `solution` field, separately from `--note`, which writes `implementation`.
- Text can come from a file or stdin instead of a quoted argument: `--note-file`, `--solution-file`, `node metadata set --value-file`, and `node context set --file -`. The text is stored as written, so backticks and `$( )` are never run by the shell.
- Single-node commands print a receipt of what the server saved: the changed fields, their saved values, the new revision, and the history entry id. `node update` and `node context set` take `--expected-revision`.
- `pgm project schema ensure-field <key> --label "Label"` adds one metadata field without replacing the rest of the schema. Running it again does nothing, and a different label or default for an existing field is refused instead of overwritten.
- Node reads return a `revision`. Pass it back as `expectedRevision` when replacing context or other fields, and the update is refused with a conflict if someone changed the node in between. Changes to other nodes don't affect it.
- `pgm project history` and `GET /api/v1/projects/<id>/history` page through every stored history entry, newest first, with an optional node filter. Each page returns a `nextCursor` for reading older entries, and entries written in the meantime don't shift the pages.
- The node update API accepts `context` and `metadata` (`set`, `unset`, or a full `replace`) alongside title, status, type, priority, and archived, and returns the saved node, its new revision, the changed fields, and the history entry id.

## 2026-10-10

### Added

- A Delete archived action sits next to Archive implemented in the toolbar `...` menu. It shows how many nodes are archived, including children hidden under an archived node, and after you confirm it deletes all of them with their links and image files.

### Changed

- Archive implemented and Delete archived moved from the grid toolbar and inspector header into the toolbar `...` menu, so they work the same in Canvas, Tree, and Grid. Each shows its count and is greyed out when there is nothing to act on.

### Fixed

- Labels on canvas nodes with an image preview are readable again. The preview leaves room for a two-line label, so the text no longer shrinks to a fraction of the size of nearby nodes.
- The Create and More actions tooltips no longer cover the first item of their open menu.

## 2026-10-09

### Changed

- Projects are now saved as one Markdown file per node, one file per history entry, and a small `project.json`, instead of one large `project.json`. Two git branches that each add issues or edit different nodes now merge without conflicts. When both edit the same field, the conflict shows up in that node's file, where it is easy to read.
- Existing projects move to the new layout the first time they're opened, with nothing lost. The old file is kept as a `project.json.v1-*.bak` backup, and git ignores it.
- After a merge, a project with a missing parent, a link to a deleted node, or a parent loop from two crossing moves loads normally. The loader repairs the problem and logs what it changed. If a merge leaves conflict markers, the error names each file that needs fixing.

## 2026-10-06

### Added

- The project list has a Remove unused images button for each project. It shows how many image files no node uses, including archived nodes, and how much space they take, then deletes them after you confirm.

### Changed

- Deleting a node also deletes its image files, and its children's image files when you delete the children too.
- Canvas nodes show a tall or square image on the left with the title beside it, and keep wide images on top. The image shape picks whichever layout gives the larger preview.
- A node title that needs two lines shrinks to fit them instead of running into the node type below.
- The new node form puts Context directly under the title and Type below it, so the field you fill in most often comes first.

### Fixed

- Closing the terminal running `pgm viewer`, or a server that stops on Ctrl+C by signal, no longer leaves `.pgm-local-runtime.json` behind. A new `pgm viewer` also replaces a record left by a viewer that was force-killed, instead of refusing to start.

## 2026-10-05

### Added

- The repo includes a cloud copy of Project Mgmt Grid, with archived nodes, history, and images, in `pgm/data`.

### Changed

- The local Project Mgmt Grid marks 22 resolved issues as implemented, with current source evidence on each issue.
- `pgm viewer` uses `./pgm/data` by default. Use `--data-dir` to select another folder.
- The development app checks `pgm/data` before other default data folders. `APP_DATA_DIR` still takes priority.

## 2026-10-02

### Added

- `pgm viewer --data-dir <folder>` starts the editable viewer with project files and images saved in that folder.
- Project, node, and image CLI commands accept `--local <folder>` and share that folder's viewer or start a temporary local runtime.
- CLI releases use a Version Packages PR to update the npm package, package changelog, and GitHub release.

- The inspector header has an Archive implemented action (archive icon with a count) in canvas, tree, and grid, with or without a selected node.
- Canvas zoom and pan are kept in the URL (`cam`), so a refresh, a shared link, or Back returns to the same view. Fit, F, and the first pan or zoom take over as usual.
- The map filter menu can filter by who last edited a node (Human or Agent), combined with type, status, and priority. A node whose edit history has rolled out of the project log matches neither.
- An optional Overlap toggle in the canvas controls stacks nodes by depth like Mahjong tiles: children overlap their parent, deeper tiles sit on top with a thicker tile edge. The regular layout stays the default, and the choice is kept in the URL.
- A structure peek button in the inspector header shows where the selected node sits: its ancestors, the node, and up to three levels of children with status and child counts. Opening or closing it leaves the selection and the map view alone; clicking a row selects that node.
- The tree view's table of contents highlights the heading you are currently scrolled to (the same one the breadcrumb shows), marks it as the current location for screen readers, and scrolls it into view when the contents open. Keyboard focus now uses a ring, so it is distinct from the current row.
- The node type picker (inspector, tree, and grid) has a filter field: start typing to narrow the types, use the arrow keys and Enter to choose, and an empty search says nothing matches.

### Removed

- Removed the Overlap canvas mode, its URL setting, and its depth-based tile layout.

### Changed

- The inspector title and its header actions stay pinned at the top while the inspector body scrolls.
- Canvas image previews follow the image's shape. Portrait and square images get a taller centered frame instead of a thin cropped strip, and wide images use a shorter band that leaves more room for the node title. Node sizes and positions are unchanged.
- Workspace chrome (toolbar, canvas controls, filter menu, inspector, tree, grid, and menus) uses neutral grays instead of green. Node type and status colors are unchanged.

### Fixed

- Legacy project-file repair no longer overwrites edits made while a project is being read.
- CLI release package checks now work on the Linux GitHub Actions runner.

- Edits stay on screen while they save, even when another save finishes, another tab saves, or the server pushes an update. A failed save rolls back only that edit, and a successful save is kept even if the follow-up refresh fails.
- Success and error notifications appear again. The notification area was never mounted, so failures were silent.
- The canvas no longer opens stretched. On first load the map now uses the real canvas proportions instead of waiting for a window resize, and the zoom readout shows the actual zoom.
- Include all children and Show archived now stay in the URL with the other filters, so a refresh or a shared link keeps them.
- Cmd+K search highlights no longer add space inside words; a match in the middle of a word now reads as one word.
- Deleting an image in the image viewer updates the viewer immediately: it moves to the next image, or closes when the last image is deleted. A failed delete puts the image back in the viewer with an error so you can retry.
- Project changes from CLI commands now reach an open viewer through production WebSocket events.

## 2026-10-01

### Added

- The metadata grid header has an Archive implemented action that archives every implemented node in the project in one click.
- The map filter menu has a Reset filters action that clears every filter and hides archived nodes again. It stays available when no nodes match.

### Changed

- Node filters and the grid name filter now stay in the URL, so a link or a refresh restores the same view.

### Fixed

- Simultaneous project edits retain both changes. Failed edits no longer block later writes.
- Node edits read only their project. A corrupt unrelated project no longer blocks a valid edit.
- Selecting nodes in the metadata grid no longer shifts the table. The bulk actions now take the place of the count summary in the grid header instead of adding a row, and Set status is a menu.

## 2026-09-30

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
