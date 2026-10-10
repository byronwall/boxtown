---
id: page-bug-report-from-codex
label: Bug report from Codex
type: task
status: implemented
archived: true
metadata:
  implementation: "Implemented a parent-node context pack command in the CLI. Added pgm node context-pack PARENT_NODE_ID --output DIR --json with optional --depth N. The command gathers the selected parent plus descendants, writes context-pack.md, writes context-pack.json with node metadata, inherited context, and path data, and downloads all referenced node images into an images folder with de-duplication by source node and image id. Also documented the command in the CLI README and bundled/project product-grid-context skills. Covered with CLI parser and mocked end-to-end context-pack tests. Verification: pnpm test in packages/cli passes, 25 of 25. Also aligned the existing update-check test with the current pgm update message so the CLI suite remains passing."
---
Here’s the practical breakdown.

**What Worked Well**
`pgm` was genuinely useful for project-status work. It let me avoid browser scraping, identify the `logo-dodo` project, find the Chandler feedback subtree, pull attached image metadata, update statuses, add implementation notes, and verify final state from the authoritative source.

The best parts:
- `pgm project list --json` made project discovery easy.
- `pgm node list --search Chandler --with-ancestors --json` was the right way to find the feedback subtree without opening the UI.
- Node IDs were stable and human-readable enough to use directly.
- `pgm node update ... --status ...` and `pgm node metadata set ... implementation ...` were simple and predictable.
- Image metadata was available directly on node output, which made it easy to download references.

The rough edges are mostly around output size, multi-node updates, and verification ergonomics.

**Biggest Token Efficiency Problems**
The main issue is that `node list --with-ancestors --json` returns a lot of repeated structure. For the Chandler subtree, each child included the full ancestor path, and each path repeated context, raw context, image metadata, title, status, metadata, etc. That is useful sometimes, but expensive when the agent already knows the subtree.

Specific token waste:
- Ancestor nodes were repeated for every result.
- Image objects were repeated in each path and inherited context.
- `context`, `rawContext`, `metadata`, and `images` were returned together by default in many places.
- `node view --with-context` returned direct node data, path, and inherited context, often duplicating the same content.
- Verification via `node list --search Chandler --with-ancestors` pulled all feedback content again, even though I only needed final `id/status/metadata.implementation`.

The biggest improvement would be field selection.

Example ideal command:

```bash
pgm node list --project logo-dodo \
  --parent page-feedback-from-chandler \
  --fields id,title,status,metadata.implementation,imageCount \
  --json
```

Or:

```bash
pgm node view page-pricing \
  --project logo-dodo \
  --fields id,title,status,metadata.implementation \
  --json
```

That would cut verification output by probably 80-95%.

**Best CLI Additions**
1. **Add `--fields` everywhere**

Support dot paths and presets.

```bash
pgm node list --project logo-dodo --search Chandler \
  --fields id,title,status,parentNodeId,metadata.implementation
```

Presets:

```bash
pgm node list --project logo-dodo --search Chandler --preset status
pgm node view page-pricing --project logo-dodo --preset status
pgm node view page-pricing --project logo-dodo --preset handoff
```

Suggested presets:
- `status`: `id,title,status,type,parentNodeId,metadata.implementation,updatedAt`
- `compact`: `id,title,status,type,parentNodeId,childCount,imageCount`
- `handoff`: `id,title,status,context,metadata.implementation,images`
- `images`: `id,title,images`
- `tree`: `id,title,status,type,parentNodeId,childCount`

2. **Add parent/subtree listing**

Search was fine, but once I knew `page-feedback-from-chandler`, I wanted its children directly.

```bash
pgm node list --project logo-dodo --children page-feedback-from-chandler --json
pgm node list --project logo-dodo --subtree page-feedback-from-chandler --depth 2 --json
```

Useful options:

```bash
--include-self
--depth 1
--fields id,title,status,metadata.implementation
--no-context
--no-images
```

3. **Add batch update**

Updating five nodes required many calls, repeated network permission prompts, and verification calls. A batch command would be much better.

Option A: JSON input.

