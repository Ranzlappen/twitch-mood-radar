/**
 * historyDb.js — IndexedDB-backed per-user message log.
 *
 * Buffers writes (FLUSH_MS / FLUSH_BATCH) so the high-throughput processing
 * loop never blocks on per-message I/O. Provides indexed lookups by user
 * (optionally scoped by channel + platform), retention pruning, and quota
 * recovery. All public methods are no-ops if the DB failed to open or if
 * history is disabled in settings.
 */
import {
  HISTORY_DB_NAME, HISTORY_DB_VERSION, HISTORY_DB_STORE,
  HISTORY_FLUSH_MS, HISTORY_FLUSH_BATCH,
  HISTORY_PRUNE_INTERVAL_MS, HISTORY_QUOTA_TRIM_FRACTION,
  HISTORY_RETENTION_DAYS_KEY, HISTORY_MAX_ROWS_KEY, HISTORY_ENABLED_KEY,
  DEFAULT_HISTORY_RETENTION_DAYS, DEFAULT_HISTORY_MAX_ROWS,
} from '../config.js';
import { load, save } from '../utils/storage.js';

const IDX_USER = 'userKey';
const IDX_TS = 'ts';
const IDX_USER_CHANNEL_TS = 'user_channel_ts';

let _db = null;
let _opening = null;
const _queue = [];
let _flushTimer = null;
let _flushing = false;
let _pruneTimer = null;

export function isHistoryEnabled() {
  const v = load(HISTORY_ENABLED_KEY, true);
  return v !== false;
}

export function setHistoryEnabled(v) {
  save(HISTORY_ENABLED_KEY, !!v);
}

export function getRetentionDays() {
  const v = parseInt(load(HISTORY_RETENTION_DAYS_KEY, DEFAULT_HISTORY_RETENTION_DAYS), 10);
  return isFinite(v) && v > 0 ? Math.min(365, v) : DEFAULT_HISTORY_RETENTION_DAYS;
}

export function setRetentionDays(v) {
  const n = Math.min(365, Math.max(1, parseInt(v, 10) || DEFAULT_HISTORY_RETENTION_DAYS));
  save(HISTORY_RETENTION_DAYS_KEY, n);
  return n;
}

export function getMaxRows() {
  const v = parseInt(load(HISTORY_MAX_ROWS_KEY, DEFAULT_HISTORY_MAX_ROWS), 10);
  return isFinite(v) && v > 0 ? Math.min(2_000_000, v) : DEFAULT_HISTORY_MAX_ROWS;
}

export function setMaxRows(v) {
  const n = Math.min(2_000_000, Math.max(1000, parseInt(v, 10) || DEFAULT_HISTORY_MAX_ROWS));
  save(HISTORY_MAX_ROWS_KEY, n);
  return n;
}

function _open() {
  if (_db) return Promise.resolve(_db);
  if (_opening) return _opening;
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);

  _opening = new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(HISTORY_DB_NAME, HISTORY_DB_VERSION); }
    catch { resolve(null); return; }

    req.onupgradeneeded = (e) => {
      const db = req.result;
      const oldVersion = e.oldVersion;
      if (oldVersion < 1) {
        const store = db.createObjectStore(HISTORY_DB_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex(IDX_USER, 'userKey', { unique: false });
        store.createIndex(IDX_TS, 'ts', { unique: false });
        store.createIndex(IDX_USER_CHANNEL_TS, ['userKey', 'channel', 'platform', 'ts'], { unique: false });
      }
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => { resolve(null); };
    req.onblocked = () => { resolve(null); };
  });
  return _opening;
}

/**
 * Initialize the history DB and start the periodic prune timer.
 * Safe to call multiple times.
 */
export async function initHistoryDb() {
  await _open();
  if (!_db) return;

  if (!_pruneTimer) {
    setTimeout(() => { prune().catch(() => {}); }, 60_000);
    _pruneTimer = setInterval(() => { prune().catch(() => {}); }, HISTORY_PRUNE_INTERVAL_MS);
  }

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushQueue().catch(() => {});
      }
    });
  }
}

/**
 * Queue a message record for write. Records are flushed in batches to keep
 * the processing loop's main-thread cost negligible.
 */
export function enqueueHistory(rec) {
  if (!isHistoryEnabled()) return;
  if (!rec || !rec.userKey) return;
  _queue.push(rec);
  if (_queue.length >= HISTORY_FLUSH_BATCH) {
    flushQueue().catch(() => {});
    return;
  }
  if (!_flushTimer) {
    _flushTimer = setTimeout(() => {
      _flushTimer = null;
      flushQueue().catch(() => {});
    }, HISTORY_FLUSH_MS);
  }
}

