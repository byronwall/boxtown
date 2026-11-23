# CLI Hierarchical Task Context

## Purpose

Boxtown is most useful when it captures needs hierarchically: broad product intent, shared constraints, design references, and implementation notes live on parent nodes, while leaf nodes describe specific work. The CLI should preserve that model when an agent asks for tasks.

The current `boxtown task list --json` output is too flat for this workflow. It returns useful task summaries, but most leaf nodes look empty because their meaningful context is often expected to come from parents. Agents need a task view that shows the full path from root to leaf and makes inherited parent context explicit.

## Problem

During production task inspection for `project-mgmt-grid`, most actionable leaf tasks had:

- A clear title.
- A task or feature type.
- A `planned` status.
- Empty `metadata`.
- Empty `context`.
- Empty `rawContext`.
- No images.

That does not mean the tasks are useless. It means the CLI is showing each leaf in isolation. If a parent node says "Canvas viewer", "Quickly create new nodes", or "Agentic data flows", the child task depends on that parent meaning. Without the ancestor chain, the agent has to infer too much from a short title.

## Design Goal

The CLI should answer:

> What does this task mean in the full product hierarchy, and what context does it inherit from every parent?

For any task-like node, the output should include:

- The root-to-leaf tree path.
- Each ancestor node's title, type, status, metadata, context, raw context, context mode, and images.
- The leaf node's own fields.
- A merged inherited-context projection that an LLM can use directly.
- Clear provenance so agents can tell which requirement came from which node.

## Proposed Commands

Add task-focused commands:

```bash
boxtown task view <node-id> --with-ancestors --json
boxtown task list --with-ancestors --json
boxtown task list --with-context --json
boxtown task export-context <node-id> --output ./task-context.md
boxtown task export-context --status planned --output ./planned-task-context.md
```

Add node equivalents for non-task workflows:

```bash
boxtown node view <node-id> --with-ancestors --json
boxtown node export-context <node-id> --output ./node-context.md
```

`--with-ancestors` should return structured JSON. `--with-context` should include the inherited projection. `export-context` should produce markdown optimized for agent handoff.

## JSON Shape

For a single task:

```json
{
  "task": {
    "id": "page-show-context-existence-preview",
    "title": "Show context existence + preview",
    "type": "task",
    "status": "planned",
    "parentNodeId": "page-canvas-viewer"
  },
  "path": [
    {
      "id": "page-canvas-viewer",
      "title": "Canvas viewer",
      "type": "page",
      "status": "planned",
      "metadata": {},
      "context": "",
      "rawContext": "",
      "contextMode": "structured",
      "images": []
    },
    {
      "id": "page-show-context-existence-preview",
      "title": "Show context existence + preview",
      "type": "task",
      "status": "planned",
      "metadata": {},
      "context": "",
      "rawContext": "",
      "contextMode": "structured",
      "images": []
    }
  ],
  "inheritedContext": {
    "titlePath": "Canvas viewer > Show context existence + preview",
    "metadata": [],
    "contextBlocks": [],
    "rawContextBlocks": [],
    "images": [],
    "missingContext": true
  }
}
```

For `task list --with-context`, return an array of these task-context objects rather than flat summaries.

## Inheritance Rules

Context inheritance should be explicit and provenance-preserving, not silently merged into one blob.

Recommended rules:

- Traverse parent-child links from project roots to the requested leaf.
- Include every node in the path, including roots with no parent.
- Preserve path order from broadest to most specific.
- Do not overwrite child metadata with parent metadata.
- Represent metadata as ordered blocks with `sourceNodeId`, `sourceTitle`, `key`, and `value`.
- Represent context and raw context as ordered blocks with source IDs.
- Include images from ancestors and leaf nodes with source IDs.
- Mark whether the leaf has direct context versus only inherited context.
- Mark whether the full path has no usable context.

This keeps common requirements available to children while avoiding ambiguity about where a requirement came from.

## Markdown Export Shape

`boxtown task export-context <node-id>` should produce a compact file like:

