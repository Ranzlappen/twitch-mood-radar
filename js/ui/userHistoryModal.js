/**
 * userHistoryModal.js — click a username in any feed → open a modal listing
 * every message logged from that user, persisted across reloads via IndexedDB.
 *
 * Default scope is the current channel+platform of the live feed; a toggle
 * widens to "All channels". Bot-flagged messages are hidden by default.
 *
 * Supports:
 *  - live message appends while the modal is open (subscribes to the
 *    processing loop via onMessageProcessed)
 *  - a font-size slider for message text inside the list
 *  - persisted controls (bot checkbox, scope, font size) across reloads
 */
import { queryByUser, userStats, clearUser } from '../history/historyDb.js';
import { attachResizeHandle } from './layout.js';
import { esc, sanitize } from '../utils/dom.js';
import { appendMessageSegments } from '../platform/emotes.js';
import { load, save, loadRaw, saveRaw } from '../utils/storage.js';
import {
  USER_HIST_FONT_KEY, USER_HIST_BOTS_KEY, USER_HIST_SCOPE_KEY,
  USER_HIST_SIZE_KEY, USER_HIST_POS_KEY,
} from '../config.js';
import { onMessageProcessed } from '../processing.js';

const PAGE_SIZE = 200;
const FONT_MIN = 0.5;
const FONT_MAX = 4;
const FONT_DEFAULT = 1.1;

// Minimum floating-modal dimensions and viewport-edge padding for clamping
// a persisted position that would otherwise land off-screen after a window
// resize between sessions.
const MODAL_MIN_W = 360;
const MODAL_MIN_H = 240;
const VIEWPORT_EDGE_PAD = 12;

const _state = {
  user: '',
  userKey: '',
  channel: null,
  platform: null,
  scope: 'channel',          // 'channel' | 'all'
  includeBots: false,
  fontSize: FONT_DEFAULT,
  oldestTs: null,
  hasMore: false,
  loading: false,
  unsubLive: null,
  // Locally-incremented stats so live appends update the header without
  // re-querying IndexedDB on every message.
  stats: { total: 0, firstTs: null, lastTs: null, moodCounts: {} },
};

// Persisted defaults — read once at module load; updated whenever the user
// changes a control so subsequent opens honor the most recent choice.
const _persisted = {
  fontSize: _clampFont(parseFloat(loadRaw(USER_HIST_FONT_KEY, String(FONT_DEFAULT)))),
  includeBots: load(USER_HIST_BOTS_KEY, false) === true,
  scopePref: (() => {
    const v = loadRaw(USER_HIST_SCOPE_KEY, 'channel');
    return (v === 'all' || v === 'channel') ? v : 'channel';
  })(),
  size: (() => {
    const v = load(USER_HIST_SIZE_KEY, null);
    if (!v || typeof v !== 'object') return null;
    const w = parseInt(v.w, 10), h = parseInt(v.h, 10);
    if (!isFinite(w) || !isFinite(h)) return null;
    return { w, h };
  })(),
  pos: (() => {
    const v = load(USER_HIST_POS_KEY, null);
    if (!v || typeof v !== 'object') return null;
    const x = parseInt(v.x, 10), y = parseInt(v.y, 10);
    if (!isFinite(x) || !isFinite(y)) return null;
    return { x, y };
  })(),
};

function _clampFont(v) {
  const n = parseFloat(v);
  if (!isFinite(n)) return FONT_DEFAULT;
  return Math.min(FONT_MAX, Math.max(FONT_MIN, n));
}

function _overlay() { return document.getElementById('userHistoryOverlay'); }
function _modal() { return document.getElementById('userHistoryModal'); }
function _list() { return document.getElementById('userHistoryList'); }
function _stats() { return document.getElementById('userHistoryStats'); }
function _title() { return document.getElementById('userHistoryTitle'); }
function _loadMore() { return document.getElementById('userHistLoadMore'); }
function _botCheckbox() { return document.getElementById('userHistBots'); }
function _fontSlider() { return document.getElementById('userHistFontSlider'); }
function _fontVal() { return document.getElementById('userHistFontVal'); }

