/**
 * Feed rendering — main feed, outlier feed, and filtered feed.
 * Uses a unified FeedRenderer class to eliminate 3x duplication.
 */
import { state } from '../state.js';
import { sanitize, esc } from '../utils/dom.js';
import { renderEmotes } from '../platform/emotes.js';
import {
  FEED_FONT_KEY, OUTLIER_FONT_KEY, FILTERED_FEED_FONT_KEY,
  REGEX_STORAGE_KEY, REGEX_HISTORY_KEY, USER_FILTER_STORAGE_KEY
} from '../config.js';
import { saveRaw, loadRaw, save, load } from '../utils/storage.js';
import { onMessageProcessed } from '../processing.js';

/* ── shared row HTML builder ──────────────────────────── */

/**
 * Build the inner HTML for a single feed item. Shared by FeedRenderer.flush
 * and the per-user history modal so both render rows identically.
 *
 * @param {object} item
 * @param {string} item.user
 * @param {string} item.msg
 * @param {string} item.mood          — one of MOODS or 'bot'
 * @param {number} [item.botScore]
 * @param {number} [item.approvalVote]
 * @param {string} [item.platform]
 * @returns {{ className: string, innerHTML: string }}
 */
export function buildFeedItemHtml({ user, msg, mood, botScore = 0, approvalVote = 0, platform = '' }) {
  const isBot = mood === 'bot';
  const className = 'feed-item' + (isBot ? ' feed-bot' : '');
  const safeUser = sanitize(user);
  const safeMsg = sanitize(msg);
  const userKey = safeUser.toLowerCase();
  const platDot = `<span class="feed-plat${platform ? ' feed-plat-' + platform : ''}" title="${platform || ''}"></span>`;
  const moodTag = isBot
    ? `<span class="feed-mood mood-bot">BOT ${botScore}</span>`
    : `<span class="feed-mood mood-${mood}">${mood}</span>`;
  const apvTag = isBot ? '' : buildApprovalHtml(approvalVote);
  const innerHTML = `${platDot}<span class="feed-user" data-user="${esc(safeUser)}" data-user-key="${esc(userKey)}" role="button" tabindex="0">${esc(safeUser)}</span><span class="feed-msg">${renderEmotes(esc(safeMsg))}</span>${moodTag}${apvTag}`;
  return { className, innerHTML };
}

export function buildApprovalHtml(vote) {
  const apvPct = Math.round(Math.min(100, Math.max(0, (vote + 8) / 16 * 100)));
  let apvColor;
  if (vote > 1) apvColor = '#00ffe5';
  else if (vote < -1) apvColor = '#ff4800';
  else apvColor = '#4a4a7a';
  const apvNum = vote > 0 ? '+' + vote.toFixed(1) : vote.toFixed(1);
  return `<span class="feed-apv"><span class="feed-apv-bar"><span class="feed-apv-fill" style="width:${apvPct}%;background:${apvColor}"></span></span><span class="feed-apv-num" style="color:${apvColor}">${apvNum}</span></span>`;
}

/* ── FeedRenderer class ──────────────────────────────── */

const SCROLL_STICKY_PX = 40;

export class FeedRenderer {
  /**
   * @param {string} containerId  — DOM id of the feed list container
   * @param {object} opts
   * @param {number} opts.maxItems — max items before oldest are pruned (default 60)
   * @param {Function|null} opts.filterFn — if provided, items are only added when this returns true
   */
  constructor(containerId, { maxItems = 60, filterFn = null } = {}) {
    this._containerId = containerId;
    this._maxItems = maxItems;
    this._filterFn = filterFn;
    this._pending = [];
    this._rafId = null;
    this._stuckToBottom = true;
    this._unread = 0;
    this._pillEl = null;
    this._scrollBound = false;
  }

