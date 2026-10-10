---
id: feature-mutations-are-too-slow-waiting-for-server-need-optimistic-that-syncs-bumplessly-with-websocket
label: Mutations are too slow waiting for server... need optimistic that syncs bumplessly with websocket
type: task
status: implemented
archived: true
metadata:
  implementation: "Reconciled 2026-10-05: ProjectDetailPage keeps pending edits over server, route, and WebSocket updates. Mutation IDs settle each edit; failures remove only that edit. Stable graph identity avoids extra layout transitions. Commit 46fb26ee is merged; optimistic-sync checks passed."
---
