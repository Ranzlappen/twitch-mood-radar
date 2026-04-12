# CLAUDE.md — PWA Maintenance Rules

## Project Architecture (ES Modules)
The app uses ES modules (`<script type="module">`). Entry point: `/js/app.js`.

```
js/
  app.js              ← Orchestrator: imports all modules, wires window handlers
  config.js           ← All constants, storage keys, sentiment data, help content
  state.js            ← Centralized mutable state object
  processing.js       ← Main RAF loop, message enqueue, updateVisuals

  analysis/
    sentiment.js      ← classifyMessage(), TERM_MAP lookups
    approval.js       ← computeApproval(), approvalVerdict()
    botDetector.js    ← detectBot(), usernameScore(), messageScore()
    ewma.js           ← expWeight(), computeWeightedMoods(), computeKeywordWeights()

  platform/
    PlatformAdapter.js ← Base class for streaming platform adapters
    TwitchAdapter.js   ← Twitch IRC WebSocket, OAuth, emote loading, channel history
    emotes.js          ← Shared renderEmotes() for all platforms

  ui/
    charts.js          ← Chart.js init (pie, radar, timelines), timeline snapshots
    bubbles.js         ← Canvas bubble physics engine
    feeds.js           ← Unified FeedRenderer class (main, outlier, filtered feeds)
    approval-meter.js  ← Approval meter UI updates
    options.js         ← Options drawer (all setOpt* functions)
    settings.js        ← Layout presets (dashboard/list/dense/custom)
    layout.js          ← Layout manager, resize system, drag-reorder
    help.js            ← Help modal

  utils/
    dom.js             ← sanitize(), esc(), setStatus(), fmtNum()
    color.js           ← hexAlpha(), lerpColor()
    storage.js         ← localStorage wrapper with error handling
```

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
8. The entry point is `<script type="module" src="/js/app.js">` — do not revert to non-module script.
9. All modules import `state` from `js/state.js` for shared mutable state — avoid new globals.
10. To add a new streaming platform, create a new adapter in `js/platform/` extending `PlatformAdapter`.