  /**
   * Queue a feed item for rendering on the next animation frame.
   */
  add(user, msg, mood, botScore, approvalVote, platform) {
    if (this._filterFn && !this._filterFn(user, msg, mood, botScore, approvalVote)) return;
    this._pending.push({ user, msg, mood, botScore: botScore || 0, approvalVote: approvalVote || 0, platform: platform || '' });
    if (!this._rafId) this._rafId = requestAnimationFrame(() => this.flush());
  }

  /**
   * Flush pending items into the DOM.
   */
  flush() {
    this._rafId = null;
    const list = document.getElementById(this._containerId);
    if (!list) return;
    this._ensurePill(list);

    const wasStuck = this._stuckToBottom;
    const frag = document.createDocumentFragment();
    let appended = 0;
    for (const item of this._pending.splice(0, 25)) {
      const el = document.createElement('div');
      const { className, innerHTML } = buildFeedItemHtml(item);
      el.className = className;
      el.innerHTML = innerHTML;
      frag.appendChild(el);
      appended++;
    }
    list.appendChild(frag);
    while (list.children.length > this._maxItems) list.removeChild(list.firstChild);

    if (wasStuck) {
      list.scrollTop = list.scrollHeight;
    } else if (appended > 0) {
      this._unread += appended;
      this._updatePill();
    }
  }

  /**
   * Lazily wrap the feed list and inject the "Chat Paused" pill, and bind
   * the scroll listener that toggles _stuckToBottom.
   */
  _ensurePill(list) {
    if (this._scrollBound) return;
    this._scrollBound = true;

    let wrap = list.parentElement;
    if (!wrap || !wrap.classList.contains('feed-scroll-wrap')) {
      wrap = document.createElement('div');
      wrap.className = 'feed-scroll-wrap';
      list.parentNode.insertBefore(wrap, list);
      wrap.appendChild(list);
    }

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'feed-pause-pill';
    pill.hidden = true;
    pill.setAttribute('aria-label', 'Resume auto-scroll');
    pill.textContent = 'Chat Paused — click to resume';
    pill.addEventListener('click', () => this._resume(list));
    wrap.appendChild(pill);
    this._pillEl = pill;

    list.addEventListener('scroll', () => this._onScroll(list), { passive: true });
  }

  _onScroll(list) {
    const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
    const nearBottom = distance < SCROLL_STICKY_PX;
    if (nearBottom) {
      if (!this._stuckToBottom || this._unread !== 0) {
        this._stuckToBottom = true;
        this._unread = 0;
        this._updatePill();
      }
    } else if (this._stuckToBottom) {
      this._stuckToBottom = false;
      this._updatePill();
    }
  }

  _resume(list) {
    this._stuckToBottom = true;
    this._unread = 0;
    this._updatePill();
    list.scrollTop = list.scrollHeight;
  }

  _updatePill() {
    if (!this._pillEl) return;
    if (this._stuckToBottom) {
      this._pillEl.hidden = true;
      return;
    }
    const n = this._unread > 99 ? '99+' : String(this._unread);
    this._pillEl.textContent = this._unread > 0
      ? `Chat Paused — ${n} new — click to resume`
      : 'Chat Paused — click to resume';
    this._pillEl.hidden = false;
  }
}

/* ── feed instances ──────────────────────────────────── */

export const mainFeed = new FeedRenderer('feedList', { maxItems: 60 });

export const outlierFeed = new FeedRenderer('outlierFeedList', { maxItems: 40 });

export const filteredFeed = new FeedRenderer('filteredFeedList', {
  maxItems: 60,
  filterFn: (user, msg) => {
    const rx = state.filteredFeedRegex;
    const uq = state.filteredFeedUserQuery;
    if (!rx && !uq) return false; // show nothing when filter is inactive
    if (rx && !rx.test(msg)) return false;
    if (uq && !String(user || '').toLowerCase().includes(uq)) return false;
    return true;
  }
});

/* ── feed font sizes ─────────────────────────────────── */

