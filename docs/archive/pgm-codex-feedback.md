# pgm CLI feedback from Codex runs

<!-- Archived from prod-mgmt project-mgmt-grid node `page-guidance-from-codex` on 2026-09-29 before feature-info cleanup. -->

## Guidance from codex

The biggest token spend came from two places: the skill doc load and broad code search output. The actual `pgm` context pull was efficient.

**What Worked**
`pgm node view ... --with-context --json` was the right shape. It returned only the target node, ancestors, inherited context flags, and image metadata. That gave enough product intent without dumping the graph.

The URL gave exact IDs, so the workflow avoided discovery searches. That is ideal.

**Main Waste**
The `product-grid-context` skill is too long for this common path. I spent about 2k tokens just reading instructions, most of which were examples for creating/importing/updating nodes that were irrelevant to resolving one issue.

The broad `rg` for `"search"` returned a lot of unrelated hits. That was my codebase exploration cost, not directly CLI/skill cost, but the skill could steer this better if it maps product node types/areas to likely source paths.

**Improve The Skill**
Add a short “URL Issue Resolution” fast path at the top:

```md
If the user provides a Product Grid URL with project=... and node=...:
1. Run `pgm node view <node-id> --project <project-id> --with-context --json`
2. If context is sufficient, inspect code.
3. After implementation, run `pgm node update <node-id> --project <project-id> --status implemented --json`
```

Move create/import/image/export examples lower or into separate reference docs. The top 60 lines should cover 80% of actual usage.

Add “do not read the whole skill if this fast path applies” style guidance. Skills are instructions, so front-loading the shortest decision tree matters.

**Improve The CLI**
Add a purpose-built command:

```bash
pgm task resolve-context <project-id-or-url> --json
```

or even:

```bash
pgm issue view <url> --json
```

Return:
- projectId
- nodeId
- titlePath
- node status/type/title
- direct/inherited context
- image URLs
- suggested status update command
- maybe `implementationHints.sourcePaths` if metadata exists

That would eliminate URL parsing assumptions and reduce the first three CLI calls to one.

Add a compact mode:

```bash
pgm node view <id> --with-context --compact --json
```

For coding tasks, omit repeated `label/title`, raw empty fields, and verbose image metadata unless requested. Current JSON is fine, but it could be half the size.

**Useful Metadata To Add**
If Product Grid nodes can store implementation hints, add optional metadata like:

```json
{
  "sourcePaths": ["app/src/components/spatial-map/SpatialMapCommandMenu.tsx"],
  "keywords": ["Cmd+K", "global search", "command menu"]
}
```

Then the CLI can surface those hints. This would have cut the broad `rg` phase significantly.

**Trim The Workflow**
For this type of task, the ideal flow is:

```bash
pgm issue view '<url>' --json
rg -n '<hinted keywords>' <hinted paths>
# edit
pnpm type-check
pgm issue close '<url>' --status implemented --json
```

The current setup is close. The biggest win is making the skill less tutorial-like at the top and giving the CLI a URL-native, compact “issue context” command.

---

<!-- Archived from prod-mgmt project-mgmt-grid node `page-additional-feedback-from-codex` on 2026-09-29 before feature-info cleanup. -->

## Additional feedback from codex

# Product Grid Tooling Improvement Summary

### Purpose

This document summarizes how the `pgm` CLI and the `product-grid-context` skill can be improved to produce better implementation results, reduce turnaround time, and consume fewer model tokens.

The recommendations are based on a real implementation run against:

- Project: `modeler-new-inspectors`
- Root node: `page-05-07-jeremy-feedback`
- Artifacts captured in `tmp/20260507-pgm-page-jeremy-feedback`

The key observation from that run is that the tool chain is already useful, but it still forces the agent to do too much orchestration itself:

- recover from project-selection mismatch
- discover that the root node is empty
- manually expand into children and subtree data
- manually normalize image references into downloadable assets
- manually summarize verbose JSON into an agent-usable implementation brief

Those extra steps cost time, tokens, and attention. The best improvements are the ones that move those steps into the tool itself or into a thinner, more opinionated skill.

### What Went Wrong In Practice

### 1. URL fast path was not reliable enough by itself

The skill correctly recommends:

