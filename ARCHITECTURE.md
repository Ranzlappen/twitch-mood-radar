# Architecture Review & Elevation Roadmap

> **Date**: 2026-04-21
> **Scope**: Full codebase architecture review
> **Status**: Modular refactor complete; options/settings rework in progress

---

## Executive Summary

**Mood Radar** is a real-time, multi-platform live chat mood analyzer delivered as a client-side PWA. It connects to Twitch (IRC WebSocket), Kick (Pusher WebSocket), YouTube (Innertube polling), and Rumble (REST polling) — supporting up to 10 simultaneous feeds — and classifies every message into one of 12 mood categories using keyword-based sentiment analysis. Results are rendered through 6 interactive visualization types: pie chart, radar web, consensus bubbles (custom canvas physics engine), approval meter, timeline charts (linear/log/approval/throughput), and live message feeds with regex filtering.

The project is written in vanilla HTML/CSS/JS with no build system, using Chart.js 4.4.1 as the only runtime dependency. It is deployed via GitHub Pages with Workbox-based PWA caching.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Language | JavaScript (ES2022, no modules in production) |
| UI | Vanilla HTML/CSS, CSS custom properties |
| Charts | Chart.js 4.4.1 (CDN) |
| Canvas | Custom 2D spring-physics engine (bubbles) |
| PWA | Workbox 7.3.0 (CDN), Web App Manifest |
| Fonts | Google Fonts (Orbitron, Share Tech Mono) |
| Persistence | localStorage (17+ keys) |
| Deployment | GitHub Pages + custom domain |
| Build System | **None** |
| Tests | **None** |
| CI/CD | **None** |

---

## Current Module Tree

The ES-module refactor (formerly listed as Phase 3 here) is **complete**. The
root-level `app.js` monolith and `styles.css` stylesheet are gone. `index.html`
loads `<script type="module" src="/js/app.js">` and `<link href="/css/main.css">`.

```
js/
  app.js                  entry — wires everything at window.onload
  config.js               storage keys, DEFAULT_OPTIONS, HELP_CONTENT, dictionaries
  state.js                centralized mutable state
  processing.js           message queue + processing loop
  analysis/               pure analysis (EWMA, sentiment, approval, bot, topWords)
    __tests__/            vitest unit tests
  platform/               ConnectionManager + TwitchAdapter/KickAdapter/YouTubeAdapter/RumbleAdapter + emotes
  history/historyDb.js    IndexedDB user message history
  ui/
    options.js            Options Drawer — global + multi-module settings
    moduleDrawers.js      bubbleCard/pieCard/approvalCard info drawers
    stopwordsModal.js     topWordsCard info drawer (absorbed the old standalone modal)
    feeds.js              main/filtered/outlier feed + their info drawers
    modal.js              shared createModal() / createDrawer() factories
    infoDrawer.js         per-module info drawer pattern (ⓘ button + drawer shell)
    settings.js           preset apply/save (the Settings Dropdown is retired)
    layout.js             custom layout manager, resize observer, half-life/scale sliders
    charts.js             Chart.js wiring, timeline updates
    bubbles.js            custom canvas physics engine
    approval-meter.js     approval gauge + mini bar
    topWords.js           top-N word list rendering
    chipInput.js          reusable chip input component
    filterBuilder.js      simple↔regex filter translation
    userHistoryModal.js   draggable user history popout
    emoteModal.js         emote preview modal
    linkModal.js          link safety prompt
    help.js               help overlay + Escape-key stack
    wake-lock.js          Screen Wake Lock API
  utils/
    settings.js           unified get/set/migrate/on/off + CustomEvent bus (v2 blob)
    storage.js            localStorage JSON helpers
    CircularBuffer.js     fixed-size ring buffer
    dom.js                sanitize/esc helpers
    color.js, cors.js, urlSafety.js
    __tests__/            vitest unit tests
```

## Options & Settings (2026-04 rework)

Every option has a home determined by scope:

- **Global Options Drawer** (`#optionsDrawer`, right slide-in) holds everything
  that affects multiple modules or is operational: presets, label scale, half-life,
  timeline settings, density/gap/pad/font scale, CRT/grid, header toggles, card
  visibility, history logging, YouTube/Rumble API keys, custom layout arranger,
  reset all.
- **Per-module info drawers** (one shared `#infoDrawer` shell, ⓘ button on each
  card title bar) hold everything that affects exactly one module: feed font
  sliders, bubble count/speed/opacity/height + bubble scale, pie labels/animation,
  approval mini/verdict, top-words decay/font/emote-size + stopword editor.
- **Dedicated editor modals** stay for complex edit surfaces: filter editor
  (opens from the filteredFeedCard info drawer), user history popout.