export function updateFeedFontSize(v) {
  state.feedFontSize = Math.min(20, Math.max(0.1, parseFloat(v)));
  document.getElementById('feedFontVal').textContent = state.feedFontSize.toFixed(2);
  saveRaw(FEED_FONT_KEY, state.feedFontSize);
  applyFeedFontSize();
}

export function applyFeedFontSize() {
  const list = document.getElementById('feedList');
  if (!list) return;
  list.style.fontSize = state.feedFontSize + 'em';
  list.style.lineHeight = Math.max(1.2, 1.4 + (state.feedFontSize - 2) * 0.15).toFixed(2);
}

export function updateOutlierFontSize(v) {
  state.outlierFontSize = Math.min(20, Math.max(0.1, parseFloat(v)));
  document.getElementById('outlierFontVal').textContent = state.outlierFontSize.toFixed(2);
  saveRaw(OUTLIER_FONT_KEY, state.outlierFontSize);
  applyOutlierFontSize();
}

export function applyOutlierFontSize() {
  const list = document.getElementById('outlierFeedList');
  if (!list) return;
  list.style.fontSize = state.outlierFontSize + 'em';
  list.style.lineHeight = Math.max(1.2, 1.4 + (state.outlierFontSize - 2) * 0.15).toFixed(2);
}

export function updateFilteredFeedFontSize(v) {
  state.filteredFeedFontSize = Math.min(20, Math.max(0.1, parseFloat(v)));
  document.getElementById('filteredFeedFontVal').textContent = state.filteredFeedFontSize.toFixed(2);
  saveRaw(FILTERED_FEED_FONT_KEY, state.filteredFeedFontSize);
  applyFilteredFeedFontSize();
}

export function applyFilteredFeedFontSize() {
  const list = document.getElementById('filteredFeedList');
  if (!list) return;
  list.style.fontSize = state.filteredFeedFontSize + 'em';
  list.style.lineHeight = Math.max(1.2, 1.4 + (state.filteredFeedFontSize - 2) * 0.15).toFixed(2);
}

/* ── filter state writers ────────────────────────────── */

/**
 * Compile `v` as a case-insensitive regex and write to state. Empty/whitespace
 * clears the filter. Invalid regex leaves state null and does not throw.
 * Returns { ok: boolean } so callers can reflect validity in UI.
 */
export function updateFilteredFeedRegex(v) {
  const str = (v || '').trim();
  if (!str) {
    state.filteredFeedRegex = null;
    saveRaw(REGEX_STORAGE_KEY, '');
    return { ok: true };
  }
  try {
    state.filteredFeedRegex = new RegExp(str, 'i');
    saveRaw(REGEX_STORAGE_KEY, str);
    return { ok: true };
  } catch {
    state.filteredFeedRegex = null;
    return { ok: false };
  }
}

export function updateFilteredFeedUserQuery(v) {
  const str = (v || '').trim().toLowerCase();
  state.filteredFeedUserQuery = str;
  saveRaw(USER_FILTER_STORAGE_KEY, str);
}

/* ── filter history (shape: [{ rx, user }, ...]) ─────── */

// Normalizes legacy string entries to {rx, user:''} on read.
export function loadFilterHistory() {
  const raw = load(REGEX_HISTORY_KEY, []);
  if (!Array.isArray(raw)) return [];
  return raw
    .map(h => typeof h === 'string' ? { rx: h, user: '' } : h)
    .filter(h => h && typeof h === 'object' && (h.rx || h.user));
}

export function saveFilterToHistory(rx, user) {
  const rec = { rx: rx || '', user: user || '' };
  if (!rec.rx && !rec.user) return;
  const hist = loadFilterHistory().filter(h => !(h.rx === rec.rx && h.user === rec.user));
  hist.unshift(rec);
  if (hist.length > 20) hist.length = 20;
  save(REGEX_HISTORY_KEY, hist);
}

export function deleteFilterHistoryItem(index) {
  const hist = loadFilterHistory();
  if (index < 0 || index >= hist.length) return;
  hist.splice(index, 1);
  save(REGEX_HISTORY_KEY, hist);
  renderFilterHistory();
}

