---
id: task-pgm-cli-bug-report-metadata-persistence-and-stdout-edge-cases
label: "pgm CLI bug report: metadata persistence and stdout edge cases"
type: task
status: implemented
archived: true
metadata:
  implementation: "Triage 2026-09-29: verified fixed in code — Linked project resolved for all commands (config.resolveProjectId); unknown metadata keys now fail with 400 invalid_metadata_key instead of silently dropping; stdout writer ignores EPIPE (tested)."
  purpose: Bug report for pgm CLI v0.1.3 — metadata set silently no-ops on subsequent keys, project link not honored, EPIPE on piped JSON output.
---
# pgm CLI bug report — metadata persistence and stdout edge cases

Encountered while tagging MVP candidate features in the `image-annotation-app` project using `@byronwallrus/product-grid-cli` v0.1.3.

## Environment

- CLI: `@byronwallrus/product-grid-cli` v0.1.3 (installed via `npm install -g`)
- Node: v24.10.0
- Server: https://prod-mgmt.apps.byroni.us
- Shell: zsh on macOS (Darwin 25.2.0)

## Issue 1 — `node metadata set` silently no-ops without `--project` despite a linked project

**Repro:**

```
pgm project link image-annotation-app
pgm node metadata set note-fast-capture-mvp mvp yes
# CLI prints: "Updated metadata for Fast capture (MVP) (note-fast-capture-mvp)."
pgm node view note-fast-capture-mvp --project image-annotation-app --json
# metadata is empty {}
```

**Expected:** Linked project should be used (it is for `node list`, `node view`, `node import-markdown`).

**Actual:** Write is silently dropped. CLI claims success.

**Workaround:** Always pass `--project <id>` explicitly on `node metadata set`.

## Issue 2 — Subsequent `node metadata set` calls on the same node do not persist new keys

After the first 1–2 keys are added, additional `metadata set` calls on the same node report success but the new key never appears in `node view`.

**Repro:**

```
pgm node metadata set note-fast-capture-mvp purpose "MVP core feature" --project image-annotation-app --json
# response metadata: {purpose: "MVP core feature"}  ✅

pgm node metadata set note-fast-capture-mvp mvp yes --project image-annotation-app --json
# response metadata: {purpose, mvp: "yes"}  ✅

pgm node metadata set note-fast-capture-mvp mvp_tier core --project image-annotation-app --json
# response metadata: {purpose, mvp}  ❌  (mvp_tier missing)
# CLI prints: "Updated metadata for Fast capture (MVP)..."

pgm node view note-fast-capture-mvp --project image-annotation-app --json
# metadata: {purpose, mvp}  — mvp_tier never persisted
```

Reproduced with multiple key names (`mvp_tier`, `tier`, `priority`) and across multiple nodes (`note-fast-capture-mvp`, `note-best-in-class-annotation-mvp`). The third-and-later set call always silently no-ops.

**Impact:** Cannot tag nodes with multiple metadata keys via the CLI. Only the first one or two keys ever stick.

**Suspected cause:** Server replacing rather than merging, or write being deduplicated/rate-limited; the CLI cannot tell the difference because it reports success either way.

## Issue 3 — `metadata set` response returns pre-write state, not post-write state

The `--json` output of `node metadata set` returns the node's metadata *before* the update is applied. Combined with Issue 2, this means callers cannot tell from the response whether their write actually landed — the response looks identical whether the write succeeded or was dropped.

**Suggestion:** Return the post-write state, or surface a `wrote: true|false` field.

## Issue 4 — `node list --json | python3 -c ...` triggers EPIPE

```
pgm node list --project image-annotation-app --json | python3 -c "import json,sys; json.load(sys.stdin)"
```

Sometimes fails with:

```
Error: write EPIPE
    at writeJson (.../src/output.mjs:2:10)
    at dispatchNode (.../src/main.mjs:256:7)
```

The CLI's stdout writer crashes if the consumer closes the pipe early. Workaround: redirect to a file first (`pgm node list --json > /tmp/x.json`).

**Suggestion:** Catch EPIPE in `writeJson` and exit cleanly.

## Issue 5 — Help text does not document `--project` is required for some mutations

The help shows `--project` only as a global option ("defaults to linked project"). Issue 1 above shows that for `metadata set` the linked-project default is not honored. Either fix the default-resolution path or document that `metadata set` needs `--project` explicitly.

## What I was trying to do

Tag ~30 nodes in `image-annotation-app` with two metadata keys each (`mvp: yes`, `mvp_tier: core|candidate`) to mark MVP feature candidates from a market scan. The first key on each node persisted; the second did not, so the tagging exercise is incomplete.

## Asks

1. Fix metadata merge so successive `set` calls persist all keys.
2. Make `set --json` return the post-write metadata.
3. Honor the linked project for `metadata set` (or document that it doesn't).
4. Catch EPIPE in the JSON output writer.