```bash
pgm node batch-update --project logo-dodo --json-input ./tmp/pgm-updates.json --json
```

Input:

```json
{
  "updates": [
    {
      "id": "page-issue",
      "status": "implemented",
      "metadata": {
        "implementation": "Implemented: simplified header navigation..."
      }
    },
    {
      "id": "page-pricing",
      "status": "needs-review",
      "metadata": {
        "implementation": "Partially implemented and needs review..."
      }
    }
  ]
}
```

Output should be compact:

```json
{
  "updated": [
    { "id": "page-issue", "status": "implemented", "updatedFields": ["status", "metadata.implementation"] },
    { "id": "page-pricing", "status": "needs-review", "updatedFields": ["status", "metadata.implementation"] }
  ],
  "failed": []
}
```

Option B: JSONL input for easy generation:

```jsonl
{"id":"page-issue","status":"implemented","metadata":{"implementation":"..."}}
{"id":"page-pricing","status":"needs-review","metadata":{"implementation":"..."}}
```

4. **Add an atomic status + note command**

Most agent status updates are “set status and explain why.” Make that one primitive.

```bash
pgm node resolve page-issue \
  --project logo-dodo \
  --status implemented \
  --note "Simplified header navigation..." \
  --json
```

For mixed/deferred items:

```bash
pgm node resolve page-pricing \
  --project logo-dodo \
  --status needs-review \
  --note "Partially implemented..." \
  --deferred "Free generations/do-over policy" \
  --deferred "Legal language for unused generation expiration" \
  --json
```

That could write structured metadata:

```json
{
  "implementation": "Partially implemented...",
  "deferred": [
    "Free generations/do-over policy",
    "Legal language for unused generation expiration"
  ],
  "updatedBy": "agent",
  "updatedAt": "..."
}
```

5. **Support append notes, not only metadata set**

`metadata set implementation "..."` replaces the field. That is okay for this pass, but project tracking often needs an audit trail.

Add:

```bash
pgm node note add page-pricing \
  --project logo-dodo \
  --kind implementation \
  --body "Partially implemented..." \
  --json
```

Or:

```bash
pgm node metadata append page-pricing implementation-log "..." --json
```

The agent should not have to choose between overwriting context and losing history.

6. **Return compact mutation output by default**

Mutation output was already pretty compact:

```json
{
  "nodeId": "page-issue",
  "status": "implemented",
  "updatedFields": ["status"]
}
```

That is good. Keep that default. Do not return the full node after mutation unless requested.

Maybe add:

```bash
--return node
--return summary
```

Default should be `summary`.

7. **Make verification cheap**

Add a command specifically for checking status/notes after a batch.

```bash
pgm node status --project logo-dodo page-issue page-login-account page-pricing --json
```

Output:

```json
{
  "nodes": [
    {
      "id": "page-issue",
      "title": "Issue w/ navigation",
      "status": "implemented",
      "implementation": "Implemented: simplified header navigation..."
    }
  ]
}
```

This would be dramatically better than `node view --with-context` for final checks.

8. **Better image download support**

I had to use `curl` manually against image URLs. Add:

```bash
pgm image download page-feedback-from-chandler \
  --project logo-dodo \
  --subtree \
  --output tmp/chandler-feedback-images \
  --json
```

Useful output:

```json
{
  "downloaded": [
    {
      "nodeId": "page-issue",
      "imageId": "5feafc61...",
      "path": "tmp/chandler-feedback-images/page-issue-5feafc61.png"
    }
  ]
}
```

Also useful:

```bash
pgm image list --project logo-dodo --subtree page-feedback-from-chandler --json
```

9. **Separate context from references**

Sometimes I need node text; sometimes just image references. Current outputs often bundle everything.

Useful flags:
- `--no-context`
- `--no-raw-context`
- `--no-images`
- `--images-only`
- `--metadata-only`
- `--status-only`

Example:

```bash
pgm node list --subtree page-feedback-from-chandler --no-context --no-images --json
```

10. **Add optimistic concurrency / updatedAt checks**

Agents may update stale data. Add optional safeguards:

