/**
 * Feed rendering — main feed, outlier feed, and filtered feed.
 * Uses a unified FeedRenderer class to eliminate 3x duplication.
 */
import { state } from '../state.js';
import { sanitize, esc } from '../utils/dom.js';
import { renderEmotes } from '../platform/emotes.js';
import {
  FEED_FONT_KEY, OUTLIER_FONT_KEY, FILTERED_FEED_FONT_KEY,
  REGEX_STORAGE_KEY, REGEX_HISTORY_KEY
} from '../config.js';
import { saveRaw, save, load } from '../utils/storage.js';

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
  filterFn: (_user, msg) => {
    if (!state.filteredFeedRegex) return false; // only show when filter is active
    return state.filteredFeedRegex.test(msg);
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

/* ── regex filter ────────────────────────────────────── */

export function updateFilteredFeedRegex(v) {
  const input = document.getElementById('filteredFeedRegex');
  if (!v.trim()) {
    state.filteredFeedRegex = null;
    input.classList.remove('regex-error');
    saveRaw(REGEX_STORAGE_KEY, '');
    return;
  }
  try {
    state.filteredFeedRegex = new RegExp(v, 'i');
    input.classList.remove('regex-error');
    saveRaw(REGEX_STORAGE_KEY, v);
    saveRegexToHistory(v);
  } catch {
    state.filteredFeedRegex = null;
    input.classList.add('regex-error');
  }
}

/* ── regex history ───────────────────────────────────── */

export function loadRegexHistory() {
  return load(REGEX_HISTORY_KEY, []);
}

export function saveRegexToHistory(pattern) {
  let hist = loadRegexHistory();
  hist = hist.filter(h => h !== pattern);
  hist.unshift(pattern);
  if (hist.length > 20) hist.length = 20;
  save(REGEX_HISTORY_KEY, hist);
}

export function deleteRegexFromHistory(pattern) {
  const hist = loadRegexHistory().filter(h => h !== pattern);
  save(REGEX_HISTORY_KEY, hist);
  renderRegexHistory();
}

export function renderRegexHistory() {
  const dropdown = document.getElementById('regexHistoryDropdown');
  if (!dropdown) return;
  const hist = loadRegexHistory();
  const input = document.getElementById('filteredFeedRegex');
  const filter = (input.value || '').trim().toLowerCase();
  const filtered = filter ? hist.filter(h => h.toLowerCase().includes(filter)) : hist;
  if (filtered.length === 0) {
    dropdown.innerHTML = '<div class="history-empty">No saved patterns</div>';
    return;
  }
  dropdown.innerHTML = filtered.map(p =>
    `<div class="history-item" onmousedown="selectRegexHistory('${p.replace(/'/g, "\\'")}')">` +
      `<span class="history-item-name">${esc(p)}</span>` +
      `<button class="history-delete" onmousedown="event.stopPropagation();deleteRegexFromHistory('${p.replace(/'/g, "\\'")}');event.preventDefault();" title="Remove">&times;</button>` +
    `</div>`
  ).join('');
}

export function selectRegexHistory(pattern) {
  const input = document.getElementById('filteredFeedRegex');
  input.value = pattern;
  updateFilteredFeedRegex(pattern);
  closeRegexHistory();
}

export function openRegexHistory() {
  const dropdown = document.getElementById('regexHistoryDropdown');
  if (!dropdown) return;
  renderRegexHistory();
  dropdown.classList.add('open');
}

export function closeRegexHistory() {
  const dropdown = document.getElementById('regexHistoryDropdown');
  if (dropdown) dropdown.classList.remove('open');
}
