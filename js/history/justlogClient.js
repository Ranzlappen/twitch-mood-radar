/**
 * justlogClient.js — thin read-only client for a Justlog instance
 * (default https://logs.ivr.fi).
 *
 * Why this exists: Twitch has no Helix/IRC endpoint for a user's historical
 * chat messages. Justlog is a third-party IRC-logging bot with a JSON API;
 * calling it is the only way the user-history modal can show messages from
 * beyond what this client has locally witnessed.
 *
 * Traffic discipline:
 * - Every call is triggered by an explicit user click. Never auto-fired.
 * - One call per channel per search. Channels are queried sequentially
 *   (not in parallel) so a 5-channel search looks like normal browsing.
 * - `/list` is fetched at most once per session (cached in `_listPromise`).
 * - Per-(user, channel) results are cached in `_channelCache` for the
 *   session so toggling the scope radio or reopening the same user is free.
 * - Callers pass an AbortSignal; on modal close we abort in-flight work.
 */
import { JUSTLOG_BASE_URL, JUSTLOG_PAGE_LIMIT } from '../config.js';

const CLIENT_HEADER = { 'X-Client': 'twitch-mood-radar' };

let _listPromise = null;                    // Promise<Set<string>> of logged channels
const _channelCache = new Map();            // `${userKey}|${channel}` → Array<normalisedRow>

/**
 * Fetch the list of channels this justlog instance logs. Returns a Set of
 * lowercased channel names. Cached for the lifetime of the tab.
 *
 * Shape returned by /list:
 *   { channels: [ { userID, name }, ... ] }
 */
export function listChannels() {
  if (_listPromise) return _listPromise;
  _listPromise = (async () => {
    try {
      const res = await fetch(`${JUSTLOG_BASE_URL}/list`, { headers: CLIENT_HEADER });
      if (!res.ok) return new Set();
      const data = await res.json();
      const channels = Array.isArray(data && data.channels) ? data.channels : [];
      const out = new Set();
      for (const c of channels) {
        const n = (c && c.name ? String(c.name) : '').toLowerCase();
        if (n) out.add(n);
      }
      return out;
    } catch {
      // Clear the cached failure so a later search can retry.
      _listPromise = null;
      return new Set();
    }
  })();
  return _listPromise;
}

/**
 * Translate a justlog HTTP response into the same row shape the user-history
 * modal uses for local IndexedDB results, so the same render pipeline can
 * display both without branching.
 *
 * Only PRIVMSGs are kept — CLEARCHAT / USERNOTICE entries are metadata.
 */
function _normaliseMessages(raw, { channel }) {
  const msgs = Array.isArray(raw && raw.messages) ? raw.messages : [];
  const out = [];
  for (const m of msgs) {
    if (!m) continue;
    if (m.type && m.type !== 'PRIVMSG' && m.type !== 1) continue;
    const tsMs = Date.parse(m.timestamp);
    if (!isFinite(tsMs)) continue;
    const user = String(m.displayName || m.username || '').trim();
    if (!user) continue;
    out.push({
      user,
      userKey: (m.username || user).toLowerCase(),
      msg: String(m.text || ''),
      ts: tsMs,
      platform: 'twitch',
      channel: String(m.channel || channel || '').toLowerCase(),
      mood: null,
      approvalVote: 0,
      botScore: 0,
      isBot: false,
      badges: [],
      _source: 'justlog',
    });
  }
  return out;
}

/**
 * Fetch a user's full history in a single channel, newest-first. Paginates
 * internally via `from`/`to` unix-second windows until either `limit` rows
 * are collected or justlog returns fewer than a page's worth (i.e. no older
 * data exists).
 *
 * Resolves to `{ rows, status }` where status is one of:
 *   'ok' | 'not_logged' | 'opted_out' | 'not_found' | 'error' | 'aborted'
 */
export async function fetchUserInChannel(user, channel, opts = {}) {
  const { signal, limit = JUSTLOG_PAGE_LIMIT } = opts;
  const userKey = String(user || '').toLowerCase();
  const chanKey = String(channel || '').toLowerCase();
  if (!userKey || !chanKey) return { rows: [], status: 'error' };

  const cacheKey = `${userKey}|${chanKey}`;
  const cached = _channelCache.get(cacheKey);
  if (cached) return { rows: cached.slice(0, limit), status: cached._status || 'ok' };

  const logged = await listChannels();
  if (logged.size > 0 && !logged.has(chanKey)) {
    const empty = [];
    empty._status = 'not_logged';
    _channelCache.set(cacheKey, empty);
    return { rows: [], status: 'not_logged' };
  }

  // Justlog returns newest-first with ?reverse=true. Pagination works by
  // moving the `to` cursor to the oldest ts seen, minus one second. When a
  // response is empty or shorter than a full batch we've exhausted history.
  const collected = [];
  let toCursor = null;
  let terminalStatus = 'ok';

  for (let page = 0; page < 20; page++) {
    if (signal && signal.aborted) return { rows: collected, status: 'aborted' };

    const url = new URL(`${JUSTLOG_BASE_URL}/channel/${encodeURIComponent(chanKey)}/user/${encodeURIComponent(userKey)}`);
    url.searchParams.set('json', '1');
    url.searchParams.set('reverse', 'true');
    if (toCursor != null) url.searchParams.set('to', String(toCursor));

    let res;
    try {
      res = await fetch(url.toString(), { headers: CLIENT_HEADER, signal });
    } catch (err) {
      if (err && err.name === 'AbortError') return { rows: collected, status: 'aborted' };
      terminalStatus = 'error';
      break;
    }

    if (res.status === 403) { terminalStatus = 'opted_out'; break; }
    if (res.status === 404) { terminalStatus = page === 0 ? 'not_found' : 'ok'; break; }
    if (!res.ok) { terminalStatus = 'error'; break; }

    let data;
    try { data = await res.json(); }
    catch { terminalStatus = 'error'; break; }

    const pageRows = _normaliseMessages(data, { channel: chanKey });
    if (!pageRows.length) break;

    collected.push(...pageRows);
    if (collected.length >= limit) break;

    const oldest = pageRows[pageRows.length - 1].ts;
    const nextTo = Math.floor(oldest / 1000) - 1;
    if (toCursor != null && nextTo >= toCursor) break; // no progress, bail
    toCursor = nextTo;

    if (pageRows.length < 50) break; // partial page → reached start
  }

  const capped = collected.slice(0, limit);
  capped._status = terminalStatus;
  _channelCache.set(cacheKey, capped);
  return { rows: capped, status: terminalStatus };
}

/**
 * Run `fetchUserInChannel` across a list of channels sequentially. Fires
 * `onChannelStatus({ channel, status, count })` before and after each call
 * so the UI can stream progress.
 *
 * Results from all channels are merged and sorted newest-first. We run
 * sequentially (not in parallel) to keep burst traffic polite.
 */
export async function fetchUserAcrossChannels(user, channels, opts = {}) {
  const { signal, onChannelStatus } = opts;
  const merged = [];
  for (const ch of channels) {
    if (signal && signal.aborted) break;
    if (onChannelStatus) onChannelStatus({ channel: ch, status: 'loading', count: 0 });
    const { rows, status } = await fetchUserInChannel(user, ch, { signal });
    merged.push(...rows);
    if (onChannelStatus) onChannelStatus({ channel: ch, status, count: rows.length });
  }
  merged.sort((a, b) => b.ts - a.ts);
  return merged;
}

/** Drop the per-session cache. Exposed for debugging; not called from UI. */
export function _resetJustlogCache() {
  _listPromise = null;
  _channelCache.clear();
}
