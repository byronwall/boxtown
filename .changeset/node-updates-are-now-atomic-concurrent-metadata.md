---
"@byronwallrus/product-grid-cli": patch
---

Node updates are now atomic: concurrent metadata updates to different keys both survive, an invalid field rejects the whole update, and node reads return a revision you can pass as expectedRevision to avoid overwriting newer edits.
