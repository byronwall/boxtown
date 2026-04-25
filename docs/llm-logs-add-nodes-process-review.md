# LLM Logs Add-Nodes Process Review

## Scope

Reviewed the recent `llm_logs/add-nodes` runs:

- `add-nodes-1fcf13ce-0ec5-4375-81c8-5bdad14b1086.json`: question generation only, left `running`.
- `add-nodes-c68780bf-35e4-4ad4-ade2-96bf5ffa7cd2.json`: completed broad "common features" request.
- `add-nodes-3e297902-9c95-4baa-8b1e-79f3e47a1801.json`: completed editing-feature detail request.
- `add-nodes-f0309076-7345-4d98-87c3-58d1c7979dcf.json`: completed selected inline-editing expansion.

The completed process is:

1. Capture graph context.
2. Generate 3-4 clarifying questions with fixed options.
3. Wait for answers.
4. Generate 5-10 candidate nodes and links.
5. Persist graph changes.
6. Generate four follow-up suggestions.

## Executive Assessment

The process produces coherent graph additions, but it is not yet a "10" experience. It is most effective when the user asks for broad brainstorming and accepts a guided workflow. It is weaker when the user has already stated the target clearly and expects the system to just perform the expansion.

For the three completed runs, the produced output is probably usable, but not reliably what the user wanted at first pass:

- Broad common-feature request: likely match, about **7/10**.
- Detailed editing-feature request: partial match, about **6/10**.
- Selected inline-editing expansion: better local match, about **7/10**.
- Overall likelihood that the output is what the user wanted: **6.5/10**.

The biggest gap is that the pipeline optimizes for valid structured output, not for intent satisfaction. It asks generic clarification questions, accepts answers that can reduce the user's requested detail, then persists without an explicit critique, coverage check, or preview/repair loop.

## Dimension Scores

| Dimension | Score | Notes |
| --- | ---: | --- |
| User-intent fit | 6 | Outputs are related to the brief, but choices sometimes redirect the work. Example: "Add a bunch of detail" became "Feature surface", yielding high-level nodes. |
| Prompt specificity | 7 | Prompts are clear about structure, counts, metadata, and link semantics. They are less clear about preserving the user's explicit intent above clarification defaults. |
| Question quality | 6 | Questions are polished, but too generic and often about pipeline mechanics rather than missing user intent. |
| Question necessity | 4 | The first and second completed requests could have been handled with few or no blocking questions. |
| Answer option design | 5 | Options are understandable, but sometimes contain hidden product decisions and can conflict with the original request. |
| Output relevance | 7 | Nodes generally match nested tree editor concepts and inline editing workflows. |
| Output completeness | 6 | Good coverage of common features, but missing acceptance criteria, edge cases, user scenarios, and implementation ordering. |
| Graph structure quality | 7 | Parent-child anchoring is mostly sensible, with useful cross-links in later runs. |
| Metadata usefulness | 6 | `purpose` and `implementation` are concise, but too shallow to guide actual implementation beyond naming concepts. |
| Existing graph awareness | 7 | The model uses existing nodes and selected node context well, especially in the inline-editing run. |
| Duplicate/ID handling | 5 | Generated IDs are changed during persistence (`feature-*` to `note-*`, `note-edit-commit-cancel` to `note-commit-cancel-edit`, etc.), which can confuse logs and downstream reasoning. |
| Reliability/state handling | 4 | One run remains `running` after question generation. There is no visible timeout/recovery status. |
| Latency | 5 | Completed runs took about 64s, 69s, and 105s. The final selected-node run spent about 66s on node generation alone. |
| Transparency | 6 | Logs are useful for debugging, but the user experience likely does not expose enough rationale, coverage, or preview. |
| Follow-up suggestions | 7 | Suggestions are compact and usually actionable, but sometimes introduce broad new scopes instead of finishing the current one. |
| Evaluation/QA | 2 | No logged self-review, intent coverage score, schema-level semantic validation, or repair pass before persistence. |
| Overall process effectiveness | 6 | Solid foundation for structured graph generation, but too linear and under-evaluated for consistently excellent UX. |

## What Worked

The prompts successfully constrain the model into structured graph output. Node labels are compact, metadata uses the available keys, links mostly respect parent-child versus cross-cutting relationships, and follow-up suggestions are formatted for the UI.

The selected-node run is the strongest. Given `note-inline-editing`, the output adds useful child concepts: edit buffer, label validation, inline errors, undo integration, history checkpoint, drag guard, shortcut handoff, and focus restore. That is a sensible expansion of the selected concept.

