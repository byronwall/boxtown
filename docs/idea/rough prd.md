Hi,

Below is a rough PRD that starts with the original ask, captures what was actually built, and then reframes it into a more general-purpose product ideation and management tool.

PRD: Spatial Product Map

1. Overview

The initial request was for a lightweight index.html prototype that visualizes a hierarchy as flat boxes, allows links between boxes, and avoids rendering edges by default. Relationships should instead be communicated through spatial proximity, with related boxes touching or clustering tightly. Deeper items should appear smaller, and hover should reveal richer explanatory details.

What was created is a single-page HTML prototype that:

- renders pages, assemblies, and components as flat labeled rectangles,
- sizes boxes by depth,
- supports hierarchical and cross-link relationships,
- uses a force-based layout so related items cluster,
- hides edges by default,
- reveals details on hover,
- and now adds hover-focus behavior that elevates related items, dims unrelated items, and pulls related nodes into a tighter temporary cluster.

The broader opportunity is to evolve this into a general-purpose spatial planning tool for product architecture, roadmap ideation, system design, and dependency management.

⸻

2. Original user problem

The original problem was not really “draw a graph.” It was closer to this:

- Users need a way to think about product structure spatially.
  - Hierarchies matter.
  - Cross-links matter.
  - But traditional node-link diagrams get noisy fast.
- Users want a view that feels more like clustering and composition than diagramming.
  - Related things should visually gather.
  - Ownership and reuse should be legible.
  - The user should not need to inspect a web of lines to understand the shape.
- Users also want lightweight metadata.
  - Each box should have a readable label.
  - More details should appear on demand, not all at once.

⸻

3. Original request distilled into requirements

Functional intent

- Visualize hierarchical items as flat boxes.
- Support explicit links between arbitrary boxes.
- Do not show edges by default.
- Use proximity and contact as the main signal of relationship.
- Make deeper nodes smaller.
- Show labels directly on the boxes.
- Reveal more information on hover.
- Seed with a test dataset representing a recipe website.

Initial information model

- Page
  - largest unit
- Assembly
  - intermediate unit
- Component
  - smallest unit

Initial interaction model

- Passive browsing first
  - user sees the structure at a glance
- Hover for detail
  - user sees purpose and implementation
- Optional diagnostic mode
  - user can show edges when needed

⸻

4. What was actually built

Prototype scope

A single static HTML page with plain CSS and JavaScript.

Implemented features

- Data-driven node model
  - id
  - label
  - kind
  - depth
  - purpose
  - implementation
- Relationship model
  - hierarchy links
  - cross-links / reuse links
- Visual encoding
  - pages, assemblies, and components have distinct sizes
  - each type has slightly different coloring
  - labels and type metadata are always visible
- Layout behavior
  - nodes initialize into rough depth-based zones
  - force-based attraction keeps linked items close
  - collision logic reduces overlap
  - related nodes tend to cluster without needing visible edges
- Interaction
  - hover tooltip with richer metadata
  - edge toggle
  - reflow / shuffle button
- Enhanced hover UX
  - hovered node becomes focal point
  - related items are elevated
  - unrelated items dim
  - related edges can surface during hover
  - direct neighbors are nudged inward to tighten the active cluster

Sample dataset

The prototype models a recipe product structure:

- Pages
  - Home
  - Recipes
  - Recipe Detail
  - Profile
- Assemblies
  - Hero Assembly
  - Featured Recipes
  - Filter Bar
  - Results Grid
  - Recipe Overview
  - Instructions Block
  - Saved Recipes
  - Meal Planner
- Components
  - Search Input
  - CTA Button
  - Recipe Card
  - Filter Chip
  - Sort Select
  - Ingredient List
  - Step List
  - Rating Stars
  - Save Toggle
  - Calendar Grid
  - Shopping List

⸻

5. Product vision for a generalized version

Turn the prototype into a spatial workspace for thinking about a product as a system.

The generalized product should help teams:

- ideate new product concepts,
- map product areas and features,
- express ownership and hierarchy,
- capture dependencies and reuse,
- manage the relationship between vision, UX, implementation, and delivery.

The key idea is:

- a product is represented as a spatial network of typed boxes,
- proximity is meaningful,
- hierarchy is preserved,
- metadata is rich,
- and the experience is optimized for exploration, not just documentation.

⸻

6. Target users

Primary

- Product managers
- Designers
- Engineering leads
- Founders / early-stage product teams

Secondary

- Frontend and platform engineers
- Staff+ engineers doing system mapping
- Delivery leads / program managers
- Cross-functional teams during planning workshops

⸻

7. Core jobs to be done

Ideation

- “Help me map out a product concept and its major areas.”

Structuring

- “Help me break pages/features into sub-areas, components, flows, or systems.”

Dependency understanding

- “Show what is reused, shared, or tightly coupled.”

Planning

- “Help me understand what belongs together and what impacts what.”

Communication

- “Give me a clean artifact I can use with engineering, design, and stakeholders.”

⸻

8. Proposed generalized object model

