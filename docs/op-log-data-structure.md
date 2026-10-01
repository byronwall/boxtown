# Project Operation Log Data Structure

## Purpose

The project operation log is the canonical on-disk representation of a project. It records graph and project mutations in a replayable structure so the app can answer:

- What changed recently in this project?
- What activity is associated with the selected node?
- Which nodes, links, or schemas were affected by a mutation?
- What state should be materialized for the client?
- What checkpoint could future rollback, undo, or timeline tooling target?

`ProjectRecord.spatialMap`, `ProjectRecord.nodeMetadataSchema`, and `ProjectRecord.nodeTypeSchema` are now derived fields. The client still receives those old fields for compatibility, but disk serialization drains down to project identity plus `operationLog`.

## Storage Location

The log lives on `ProjectRecord.operationLog` in [app/src/lib/projects/types.ts](/Users/byronwall/Projects/product-grid-mgmt/app/src/lib/projects/types.ts). `ProjectRecord` still exposes the old shape after projection so existing UI code can keep reading `project.spatialMap`, `project.nodeMetadataSchema`, and `project.nodeTypeSchema`.

```ts
export interface ProjectRecord {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  nodeMetadataSchema: ProjectNodeMetadataField[];
  nodeTypeSchema: ProjectNodeTypeDefinition[];
  spatialMap: SpatialMapData;
  operationLog: ProjectOperationLogEntry[];
}
```

In-memory tree:

```text
ProjectRecord
|-- id
|-- name
|-- description
|-- createdAt
|-- updatedAt
|-- nodeMetadataSchema[]   derived from operationLog
|-- nodeTypeSchema[]       derived from operationLog
|-- spatialMap             derived from operationLog
|   |-- nodes[]
|   `-- links[]
`-- operationLog[]         canonical
    |-- ProjectOperationLogEntry
    |-- ProjectOperationLogEntry
    `-- ...
```

Serialized disk tree:

```text
project.json
|-- id
|-- name
|-- description
|-- createdAt
|-- updatedAt
`-- operationLog[]
    |-- newest operation
    |-- prior operation
    `-- baseline operation
```

## Entry Shape

Each entry stores operation identity, display text, references to affected graph objects, and an optional payload. The current authoritative payload is a full projected state snapshot. That gives immediate canonical replay and rollback checkpoints while leaving room for smaller operation-specific reducers later.

```ts
export interface ProjectOperationLogEntry {
  id: string;
  kind: ProjectOperationKind;
  actor: ProjectOperationActor;
  createdAt: string;
  summary: string;
  nodeIds: string[];
  linkKeys?: string[];
  metadata?: Record<string, string>;
  payload?: ProjectOperationPayload;
}

export interface ProjectOperationPayload {
  state?: ProjectOperationState;
}

export interface ProjectOperationState {
  nodeMetadataSchema: ProjectNodeMetadataField[];
  nodeTypeSchema: ProjectNodeTypeDefinition[];
  spatialMap: SpatialMapData;
}

export type ProjectOperationActorKind = "human" | "agent";

export interface ProjectOperationActor {
  kind: ProjectOperationActorKind;
  id?: string;
  label?: string;
}
```

Entry tree:

```text
ProjectOperationLogEntry
|-- id: random UUID, or stable migration id
|-- kind: ProjectOperationKind
|-- actor
|   |-- kind: human | agent
|   |-- id?
|   `-- label?
|-- createdAt: ISO timestamp
|-- summary: human-readable sentence
|-- nodeIds[]
|   |-- affected node id
|   `-- affected parent/source/target node id
|-- linkKeys[]?
|   `-- stable link keys from getLinkKey(...)
|-- metadata?
|   |-- imageCount
|   |-- imageId
|   `-- small string fields for display/filtering
`-- payload?
    `-- state?
        |-- nodeMetadataSchema[]
        |-- nodeTypeSchema[]
        `-- spatialMap
            |-- nodes[]
            `-- links[]
```

## Operation Kinds

`ProjectOperationKind` is a string union. The current set covers the mutation functions in [app/src/lib/projects/data.server.ts](/Users/byronwall/Projects/product-grid-mgmt/app/src/lib/projects/data.server.ts).

```text
ProjectOperationKind
|-- project.backfilled
|-- project.created
|-- nodes.generated
|-- node.context.updated
|-- node.title.updated
|-- node.status.updated
|-- node.type.updated
|-- node.metadata.updated
|-- project.schema.updated
|-- node.images.added
|-- node.image.deleted
|-- context.nodes.imported
|-- node.created
|-- node.deleted
|-- link.deleted
`-- node.moved
```

## Actor Attribution

Each operation has an `actor` so activity can distinguish normal user actions from CLI/agent actions.

