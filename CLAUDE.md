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

## Settings Architecture

The app has one global settings surface and a per-module info drawer system.
Follow the scope rule when adding new options:

- **Affects 2+ modules or is global** → add to the Options Drawer (`#optionsDrawer`), inside a `<details class="opt-section">` with `.opt-row` / `.opt-toggle` markup. Register its default in `DEFAULT_OPTIONS` (js/config.js).
- **Affects exactly one module** → add it to that module's info drawer by extending its `registerModuleSettings(moduleId, ...)` builder in `js/ui/feeds.js` (feed/outlier/filteredFeed), `js/ui/moduleDrawers.js` (pie/bubble/approval), or `js/ui/stopwordsModal.js` (topWords). Each card's title bar should have one "ⓘ" info button and nothing else — the drawer contains both the help text (from `HELP_CONTENT`) and the settings.

Do NOT add standalone inline sliders / `?` help buttons to card headers — that's the pattern the Options & Settings rework replaced.

### Key files
- `js/utils/settings.js` — unified `get` / `set` / `on` / `off` / `migrate` API + `settings:change` CustomEvent bus (blob key `moodradar_options_v2`).
- `js/ui/modal.js` — shared `createModal()` / `createDrawer()` factories; `.mr-overlay` / `.mr-modal` / `.mr-drawer` CSS in `css/modal.css`.
- `js/ui/infoDrawer.js` — `registerModuleSettings()` + `attachInfoButton()` used by every module drawer.

### Touch / slider guidelines
Range sliders live on touchscreens — always wrap them in `.opt-row`, `.sw-slider-row`, or another container covered by the `user-select:none` rules at the top of `css/tokens.css`. Do not use `touch-action:none` on the thumb; use `manipulation` so pinch-zoom still works.
