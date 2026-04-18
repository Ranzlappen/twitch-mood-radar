# Mood Radar

[twitch-mood-radar.ranzlappen.com](https://twitch-mood-radar.ranzlappen.com/)

### Real-time Multi-Platform Chat Mood Analyzer

Analyzes the emotional tone of live chat across Twitch, Kick, YouTube, and Rumble in real time. Connect up to 10 simultaneous feeds and visualize chat mood through interactive charts, bubbles, timelines, and more.

<a href="https://ko-fi.com/F1F1140LWT"><img src="https://storage.ko-fi.com/cdn/kofi2.png?v=6" alt="Buy Me a Coffee at ko-fi.com" height="36"></a>

## Key Features

- **Multi-platform support** — Twitch (IRC WebSocket), Kick (Pusher), YouTube (Innertube), Rumble (REST polling)
- **Up to 10 simultaneous feeds** — monitor multiple streams at once
- **12-mood sentiment analysis** — hype, funny, love, toxic, sad, calm, angry, excited, cringe, wholesome, confused, neutral
- **Approval/dissent meter** — tracks chat agreement vs pushback separately from mood
- **6 visualization types:**
  - Mood pie chart with inline labels
  - Radar/spiderweb mood web
  - Consensus bubbles (custom canvas physics engine)
  - Approval gauge with mini-bar history
  - Timeline charts (linear, logarithmic, approval, throughput)
  - Live feeds (main, filtered, standout messages) with Twitch-style sticky-bottom scroll — scrolling up pauses auto-scroll and shows a "Chat Paused — click to resume" pill
  - **Filtered feed editor** — click the `FILTER` pill on the filtered feed to open a modal with two combinable fields: a case-insensitive message regex and a username-contains substring (suggested from chatters seen so far). A live preview counts matches and shows recent hits while you type; Apply persists the filter across reloads. Saved filters (up to 20) can be re-applied or deleted
- **Bot detection** — multi-criteria scoring with behavioral profiling
- **Per-user message history** — click any chatter's name to open a modal with every message they've posted. Stored in IndexedDB (mobile-friendly defaults: 14 days / 50k rows, configurable), scoped per channel + platform, with "All channels" and "Show bot messages" toggles
- **30+ customization options** — density presets, drag-and-drop layout, CRT effects, font scaling
- **PWA** — installable, works offline, screen wake lock
- **Auto-reconnect** with per-slot status tracking

## Tech Stack

- Vanilla HTML/CSS/JS (ES modules)
- Chart.js v4.4.1 (CDN)
- Workbox 7.3.0 (service worker)
- IndexedDB for persistent per-user message history
- Vitest (85 tests), ESLint, Prettier

## How to Use

Open `index.html` in any browser. Select a platform, enter a channel name, and click Connect. Add more feeds with the "+ Add Feed" button.

## Message History Storage

Every message the page ingests is logged to a browser-local database so you can click a username at any time and review every line they've posted — even from previous sessions.

### Where it lives

Nothing is ever sent to a server. Two layers are used, each with a different purpose:

| Layer | What it holds | Typical size | Cleared by |
|---|---|---|---|
| **`localStorage`** | UI settings only (font sizes, layout, presets, active filter + saved filter history, OAuth token, retention settings) | a few KB | browser site-data wipe |
| **IndexedDB** (`moodradar_history_v1`) | The full per-user chat log | bounded — see defaults below | retention pruning, per-user Clear, global Clear All |

The history database is visible in DevTools → **Application → Storage → IndexedDB → `moodradar_history_v1` → `messages`**. You can inspect or export it from there if you want.

### Schema

Each message is stored as one record in the `messages` object store:

```js
{
  id: <auto-increment>,
  user: "DisplayName",          // as rendered in the feed (sanitized)
  userKey: "displayname",       // lowercased — used for lookups
  msg:  "the message text",
  ts:   1713456789012,          // epoch ms
  platform: "twitch" | "kick" | "youtube" | "rumble",
  channel: "xqc",               // the slot's channel at ingest time
  mood: "hype" | "funny" | ... | "neutral",
  approvalVote: +2.5,           // -8..+8, same scale as the approval meter
  botScore: 0,                  // 0..99
  isBot: false
}
```

Three indexes power the queries:

- `userKey` — all messages for a user across every channel (powers the "All channels" toggle)
- `ts` — timestamp-ordered (powers age-based retention pruning)
- `user_channel_ts` on `[userKey, channel, platform, ts]` — compound index that makes the default "this channel" modal view fast, even with hundreds of thousands of rows

### Write path

Writes are **batched**, not per-message, so a 50-msg/sec channel doesn't cause a disk transaction on every frame:

1. Every processed message (including bot-flagged ones, with `isBot: true`) is pushed into an in-memory queue.
2. The queue flushes to IndexedDB every **3 seconds**, or immediately when it reaches **500 records**, whichever comes first.
3. A `visibilitychange → hidden` listener force-flushes when you background the tab, so closing the tab loses at most a few seconds of buffered records.

### Retention & quota

Defaults are tuned for mobile — the app is installable as a PWA and iOS Safari enforces a ~50 MB quota until the user grants more.

- **14 days** of history, capped at **50,000 rows** (whichever limit hits first).
- A prune job runs 60 seconds after startup and then every 30 minutes: it deletes records older than the retention cutoff, then trims the oldest rows until `count ≤ max`.
- If a write ever fails with `QuotaExceededError`, the oldest 20% of records are deleted and the batch is retried once.
- Both limits are adjustable in **Options → User History (IndexedDB)**: retain 1–90 days, 5k–500k rows.

### Disabling or clearing

- **Options → User History → "Log messages per-user"** — uncheck to stop logging entirely. Existing records stay until pruned.
- **Inside a user's history modal** — "Clear this user" wipes just that chatter (scoped to the current channel or globally, matching the scope toggle above).
- **Options → User History → "CLEAR ALL HISTORY"** — empties the entire `messages` store after a confirmation prompt.
- Note: the existing **Flush Data** button on the header only clears the in-memory runtime state (charts, queues, counters). It deliberately does not touch the history database, so you can reset the live visuals without losing your chat log.

### Privacy

Everything described above stays in **your browser on your device**. The service worker caches static assets only. Chat messages never transit any server that this app runs. Clearing site data in your browser settings (or the "CLEAR ALL HISTORY" button) removes the log permanently.

## Development

```bash
npm install          # install dev dependencies
npm test             # run 85 characterization tests
npm run lint         # lint JS modules
npm run format       # format with Prettier
```

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for a detailed codebase overview, data flow diagrams, and elevation roadmap.

## Credit

Made by [ranzlappen](https://github.com/ranzlappen)
