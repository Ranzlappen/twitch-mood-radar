/**
 * supabaseSync.js — push unsynced IndexedDB rows to the server archive.
 *
 * Architecture:
 *   IDB writes happen on the hot path (processing.js → enqueueHistory).
 *   This module is a separate slow loop that periodically wakes up, drains a
 *   bounded batch of unsynced rows, requests a fresh Cloudflare Turnstile
 *   token, POSTs the batch to the Supabase Edge Function, and on 2xx flips
 *   those rows to synced=1.
 *
 * Configuration is read at runtime from /config.runtime.json (so the same
 * deployed bundle can target different Supabase projects across forks). If
 * the file is absent or `supabase.url` is empty the sync loop never starts
 * and the app behaves exactly as before — IDB-only, no network traffic.
 *
 * Dedup story (recap):
 *   Layer 1 — IDB enqueue: same row never queued twice within a session.
 *   Layer 2 — this batch: we Map by `${platform}|${msgId}` before posting in
 *             case the unsynced cursor returned the same logical message via
 *             two different IDB rows (shouldn't happen, but cheap guard).
 *   Layer 3 — Postgres PK on (platform, msg_id) + ignoreDuplicates makes
 *             cross-client collisions silent no-ops.
 */
import { queryUnsynced, markSynced } from './historyDb.js';
import {
  SUPABASE_SYNC_BATCH, SUPABASE_SYNC_INTERVAL_MS, SUPABASE_SYNC_MAX_RETRY_MS,
  SUPABASE_CLIENT_ID_KEY, SUPABASE_SYNC_ENABLED_KEY,
} from '../config.js';
import { load, save, loadRaw } from '../utils/storage.js';

let _runtime = null;       // { supabase: { url, ingestPath }, turnstile: { siteKey } }
let _timer = null;
let _running = false;
let _backoffMs = SUPABASE_SYNC_INTERVAL_MS;
let _clientId = null;

function _getClientId() {
  if (_clientId) return _clientId;
  let v = loadRaw(SUPABASE_CLIENT_ID_KEY, '');
  if (!v) {
    v = (typeof crypto !== 'undefined' && crypto.randomUUID)
      ? crypto.randomUUID()
      : 'c_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
    try { localStorage.setItem(SUPABASE_CLIENT_ID_KEY, v); } catch { /* ignore */ }
  }
  _clientId = v;
  return v;
}

/**
 * Whether the user has opted in to upstream sync. Defaults to false so the
 * app stays purely local until the user flips a switch.
 */
export function isSupabaseSyncEnabled() {
  return load(SUPABASE_SYNC_ENABLED_KEY, false) === true;
}

export function setSupabaseSyncEnabled(v) {
  const on = !!v;
  save(SUPABASE_SYNC_ENABLED_KEY, on);
  if (on) startSupabaseSync();
  else stopSupabaseSync();
}

/**
 * Load runtime config (URL + Turnstile site key) from a static JSON file.
 * Resolves to null if the file is absent or malformed — the caller should
 * treat that as "sync disabled" and skip starting the loop.
 */
async function _loadRuntimeConfig() {
  if (_runtime) return _runtime;
  try {
    const res = await fetch('/config.runtime.json', { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.supabase || !data.supabase.url || !data.turnstile || !data.turnstile.siteKey) {
      return null;
    }
    _runtime = data;
    return _runtime;
  } catch {
    return null;
  }
}

/**
 * Ask Cloudflare Turnstile for a fresh token. We render an invisible widget
 * once per batch — the implicit "managed" mode auto-solves for most users
 * and presents a challenge only if the visitor looks suspicious.
 *
 * Resolves to null on any failure (script not loaded, widget timed out, user
 * dismissed the challenge). The caller should skip this batch on null.
 */
function _getTurnstileToken(siteKey) {
  return new Promise((resolve) => {
    const ts = window.turnstile;
    if (!ts) { resolve(null); return; }

    let host = document.getElementById('mr-turnstile-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'mr-turnstile-host';
      host.style.position = 'fixed';
      host.style.bottom = '8px';
      host.style.right = '8px';
      host.style.zIndex = '999';
      // Invisible by default — Turnstile injects an iframe sized 0×0 in
      // managed mode unless a real challenge is required, in which case the
      // widget grows to its native size and the user sees the challenge.
      document.body.appendChild(host);
    }

    let resolved = false;
    let widgetId = null;
    const timeout = setTimeout(() => {
      if (resolved) return;
      resolved = true;
      try { if (widgetId != null) ts.remove(widgetId); } catch { /* ignore */ }
      resolve(null);
    }, 30_000);

    try {
      widgetId = ts.render(host, {
        sitekey: siteKey,
        size: 'invisible',
        callback: (token) => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          resolve(token);
          // Token is single-use — clean up so the next batch gets a fresh one.
          try { ts.remove(widgetId); } catch { /* ignore */ }
        },
        'error-callback': () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          try { ts.remove(widgetId); } catch { /* ignore */ }
          resolve(null);
        },
        'timeout-callback': () => {
          if (resolved) return;
          resolved = true;
          clearTimeout(timeout);
          try { ts.remove(widgetId); } catch { /* ignore */ }
          resolve(null);
        },
      });
      // Some Turnstile versions resolve the invisible challenge implicitly
      // (no explicit execute() call needed). Others need execute(). Calling
      // it on invisible widgets is a no-op when not required.
      try { ts.execute(widgetId); } catch { /* ignore */ }
    } catch {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve(null);
      }
    }
  });
}

