# Action/Form Migration Inventory

This captures the places that still need updates to match the `AGENTS.md` guidance for writes:

- UI-triggered writes should call server actions with `useAction(...)`.
- Write state should be explicit local state, such as `pending`, `error`, and optimistic values.
- Avoid native `<form method="post">` transport, hidden forms, `requestSubmit()`, and `useSubmission()` for new or touched UI.
- Prefer typed object action inputs over `FormData` where Solid Router action constraints allow it.
- Keep `FormData` only where the payload genuinely needs browser file semantics or while migrating an existing action.

## Shared Action Layer

`app/src/lib/projects/data.ts`

- Most project actions still accept `FormData` and parse fields manually.
- Actions that should move to typed object inputs:
  - `createProject`
  - `deleteProject`
  - `updateProjectNodeContext`
  - `updateProjectNodeTitle`
  - `updateProjectNodeStatus`
  - `createProjectContextNode`
  - `createProjectChildNode`
  - `updateProjectNodeMetadata`
  - `updateProjectMetadataSchema`
  - `deleteProjectNode`
  - `moveProjectNode`
- Actions that can reasonably stay `FormData` until a file-upload-specific wrapper exists:
  - `importProject`
  - `addProjectNodeImages`
- `deleteProjectNodeImage` does not need file semantics and should become a typed object action.
- `getMetadataFromFormData(...)` should be replaced with a typed metadata shape once metadata actions migrate.

`app/src/lib/router/action-url.ts`

- `normalizeActionUrl(...)` exists only for legacy form-backed actions.
- Delete this helper after all UI call sites stop rendering action URLs.

`app/src/lib/projects/optimistic.ts`

- `createProjectNodeFormData(...)` should be reviewed during action migration.
- If it only supports action invocation, replace it with a typed input builder.

## Project Index Flows

`app/src/routes/index.tsx`

- Uses `useSubmission(createProject)` and passes `normalizeActionUrl(createProject.url)` into the page component.
- Replace with a named `useAction(createProject)` handler and local pending/error state.

`app/src/components/projects/ProjectIndexPage.tsx`

- Renders `<form action={props.createProjectActionUrl} method="post">` for create project.
- Replace props like `createProjectActionUrl`/`createProjectSubmission` with an explicit callback prop, or keep the action locally in this component.
- Submit should build a typed `{ name?: string }` input and call the action directly.

`app/src/components/projects/ProjectDeleteControl.tsx`

- Uses `useSubmission(deleteProject)`, `normalizeActionUrl(deleteProject.url)`, and a form in the dialog.
- Replace the form submit button with a `type="button"` handler that calls `useAction(deleteProject)({ projectId })`.
- Keep dialog open/close, pending, and error state explicit.

`app/src/components/projects/ProjectImportControl.tsx`

- Uses a native multipart form and `useSubmission(importProject)`.
- This is a file upload path, so `FormData` can remain for now.
- Still update the UI transport to `useAction(importProject)` with explicit pending/error state, building `FormData` in TypeScript from the selected file instead of relying on native form submission.

## Spatial Map Dialogs And Inspector

`app/src/components/spatial-map/ProjectMetadataSettingsDialog.tsx`

- Uses `useSubmission(updateProjectMetadataSchema)` and a post form.
- Migrate to `useAction(updateProjectMetadataSchema)` with a typed object containing project details, metadata fields, and node types.
- Keep the existing controlled row signals as the source of truth instead of serializing repeated form fields.

`app/src/components/spatial-map/SpatialMapCreateContextNodeDialog.tsx`

- Uses `useSubmission(createProjectContextNode)`, `normalizeActionUrl`, and a post form.
- Migrate to `useAction(createProjectContextNode)` with a typed input:
  - `projectId`
  - `label`
  - `context`
  - `metadata`
  - `splitByHeadingLevel`
  - `maxHeadingDepth`
- Preserve the success flow that selects the created node and opens the inspector.

`app/src/components/spatial-map/SpatialMapInspector.tsx`

- Uses `useSubmission(updateProjectNodeContext)` and `useSubmission(updateProjectNodeMetadata)`.
- Renders separate forms for context and metadata saves.
- Migrate both save buttons to explicit handlers:
  - context save should call `useAction(updateProjectNodeContext)` with `{ projectId, nodeId, context }`.
  - metadata save should call `useAction(updateProjectNodeMetadata)` with `{ projectId, nodeId, metadata }`.
- Existing `titlePending`, `statusPending`, and `typePending` are already closer to the preferred local-state style and should be the model for these saves.

## Spatial Map Canvas Flows

`app/src/components/spatial-map/SpatialMapScene.tsx`

- `moveProjectNode` still uses `useSubmission`, a hidden form, mutable refs, and `requestSubmit()`.
- Replace the hidden form with `useAction(moveProjectNode)` and call it directly from `moveSelectedNode(parentNodeId)`.
- Preserve the optimistic call to `moveProjectNodeOptimistically(...)`, but add explicit error rollback if the direct action call fails.
- `ChildNodePlaceholder` uses `useSubmission(createProjectChildNode)`, a post form, and `formRef?.requestSubmit()` for Enter key handling.
- Replace with a direct submit handler that calls `useAction(createProjectChildNode)` with `{ projectId, parentNodeId, title }`.
- Keep the keyboard behavior, but have Enter call the same TypeScript handler instead of submitting a form.

`app/src/components/spatial-map/SpatialMapDeleteNodeControl.tsx`

- Already uses `useAction(deleteProjectNode)` and explicit local pending state.
- Still builds `FormData` because the action contract is FormData.
- Once `deleteProjectNode` accepts a typed object, change the call to `submitDeleteNode({ projectId, nodeId })`.

## Spatial Map Images

`app/src/components/spatial-map/SpatialMapImages.tsx`

- Uses two `useSubmission(...)` instances, hidden upload/delete forms, mutable hidden inputs, and `requestSubmit()`.
- Upload can continue to use `FormData` because it carries `File` values, but the hidden form should be removed.
- `uploadImages(...)` should build `FormData` in TypeScript and call `useAction(addProjectNodeImages)` directly.
- Image delete does not need `FormData`; migrate `deleteProjectNodeImage` to a typed input and call it through `useAction(deleteProjectNodeImage)`.
- Keep `pendingDeleteImageId` as the explicit local pending indicator.

## Source Decomposition Flow

`app/src/components/spatial-map/source-decomposition-flow/useSourceDecompositionFlow.ts`

- Builds `FormData` for `startSourceDecompositionRunRequest(...)`.
- This is not a Solid Router action and includes image files, so it is not part of the form-backed action migration.
- Leave it alone unless the request API changes.

`app/src/components/spatial-map/source-decomposition-flow/sourceDecomposition.api.ts`

- Accepts `FormData` for image-bearing source decomposition requests.
- Leave it as-is for now.

## Suggested Migration Order

1. Convert non-file project actions in `app/src/lib/projects/data.ts` to typed object inputs.
2. Update simple project index flows: create and delete project.
3. Update inspector/context/metadata flows where controlled signals already hold the desired payload.
4. Update canvas flows that currently depend on hidden forms and `requestSubmit()`.
5. Update image delete to typed input; keep image upload/import as explicit TypeScript-built `FormData`.
6. Remove `normalizeActionUrl(...)` once no UI imports it.
