---
id: feature-grid-view-has-layout-shift-when-selecting-all
label: Grid view has layout shift when selecting all
type: feature
status: implemented
archived: true
metadata:
  implementation: "Reconciled 2026-10-05: Grid bulk actions replace the count summary in the existing header instead of adding a row. The header stays above sticky cells, and Set status is a menu. Commits b8d12980 and 51999459, plus PR #14, are merged."
images:
  - id: e9ccd9d7-7d73-4d48-830d-7af4a26a0d9c
    src: /api/projects/project-mgmt-grid/images/feature-grid-view-has-layout-shift-when-selecting-all/e9ccd9d7-7d73-4d48-830d-7af4a26a0d9c.png
    filename: e9ccd9d7-7d73-4d48-830d-7af4a26a0d9c.png
    originalName: image.png
    mimeType: image/png
    size: 580101
    createdAt: 2026-10-01T02:18:53.158Z
rawContext: Really need a nice clean set of buttons that appear without a layout shfit.  Find a way.
---
Really need a nice clean set of buttons that appear without a layout shfit. Find a way.

## Review

PR: https://github.com/byronwall/prod-mgmt-grid/pull/14

Validation: Type-check and browser selection checks pass. Lint is blocked because `@eslint/js` is missing from app dependencies.