/**
 * Translate IDB rows into the wire shape the Edge Function expects. Keep the
 * field names matching the Postgres column names so the function can splat
 * them straight into upsert().
 */
function _toWire(rec) {
  return {
    platform: rec.platform || '',
    msg_id: rec.msgId,
    channel: (rec.channel || '').toLowerCase(),
    user_login: (rec.userKey || rec.user || '').toLowerCase(),
    user_display: rec.user || null,
    user_id: rec.userId || null,
    text: rec.msg || '',
    ts: rec.ts,
    badges: rec.badges ?? null,
    mood: rec.mood || null,
    approval_vote: typeof rec.approvalVote === 'number' ? rec.approvalVote : null,
    bot_score: typeof rec.botScore === 'number' ? rec.botScore : null,
    is_bot: !!rec.isBot,
  };
}

async function _runOnce() {
  if (_running) return;
  if (!isSupabaseSyncEnabled()) return;
  const cfg = await _loadRuntimeConfig();
  if (!cfg) return;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return;

  _running = true;
  try {
    const rows = await queryUnsynced(SUPABASE_SYNC_BATCH);
    if (!rows.length) { _backoffMs = SUPABASE_SYNC_INTERVAL_MS; return; }

    // Layer-2 in-batch dedup. Same logical message landing in IDB twice would
    // be a bug elsewhere, but the cost of a Map check is negligible.
    const wireById = new Map();
    const idsByKey = new Map();
    for (const r of rows) {
      const k = `${r.platform || ''}|${r.msgId}`;
      if (!wireById.has(k)) wireById.set(k, _toWire(r));
      if (!idsByKey.has(k)) idsByKey.set(k, []);
      idsByKey.get(k).push(r.id);
    }
    const messages = Array.from(wireById.values());

    const token = await _getTurnstileToken(cfg.turnstile.siteKey);
    if (!token) {
      _backoffMs = Math.min(SUPABASE_SYNC_MAX_RETRY_MS, _backoffMs * 2);
      return;
    }

    const ingestUrl = cfg.supabase.url.replace(/\/$/, '') +
      (cfg.supabase.ingestPath || '/functions/v1/ingest');

    let res;
    try {
      res = await fetch(ingestUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ turnstileToken: token, clientId: _getClientId(), messages }),
      });
    } catch (err) {
      console.warn('[supabaseSync] network failure', err);
      _backoffMs = Math.min(SUPABASE_SYNC_MAX_RETRY_MS, _backoffMs * 2);
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.warn('[supabaseSync]', res.status, text);
      // 4xx is a permanent failure for the current batch (bad data, bad
      // turnstile, etc.) — don't keep retrying it; mark the rows synced so
      // we move on. 5xx + 429 we back off and retry the same rows.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const allIds = [];
        for (const ids of idsByKey.values()) allIds.push(...ids);
        await markSynced(allIds);
      } else {
        _backoffMs = Math.min(SUPABASE_SYNC_MAX_RETRY_MS, _backoffMs * 2);
      }
      return;
    }

    // Success — flip every row in this batch to synced=1. We do this
    // unconditionally rather than per-row because the server collapses
    // duplicates silently and either way the row is now "in the archive".
    const allIds = [];
    for (const ids of idsByKey.values()) allIds.push(...ids);
    await markSynced(allIds);
    _backoffMs = SUPABASE_SYNC_INTERVAL_MS;
  } catch (err) {
    console.warn('[supabaseSync] loop error', err);
    _backoffMs = Math.min(SUPABASE_SYNC_MAX_RETRY_MS, _backoffMs * 2);
  } finally {
    _running = false;
  }
}

function _scheduleNext() {
  if (_timer) return;
  if (!isSupabaseSyncEnabled()) return;
  _timer = setTimeout(async () => {
    _timer = null;
    await _runOnce();
    _scheduleNext();
  }, _backoffMs);
}

/**
 * Start the sync loop. Idempotent. Does nothing if the user hasn't enabled
 * sync or if /config.runtime.json is missing. Caller is the app bootstrap.
 */
export async function startSupabaseSync() {
  if (_timer) return;
  if (!isSupabaseSyncEnabled()) return;
  const cfg = await _loadRuntimeConfig();
  if (!cfg) {
    console.info('[supabaseSync] no /config.runtime.json — sync disabled');
    return;
  }
  _backoffMs = SUPABASE_SYNC_INTERVAL_MS;
  _scheduleNext();
}

export function stopSupabaseSync() {
  if (_timer) { clearTimeout(_timer); _timer = null; }
}
