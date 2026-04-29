# Bumpless Optimistic Updates

Use this pattern when a UI mutation should feel immediate while server data is revalidating, and when the user must remain in the exact same local view state during that refresh.

The core idea is:

- Keep the currently rendered resource stable during revalidation.
- Apply a local optimistic snapshot through the same data path the rest of the screen already reads.
- Render the edited field from an optimistic overlay until confirmed.
- Roll back only if the server action fails.

## Problem This Solves

Form-backed server actions can cause route resources to revalidate. If a route renders the pending resource value directly, nested UI may briefly unmount or recreate with default local state.

For stateful workspaces, that causes visible bumps:

- An edited label flashes back to its old value before the server result arrives.
- A tree/detail/inspector view briefly resets to the default canvas view.
- Selection, camera, open panels, or other client-only state can churn even though the user did not change views.

The fix is not just "set local state." The rest of the workspace must see the optimistic value through the same project/data object it normally consumes, and the route must avoid dropping the last good resource while revalidating.

## Pattern

### 1. Render From `resource.latest`

When using Solid Router resources, prefer `resource.latest` for stable screens that should not show pending transitions during revalidation.

```tsx
const project = createAsync(() => getProjectById(params.projectId));
const stableProject = () => project.latest;

return (
  <Show when={stableProject()}>
    {(resolvedProject) => <ProjectDetailPage project={resolvedProject()} />}
  </Show>
);
```

Use `resource()` directly only when the UI intentionally wants loading or pending-state transitions.

### 2. Keep a Local Project Signal at the Screen Boundary

At the page or feature boundary, copy the resolved project into a local signal. Child actions can update that signal immediately without waiting for resource revalidation.

```tsx
const [project, setProject] = createSignal(untrack(() => props.project));

createEffect(() => {
  setProject(props.project);
});

return <Workspace project={project()} onProjectUpdated={setProject} />;
```

The child should call `onProjectUpdated(nextProject)` with both optimistic snapshots and confirmed server results.

### 3. Apply an Optimistic Snapshot Before Submitting

Before requesting the server action, create the next project object by immutably updating the same record the workspace already renders.

```tsx
const submitTitle = (value: string) => {
  const node = selectedNode();
  if (!node) return;

  const title = value.trim();
  if (!title || title === node.label) return;

  setOptimisticTitle({
    nodeId: node.id,
    previousTitle: node.label,
    title,
  });

  props.onProjectUpdated?.({
    ...props.project,
    updatedAt: new Date().toISOString(),
    spatialMap: {
      ...props.project.spatialMap,
      nodes: props.project.spatialMap.nodes.map((projectNode) =>
        projectNode.id === node.id ? { ...projectNode, label: title } : projectNode,
      ),
    },
  });

  if (titleInputRef) titleInputRef.value = title;
  titleFormRef?.requestSubmit();
};
```

This avoids having one component show the optimistic value while the canvas, tree, inspector, relations, or metadata chips still read the old project.

### 4. Render the Field From the Optimistic Overlay

For the field being edited, derive display text from the optimistic record while that mutation is pending.

```tsx
const selectedNodeTitle = createMemo(() => {
  const node = selectedNode();
  if (!node) return "Select an item";

  const optimistic = optimisticTitle();
  return optimistic?.nodeId === node.id ? optimistic.title : node.label;
});
```

Use that memo everywhere the field is displayed or submitted from the current UI.

```tsx
<EditInPlace
  value={selectedNodeTitle()}
  disabled={Boolean(saveTitleSubmission.pending)}
  onConfirm={submitTitle}
/>

<input ref={titleInputRef} type="hidden" name="title" value={selectedNodeTitle()} />
```

### 5. Confirm With the Server Result

When the action succeeds, replace the optimistic snapshot with the returned server record. Then clear the optimistic overlay and the submission state.

```tsx
createEffect(() => {
  const result = saveTitleSubmission.result;
  if (!result || saveTitleSubmission.pending) return;

  props.onProjectUpdated?.(result);
  setOptimisticTitle(null);
  saveTitleSubmission.clear();
});
```

The server result remains the source of truth. The optimistic snapshot only bridges the latency gap.

### 6. Roll Back on Failure

Store enough previous state to restore the old value if the action fails.

```tsx
createEffect(() => {
  const error = saveTitleSubmission.error;
  const optimistic = optimisticTitle();
  if (!error || saveTitleSubmission.pending || !optimistic) return;

  props.onProjectUpdated?.({
    ...props.project,
    spatialMap: {
      ...props.project.spatialMap,
      nodes: props.project.spatialMap.nodes.map((projectNode) =>
        projectNode.id === optimistic.nodeId
          ? { ...projectNode, label: optimistic.previousTitle }
          : projectNode,
      ),
    },
  });

  setOptimisticTitle(null);
  saveTitleSubmission.clear();
});
```

Show a user-visible error toast or inline error near the control.

## Checklist

- The route renders `resource.latest` for stable, stateful workspaces.
- The feature boundary owns a local signal for the rendered record.
- Child mutation controls receive an `onUpdated(nextRecord)` callback.
- The optimistic update is applied to the same top-level object the whole feature consumes.
- The edited field has a small optimistic overlay memo to prevent old-value flashes.
- The server success path replaces the optimistic snapshot with the canonical result.
- The error path restores the previous value and clears the submission.
- The local view state is not derived from pending server data unless that transition is intentional.

## When Not to Use This

Do not use this pattern for changes where speculative UI is misleading or dangerous, such as destructive actions without undo, permission changes, or operations where the server may substantially transform the submitted value. In those cases, prefer explicit pending UI and wait for the canonical server result.