export async function flushQueue() {
  if (_flushing) return;
  if (_queue.length === 0) return;
  const db = await _open();
  if (!db) { _queue.length = 0; return; }

  _flushing = true;
  const batch = _queue.splice(0, _queue.length);

  try {
    await _writeBatch(db, batch);
  } catch (err) {
    if (err && (err.name === 'QuotaExceededError' || err.code === 22)) {
      try {
        await prune({ trimFraction: HISTORY_QUOTA_TRIM_FRACTION });
        await _writeBatch(db, batch);
      } catch {
        // give up on this batch
      }
    }
  } finally {
    _flushing = false;
  }
}

function _writeBatch(db, batch) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HISTORY_DB_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_DB_STORE);
    for (const rec of batch) store.put(rec);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

/**
 * Query messages for a user. When channel+platform are provided, results are
 * scoped to that stream via a compound index; otherwise we collect all rows
 * for the user and sort by ts descending in memory.
 *
 * Returns rows newest-first plus a hasMore flag (we collect limit+1 to detect).
 */
export async function queryByUser(userKey, opts = {}) {
  const { channel = null, platform = null, limit = 200, beforeTs = Infinity, includeBots = false } = opts;
  const db = await _open();
  if (!db) return { rows: [], oldestTs: null, hasMore: false };

  const upperTs = beforeTs === Infinity ? Number.MAX_SAFE_INTEGER : (beforeTs - 1);

  if (channel) {
    return new Promise((resolve) => {
      const tx = db.transaction(HISTORY_DB_STORE, 'readonly');
      const idx = tx.objectStore(HISTORY_DB_STORE).index(IDX_USER_CHANNEL_TS);
      const range = IDBKeyRange.bound(
        [userKey, channel, platform || '', -Infinity],
        [userKey, channel, platform || '', upperTs],
      );
      const cursorReq = idx.openCursor(range, 'prev');
      const rows = [];
      let hasMore = false;
      cursorReq.onsuccess = (e) => {
        const c = e.target.result;
        if (!c) { resolve({ rows, oldestTs: rows.length ? rows[rows.length - 1].ts : null, hasMore }); return; }
        const r = c.value;
        if (includeBots || !r.isBot) {
          if (rows.length < limit) {
            rows.push(r);
          } else {
            hasMore = true;
            resolve({ rows, oldestTs: rows[rows.length - 1].ts, hasMore });
            return;
          }
        }
        c.continue();
      };
      cursorReq.onerror = () => resolve({ rows, oldestTs: rows.length ? rows[rows.length - 1].ts : null, hasMore });
    });
  }

  // All-channels: collect everything for user, sort by ts desc in memory.
  return new Promise((resolve) => {
    const tx = db.transaction(HISTORY_DB_STORE, 'readonly');
    const idx = tx.objectStore(HISTORY_DB_STORE).index(IDX_USER);
    const cursorReq = idx.openCursor(IDBKeyRange.only(userKey));
    const all = [];
    cursorReq.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) {
        all.sort((a, b) => b.ts - a.ts);
        const filtered = all.filter(r => (includeBots || !r.isBot) && r.ts <= upperTs);
        const rows = filtered.slice(0, limit);
        const hasMore = filtered.length > limit;
        resolve({ rows, oldestTs: rows.length ? rows[rows.length - 1].ts : null, hasMore });
        return;
      }
      all.push(c.value);
      c.continue();
    };
    cursorReq.onerror = () => resolve({ rows: [], oldestTs: null, hasMore: false });
  });
}

/**
 * Aggregate stats for a user (optionally scoped to channel+platform).
 */
