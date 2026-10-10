# @byronwallrus/product-grid-cli

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
