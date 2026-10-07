# Local project data

`data/projects/project-mgmt-grid` contains a copy of the cloud Project Mgmt Grid.
The copy was downloaded on October 5, 2026, from `https://prod-mgmt.apps.byroni.us`.
It includes 69 nodes, seven images, and 250 saved history entries.

On October 5, 2026, 22 resolved issues were marked implemented after source review and 35 focused checks.
Each updated issue has an implementation note with the evidence.
Node-form order, preview sizing across zoom levels, and the removed overlap view remain open.
The two deprecated issues keep their status.

Run `pgm viewer` from the repo root to open this data with the updated CLI.
For a source checkout, run `pnpm cli:prepare-package` first, then `pnpm --dir packages/cli dev viewer`.
The development app also detects this folder when started from the repo root or `app/`.

This is an editable local copy. Local changes do not update the cloud project.
