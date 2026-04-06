# CLAUDE.md — PWA Maintenance Rules

## PWA Files (do not remove or break)
- `manifest.json` — Web App Manifest (name, icons, display mode, colors)
- `service-worker.js` — Workbox-based service worker (precache, runtime caching)
- `install-prompt.js` — Auto-triggers native browser install dialog
- `icons/icon-192x192.png` — App icon 192×192
- `icons/icon-512x512.png` — App icon 512×512

## Rules
1. **Never remove** the `<link rel="manifest">`, `<meta name="theme-color">`, or service worker registration from `index.html`.
2. When adding new static assets (CSS, JS, images), add them to the precache list in `service-worker.js` and bump the `revision` string.
3. Keep `start_url` in `manifest.json` set to `"/"`.
4. The service worker scope must remain `"/"`.
5. Do not delete or rename `install-prompt.js` — it handles the automatic native install prompt.
6. Icon files in `/icons/` are placeholders. Replace with real branded icons but keep the filenames and sizes.
7. All paths in `manifest.json` and `service-worker.js` must be root-relative (`/`).