/**
 * Clamp an (x, y) point so a w×h modal stays at least partially on screen
 * after a window resize between sessions would otherwise push it off.
 */
function _clampPos(x, y, w, h) {
  const vw = window.innerWidth || document.documentElement.clientWidth;
  const vh = window.innerHeight || document.documentElement.clientHeight;
  const maxX = Math.max(VIEWPORT_EDGE_PAD, vw - w - VIEWPORT_EDGE_PAD);
  const maxY = Math.max(VIEWPORT_EDGE_PAD, vh - h - VIEWPORT_EDGE_PAD);
  return {
    x: Math.min(Math.max(VIEWPORT_EDGE_PAD, x), maxX),
    y: Math.min(Math.max(VIEWPORT_EDGE_PAD, y), maxY),
  };
}

/**
 * Apply the persisted size + position to the modal element. Falls back to
 * the CSS-default centered position (top:8vh, left:50%, transform) when no
 * persistence is present — which is the case on first-ever open.
 */
function _applySizeAndPos() {
  const m = _modal();
  if (!m) return;
  const size = _persisted.size;
  const pos = _persisted.pos;
  if (size) {
    m.style.width = Math.max(MODAL_MIN_W, size.w) + 'px';
    m.style.height = Math.max(MODAL_MIN_H, size.h) + 'px';
  }
  if (pos) {
    const w = size ? size.w : m.offsetWidth;
    const h = size ? size.h : m.offsetHeight;
    const c = _clampPos(pos.x, pos.y, w || MODAL_MIN_W, h || MODAL_MIN_H);
    m.style.left = c.x + 'px';
    m.style.top = c.y + 'px';
    m.style.transform = 'none';     // drop the centering translate
  }
}

/**
 * Make the h3 title a drag handle that moves the whole modal. Uses pointer
 * events so touch + mouse both work; releases capture on pointerup/cancel.
 */
function _initDrag() {
  const m = _modal();
  const handle = _title();
  if (!m || !handle || handle._dragWired) return;
  handle._dragWired = true;

  let dragging = false;
  let startX = 0, startY = 0;
  let origLeft = 0, origTop = 0;
  let pointerId = null;

  handle.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    dragging = true;
    pointerId = e.pointerId;
    const rect = m.getBoundingClientRect();
    // Commit the current visual position to explicit left/top so the drag
    // math is in a consistent coordinate system (the CSS default uses
    // transform:translateX(-50%) which would fight the delta update).
    origLeft = rect.left;
    origTop = rect.top;
    m.style.left = origLeft + 'px';
    m.style.top = origTop + 'px';
    m.style.transform = 'none';
    startX = e.clientX;
    startY = e.clientY;
    m.classList.add('dragging');
    try { handle.setPointerCapture(pointerId); } catch { /* ignore */ }
    e.preventDefault();
  });

  handle.addEventListener('pointermove', (e) => {
    if (!dragging || e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const c = _clampPos(origLeft + dx, origTop + dy, m.offsetWidth, m.offsetHeight);
    m.style.left = c.x + 'px';
    m.style.top = c.y + 'px';
  });

  const end = (e) => {
    if (!dragging || (pointerId != null && e.pointerId !== pointerId)) return;
    dragging = false;
    m.classList.remove('dragging');
    try { handle.releasePointerCapture(pointerId); } catch { /* ignore */ }
    pointerId = null;
    const x = parseInt(m.style.left, 10);
    const y = parseInt(m.style.top, 10);
    if (isFinite(x) && isFinite(y)) {
      _persisted.pos = { x, y };
      save(USER_HIST_POS_KEY, _persisted.pos);
    }
  };
  handle.addEventListener('pointerup', end);
  handle.addEventListener('pointercancel', end);
}

