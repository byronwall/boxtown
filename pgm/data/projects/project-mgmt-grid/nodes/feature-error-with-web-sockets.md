---
id: feature-error-with-web-sockets
label: Error with web sockets
type: task
status: implemented
archived: true
metadata:
  implementation: "Triage 2026-09-29: verified fixed in code — /ws/jobs route probe + client fallback shipped (see resolution note)."
rawContext: "```"
---
```
_projectId_-D5GFlf3H.js:97 WebSocket connection to 'wss://prod-mgmt.apps.byroni.us/ws/jobs' failed: 

_projectId_-D5GFlf3H.js:97 WebSocket connection to 'wss://prod-mgmt.apps.byroni.us/ws/jobs' failed: 
_projectId_-D5GFlf3H.js:97 WebSocket connection to 'wss://prod-mgmt.apps.byroni.us/ws/jobs' failed: 
_projectId_-D5GFlf3H.js:97 WebSocket connection to 'wss://prod-mgmt.apps.byroni.us/ws/jobs' failed: 
﻿```

Resolution note:

Implemented a /ws/jobs route probe and client-side fallback so production only opens the WebSocket when the endpoint is actually mounted, avoiding repeated console connection failures while retaining polling reconciliation.
