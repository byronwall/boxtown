# @byronwallrus/product-grid-cli

## 0.5.0

### Minor Changes

- cf23471: Add pgm node note add, which appends a note to a node on the server so concurrent notes are kept and recorded in history; node complete --note now uses it.
- 1e839fe: Add pgm project audit, a read-only report of node counts and completeness and integrity findings, with Markdown output and a --fail-on option for automated checks.
- b0456d0: Add pgm project schema ensure-field. Node create and import now reject undeclared metadata fields instead of silently dropping them, and unknown-field errors list the existing fields and how to add one.
- 0319ba7: Add pgm relation list, add, and remove for related, dependency, and reuse links between nodes.
- 503c9fe: Add pgm target inspect, include the target in write receipts, and report blocked local network access and other connection failures by cause instead of as a slow viewer startup.
- ea85aaa: Compound node writes: resolve, complete, batch-update, and agent-update save each node in one request; batches report per-item outcomes and exit 8 on any failure; new --solution, --note-file, --solution-file, and --value-file options read text safely from files or stdin.

### Patch Changes

- 7a5959a: Node updates are now atomic: concurrent metadata updates to different keys both survive, an invalid field rejects the whole update, and node reads return a revision you can pass as expectedRevision to avoid overwriting newer edits.
- 5e596b3: Project history is no longer trimmed to 250 entries, and the new pgm project history command pages through every entry with a cursor and optional node filter.

## 0.4.1

### Patch Changes

- b4bf88f: Move Archive implemented and Delete archived into the toolbar ... menu, and keep canvas node labels readable when the node shows an image preview.

## 0.4.0

### Minor Changes

- d3acb92: The bundled app has a Delete archived button that deletes every archived node, the children hidden under them, and their images after you confirm.

## 0.3.0

### Minor Changes

- 5fae3d3: Projects are saved as one Markdown file per node plus one file per history entry, so git branches that add or edit different issues merge cleanly. Existing projects migrate automatically on first open and keep a backup of the old project.json; older CLI versions cannot read migrated projects.
- a17aca6: The viewer uses ./pgm/data by default. Pass --data-dir to select another folder.

### Patch Changes

- b4c350a: pgm viewer cleans up its runtime record when the terminal closes or the server dies from a signal, and a later pgm viewer replaces a record left by a viewer that was force-killed.

## 0.2.0

### Minor Changes

- 63a0515: Open the current editable viewer with local project and image files. Use --local for CLI commands that share the viewer server or run a temporary server.

## 0.1.9

### Patch Changes

- a6f8fd9: Add node priority filters, archive controls, and image downloads to the CLI.