Object Type Purpose Example
Product Area Top-level domain or business area Search, Checkout, Profile
Surface / Screen User-facing surface Home, Pricing, Dashboard
Feature Functional capability Saved Items, Recommendations
Flow Multi-step journey Onboarding, Purchase Flow
Module / Assembly Composite UX or technical grouping Filter Bar, Hero, Billing Panel
Component Reusable UI or logic block Card, Button, Sort Select
Entity / Data Object Important domain object Recipe, Order, User, Subscription
System / Service Technical dependency Auth Service, Search Index
Initiative / Milestone Planning object Q3 Checkout Refresh
Team / Owner Ownership object Growth Team, Platform Team

This should be configurable rather than hardcoded.

⸻

9. Core feature set for v1

A. Spatial map canvas

- Render typed boxes on a zoomable/pannable canvas.
- Support parent-child hierarchy.
- Support lateral links and dependencies.
- Use clustering and proximity as the default relational signal.
- Keep edges optional.

B. Typed nodes

- User can create node types.
- Each type has:
  - label,
  - size rules,
  - color/style,
  - icon or badge,
  - metadata schema.

C. Relationship types

- Parent-child
- Reuse
- Dependency
- Ownership
- Data flow
- Delivery linkage

These should support different weights in layout and highlight behavior.

D. Hover and focus interactions

- Hover highlights the focal node and related cluster.
- Non-related items dim.
- Related items rise visually.
- The active cluster can tighten temporarily.
- Tooltip or side panel reveals metadata.

E. Detail model

Each node should support:

- title
- type
- summary
- purpose
- implementation notes
- owner
- status
- tags
- links to docs/issues/code
- priority or strategic importance

F. Layout controls

- Auto-layout
- Re-cluster
- Lock node position
- Show/hide edges
- Show only selected relationship types
- Depth-aware scaling

⸻

10. Candidate v2 capabilities

Planning and management

- Status on nodes
  - idea, planned, in progress, shipped, deprecated
- Priority and effort
- Roadmap grouping
- Team ownership overlays
- Quarter or milestone tagging

Product operations

- Filter by owner, status, area, tag
- Search nodes
- Save multiple views
  - architecture view
  - roadmap view
  - ownership view
  - dependency risk view

Collaboration

- Comments / annotations
- Shared workspaces
- Presence / multiplayer editing
- Snapshot history

Integrations

- Jira / Linear
- Figma
- GitHub
- Notion / docs
- analytics links

⸻

11. UX principles

Default to visual calm

- Avoid edge-heavy diagrams on first load.
- Keep labels readable.
- Put metadata behind hover/focus or side panel.

Preserve meaning through space

- Parent-child relationships should feel local and grounded.
- Cross-links should inform, not dominate.
- Clusters should feel intentional.

Let users move from abstract to concrete

- Start with structure.
- Then reveal metadata.
- Then reveal dependencies.
- Then reveal delivery state.

Optimize for product thinking, not just documentation

- Fast box creation.
- Fast restructuring.
- Easy regrouping.
- Easy comparison of multiple mental models.

⸻

12. Non-goals for the first real version

- Full BPMN-style process modeling
- Pixel-precise design tooling
- Replacing Jira/Figma/Notion entirely
- Complex graph analytics as a primary workflow

The goal is a thinking and coordination surface, not a full enterprise modeling suite.

⸻

13. Success criteria

Usability

- A user can create a useful product map in under 15 minutes.
- A viewer can understand the top-level product shape in under 30 seconds.

Clarity

- Ownership and hierarchy are readable without edges enabled.
- Reuse and dependencies are discoverable on hover/focus.

Product value

- Teams use the map during planning, design reviews, and architecture discussions.
- The artifact becomes something people maintain rather than a one-off workshop output.

⸻

14. Risks and tradeoffs

Risk: clustering can blur ownership

- Reuse links may pull items away from their parent areas.
- Mitigation:
  - stronger parent-child weighting,
  - lighter reuse weighting,
  - optional “territories” or containers for top-level groups.

Risk: too much metadata turns boxes into cards

- Mitigation:
  - keep boxes compact,
  - move detail into hover or side panel.

Risk: becomes another diagramming tool

- Mitigation:
  - lean into product-specific object types,
  - ownership/status overlays,
  - relationship-aware clustering,
  - view presets for planning and architecture.

⸻

15. Suggested MVP framing

If you want to make this real, I would position the MVP as:

Spatial Product Map MVP

A canvas-based tool for mapping product structure, feature relationships, and reusable building blocks without relying on cluttered node-link diagrams.

MVP includes

- typed nodes,
- hierarchical + lateral relationships,
- auto-clustering layout,
- hover focus and dimming,
- edge toggle,
- metadata side panel,
- filters by type/status/owner,
- save/load map data.

MVP excludes

- real-time collaboration,
- external integrations,
- advanced permissions,
- heavy workflow automation.

⸻

16. One-sentence product pitch

A visual workspace for mapping products as connected clusters of features, flows, systems, and components—so teams can ideate, structure, and manage complexity without drowning in diagram lines.

If you want, I can turn this into a tighter one-page PRD with sections like Goals, User Stories, Requirements, and Open Questions.