```bash
pgm node update page-pricing \
  --status needs-review \
  --if-updated-at 2026-05-07T02:45:03.835Z \
  --json
```

If stale:

```json
{
  "error": "Node changed since read",
  "currentUpdatedAt": "...",
  "requestedUpdatedAt": "..."
}
```

Good for collaborative project tracking.

**Agent-Oriented Status Model**
To make `pgm` the best agent project-status tool, I’d formalize a common update shape:

```ts
type AgentStatusUpdate = {
  nodeId: string;
  status: "planned" | "working" | "implemented" | "needs-review" | "blocked" | "deprecated";
  summary: string;
  completed?: string[];
  deferred?: string[];
  blockedBy?: string[];
  verification?: string[];
  filesChanged?: string[];
  source?: {
    agent: "codex";
    workspace?: string;
    branch?: string;
  };
};
```

Then expose:

```bash
pgm node agent-update --project logo-dodo --file ./tmp/agent-status.json --json
```

This lets the app render project status cleanly instead of burying everything in one prose metadata field.

For this task, an ideal update would have been:

```json
{
  "updates": [
    {
      "nodeId": "page-pricing",
      "status": "needs-review",
      "summary": "Simplified pricing copy and clarified generation usage.",
      "completed": [
        "Changed negative renewal/subscription phrasing to one-time purchase",
        "Clarified that new boards and refinements each cost one generation",
        "Avoided hard non-expiring credit claims"
      ],
      "deferred": [
        "Free generations/do-over policy",
        "Extra-credit behavior",
        "Whether project history is paid",
        "Legal language for unused generation retention or expiration"
      ],
      "verification": [
        "pnpm -C app type-check",
        "Playwright desktop/mobile smoke check"
      ]
    }
  ]
}
```

That would be much more useful than a single `implementation` string.

**Specific Workflow I’d Recommend For Agents**
The ideal agent loop should be:

1. Discover project:

```bash
pgm project list --json --fields id,name,nodeCount,updatedAt
```

2. Locate relevant subtree:

```bash
pgm node list --project logo-dodo --search Chandler --fields id,title,status,parentNodeId
```

3. Inspect only needed subtree:

```bash
pgm node list --project logo-dodo \
  --subtree page-feedback-from-chandler \
  --depth 2 \
  --fields id,title,status,context,imageCount,metadata.implementation
```

4. Download images in one call:

```bash
pgm image download --project logo-dodo \
  --subtree page-feedback-from-chandler \
  --output tmp/chandler-feedback-images \
  --json
```

5. Perform work.

6. Batch status update:

```bash
pgm node agent-update --project logo-dodo --file ./tmp/agent-status.json --json
```

7. Compact verification:

```bash
pgm node status --project logo-dodo \
  page-issue page-login-account page-marketing-and-copy page-pricing page-random-issues \
  --json
```

That is probably 5-10x more token efficient than the current flow.

**One Bug / Odd Behavior I Saw**
When I set metadata on `page-random-issues`, the command output reported:

```json
{
  "nodeId": "page-random-issues",
  "status": "planned",
  "updatedFields": ["metadata"]
}
```

even though I had just set it to `needs-review`. A later `node view` confirmed the status was actually `needs-review`.

That suggests either:
- mutation output returned a stale status,
- there was eventual consistency,
- metadata set wrote from an older node snapshot and temporarily clobbered status,
- or the update response was built from stale pre-write data.

This matters for agents because they trust command output. Mutation responses should reflect final persisted state, or omit unchanged fields unless guaranteed current.

**Highest-Impact Changes To Make First**
If you only change a few things, I’d do these:

1. Add `--fields` to `node list` and `node view`.
2. Add `pgm node batch-update` for status + metadata updates.
3. Add `pgm node status <ids...>` for compact verification.
4. Add `pgm node list --subtree <node-id> --depth N`.
5. Add structured `agent-update` with `summary`, `completed`, `deferred`, and `verification`.
6. Ensure mutation responses return final persisted state.

With those, `pgm` becomes a strong agent-native project tracker: cheap to inspect, cheap to update, easy to verify, and structured enough that agents can keep project status current without filling the context window with repeated graph data.
