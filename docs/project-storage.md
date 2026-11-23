# Project storage

Projects are stored as plain files so a project can live in a git repo next to the code it describes. Two branches that each add or edit issues should merge with ordinary `git merge`. This doc covers the layout, the merge rules, and the one-time migration from the older single-file format.

Code: [app/src/lib/projects/storage/](../app/src/lib/projects/storage/).

## Layout (format version 2)

```text
<data dir>/projects/<project-id>/
|-- project.json          name, description, createdAt, metadata fields, node types
|-- nodes/<node-id>.md    one file per node
|-- history/<stamp>-<ordinal>-<entry-id>.json
|                         one file per activity entry, write-once
|-- images/<node-id>/     uploaded images (unchanged)
`-- .gitignore            keeps *.bak backups and *.tmp writes out of git
```

`project.json` stores only things that rarely change:

```json
{
  "format": "product-grid-project",
  "formatVersion": 2,
  "id": "project-mgmt-grid",
  "name": "Project Mgmt Grid",
  "description": "…",
  "createdAt": "2026-04-29T15:53:08.833Z",
  "nodeMetadataSchema": [ … ],
  "nodeTypeSchema": [ … ]
}
```

`updatedAt` is not stored. It is the time of the newest history entry, because a shared timestamp would conflict on every merge.

### Node files

Front matter holds the fields. The Markdown body holds the node context.

```markdown
---
id: feature-archive-implemented-should-in-the-side-bar-too
label: Archive implemented should in the side bar too
type: feature
status: implemented
priority: high            # omitted when unprioritized
archived: true            # omitted when false
parent: feature-sidebar   # parent node id; omitted for roots
links:                    # non-parent links that start at this node
  - target: page-grid-view
    relationship: dependency
metadata:
  implementation: |-
    Multi-line values stay line-oriented,
    so git can merge them.
images:
  - id: 8e618702-…
    filename: 8e618702-….png
    …
rawContext: ""            # only when it differs from the body
---
Currently only on the grid view. We should have all functionality in all places.
```

Rules that keep diffs small and merges clean:

- The file name comes from the node id. The `id` field is authoritative.
- The parent is stored on the child, so reparenting changes one line in one file. Folders do not mirror the tree, because a move would then be a directory rename, which git merges poorly.
- Metadata keys are written in sorted order. Long text uses YAML block scalars.
- Writes are atomic (temp file plus rename). A file is rewritten only when its content changes, so an edit touches only the node it changes and its new history file.

### History files

Each activity entry is its own JSON file named `<yyyymmddThhmmssSSSZ>-<ordinal>-<id>.json`. Names sort chronologically, and the ordinal keeps entries with the same timestamp in order. Entries are never rewritten. The newest 250 are kept, and pruning deletes the oldest files.

Entries no longer carry state snapshots. The node files hold the current state.

## Merging branches

| Change on each branch | Result of `git merge` |
| --- | --- |
| Both add issues | Clean: new files |
| Edits to different nodes | Clean: different files |
| Edits to different fields or paragraphs of one node | Clean: different lines |
| Same field of the same node | Conflict in `nodes/<id>.md`, readable in place |
| Both add a node type or metadata field | Usually a conflict in `project.json` |

Some merges are clean in git but leave a project that neither branch had. The loader repairs these on read, logs each repair once, and saves the fix with the next edit:

- **A child of a node deleted on the other branch** moves to the root, which matches what deleting a node does in the app.
- **A link to a deleted node** is dropped.
- **A parent cycle from crossing moves** (A under B on one branch, B under A on the other) is cut at the lowest node id in the cycle, so every clone repairs it the same way.
- **A duplicate node type or metadata field in `project.json`**: the first one is kept.

If a merge leaves conflict markers, the project refuses to load. The error names every conflicted file, for example `nodes/feature-x.md has unresolved git merge conflict markers`. A conflicted `project.json` is never auto-recovered, because that could silently drop one side.

`git-merge.test.ts` runs these cases with real branches and `git merge`.

## Migration from format version 1

Older projects stored everything in one `project.json`: the project fields plus `operationLog`, where the newest entry held a full snapshot of every node. Every edit rewrote the top of that file, so any two branches conflicted.

The first time the app or `boxtown` reads a version 1 project, it migrates it:

1. Parse it with the existing reader. This also migrates older legacy shapes, such as top-level `spatialMap` and `project.backfilled` entries.
2. Copy the old file to `project.json.v1-<timestamp>.bak`. The copy appears in the backup list and is ignored by git.
3. Write `nodes/` and `history/`, then write `project.json` last. Until that last write finishes, the project still reads as version 1, so an interrupted migration simply runs again.

The migration is lossless and deterministic. History file names depend only on entry content, so two branches that each migrate the same version 1 project produce identical files and merge cleanly. To move a shared repo over, migrate on the main branch first. A branch that migrates on its own also merges cleanly with it.

## Archives

Project archives (`.boxtown.zip`) still contain a single `project.json` record in which the newest history entry holds the full state. Old archives import unchanged.

## History entry shape

```ts
interface ProjectOperationLogEntry {
  id: string;                       // UUID, or a stable id for backfilled entries
  kind: ProjectOperationKind;       // e.g. node.created, node.status.updated, node.moved
  actor: { kind: "human" | "agent"; id?: string; label?: string };
  createdAt: string;                // ISO timestamp
  summary: string;                  // sentence shown in activity
  nodeIds: string[];
  linkKeys?: string[];
  metadata?: Record<string, string>; // e.g. clientMutationId, imageCount
}
```

UI actions are recorded as `human`. `/api/v1` calls, which include the `boxtown` CLI, are recorded as `agent`.