export async function userStats(userKey, opts = {}) {
  const { channel = null, platform = null, includeBots = false } = opts;
  const db = await _open();
  if (!db) return { total: 0, firstTs: null, lastTs: null, moodCounts: {} };

  return new Promise((resolve) => {
    const tx = db.transaction(HISTORY_DB_STORE, 'readonly');
    const store = tx.objectStore(HISTORY_DB_STORE);
    const moodCounts = {};
    let total = 0, firstTs = null, lastTs = null;
    let cursorReq;

    if (channel) {
      const idx = store.index(IDX_USER_CHANNEL_TS);
      const range = IDBKeyRange.bound(
        [userKey, channel, platform || '', -Infinity],
        [userKey, channel, platform || '', Number.MAX_SAFE_INTEGER],
      );
      cursorReq = idx.openCursor(range, 'next');
    } else {
      cursorReq = store.index(IDX_USER).openCursor(IDBKeyRange.only(userKey), 'next');
    }
    cursorReq.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) { resolve({ total, firstTs, lastTs, moodCounts }); return; }
      const r = c.value;
      if (includeBots || !r.isBot) {
        total++;
        if (firstTs === null || r.ts < firstTs) firstTs = r.ts;
        if (lastTs === null || r.ts > lastTs) lastTs = r.ts;
        const m = r.mood || 'neutral';
        moodCounts[m] = (moodCounts[m] || 0) + 1;
      }
      c.continue();
    };
    cursorReq.onerror = () => resolve({ total, firstTs, lastTs, moodCounts });
  });
}

/**
 * Delete every record for a user. When channel+platform are provided, only
 * records for that stream are removed.
 */
export async function clearUser(userKey, opts = {}) {
  const { channel = null, platform = null } = opts;
  const db = await _open();
  if (!db) return 0;

  return new Promise((resolve) => {
    const tx = db.transaction(HISTORY_DB_STORE, 'readwrite');
    const store = tx.objectStore(HISTORY_DB_STORE);
    let deleted = 0;
    let cursorReq;
    if (channel) {
      const idx = store.index(IDX_USER_CHANNEL_TS);
      const range = IDBKeyRange.bound(
        [userKey, channel, platform || '', -Infinity],
        [userKey, channel, platform || '', Number.MAX_SAFE_INTEGER],
      );
      cursorReq = idx.openCursor(range);
    } else {
      cursorReq = store.index(IDX_USER).openCursor(IDBKeyRange.only(userKey));
    }
    cursorReq.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return;
      c.delete();
      deleted++;
      c.continue();
    };
    tx.oncomplete = () => resolve(deleted);
    tx.onerror = () => resolve(deleted);
  });
}

export async function clearAll() {
  const db = await _open();
  if (!db) return false;
  return new Promise((resolve) => {
    const tx = db.transaction(HISTORY_DB_STORE, 'readwrite');
    tx.objectStore(HISTORY_DB_STORE).clear();
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => resolve(false);
  });
}

/**
 * Prune old / excess records.
 *
 * Modes:
 * - default: drop records older than retentionDays AND trim down to maxRows.
 * - { trimFraction: N }: drop the oldest N fraction of records (used for
 *   QuotaExceededError recovery).
 */
export async function prune(opts = {}) {
  const db = await _open();
  if (!db) return;
  const { trimFraction = null } = opts;

  if (trimFraction != null) {
    const total = await _count(db);
    const dropN = Math.max(1, Math.floor(total * trimFraction));
    await _deleteOldestN(db, dropN);
    return;
  }

  const cutoff = Date.now() - getRetentionDays() * 86_400_000;
  await _deleteOlderThan(db, cutoff);

  const total = await _count(db);
  const max = getMaxRows();
  if (total > max) await _deleteOldestN(db, total - max);
}

function _count(db) {
  return new Promise((resolve) => {
    const tx = db.transaction(HISTORY_DB_STORE, 'readonly');
    const req = tx.objectStore(HISTORY_DB_STORE).count();
    req.onsuccess = () => resolve(req.result || 0);
    req.onerror = () => resolve(0);
  });
}

function _deleteOlderThan(db, ts) {
  return new Promise((resolve) => {
    const tx = db.transaction(HISTORY_DB_STORE, 'readwrite');
    const idx = tx.objectStore(HISTORY_DB_STORE).index(IDX_TS);
    const range = IDBKeyRange.upperBound(ts, false);
    const cursorReq = idx.openCursor(range);
    cursorReq.onsuccess = (e) => {
      const c = e.target.result;
      if (!c) return;
      c.delete();
      c.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}

function _deleteOldestN(db, n) {
  return new Promise((resolve) => {
    if (n <= 0) { resolve(); return; }
    const tx = db.transaction(HISTORY_DB_STORE, 'readwrite');
    const idx = tx.objectStore(HISTORY_DB_STORE).index(IDX_TS);
    let remaining = n;
    const cursorReq = idx.openCursor(null, 'next');
    cursorReq.onsuccess = (e) => {
      const c = e.target.result;
      if (!c || remaining <= 0) return;
      c.delete();
      remaining--;
      c.continue();
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