```text
ProjectOperationActor
|-- kind
|   |-- human
|   `-- agent
|-- id?
`-- label?
```

Current attribution rules:

```text
normal app UI / server actions
`-- actor.kind: human

/api/v1 agent API routes
`-- actor.kind: agent
    |-- id: authenticated agent id
    `-- label: token suffix label, or Agent API for local dev

legacy backfill
`-- actor.kind: human
    `-- label: Legacy project owner
```

The CLI uses `/api/v1`, so CLI-created or CLI-updated records are attributed to `agent`. UI actions that call Solid Router server actions or app-local API routes keep the default `human` actor.

## Read Projection

All project records are parsed through [app/src/lib/projects/project-record-format.ts](/Users/byronwall/Projects/product-grid-mgmt/app/src/lib/projects/project-record-format.ts).

```text
readProjectRecordsFromDisk()
`-- parseStoredProjectRecord(raw JSON)
    |-- validate project identity fields
    |-- parse operationLog
    |   |-- missing field -> []
    |   `-- existing entries -> validated entries
    |-- parse legacy state if old disk fields exist
    |   |-- nodeMetadataSchema
    |   |-- nodeTypeSchema
    |   `-- spatialMap
    |-- ensureCanonicalOperationLog(...)
    |   |-- any payload.state exists -> keep log as canonical
    |   |-- legacy state exists -> append project.backfilled as oldest entry
    |   `-- no state exists -> default empty state
    |-- projectStateFromOperationLog(...)
    |   |-- start with default schemas + empty map
    |   |-- replay oldest to newest
    |   `-- latest payload.state becomes materialized state
    `-- return ProjectRecord
        |-- old fields populated from projection
        `-- operationLog preserved as canonical source
```

Projection tree:

```text
operationLog[]                  stored newest-first
|-- node.status.updated         newest
|   `-- payload.state
|-- node.created
|   `-- payload.state
|-- old audit-only entry
`-- project.backfilled          oldest baseline
    `-- payload.state

projectStateFromOperationLog()
|-- reverse operationLog
|-- apply project.backfilled payload.state
|-- skip audit-only entries with no state payload
|-- apply node.created payload.state
|-- apply node.status.updated payload.state
`-- derived state for ProjectRecord
```

## Write Serialization

Mutation helpers still work with materialized `ProjectRecord` values in memory. Before writing, each helper appends an operation entry with `payload.state` equal to the full post-mutation state.

```text
mutation helper
|-- readProjectRecordsFromDisk()
|   `-- materialized ProjectRecord from operationLog
|-- build next in-memory state
|   |-- nodeMetadataSchema?
|   |-- nodeTypeSchema?
|   `-- spatialMap?
|-- appendProjectOperation(nextRecord, operation)
|   |-- attach payload.state from nextRecord
|   |-- prepend operation to operationLog
|   `-- keep newest 250 entries
`-- writeProjectRecordsToDisk(records)
    `-- serializeProjectRecord(record)
        |-- write project identity fields
        |-- write operationLog
        `-- omit derived spatialMap/schema fields
```

## Back Migration

Legacy project files can still contain `spatialMap`, `nodeMetadataSchema`, and `nodeTypeSchema`. On read, those fields are normalized and captured into a stable baseline operation.

```text
legacy project.json
|-- id/name/description/timestamps
|-- nodeMetadataSchema[]
|-- nodeTypeSchema[]
|-- spatialMap
`-- operationLog[]?              old audit-only entries may exist

parseStoredProjectRecord()
`-- ensureCanonicalOperationLog()
    |-- build project.backfilled entry
    |   |-- id: legacy-backfill-<projectId>
    |   |-- kind: project.backfilled
    |   |-- actor: human
    |   |-- payload.state: normalized legacy state
    |   `-- nodeIds: all current node ids
    `-- place backfill as oldest entry
```

If a legacy project already has audit-only operation entries, those entries stay after the backfill in chronological order. Because stored order is newest-first, the backfill entry is appended at the end of the array.

## Mutation Recording Examples

Node title update:

```text
updateProjectNodeTitleOnDisk(input)
|-- locate project
|-- locate node
|-- create nextNodes with changed label
|-- appendProjectOperation(...)
|   |-- kind: node.title.updated
|   |-- actor: human or agent
|   |-- summary: Renamed "Old" to "New".
|   |-- nodeIds: [changed node id]
|   `-- payload.state: full state after rename
`-- persist operationLog-only record
```

Historical `nodes.generated` entries remain readable. The app no longer creates them through AI workflows.

Schema update:

```text
updateProjectMetadataSchemaOnDisk(input)
|-- normalize metadata schema rows
|-- normalize node type rows
|-- remap node metadata values
|-- appendProjectOperation(...)
|   |-- kind: project.schema.updated
|   |-- actor: human
|   |-- summary: Updated project metadata and node type schema.
|   `-- payload.state
|       |-- nodeMetadataSchema: new schema
|       |-- nodeTypeSchema: new schema
|       `-- spatialMap: remapped nodes
`-- persist operationLog-only record
```

