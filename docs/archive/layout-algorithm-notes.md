<!-- Archived from prod-mgmt project-mgmt-grid node `page-layout-algorith` on 2026-09-29 before feature-info cleanup. -->

# Layout Algorithm Notes

The layout algorithm should be fast, deterministic, unbounded, and packing-oriented. It should not be constrained to the current screen dimensions. The canvas can grow as large as needed, then the viewer should zoom to fit the resulting blob.

Recent behavior showed that global aspect-ratio fixes can be misleading. Stretching or expanding the final bounds can make the outer rectangle look correct while leaving detached edge nodes or large internal gaps. Aspect ratio should be treated as a placement and docking score, not as a final geometric transform that spreads nodes apart.

Preferred approach:

- Place nodes in a deterministic single pass.
- Prioritize larger nodes, placed parents, placed connected nodes, and stable sibling order.
- Prefer direct adjacency/touching over force-style settling.
- Let roots and loose nodes choose slots that help the blob trend toward the viewport aspect ratio.
- Compact inward after placement so edge nodes march toward the center until blocked.
- Detect floating nodes by whether they touch any neighbor, not just by whether the overall bounds look reasonable.
- Rebalance aspect by docking a small number of edge nodes into open side/top/bottom slots, not by scaling the whole layout.
- Keep the algorithm bounded and predictable: avoid O(n^3) scans, repeated full force simulations, or final passes that iterate until visual convergence.

Important regression criteria:

- No overlapping nodes.
- No detached/floating nodes after finalization.
- Packed bounds should stay close to the viewport aspect ratio without limiting canvas size.
- The packed area should remain dense; a good outer aspect ratio is not sufficient if whitespace or stranded nodes create the ratio.
- Parent/child and connected relationships should remain visibly adjacent where possible.

The current implementation direction is a single-pass packer followed by a small finalizer: dock isolated nodes, compact edge nodes inward, and perform bounded aspect rebalancing through docking. Avoid reintroducing viewport clamping or final stretch/scale corrections.