```bash
pgm issue view '<product-grid-url>' --json
```

But in practice the first attempt failed until the project was explicitly supplied because the CLI was linked to a different project. That means the "fast path" was only conditionally fast.

Impact:

- extra auth/current-project inspection
- extra retries
- more shell chatter before useful context appeared
- more tokens spent narrating and recovering from the mismatch

Root issue:

- the URL already contained the target project
- the CLI still depended on ambient linked-project state

### 2. The root issue node resolved correctly but contained no usable implementation brief

The saved `issue-view.json` and `node-view-full.json` both show the root node as effectively empty:

- no direct context
- no inherited context
- no images
- `missingContext: true`

This is not inherently wrong because the real requirements were in child pages. But the output still left the agent responsible for deciding what to do next.

Impact:

- the agent had to infer that the actual work lived in descendants
- the agent had to query `children` and then `subtree`
- the agent had to build its own hierarchy summary before coding

Root issue:

- the tool answered the literal request, but not the practical implementation question: "where is the actual work under this node?"

### 3. Images were visible in JSON, but not directly usable

The subtree JSON included image metadata and API-relative `src` paths, but the agent still had to:

- extract unique images
- construct fully qualified URLs
- write a download script
- save a manifest
- fetch the images separately with `curl`

Impact:

- several extra tool calls and shell steps
- temporary scripts and manifests that should not have been necessary
- more tokens to coordinate asset handling than to interpret the design

Root issue:

- the CLI exposes image references, but does not provide a convenient "materialize these assets locally" workflow for agents

### 4. The JSON was structurally rich but semantically under-compressed

The subtree response was correct, but still too raw for direct coding work. The agent had to produce its own reduced summaries like:

- node title hierarchy
- leaf requirements
- direct vs inherited image ownership
- which nodes were actionable vs informational

Impact:

- token burn converting data into an execution brief
- more reasoning steps before first edit
- more chances for the agent to miss an important child node or inherit the wrong context

Root issue:

- the tool gives high-fidelity structure
- the skill does not provide a compact transformation layer tuned for implementation

### 5. The skill is accurate, but not opinionated enough for agent runtime efficiency

The current skill is a strong command catalog. It teaches the agent what exists. But it still reads like a general-purpose operator manual, not a latency-optimized execution playbook.

Impact:

- the agent still has to choose among many valid paths
- the agent often performs extra confirmation steps because the skill favors completeness over the fewest commands that preserve correctness
- repeated token cost across runs because the decision logic lives in the model, not the tool

Root issue:

- the skill optimizes for capability discovery
- implementation runs need stronger defaults and fewer branch points

### Highest-Leverage CLI Improvements

### 1. Make URL resolution fully self-contained

### Recommendation

When a Product Grid URL includes a project slug and node id, `pgm issue view` should ignore linked-project state unless the user explicitly overrides it.

Desired behavior:

- parse project from URL
- parse node from URL
- resolve against that project directly
- only fall back to linked project when the URL is incomplete

### Why this matters

This removes an entire recovery sequence:

- `pgm auth status --json`
- `pgm project current --json`
- retry with `--project ...`

That is one of the cleanest wins for both speed and token usage.

### Suggested CLI contract

`pgm issue view '<url>' --json` should return:

- resolved server
- resolved project id
- resolved node id
- whether linked project was ignored
- a warning only if resolution was ambiguous

### 2. Add an implementation-oriented issue export mode

### Recommendation

Add something like:

```bash
pgm issue view '<url>' --mode implementation --json
```

or:

```bash
pgm issue export-implementation '<url>' --json
```

### What it should do

- resolve the root node
- detect whether it has direct context
- if empty, walk children or subtree just enough to find actionable descendants
- compress the result into an implementation packet

### Proposed output shape

- `root`
- `actionableNodes`
- `requirements`
- `designReferences`
- `images`
- `missingInformation`
- `suggestedNextCommand`

### Why this matters

This would have replaced several manual steps in the run and would likely have saved the majority of Product Grid-related tokens.

### 3. Add a first-class context summary endpoint

### Recommendation

Add a summarized form of node context that is intentionally built for LLM consumption.

Possible command:

```bash
pgm node summarize <node-id> --project <project-id> --for implementation --json
```