function _fmtTs(ts) {
  const d = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function _fmtRelative(ts) {
  if (ts == null) return '—';
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 60) return s + 's ago';
  const m = Math.round(s / 60);
  if (m < 60) return m + 'm ago';
  const h = Math.round(m / 60);
  if (h < 48) return h + 'h ago';
  const d = Math.round(h / 24);
  return d + 'd ago';
}

function _topMood(moodCounts) {
  let best = null, bestN = 0;
  for (const [m, n] of Object.entries(moodCounts || {})) {
    if (n > bestN) { best = m; bestN = n; }
  }
  return best;
}

/**
 * Build a single .user-history-row element from a history record. Used by
 * both initial page renders and live appends so the DOM structure stays in
 * sync.
 */
function _buildRow(r) {
  const isBot = !!r.isBot;
  const safeUser = sanitize(r.user || '');
  const userKey  = safeUser.toLowerCase();
  const safeMsg  = sanitize(r.msg || '');
  const platform = r.platform || '';
  const channel  = r.channel  || '';

  const wrap = document.createElement('div');
  wrap.className = 'user-history-row';

  const meta = document.createElement('div');
  meta.className = 'user-history-meta';

  const ts = document.createElement('span');
  ts.className = 'user-history-ts';
  ts.title = _fmtTs(r.ts);
  ts.textContent = _fmtTs(r.ts);
  meta.appendChild(ts);

  const mid = document.createElement('span');
  mid.className = 'user-history-meta-mid';

  const userSpan = document.createElement('span');
  userSpan.className = 'feed-user';
  userSpan.dataset.user = safeUser;
  userSpan.dataset.userKey = userKey;
  userSpan.setAttribute('role', 'button');
  userSpan.tabIndex = 0;
  userSpan.textContent = safeUser;
  mid.appendChild(userSpan);

  mid.appendChild(_connWord(' to '));

  const chan = document.createElement('span');
  chan.className = 'user-history-channel';
  chan.textContent = channel ? '#' + channel : '?';
  mid.appendChild(chan);

  mid.appendChild(_connWord(' on '));

  if (platform) {
    const dot = document.createElement('span');
    dot.className = 'feed-plat feed-plat-' + platform;
    dot.title = platform;
    mid.appendChild(dot);
  }
  const platText = document.createElement('span');
  platText.className = 'user-history-platform';
  platText.textContent = (platform || '?').toLowerCase();
  mid.appendChild(platText);

  meta.appendChild(mid);

  const right = document.createElement('span');
  right.className = 'user-history-meta-right';
  if (isBot) {
    const b = document.createElement('span');
    b.className = 'feed-mood mood-bot';
    b.textContent = `BOT ${r.botScore || 0}`;
    right.appendChild(b);
  } else {
    const mood = r.mood || 'neutral';
    const mEl = document.createElement('span');
    mEl.className = 'feed-mood mood-' + mood;
    mEl.textContent = mood;
    right.appendChild(mEl);
    const { color, num } = _scoreColorNum(+(r.approvalVote || 0));
    const sEl = document.createElement('span');
    sEl.className = 'user-history-score';
    sEl.style.color = color;
    sEl.textContent = num;
    right.appendChild(sEl);
  }
  meta.appendChild(right);
  wrap.appendChild(meta);

  const body = document.createElement('div');
  body.className = 'user-history-body feed-msg';
  appendMessageSegments(body, safeMsg);
  wrap.appendChild(body);

  return wrap;
}

function _connWord(text) {
  const s = document.createElement('span');
  s.className = 'uh-conn';
  s.textContent = text;
  return s;
}

function _scoreColorNum(vote) {
  let color = '#9898c8';
  if (vote >  1) color = '#00ffe5';
  else if (vote < -1) color = '#ff4800';
  const num = vote > 0 ? '+' + vote.toFixed(1) : vote.toFixed(1);
  return { color, num };
}