Unified storage lives in `js/utils/settings.js` (`moodradar_options_v2` blob)
with migration from the scattered v1 keys. A `settings:change` CustomEvent is
dispatched on every write so modules can subscribe without importing setters.

---

## Architecture: What's Running (the Monolith)

### Data Flow

```
Platform WebSocket/Polling
    ↓ message events
enqueue(user, msg, ts, platform)
    ↓ msgQueue (capped at 5000)
processingLoop() [runs on requestAnimationFrame, ~60fps]
    ↓ dequeue up to 400 msgs/frame
    ├── detectBot() → filter bots
    ├── classifyMessage() → mood + strength + approval vote
    ├── scoredMessages[] → EWMA time-decay scoring
    ├── keywordStore Map → keyword frequency tracking
    ├── approvalStore[] → approval/dissent tracking
    ├── mainFeed.add() → live feed (1 in 5 shown)
    ├── filteredFeed.add() → regex-filtered feed
    └── outlierFeed.add() → underrepresented mood detection
    ↓ every 8 frames
updateVisuals()
    ├── computeWeightedMoods() → pie chart + radar
    ├── computeKeywordWeights() → bubble sizes
    ├── updateBubbles() → canvas physics
    ├── updateApprovalMeter() → gauge + mini bars
    └── DOM stat updates (messages, users, rate, etc.)
    ↓ every TIMELINE_INTERVAL ms
pushTimelineSnapshot() → mood timeline charts
pushApprovalTimelineSnapshot() → approval timeline
pushThroughputTimelineSnapshot() → msg/s timeline
```

### Multi-Connection Slot System

```
connections[] — array of up to MAX_FEEDS (10) slot objects
    ├── id: monotonic slotIdCounter
    ├── platform: 'twitch' | 'kick' | 'youtube' | 'rumble'
    ├── channelName: string
    ├── ws: WebSocket | null
    ├── polling: boolean (for YouTube/Rumble)
    ├── loggingActive: boolean
    ├── reconnectAttempt: number
    ├── reconnectTimer: timeout handle
    ├── bttvEmotes, seventvEmotes, ffzEmotes: Map
    └── roomId, chatId, continuation, etc. (platform-specific)

addSlot() → creates new slot, renders UI, caps at MAX_FEEDS
removeSlot(slotId) → disconnects and removes slot
connectSlot(slotId) → dispatches to connectTwitch/Kick/YouTube/Rumble
disconnectSlot(slotId) → closes WS/polling, clears state
switchSlotPlatform(slotId, platform) → changes platform for a slot
mergeAllEmotes() → merges emotes across all active slots
updateGlobalStatus() → aggregates slot statuses into status bar
```

### Sentiment Analysis Engine

- **12 moods**: hype, funny, love, toxic, sad, calm, angry, excited, cringe, wholesome, confused, neutral
- **~200 keyword terms** with mood + weight + label mappings
- **~70 approval/dissent terms** with signed weights
- **Classification**: Linear scan of all keywords via `String.includes()` — O(terms × msgLength)
- **Length multiplier**: Longer messages get higher weight (0.5x–1.35x)
- **Caps detection**: >65% uppercase → +0.6 toxic, 1.4x approval multiplier
- **EWMA decay**: Configurable half-life (1–60s), exponential weight `e^(-age × 0.693/halfLife)`

### Bot Detection

Multi-criteria scoring (threshold: 60/100):
- Known bot username list (instant 100)
- Username heuristics (suffix "bot", prefix "bot", long numbers, generic patterns)
- Message heuristics (! commands, URLs, word repetition, extreme length, non-alphanumeric ratio)
- Behavioral profiling per user over 60s window (message rate, hash repetition, length variance)

---

## Identified Issues by Priority

### Critical

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| ~~C1~~ | ~~Dead modular code~~ — **resolved 2026-04**: refactor complete, root `app.js`/`styles.css` removed | — | — |
| ~~C2~~ | ~~Monolithic app.js~~ — **resolved 2026-04**: split into `js/ui/*`, `js/platform/*`, `js/utils/*`, `js/analysis/*` | — | — |
| C3 | UI tests missing | Entire UI | vitest covers `js/analysis/*` + `js/utils/*` only |

### High

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| H1 | Default password is "password" (hash exposed) | `index.html:55` | Auth gate is theater |
| H2 | No build system or dependency management | Root | No linting, minification, or version control |
| H3 | O(n×m) sentiment classification per message | `classifyMessage()` | CPU bottleneck at scale |
| H4 | 3× duplicated CORS proxy logic | `connectKick/YouTube/Rumble` | Maintenance burden |
| H5 | 20+ empty catch blocks (swallowed errors) | Throughout `app.js` | Silent failures |