### What it should summarize

- direct context
- inherited context
- children that contain actual instructions
- image captions / image ownership
- contradictions or ambiguity
- concrete requested changes

### Why this matters

Right now the tool returns enough information for a human or a very patient agent. What is missing is a compressed semantic layer.

This is the single biggest token-reduction opportunity after URL self-resolution.

### 4. Add image materialization commands

### Recommendation

Add a built-in way to download the image set for a node or subtree.

Possible commands:

```bash
pgm image export <node-id> --project <project-id> --output ./tmp/images
pgm issue export-assets '<url>' --output ./tmp/assets --json
```

### What it should do

- fetch all direct images or subtree images
- dedupe by image id
- preserve source-node provenance in filenames or a manifest
- return local paths in JSON

### Why this matters

The manual download script created during the run is exactly the kind of work the CLI should absorb.

### 5. Add subtree scope controls that reflect how agents actually work

### Recommendation

The current commands are low-level and flexible. Add higher-level traversal modes tailored to implementation.

Examples:

```bash
pgm node view <node-id> --implementation-scope descendants-with-context --json
pgm node view <node-id> --implementation-scope first-actionable-layer --json
pgm node view <node-id> --implementation-scope descendants-with-images --json
```

### Why this matters

The current flow requires the agent to discover whether it needs:

- root only
- children
- subtree
- with-context
- with-ancestors

That decision is expensive in tokens and often predictable.

### 6. Return more compact machine-friendly fields by default

### Recommendation

Provide a `--llm-compact` mode that omits redundant mirrors of the same information.

Current responses often include overlapping fields such as:

- `label` and `title`
- both `node` and duplicated final `path` entry
- repeated image metadata in both direct and inherited arrays

### Why this matters

For LLM usage, token efficiency matters more than display completeness. A compact mode should prioritize:

- normalized ids
- one canonical title
- one canonical context block list
- one canonical image list with provenance

### 7. Emit explicit implementation ambiguity flags

### Recommendation

Add fields that tell the agent exactly what kind of follow-up is needed.

Examples:

- `rootNodeEmptyButChildrenActionable`
- `containsDesignOnlyNodes`
- `containsMultipleIndependentRequests`
- `imagesPresentWithoutContext`
- `contextPresentWithoutImages`

### Why this matters

This removes the need for the model to infer operational meaning from raw shape.

### Highest-Leverage Skill Improvements

### 1. Split the skill into "operator reference" and "execution playbook"

### Recommendation

Keep the current skill as the comprehensive reference, but add a second shorter skill or section dedicated to implementation runs.

The implementation playbook should be brief, prescriptive, and optimized for the first 3 commands only.

### Example structure

1. Resolve URL directly.
2. If root has `missingContext`, inspect one descendant layer.
3. If descendants have images, export them immediately.
4. Build a compact local brief before touching code.

### Why this matters

The current skill is good documentation. It is not yet the shortest reliable runtime guide.

### 2. Encode fallback logic more explicitly

### Recommendation

The skill should tell the agent exactly what to do when the fast path returns an empty root node.

Proposed addition:

"If `pgm issue view` returns `missingContext: true` and the root node has no images, immediately inspect one layer of children with `--with-context`. If any child has images or direct context, stop broadening and summarize only that actionable subset."

### Why this matters

This would have reduced the amount of exploratory reasoning and kept the agent local sooner.

### 3. Prefer artifact-oriented workflows over command-oriented workflows

### Recommendation

The skill should not only list commands. It should describe the artifact set the agent should produce from them.

Example:

For implementation work from a Product Grid URL, create:

- `issue-view.json`
- `actionable-subtree.json`
- `implementation-brief.md`
- `images/`

### Why this matters

Agents perform better when the desired intermediate outputs are explicit. It improves reproducibility and lowers repeated token use.

### 4. Add guidance for compact summarization before coding

### Recommendation

The skill should instruct the agent to reduce grid data into three things only:

- requested UI/behavior changes
- supporting screenshots
- unresolved ambiguities

It should explicitly say not to carry large raw JSON forward once the summary exists.

### Why this matters

This is a direct token optimization. The agent should transform high-volume JSON into a very small working set and then stop referring to the raw payload except when validating uncertainty.