export function renderFilterHistory() {
  const list = document.getElementById('filterHistoryList');
  if (!list) return;
  const hist = loadFilterHistory();
  if (hist.length === 0) {
    list.innerHTML = '<div class="filter-history-empty">No saved filters yet.</div>';
    return;
  }
  list.innerHTML = hist.map((h, i) => {
    const rx = h.rx ? `<span class="fh-rx">${esc(h.rx)}</span>` : '<span class="fh-empty">—</span>';
    const user = h.user ? `<span class="fh-user">@${esc(h.user)}</span>` : '';
    return (
      `<div class="filter-history-item" role="button" tabindex="0" onclick="selectFilterHistoryItem(${i})">` +
        `<div class="fh-content">${rx}${user}</div>` +
        `<button class="fh-delete" aria-label="Remove" title="Remove" onclick="event.stopPropagation();deleteFilterHistoryItem(${i})">&times;</button>` +
      `</div>`
    );
  }).join('');
}

export function selectFilterHistoryItem(index) {
  const hist = loadFilterHistory();
  if (index < 0 || index >= hist.length) return;
  const { rx, user } = hist[index];
  const rxInput = document.getElementById('filterRegexInput');
  const userInput = document.getElementById('filterUserInput');
  if (rxInput) rxInput.value = rx || '';
  if (userInput) userInput.value = user || '';
  onFilterModalInput();
}

/* ── live preview ring buffer (modal-scoped) ─────────── */

const PREVIEW_RING_MAX = 200;
const PREVIEW_SHOW = 8;
let _previewRing = [];
let _unsubProcessed = null;
let _previewRafId = null;

/* ── filter modal open/close ─────────────────────────── */

export function openFilterModal() {
  const overlay = document.getElementById('filterOverlay');
  if (!overlay) return;

  const rxInput = document.getElementById('filterRegexInput');
  const userInput = document.getElementById('filterUserInput');
  if (rxInput) rxInput.value = loadRaw(REGEX_STORAGE_KEY, '') || '';
  if (userInput) userInput.value = loadRaw(USER_FILTER_STORAGE_KEY, '') || '';

  refreshUserDatalist();
  renderFilterHistory();

  _previewRing = [];
  if (!_unsubProcessed) {
    _unsubProcessed = onMessageProcessed(rec => {
      _previewRing.push(rec);
      if (_previewRing.length > PREVIEW_RING_MAX) _previewRing.shift();
      _schedulePreviewUpdate();
    });
  }

  overlay.classList.add('open');
  overlay.hidden = false;
  onFilterModalInput();

  if (rxInput) setTimeout(() => rxInput.focus(), 0);
}

