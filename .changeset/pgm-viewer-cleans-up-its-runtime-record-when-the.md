---
"@byronwallrus/product-grid-cli": patch
---

pgm viewer cleans up its runtime record when the terminal closes or the server dies from a signal, and a later pgm viewer replaces a record left by a viewer that was force-killed.