function _renderRows(rows, append) {
  const list = _list();
  if (!list) return;
  if (!append) list.innerHTML = '';

  if (!rows.length && !append) {
    list.innerHTML = '<div class="user-history-empty">No messages logged for this user' +
      (_state.scope === 'channel' ? ' on this channel.' : '.') +
      '</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  for (const r of rows) frag.appendChild(_buildRow(r));
  list.appendChild(frag);
}

async function _renderStats() {
  const statsEl = _stats();
  if (!statsEl) return;
  const scopeOpts = _state.scope === 'channel'
    ? { channel: _state.channel, platform: _state.platform, includeBots: _state.includeBots }
    : { includeBots: _state.includeBots };
  const s = await userStats(_state.userKey, scopeOpts);
  _state.stats = {
    total: s.total,
    firstTs: s.firstTs,
    lastTs: s.lastTs,
    moodCounts: { ...(s.moodCounts || {}) },
  };
  _paintStats();
}

/**
 * Paint the stats row from the in-memory _state.stats snapshot. Called after
 * every live-append so total/last-seen/top-mood tick live.
 */
function _paintStats() {
  const statsEl = _stats();
  if (!statsEl) return;
  const s = _state.stats;
  const top = _topMood(s.moodCounts);
  const scopeText = _state.scope === 'channel' && _state.channel
    ? `${_state.platform || '?'} / #${_state.channel}`
    : 'all logged channels';
  statsEl.innerHTML =
    `<div class="user-history-stat-row">` +
      `<span><span class="user-history-stat-label">scope</span> ${esc(scopeText)}</span>` +
      `<span><span class="user-history-stat-label">total</span> ${s.total.toLocaleString()}</span>` +
      `<span><span class="user-history-stat-label">first seen</span> ${_fmtRelative(s.firstTs)}</span>` +
      `<span><span class="user-history-stat-label">last seen</span> ${_fmtRelative(s.lastTs)}</span>` +
      (top ? `<span><span class="user-history-stat-label">top mood</span> ${esc(top)}</span>` : '') +
    `</div>`;
}

async function _loadFirstPage() {
  if (_state.loading) return;
  _state.loading = true;
  _state.oldestTs = null;
  _state.hasMore = false;
  const opts = {
    limit: PAGE_SIZE,
    includeBots: _state.includeBots,
  };
  if (_state.scope === 'channel') {
    opts.channel = _state.channel;
    opts.platform = _state.platform;
  }
  const { rows, oldestTs, hasMore } = await queryByUser(_state.userKey, opts);
  _state.oldestTs = oldestTs;
  _state.hasMore = hasMore;
  _renderRows(rows, false);
  const lm = _loadMore();
  if (lm) lm.hidden = !hasMore;
  _state.loading = false;
  _renderStats();
}

async function _loadOlder() {
  if (_state.loading || !_state.hasMore || _state.oldestTs == null) return;
  _state.loading = true;
  const opts = {
    limit: PAGE_SIZE,
    beforeTs: _state.oldestTs,
    includeBots: _state.includeBots,
  };
  if (_state.scope === 'channel') {
    opts.channel = _state.channel;
    opts.platform = _state.platform;
  }
  const { rows, oldestTs, hasMore } = await queryByUser(_state.userKey, opts);
  if (oldestTs != null) _state.oldestTs = oldestTs;
  _state.hasMore = hasMore;
  _renderRows(rows, true);
  const lm = _loadMore();
  if (lm) lm.hidden = !hasMore;
  _state.loading = false;
}

/**
 * Append a single live row to the top of the list (newest-first ordering).
 * Preserves scroll position if the user has scrolled into older history.
 */
function _prependLiveRow(rec) {
  const list = _list();
  if (!list) return;

  // Replace the "no messages" placeholder, if present.
  const empty = list.querySelector('.user-history-empty');
  if (empty) list.innerHTML = '';

  const row = _buildRow(rec);
  row.classList.add('user-history-row--new');
  setTimeout(() => row.classList.remove('user-history-row--new'), 1500);

  const prevScroll = list.scrollTop;
  list.insertBefore(row, list.firstChild);
  // If the user had scrolled down into older history, keep their view anchored
  // so the new message doesn't yank them back to the top.
  if (prevScroll > 0) {
    list.scrollTop = prevScroll + row.offsetHeight;
  }
}

function _incrementStatsFor(rec) {
  const s = _state.stats;
  s.total += 1;
  if (s.firstTs == null || rec.ts < s.firstTs) s.firstTs = rec.ts;
  if (s.lastTs == null || rec.ts > s.lastTs) s.lastTs = rec.ts;
  const m = rec.isBot ? 'bot' : (rec.mood || 'neutral');
  s.moodCounts[m] = (s.moodCounts[m] || 0) + 1;
  _paintStats();
}

function _onLiveMsg(rec) {
  if (!rec || !_state.userKey || rec.userKey !== _state.userKey) return;
  if (_state.scope === 'channel') {
    if ((rec.channel || '') !== (_state.channel || '')) return;
    if ((rec.platform || '') !== (_state.platform || '')) return;
  }
  if (rec.isBot && !_state.includeBots) return;

  _prependLiveRow(rec);
  _incrementStatsFor(rec);
}

function _applyFontSize() {
  const list = _list();
  if (!list) return;
  list.style.fontSize = _state.fontSize + 'em';
  list.style.lineHeight = Math.max(1.2, 1.4 + (_state.fontSize - 2) * 0.15).toFixed(2);
}

function _syncFontUi() {
  const slider = _fontSlider();
  if (slider) slider.value = String(_state.fontSize);
  const valEl = _fontVal();
  if (valEl) valEl.textContent = _state.fontSize.toFixed(2);
}

export function updateUserHistoryFontSize(v) {
  _state.fontSize = _clampFont(v);
  _persisted.fontSize = _state.fontSize;
  saveRaw(USER_HIST_FONT_KEY, _state.fontSize);
  _syncFontUi();
  _applyFontSize();
}

export async function openUserHistory(userKey, displayUser, ctx = {}) {
  if (!userKey) return;
  _state.user = displayUser || userKey;
  _state.userKey = userKey;
  _state.channel = ctx.channel || _resolveCurrentChannel();
  _state.platform = ctx.platform || _resolveCurrentPlatform();
  // Respect the persisted scope preference; fall back to 'all' if no channel
  // is currently live (the "This channel" scope would be empty).
  _state.scope = (_persisted.scopePref === 'channel' && _state.channel) ? 'channel' : 'all';
  _state.includeBots = _persisted.includeBots;
  _state.fontSize = _persisted.fontSize;
  _state.oldestTs = null;
  _state.hasMore = false;
  _state.stats = { total: 0, firstTs: null, lastTs: null, moodCounts: {} };

  const titleEl = _title();
  if (titleEl) titleEl.textContent = (_state.user || 'USER').toUpperCase();
  const botBox = _botCheckbox();
  if (botBox) botBox.checked = _state.includeBots;
  const radios = document.querySelectorAll('input[name="userHistScope"]');
  radios.forEach(r => { r.checked = (r.value === _state.scope); });
  _syncFontUi();
  _applyFontSize();

  const ov = _overlay();
  if (ov) {
    ov.hidden = false;
    ov.classList.add('open');
  }
  _applySizeAndPos();

  // Subscribe before loading so any message processed mid-load still lands
  // (duplicates can't happen — IndexedDB hasn't flushed this record yet, so
  // the initial page won't contain it).
  if (_state.unsubLive) { _state.unsubLive(); _state.unsubLive = null; }
  _state.unsubLive = onMessageProcessed(_onLiveMsg);

  await _loadFirstPage();
}

export function closeUserHistory() {
  if (_state.unsubLive) { _state.unsubLive(); _state.unsubLive = null; }
  const ov = _overlay();
  if (!ov) return;
  ov.classList.remove('open');
  ov.hidden = true;
}

export async function setUserHistoryScope(scope) {
  if (scope !== 'channel' && scope !== 'all') return;
  _state.scope = scope;
  _persisted.scopePref = scope;
  saveRaw(USER_HIST_SCOPE_KEY, scope);
  await _loadFirstPage();
}

export async function setUserHistoryBots(include) {
  _state.includeBots = !!include;
  _persisted.includeBots = _state.includeBots;
  save(USER_HIST_BOTS_KEY, _state.includeBots);
  await _loadFirstPage();
}

export async function clearCurrentUserHistory() {
  if (!_state.userKey) return;
  const scopeText = _state.scope === 'channel' && _state.channel
    ? `for ${_state.user} on ${_state.platform || '?'} / #${_state.channel}`
    : `for ${_state.user} across ALL channels`;
  if (!window.confirm(`Delete all logged messages ${scopeText}?\n\nThis cannot be undone.`)) return;
  if (_state.scope === 'channel') {
    await clearUser(_state.userKey, { channel: _state.channel, platform: _state.platform });
  } else {
    await clearUser(_state.userKey);
  }
  await _loadFirstPage();
}

/**
 * Resolve the current connected channel by reading the first live slot.
 * Falls back to null if nothing live (then modal opens in "all" scope).
 */
function _resolveCurrentChannel() {
  // ConnectionManager exposes slots on window via app.js; keep this loose
  // to avoid a hard import cycle.
  const cm = window.__connMgr;
  if (!cm) return null;
  const live = cm.getLiveSlots ? cm.getLiveSlots() : [];
  return live.length ? live[0].channelName : null;
}

function _resolveCurrentPlatform() {
  const cm = window.__connMgr;
  if (!cm) return null;
  const live = cm.getLiveSlots ? cm.getLiveSlots() : [];
  return live.length ? live[0].platform : null;
}

/**
 * Wire one-time event listeners:
 * - Delegated click on every feed list to open the modal when a username
 *   is clicked.
 * - Backdrop click + close button via the overlay's onclick.
 * - Scope radio change + bot checkbox change.
 * - Font slider input.
 */
export function initUserHistoryModal() {
  const FEED_IDS = ['feedList', 'filteredFeedList', 'outlierFeedList'];
  for (const id of FEED_IDS) {
    const list = document.getElementById(id);
    if (!list) continue;
    list.addEventListener('click', (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      const userEl = t.closest('.feed-user');
      if (!userEl || !list.contains(userEl)) return;
      const userKey = userEl.dataset.userKey || (userEl.textContent || '').toLowerCase();
      const displayUser = userEl.dataset.user || userEl.textContent || '';
      openUserHistory(userKey, displayUser);
    });
  }

  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLInputElement)) return;
    if (t.name === 'userHistScope' && t.checked) setUserHistoryScope(t.value);
    if (t.id === 'userHistBots') setUserHistoryBots(t.checked);
  });

  const slider = _fontSlider();
  if (slider) {
    slider.value = String(_persisted.fontSize);
    const valEl = _fontVal();
    if (valEl) valEl.textContent = _persisted.fontSize.toFixed(2);
    slider.addEventListener('input', (e) => {
      const t = e.target;
      if (t instanceof HTMLInputElement) updateUserHistoryFontSize(t.value);
    });
  }

  _initDrag();
  _initResize();

  const lm = _loadMore();
  if (lm) lm.addEventListener('click', _loadOlder);
}

let _resizeHandleAttached = false;
function _initResize() {
  const m = _modal();
  if (!m || _resizeHandleAttached) return;
  _resizeHandleAttached = true;
  let debounce = null;
  attachResizeHandle(m, {
    minW: MODAL_MIN_W,
    minH: MODAL_MIN_H,
    onResize: () => {
      clearTimeout(debounce);
      debounce = setTimeout(_persistModalSize, 180);
    },
    onResizeEnd: () => {
      clearTimeout(debounce);
      _persistModalSize();
    },
  });
}

function _persistModalSize() {
  const m = _modal();
  if (!m) return;
  const w = m.offsetWidth;
  const h = m.offsetHeight;
  if (!w || !h) return;
  _persisted.size = { w, h };
  save(USER_HIST_SIZE_KEY, _persisted.size);
}