### 5. Teach the skill how to detect multi-request nodes

### Recommendation

The skill should include a rule like:

"When a parent page contains multiple child pages that each describe different UI changes, treat the parent as a request bundle. Produce a numbered implementation list before reading code."

### Why this matters

In this run, the parent node was effectively a bundle of several UI refinements. Explicitly recognizing that pattern would improve planning quality and reduce repeated subtree inspection.

### 6. Add token-budget heuristics to the skill

### Recommendation

The skill should make token-saving behavior explicit.

Suggested heuristics:

- never hold full subtree JSON in working context after summarization
- never inspect both `children` and `subtree` unless the child layer is ambiguous
- never fetch broad project markdown unless implementation is clearly cross-cutting
- dedupe images before downloading or viewing them
- stop traversing once concrete requests and screenshots are recovered

### Why this matters

These are not just convenience tips. They materially change total run cost.

### Workflow Improvements Across CLI + Skill

### 1. Create a single "implementation handoff" command

### Recommendation

The best long-term improvement is a single command that combines resolution, summarization, and asset export.

Example:

```bash
pgm issue handoff '<url>' --output ./tmp/pgm-handoff --json
```

### Expected output

- `handoff.json`
- `implementation-brief.md`
- `images/`
- `manifest.tsv`

### Why this matters

This collapses what was currently a multi-step orchestration problem into one deterministic entrypoint.

### 2. Add server-side screenshot captions or OCR summaries

### Recommendation

When images exist, provide optional generated captions or extracted visible text.

Example fields:

- `caption`
- `visibleText`
- `suggestedUse: reference | proof | comparison`

### Why this matters

This would reduce the need for a second multimodal pass just to understand what each screenshot is trying to communicate.

### 3. Add a distinction between request nodes and reference nodes

### Recommendation

Support metadata or inferred classification such as:

- `request`
- `reference-design`
- `background-context`
- `decision-log`

### Why this matters

Agents currently infer this from titles. That is fragile. The system should make it explicit.

### 4. Return implementation-ready markdown directly

### Recommendation

The tool should be able to emit a short markdown brief that is already organized for coding.

Suggested sections:

- Goal
- Requested changes
- Visual references
- Constraints
- Missing context

### Why this matters

Markdown is often a better medium than raw JSON for the next stage of an implementation run.

### Prioritized Improvement List

### Tier 1: Biggest wins

1. Make `pgm issue view '<url>'` self-resolve project and node without relying on linked state.
2. Add an implementation-oriented summarized export for issue URLs.
3. Add first-class image export/materialization.
4. Add a compact LLM-oriented response mode that removes redundant fields.

### Tier 2: Strong runtime improvements

1. Add subtree traversal modes like `first-actionable-layer` and `descendants-with-context`.
2. Split the skill into a short execution playbook plus a longer reference guide.
3. Add token-budget heuristics directly into the skill.
4. Add multi-request bundle detection guidance.

### Tier 3: Quality-of-life and future leverage

1. Add screenshot captions / OCR summaries.
2. Add request-vs-reference node classification.
3. Add a single `issue handoff` command that produces implementation artifacts in one shot.

### Concrete "Better, Faster, Fewer Tokens" Mapping

### Better results

These changes improve output quality by:

- reducing missed descendant requirements
- making screenshot relevance clearer
- reducing ambiguity about which node actually owns the request
- giving the agent a compressed implementation brief rather than forcing it to synthesize one from raw structure

### Faster runs

These changes improve speed by:

- eliminating project mismatch recovery
- collapsing repeated discovery calls into a single summarized handoff
- avoiding manual image download scripts
- reducing browser work needed just to understand design references

### Fewer tokens

These changes reduce token usage by:

- removing redundant JSON fields
- replacing broad JSON with compact semantic summaries
- encoding fallback rules in the skill instead of making the model improvise them
- encouraging early conversion from raw context to a small implementation brief

### Recommended Next Step

If only one improvement is implemented first, it should be this:

`pgm issue handoff '<url>' --output ./tmp/handoff --json`

That single feature would remove most of the ad hoc orchestration the agent had to perform in this run, and would likely deliver the largest combined gain in correctness, speed, and token efficiency.
