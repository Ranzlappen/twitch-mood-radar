/**
 * userHistoryModal.js — click a username in any feed → open a modal listing
 * every message logged from that user, persisted across reloads via IndexedDB.
 *
 * Default scope is the current channel+platform of the live feed; a toggle
 * widens to "All channels". Bot-flagged messages are hidden by default.
 */
import { queryByUser, userStats, clearUser } from '../history/historyDb.js';
import { buildFeedItemHtml } from './feeds.js';
import { esc } from '../utils/dom.js';

const PAGE_SIZE = 200;

const _state = {
  user: '',
  userKey: '',
  channel: null,
  platform: null,
  scope: 'channel',          // 'channel' | 'all'
  includeBots: false,
  oldestTs: null,
  hasMore: false,
  loading: false,
};

function _overlay() { return document.getElementById('userHistoryOverlay'); }
function _list() { return document.getElementById('userHistoryList'); }
function _stats() { return document.getElementById('userHistoryStats'); }
function _title() { return document.getElementById('userHistoryTitle'); }
function _loadMore() { return document.getElementById('userHistLoadMore'); }
function _botCheckbox() { return document.getElementById('userHistBots'); }

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
  for (const r of rows) {
    const wrap = document.createElement('div');
    wrap.className = 'user-history-row';
    const tsSpan = document.createElement('span');
    tsSpan.className = 'user-history-ts';
    tsSpan.title = _fmtTs(r.ts);
    tsSpan.textContent = _fmtTs(r.ts);

    const item = document.createElement('div');
    const built = buildFeedItemHtml({
      user: r.user,
      msg: r.msg,
      mood: r.isBot ? 'bot' : (r.mood || 'neutral'),
      botScore: r.botScore || 0,
      approvalVote: r.approvalVote || 0,
      platform: r.platform || '',
    });
    item.className = built.className;
    item.innerHTML = built.innerHTML;

    wrap.appendChild(tsSpan);
    wrap.appendChild(item);
    frag.appendChild(wrap);
  }
  list.appendChild(frag);
}

async function _renderStats() {
  const statsEl = _stats();
  if (!statsEl) return;
  const scopeOpts = _state.scope === 'channel'
    ? { channel: _state.channel, platform: _state.platform, includeBots: _state.includeBots }
    : { includeBots: _state.includeBots };
  const s = await userStats(_state.userKey, scopeOpts);
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

export async function openUserHistory(userKey, displayUser, ctx = {}) {
  if (!userKey) return;
  _state.user = displayUser || userKey;
  _state.userKey = userKey;
  _state.channel = ctx.channel || _resolveCurrentChannel();
  _state.platform = ctx.platform || _resolveCurrentPlatform();
  _state.scope = _state.channel ? 'channel' : 'all';
  _state.includeBots = false;
  _state.oldestTs = null;
  _state.hasMore = false;

  const titleEl = _title();
  if (titleEl) titleEl.textContent = (_state.user || 'USER').toUpperCase();
  const botBox = _botCheckbox();
  if (botBox) botBox.checked = false;
  const radios = document.querySelectorAll('input[name="userHistScope"]');
  radios.forEach(r => { r.checked = (r.value === _state.scope); });

  const ov = _overlay();
  if (ov) {
    ov.hidden = false;
    ov.classList.add('open');
  }

  await _loadFirstPage();
}

export function closeUserHistory() {
  const ov = _overlay();
  if (!ov) return;
  ov.classList.remove('open');
  ov.hidden = true;
}

export async function setUserHistoryScope(scope) {
  if (scope !== 'channel' && scope !== 'all') return;
  _state.scope = scope;
  await _loadFirstPage();
}

export async function setUserHistoryBots(include) {
  _state.includeBots = !!include;
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

  const lm = _loadMore();
  if (lm) lm.addEventListener('click', _loadOlder);
}