export function closeFilterModal() {
  const overlay = document.getElementById('filterOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.hidden = true;
  if (_unsubProcessed) { _unsubProcessed(); _unsubProcessed = null; }
  _previewRing = [];
  if (_previewRafId) { cancelAnimationFrame(_previewRafId); _previewRafId = null; }
}

export function refreshUserDatalist() {
  const dl = document.getElementById('filterUserDatalist');
  if (!dl) return;
  const users = Array.from(state.uniqueUsers || []).slice(-200).reverse();
  dl.innerHTML = users.map(u => `<option value="${esc(u)}"></option>`).join('');
}

/* ── live preview rendering ──────────────────────────── */

function _schedulePreviewUpdate() {
  if (_previewRafId) return;
  _previewRafId = requestAnimationFrame(() => {
    _previewRafId = null;
    onFilterModalInput();
  });
}

export function onFilterModalInput() {
  const rxInput = document.getElementById('filterRegexInput');
  const userInput = document.getElementById('filterUserInput');
  const countEl = document.getElementById('filterMatchCount');
  const previewEl = document.getElementById('filterPreview');
  if (!rxInput || !userInput || !countEl || !previewEl) return;

  const rxVal = rxInput.value.trim();
  const uqVal = userInput.value.trim().toLowerCase();

  let rx = null;
  let rxOk = true;
  if (rxVal) {
    try { rx = new RegExp(rxVal, 'i'); }
    catch { rxOk = false; }
  }
  rxInput.classList.toggle('regex-error', !rxOk);

  if (!rxVal && !uqVal) {
    countEl.textContent = `0 of ${_previewRing.length} recent`;
    previewEl.innerHTML = '<div class="filter-preview-hint">Type a regex or username to preview matches.</div>';
    return;
  }

  let matched = 0;
  const matches = [];
  for (let i = _previewRing.length - 1; i >= 0; i--) {
    const rec = _previewRing[i];
    if (rx && !rx.test(rec.msg)) continue;
    if (uqVal && !String(rec.user || '').toLowerCase().includes(uqVal)) continue;
    matched++;
    if (matches.length < PREVIEW_SHOW) matches.push(rec);
  }

  countEl.textContent = `${matched} of ${_previewRing.length} recent`;

  if (matches.length === 0) {
    previewEl.innerHTML = _previewRing.length === 0
      ? '<div class="filter-preview-hint">Waiting for live messages…</div>'
      : '<div class="filter-preview-hint">No recent messages match.</div>';
    return;
  }

  const frag = document.createDocumentFragment();
  for (const rec of matches.slice().reverse()) {
    const el = document.createElement('div');
    const { className, innerHTML } = buildFeedItemHtml({
      user: rec.user, msg: rec.msg, mood: rec.mood,
      botScore: rec.botScore, approvalVote: rec.approvalVote, platform: rec.platform
    });
    el.className = className;
    el.innerHTML = innerHTML;
    frag.appendChild(el);
  }
  previewEl.innerHTML = '';
  previewEl.appendChild(frag);
}

/* ── apply / clear ───────────────────────────────────── */

export function applyFilterModal() {
  const rxInput = document.getElementById('filterRegexInput');
  const userInput = document.getElementById('filterUserInput');
  if (!rxInput || !userInput) return;
  const rxVal = rxInput.value.trim();
  const uqVal = userInput.value.trim();
  const { ok } = updateFilteredFeedRegex(rxVal);
  rxInput.classList.toggle('regex-error', !ok);
  if (!ok) return;
  updateFilteredFeedUserQuery(uqVal);
  if (rxVal || uqVal) saveFilterToHistory(rxVal, uqVal.toLowerCase());
  updateFilterTriggerButton();
  renderFilterHistory();
  closeFilterModal();
}

export function clearFilterModal() {
  const rxInput = document.getElementById('filterRegexInput');
  const userInput = document.getElementById('filterUserInput');
  if (rxInput) { rxInput.value = ''; rxInput.classList.remove('regex-error'); }
  if (userInput) userInput.value = '';
  updateFilteredFeedRegex('');
  updateFilteredFeedUserQuery('');
  updateFilterTriggerButton();
  onFilterModalInput();
}

/* ── trigger button reflection ───────────────────────── */

export function updateFilterTriggerButton() {
  const btn = document.getElementById('filteredFeedFilterBtn');
  const statusEl = document.getElementById('filterTriggerStatus');
  if (!btn || !statusEl) return;
  const rxSrc = loadRaw(REGEX_STORAGE_KEY, '') || '';
  const uqSrc = state.filteredFeedUserQuery || '';
  const active = Boolean(state.filteredFeedRegex || uqSrc);
  btn.classList.toggle('active', active);
  if (!active) {
    statusEl.textContent = 'off';
    btn.title = 'Edit filter';
    return;
  }
  const parts = [];
  if (rxSrc) parts.push(`rx:${rxSrc}`);
  if (uqSrc) parts.push(`user:${uqSrc}`);
  statusEl.textContent = parts.join(' · ');
  btn.title = parts.join(' · ');
}