The graph context is doing real work. Later runs avoid recreating broad common nodes and attach details under existing concepts like `Inline editing`, `Keyboard shortcuts`, `Drag & drop`, `Validation`, and `Undo/Redo`.

## Main Issues

### 1. The pipeline asks questions even when the user gave enough direction

For "Add a bunch of detail related to implementing the editing feature...", the user already specified inline editing, selection, arrow keys, and drag/drop root moves. The question step then offered "Feature surface", "Implementation", and "Hybrid". The selected answer was "Feature surface", which weakened the result relative to "a bunch of detail related to implementing".

This creates a poor experience: the app appears helpful, but the questions can cause the system to do less than the user asked.

### 2. Clarifying questions are too generic

The questions repeatedly ask about scope, depth, and relationship shape. Those are useful to the system, but not necessarily useful to the user. Better questions would target actual ambiguity:

- Should arrow keys reorder siblings, change nesting, or navigate focus?
- Should drag/drop allow dropping between nodes, onto nodes, and onto root?
- Should inline edit commit on blur, Enter, explicit save, or all of these?
- Should generated nodes be feature-planning nodes, implementation tasks, or test cases?

### 3. The system lacks a "do the obvious thing" path

Every completed run used a question step. For many graph-building requests, the better experience is:

1. infer the likely plan,
2. generate a preview,
3. let the user adjust if needed.

Blocking the user with questions should be reserved for genuinely risky ambiguity.

### 4. No quality gate before persistence

The node batch is persisted directly after generation. There is no logged reviewer pass that asks:

- Did we satisfy each noun and verb in the user's request?
- Did we accidentally choose a lower-detail output than requested?
- Are all new links valid after ID normalization?
- Are generated nodes non-duplicative?
- Is the number of nodes appropriate?
- Is the graph too broad, too shallow, or too implementation-light?

This is the single biggest process change needed.

### 5. ID normalization is not reflected cleanly

The model generated `feature-undo-redo`; persistence recorded `note-undo-redo`. It generated `note-edit-commit-cancel`; persistence recorded `note-commit-cancel-edit`. It generated `note-drag-edit-guard`; persistence recorded `note-drag-guard`.

Normalization may be intentional, but the logs then show different generated and persisted IDs. This creates audit ambiguity and can break any later step that reasons from generated IDs instead of persisted IDs.

### 6. One run is stuck as `running`

The earliest run generated questions but has no completion or cancellation. That suggests the workflow needs explicit abandoned-run handling. A user should not see stale running sessions unless they are actually resumable.

### 7. The process is too count-driven

"Generate 5 to 10 new nodes" works for predictable output, but user intent should drive count. "A bunch of detail" might need 12-20 nodes, grouped with a preview. "Common features" might need 6 top-level nodes plus optional children. The fixed range encourages outputs that feel tidy rather than complete.

## Run-by-Run Notes

### Broad common features

Brief: "Add some nodes related to common features in a nested tree editor"

Likely user satisfaction: **7/10**.

The result is a useful broad starter set: Undo/Redo, Drag & drop, Search & filter, Version history, Validation, Keyboard shortcuts, Snapshot restore, Schema rules. This matches the request well. The main weakness is that "common features" could also imply expand/collapse, inline create/delete, copy/paste, multi-select, accessibility, empty/loading states, and context menus.

### Editing feature detail

Brief: "Add a bunch of detail related to impleneting the editing feature in the tree: edit in place with selection, arrow keys to move things around, drag drop to move nodes to new roots."

Likely user satisfaction: **6/10**.

The result covers the named areas, but not with the requested amount of implementation detail. The selected clarification answer "Feature surface" led to a relatively high-level output. It added Inline editing, Edit activation, Commit/cancel edit, Selection state, Arrow reorder, Indent/outdent, Drop indicators, and Root reparenting. That is relevant, but it leaves out important implementation detail like data model updates, keyboard event routing, focus rules, drag state, valid target computation, collision/hover behavior, persistence, undo entries for moves, and test cases.

### Inline-editing selected-node expansion

Brief: "Add a rich set of features to the inline editing block related to a nested tree viewer."

Likely user satisfaction: **7/10**.

This is the best run. The selected node anchored generation well, and the output deepened inline editing with concrete UX and state features. The mismatch is that the user asked for a rich set of features, selected "Comprehensive", but then also selected "Loose dependency"; the final output includes integrations anyway. That is probably desirable, but it means the questions are not cleanly orthogonal.

## Recommendations To Reach 10/10

1. Add an intent parser before question generation. Extract requested entities, operations, desired detail level, selected node, and implied output type.

2. Add a "no questions needed" path. If confidence is high, generate a preview directly.

