# NFPL v88.83 — Matt-style clean PWA candidate

This candidate preserves the v88.83 NFPL application while replacing the fragile all-in-one upload structure with a normal PWA layout.

- `index.html` contains the application UI and logic.
- `assets/` contains extracted visual assets.
- `sync-matts-v1.js` protects shared synchronization and the running blind clock.
- `sw.js` provides network-first app updates and offline fallback.
- The live NFPL site is not replaced until Sam approves the tested candidate.
