# Architecture Review & Elevation Roadmap

> **Date**: 2026-04-15
> **Scope**: Full codebase architecture review
> **Status**: Initial assessment complete

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

## Critical Architectural Finding: Dead Module Tree

### The Problem

The repository contains **two copies** of the application logic:

1. **`app.js`** (root, 4,208 lines) — The **active** monolithic file loaded by `index.html:632` via `<script src="app.js">`. This is what runs in production.

2. **`js/`** directory (20+ ES module files) — A **dead** modular refactor that is **never loaded**. `index.html` does not reference it. These files use ES module `import`/`export` syntax but are not loaded via `<script type="module">`.

Additionally, **`styles.css`** (1,238 lines) at root is dead — `index.html` loads `css/main.css` (the modular CSS) instead.

**Total dead code: ~5,450 lines.**

### Why the Modules Can't Simply Replace the Monolith

The modular `js/` tree represents an **earlier, incomplete refactoring** of the monolith. The monolith has since evolved significantly. Key gaps:

| Feature | Monolith (`app.js`) | Modules (`js/`) |
|---------|---------------------|-----------------|
| Multi-connection slots (up to 10 feeds) | ✅ Full implementation | ❌ Single adapter only |
| Processing loop startup | ✅ `processingLoop()` called via `requestAnimationFrame` | ❌ Imports non-existent `startProcessingLoop` |
| Message pipeline wiring | ✅ `enqueue()` called directly in message handlers | ❌ `adapter.onMessage()` never connected |
| Per-slot status bar | ✅ `setSlotStatus()` + `updateGlobalStatus()` | ❌ Only simple `setStatus()` |
| Multi-source emote merging | ✅ `mergeAllEmotes()` across all active slots | ❌ Single adapter emotes only |
| Tablet/first-visit detection | ✅ Layout defaults for tablets | ❌ Missing entirely |
| Slot-scoped DOM IDs | ✅ `channelInput_N`, `slotConnectBtn_N`, etc. | ❌ Single-instance IDs only |

### Recommended Path Forward

**Option A (Recommended): Complete the modular refactor** by porting the multi-connection slot system from the monolith into the ES module tree. Then switch `index.html` to load the modules.

**Option B: Modernize the monolith in-place** — add linting, extract the most critical functions, add tests around the analysis pipeline.

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
| C1 | Dead modular code (5,450 lines) never loaded | `js/`, `styles.css` | Confuses contributors, repo bloat |
| C2 | 4,208-line monolith with 100+ globals | `app.js` | Untestable, high regression risk |
| C3 | Zero tests | Entire project | No safety net for changes |

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

- [ ] Remove dead `styles.css` (confirmed not loaded)
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

### Active (Running in Production)

| File | Lines | Purpose |
|------|-------|---------|
| `index.html` | 643 | SPA entry, auth gate, full UI markup |
| `app.js` | 4,208 | **Monolith** — all application logic |
| `css/main.css` | 11 | CSS import aggregator |
| `css/tokens.css` | 82 | Design tokens / CSS variables |
| `css/layout.css` | 47 | App container layout |
| `css/header.css` | 119 | Header, title, status bar |
| `css/connect.css` | 238 | Connection UI, platform tabs |
| `css/cards.css` | 163 | Card containers, resize handles |
| `css/feeds.css` | 123 | Live feed styling |
| `css/presets.css` | 163 | Layout presets |
| `css/options-drawer.css` | 137 | Options drawer panel |
| `css/layout-mgr.css` | 173 | Drag-and-drop layout manager |
| `css/chat-input.css` | 102 | Chat input + emote picker |
| `manifest.json` | 30 | PWA manifest |
| `service-worker.js` | 147 | Workbox precaching + runtime |
| `install-prompt.js` | 16 | PWA install prompt |

### Dead Code (Not Loaded)

| File/Dir | Lines | Status |
|----------|-------|--------|
| `styles.css` | 1,238 | Dead — `index.html` loads `css/main.css` instead |
| `js/` directory | ~4,200 | Dead — `index.html` loads root `app.js` instead |