3. Ask at most one blocking question by default. Use multiple questions only for genuinely ambiguous or high-impact choices.

4. Replace generic scope/depth questions with request-specific questions. Ask about real product behavior, not graph-construction mechanics.

5. Make question options orthogonal. Avoid options where choosing one accidentally reduces the user's stated detail level.

6. Preserve explicit user adjectives as hard constraints. "A bunch of detail", "rich", "implementation", and "selected node" should materially affect node count and metadata depth.

7. Add a pre-persist critique pass. Score the candidate output against the original brief and selected answers before writing.

8. Add an automatic repair loop. If critique score is below threshold, regenerate or patch the node batch once.

9. Add coverage checks. Map each phrase in the user brief to generated nodes or explain why it was omitted.

10. Add a preview step for larger changes. Show the proposed nodes/links and allow "apply", "more detail", "fewer nodes", or "change focus".

11. Let the model return a plan with groups before nodes. For broad requests, generate sections first, then expand each section.

12. Make node count adaptive. Use the brief and graph density to choose count, with explicit reasoning in logs.

13. Use richer metadata when the user asks for implementation detail. Add fields or structured markdown for behavior, state, edge cases, acceptance criteria, and tests.

14. Add process-level modes: "brainstorm features", "implementation breakdown", "test plan", "UX flow", and "architecture map".

15. Infer mode from the request instead of making the user pick from abstract scope options.

16. Validate generated links after persistence ID normalization. Logs should show a mapping from generated ID to persisted ID.

17. Feed persisted IDs into follow-up suggestion generation, not generated IDs.

18. Add stale-run lifecycle handling. Mark abandoned sessions as `awaiting_answers`, `expired`, or `cancelled`, not indefinitely `running`.

19. Track timing and display progress by stage. If node generation can take 65s, show meaningful progress or stream intermediate planning.

20. Add examples to the generation prompt. Include one excellent graph expansion for a similar feature request so the model has a quality target.

21. Add negative examples. Tell the model not to convert "implementation detail" into high-level feature labels only.

22. Add duplicate semantic detection, not just exact ID checks. "Commit/cancel edit" and similar variants should be reconciled deterministically.

23. Add a "why these nodes" explanation for the user. Keep it brief, but expose rationale and coverage.

24. Make follow-up suggestions continue the user's goal. Avoid jumping to broad new scopes unless the current request is clearly complete.

25. Add user outcome metrics. Track whether users accept, undo, edit, or immediately run another expansion after a generated batch.

## Proposed Sweeping Process

The target experience should be less like a form wizard and more like a capable graph copilot.

Recommended pipeline:

1. **Intent extraction**
   - Parse requested domain, operations, detail level, target node, output mode, and constraints.

2. **Confidence decision**
   - If ambiguity is low, skip questions.
   - If ambiguity is medium, ask one high-value question.
   - If ambiguity is high, ask up to three questions, but make them domain-specific.

3. **Draft plan**
   - Generate a small outline of node groups and intended link strategy.

4. **Candidate generation**
   - Generate nodes/links adaptively, not fixed 5-10.

5. **Critique**
   - Score candidate output against original request, graph fit, duplication, link validity, and metadata usefulness.

6. **Repair**
   - Automatically revise once when score is below threshold or coverage is incomplete.

7. **Preview/apply**
   - For small, low-risk batches, auto-apply with undo.
   - For larger or uncertain batches, show preview with quick adjustment controls.

8. **Persist with ID mapping**
   - Store generated IDs, normalized IDs, and link rewrites.

9. **Follow-up suggestions**
   - Generate suggestions from the final persisted graph and the remaining uncovered intent.

## Quality Bar For A 10

A 10/10 add-nodes run should satisfy these conditions:

- The user does not answer unnecessary questions.
- Every major phrase in the user's request is represented in the output.
- The level of detail matches the language of the request.
- The selected node is respected unless there is a clear reason to attach elsewhere.
- The graph has no duplicate concepts or unexplained ID changes.
- Links are semantically useful, not just valid.
- Metadata is directly useful for the user's next action.
- The app can explain what it added and why in one short summary.
- The user has an easy way to adjust before or after persistence.

## Bottom Line

The current pipeline is a good structured-output prototype. It reliably makes plausible graph content. It does not yet reliably deliver the best user experience because it treats clarification, generation, and persistence as a linear happy path.

To get to 10, the process needs fewer generic questions, stronger intent preservation, adaptive depth, a critique-and-repair loop, and a preview/apply model. The most important immediate change is adding a pre-persist evaluator that scores the node batch against the original user request and forces a repair when the output is merely plausible instead of clearly satisfying.
