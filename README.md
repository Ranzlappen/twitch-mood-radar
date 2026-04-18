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
  - Live feeds (main, regex-filtered, standout messages) with Twitch-style sticky-bottom scroll — scrolling up pauses auto-scroll and shows a "Chat Paused — click to resume" pill
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