### Medium

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| M1 | OAuth token in plain localStorage | `app.js` | XSS exfiltration risk |
| M2 | Array.shift() O(n) in processing hot path | `processingLoop` | Micro-perf at scale |
| M3 | No CSP or SRI on CDN scripts | `index.html` | Supply-chain risk |
| M4 | innerHTML with third-party emote URLs | `renderEmotes()` | Potential XSS vector |
| M5 | README outdated (only mentions Twitch) | `README.md` | Poor onboarding |

### Low

| # | Issue | Location | Impact |
|---|-------|----------|--------|
| L1 | Manual service-worker revision bumping | `service-worker.js` | Stale assets risk |
| L2 | `prompt()` for Rumble proxy URL | `app.js:2996` | Blocking UX |
| L3 | No structured logging | Throughout | Hard to debug in production |

---

## Strengths

1. **Feature richness** — 12-mood analysis, 4 platforms, 6 visualizations, 30+ settings, drag-and-drop layout
2. **Multi-feed architecture** — Up to 10 simultaneous connections with per-slot status
3. **Excellent PWA setup** — Thorough Workbox config with per-content-type caching strategies
4. **Custom physics engine** — Spring-gravity bubble simulation with collision detection
5. **Domain expertise** — Sentiment dictionary and EWMA model are well-tuned for chat dynamics
6. **Clean CSS architecture** — Modular stylesheets with design tokens and CSS custom properties
7. **Thoughtful UX** — Decay recommendations, mood shift alerts, outlier detection, CRT effects

---

## Elevation Roadmap

### Phase 1: Quick Wins (1-2 days)

- [x] Remove dead `styles.css` (done — the root-level styles.css is gone)
- [ ] Add SRI integrity hashes to CDN script tags
- [ ] Add security warning / change default auth gate password hash
- [ ] Update README to reflect multi-platform support
- [ ] Add `package.json` with ESLint + Prettier

### Phase 2: Testing Foundation (3-5 days)

- [ ] Extract pure analysis functions from monolith into testable modules
- [ ] Add Vitest or Jest with characterization tests for:
  - `classifyMessage()` — mood classification accuracy
  - EWMA decay math
  - Approval scoring
  - Bot detection thresholds
- [ ] Add GitHub Actions CI for lint + test

### Phase 3: Complete Modular Refactor (1-2 weeks)

- [ ] Port multi-connection slot system to ES module architecture
- [ ] Wire processing loop and message callbacks in `js/app.js`
- [ ] Add tablet/first-visit detection to modules
- [ ] Verify feature parity with monolith
- [ ] Switch `index.html` to `<script type="module" src="/js/app.js">`
- [ ] Remove monolith `app.js`

### Phase 4: Performance & Security (1 week)

- [ ] Build trie/Aho-Corasick automaton for O(m) sentiment matching
- [ ] Replace `Array.shift()` with circular buffers in hot paths
- [ ] Add Content Security Policy meta tag
- [ ] Extract shared CORS proxy utility (eliminate 3× duplication)
- [ ] Add structured error handling (replace empty catch blocks)

### Phase 5: Build & Deploy Pipeline (3-5 days)

- [ ] Add Vite for dev server + production builds
- [ ] Auto-generate SRI hashes and service-worker revisions
- [ ] Add minification and optional bundling
- [ ] Set up GitHub Actions for automated deploy

---

## File Reference

All active code lives under `js/`, `css/`, and the root PWA trio. The pre-2026
monolithic `app.js` + `styles.css` at the repo root have been removed.

| Path | Purpose |
|------|---------|
| `index.html` | SPA entry, auth gate, full UI markup |
| `js/app.js` | ES module entry — `window.onload` wire-up |
| `js/config.js` | Storage keys, DEFAULT_OPTIONS, HELP_CONTENT, keyword dictionaries |
| `js/state.js` | Centralized mutable state |
| `js/processing.js` | Message queue + processing loop |
| `js/analysis/*` | Pure analysis (EWMA, sentiment, approval, bot, topWords) — has vitest tests |
| `js/platform/*` | ConnectionManager + per-platform adapters + emotes |
| `js/ui/*` | UI modules — see tree above |
| `js/utils/settings.js` | Unified settings API with event bus + migration |
| `js/utils/storage.js` | localStorage JSON helpers |
| `js/utils/CircularBuffer.js` | Fixed-size ring buffer |
| `css/main.css` | CSS import aggregator |
| `css/tokens.css` | Design tokens + global slider touch-select rules |
| `css/modal.css` | Shared modal/drawer base (`.mr-overlay/.mr-modal/.mr-drawer`) |
| `css/options-drawer.css` | Options Drawer panel |
| `css/*.css` | Layout, header, connect, cards, feeds, presets, etc. |
| `manifest.json`, `service-worker.js`, `install-prompt.js` | PWA trio |