```markdown
# Task Context: Show context existence + preview

Path: Canvas viewer > Show context existence + preview
Status: planned
Type: task

## Ancestor Requirements

### Canvas viewer

Type: page
Status: planned

Metadata: none
Context: none
Images: none

## Leaf Task

### Show context existence + preview

Metadata: none
Context: none
Images: none

## Implementation Notes For Agent

- This task has no direct context.
- Use ancestor context from `Canvas viewer`.
- If ancestor context is also empty, inspect nearby siblings or ask for clarification before implementing broad behavior.
```

For multiple tasks, group by root and parent path:

```markdown
# Planned Task Context

## Canvas viewer

Shared context for all children...

### Show context existence + preview
### Initial view is sometimes askew
### Prevent text selection with double click

## Agentic data flows

Shared context for all children...
```

This format reinforces that parent context is common material and child nodes are concrete work items.

## Task List Modes

Keep the existing flat list for quick scans:

```bash
boxtown task list --json
```

Add richer modes:

```bash
boxtown task list --tree --json
boxtown task list --with-ancestors --json
boxtown task list --with-context --json
boxtown task list --group-by-parent
```

Suggested behavior:

- `--tree`: nested hierarchy with children under parents.
- `--with-ancestors`: flat task rows plus root-to-leaf `path`.
- `--with-context`: flat task-context objects with inherited metadata/context blocks.
- `--group-by-parent`: human-readable grouped output for terminal review.

## API Support

The current task endpoint is:

```text
GET /api/v1/projects/:projectId/tasks
```

It should accept query parameters:

```text
?status=planned
?include=ancestors
?include=context
?shape=tree
```

Possible endpoints:

```text
GET /api/v1/projects/:projectId/tasks/:nodeId
GET /api/v1/projects/:projectId/tasks/:nodeId/context
GET /api/v1/projects/:projectId/nodes/:nodeId/context-tree
```

The server should build this projection. The CLI should not reconstruct inheritance by making many `node view` calls unless it is acting as a temporary compatibility layer.

## Agent Workflow

A useful agent loop becomes:

```bash
boxtown task next --with-context --json
boxtown task start <node-id> --json
boxtown task export-context <node-id> --output ./tmp/task-context.md
```

Then the agent can implement with the full inherited requirements in hand, and update the grid afterward:

```bash
boxtown node context set <node-id> --file ./implementation-notes.md --json
boxtown task review <node-id> --json
```

## Why This Matters

The Boxtown hierarchy is not just navigation. It is the requirements model. Parent nodes define shared intent, constraints, and references. Child nodes define scoped work. If CLI task output only shows leaves, the tool encourages agents to treat every task as isolated and underspecified.

The better contract is:

- Parents carry common product meaning.
- Children inherit that meaning.
- CLI output makes inheritance visible and machine-readable.
- Markdown export turns that hierarchy into an LLM-ready task brief.

This makes sparse leaf tasks acceptable because their parent chain supplies the missing context.

## Implementation Notes

Initial implementation can reuse existing project data:

1. Load the full project.
2. Build a `nodeById` map.
3. Build a `parentByChildId` map from `spatialMap.links` where `parentChild === true`.
4. For each task-like node, walk parents until a root is reached.
5. Reverse the collected path so it is root-to-leaf.
6. Build inherited metadata/context/image blocks from that ordered path.
7. Return either flat enriched rows or a nested tree shape.

Guardrails:

- Detect cycles and return a projection warning instead of looping.
- Include missing parent IDs as warnings.
- Keep output stable and deterministic by preserving project node order or sorting by path title.
- Add `--depth` only for node exports; task inheritance should include the full ancestor path by default.
- Avoid hiding empty context. Empty fields are useful because they show where detail still needs to be added.

## Open Questions

- Should `task list` include only nodes with type `task`, or continue to include all planned work-like nodes?
- Should inherited metadata support schema-level defaults, or only values explicitly stored on nodes?
- Should images from parent nodes automatically count as inherited task references?
- Should markdown exports include sibling nodes under the same parent for extra framing?
- Should `task next` prefer leaves with the richest inherited context?
