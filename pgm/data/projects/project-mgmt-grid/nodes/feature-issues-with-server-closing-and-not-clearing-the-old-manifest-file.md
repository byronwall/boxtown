---
id: feature-issues-with-server-closing-and-not-clearing-the-old-manifest-file
label: Issues with server closing and not clearing the old manifest file
type: feature
status: implemented
metadata:
  implementation: Two fixes in packages/cli. (1) Shutdown cleanup now treats a server child killed by a signal as exited (signalCode set, exitCode null). Before, cleanup waited on a close event that had already fired, so the process exited without removing .pgm-local-runtime.json; this happened when closing the terminal and whenever the server died from the signal itself. SIGHUP is now handled alongside SIGINT and SIGTERM. (2) pgm viewer clears a record whose owner process is gone (stopping a verified orphan server first) instead of refusing to start, and names the URL of a viewer that is still running. Verified end to end with SIGHUP, SIGKILL and Ctrl+C; covered by new CLI tests.
---
I usually close via CTRL C so make that work