## Client Projection

For now the server passes both the canonical log and the rebuilt old-format state to the client.

```text
GET /api/projects/:projectId
`-- readProjectByIdFromDisk()
    |-- operationLog -> materialized state
    `-- JSON response
        |-- nodeMetadataSchema[]   derived
        |-- nodeTypeSchema[]       derived
        |-- spatialMap             derived
        `-- operationLog[]         canonical
```

The inspector reads operation entries directly from `props.project.operationLog` in [app/src/components/spatial-map/SpatialMapInspector.tsx](/Users/byronwall/Projects/product-grid-mgmt/app/src/components/spatial-map/SpatialMapInspector.tsx).

```text
SpatialMapInspector
|-- selectedNode()
|-- selectedNodeActivity()
|   |-- selected node id exists?
|   |-- filter operationLog where entry.nodeIds includes selected id
|   `-- take newest 8
|-- recentProjectActivity()
|   `-- take newest 8
`-- Activity section
    |-- selected node? -> selectedNodeActivity
    `-- no selection? -> recentProjectActivity
```

## Relationship To Spatial Map Data

The operation log owns the canonical graph state. `spatialMap` is a projection result from the latest state payload.

```text
operationLog[0]
`-- payload.state
    |-- nodeMetadataSchema[]
    |-- nodeTypeSchema[]
    `-- spatialMap
        |-- nodes[]
        |   |-- id: page-checkout
        |   `-- label/type/status/context/metadata/images
        `-- links[]
            |-- source
            |-- target
            `-- parentChild/relationship
```

Deleting a node does not remove its historical log entries. The entry keeps the old node ID and human-readable summary even if the current projected graph no longer contains that node.

## Context Mode Removal

The op-log change landed alongside removal of active `contextMode` usage. `MapNode` no longer carries `contextMode` as part of the active app model. The parser tolerates legacy stored `contextMode` fields by ignoring them during normalization and backfill.

Before:

```text
MapNode
|-- context
|-- rawContext
`-- contextMode: context-only | structured
```

After:

```text
MapNode
|-- context
`-- rawContext
```

The app no longer provides context generation. The inspector shows `Original Context` when `rawContext` and `context` differ. This preserves source notes.

## Current Guarantees

- The operation log is canonical on disk.
- Every entry has an actor. Missing legacy actors parse as `human`.
- `/api/v1` writes are attributed to `agent`; normal app writes default to `human`.
- `spatialMap`, `nodeMetadataSchema`, and `nodeTypeSchema` are materialized from operation payloads.
- Disk serialization omits the derived state fields and stores `operationLog`.
- Legacy projects are backfilled with a stable `project.backfilled` operation.
- Current mutation entries include a full `payload.state` snapshot.
- Entries are stored newest-first.
- The log is capped at 250 entries per project to keep project files compact.
- Operation entries store affected node IDs and optional link keys for filtering and future replay tooling.
- The Activity inspector can show global recent activity or activity scoped to the selected node.

## Current Non-Goals

- The app does not yet expose fine-grained operation-specific reducers for every kind.
- Entries do not yet store inverse patches.
- Undo/redo UI is not implemented yet.
- Log entries are not yet exposed as a dedicated CLI/API collection.

## Future Extension Points

The current snapshot payload gives a safe canonical baseline. The next step is to add operation-specific payloads and inverse data so undo does not need to rely only on full-state checkpoints.

Possible next structure:

```text
ProjectOperationLogEntry
|-- id
|-- kind
|-- actor
|   |-- kind
|   |-- id
|   `-- label
|-- createdAt
|-- summary
|-- nodeIds[]
|-- linkKeys[]
|-- payload
|   |-- state?
|   |-- patch?
|   |   |-- before
|   |   `-- after
|   `-- operation-specific data
`-- inverse?
    `-- data needed for undo
```

Possible undo path:

```text
undo last operation
|-- read operationLog[0]
|-- validate operation has inverse data or previous payload.state checkpoint
|-- append new operation
|   |-- kind: operation.undone
|   |-- metadata.originalOperationId
|   `-- payload.state: restored state
`-- persist operationLog-only record
```

Possible API path:

```text
GET /api/projects/:projectId/activity
|-- read project
|-- optional nodeId filter
|-- optional kind filter
`-- return operationLog slice
```
