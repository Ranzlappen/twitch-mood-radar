/**
 * Feed rendering — main feed, outlier feed, and filtered feed.
 * Uses a unified FeedRenderer class to eliminate 3x duplication.
 */
import { state } from '../state.js';
import { sanitize, esc } from '../utils/dom.js';
import { appendMessageSegments } from '../platform/emotes.js';
import {
  FEED_FONT_KEY, OUTLIER_FONT_KEY, FILTERED_FEED_FONT_KEY,
  REGEX_STORAGE_KEY, REGEX_HISTORY_KEY, USER_FILTER_STORAGE_KEY,
  FILTER_SIMPLE_STATE_KEY, FILTER_TAB_KEY,
} from '../config.js';
import { saveRaw, loadRaw, save, load } from '../utils/storage.js';
import * as settings from '../utils/settings.js';
import { onMessageProcessed } from '../processing.js';
import { createChipInput } from './chipInput.js';
import { registerModuleSettings, attachInfoButton } from './infoDrawer.js';
import {
  FILTER_PRESETS, buildRegexFromSimple, parseSimpleFromRegex,
} from './filterBuilder.js';

/* ── shared row HTML builder ──────────────────────────── */

/**
 * Build a single feed item as a real DOM node. Shared by FeedRenderer.flush
 * and the per-user history modal so both render rows identically.
 *
 * Message bodies use DOM-node construction (text nodes + <img>) rather than
 * innerHTML string assembly so emote tags cannot be partially consumed by
 * later string replacement passes.
 *
 * @param {object} item
 * @param {string} item.user
 * @param {string} item.msg
 * @param {string} item.mood          — one of MOODS or 'bot'
 * @param {number} [item.botScore]
 * @param {number} [item.approvalVote]
 * @param {string} [item.platform]
 * @returns {HTMLElement}
 */
export function buildFeedItemEl({ user, msg, mood, botScore = 0, approvalVote = 0, platform = '', badges = null }) {
  const isBot = mood === 'bot';
  const el = document.createElement('div');
  el.className = 'feed-item' + (isBot ? ' feed-bot' : '');
  const safeUser = sanitize(user);
  const safeMsg = sanitize(msg);
  const userKey = safeUser.toLowerCase();

  const platDot = document.createElement('span');
  platDot.className = 'feed-plat' + (platform ? ' feed-plat-' + platform : '');
  platDot.title = platform || '';
  el.appendChild(platDot);

  // Wrap badges + username in a single grid cell so the fixed-column
  // feed-item layout (see css/feeds.css .feed-item grid-template-columns)
  // stays aligned regardless of how many badges the chatter has.
  const userWrap = document.createElement('span');
  userWrap.className = 'feed-user-wrap';

  if (Array.isArray(badges) && badges.length) {
    for (const b of badges) {
      if (!b || !b.url) continue;
      const img = document.createElement('img');
      img.className = 'feed-badge';
      img.src = b.url;
      img.alt = b.title || '';
      img.title = b.title || '';
      img.referrerPolicy = 'no-referrer';
      img.loading = 'lazy';
      img.onerror = () => { img.remove(); };
      userWrap.appendChild(img);
    }
  }

  const userSpan = document.createElement('span');
  userSpan.className = 'feed-user';
  userSpan.dataset.user = safeUser;
  userSpan.dataset.userKey = userKey;
  userSpan.setAttribute('role', 'button');
  userSpan.tabIndex = 0;
  userSpan.textContent = safeUser;
  userWrap.appendChild(userSpan);
  el.appendChild(userWrap);

  const msgSpan = document.createElement('span');
  msgSpan.className = 'feed-msg';
  appendMessageSegments(msgSpan, safeMsg);
  el.appendChild(msgSpan);

  const moodSpan = document.createElement('span');
  if (isBot) {
    moodSpan.className = 'feed-mood mood-bot';
    moodSpan.textContent = `BOT ${botScore}`;
  } else {
    moodSpan.className = 'feed-mood mood-' + mood;
    moodSpan.textContent = mood;
  }
  el.appendChild(moodSpan);

  if (!isBot) el.appendChild(buildApprovalEl(approvalVote));

  return el;
}


function _approvalParts(vote) {
  const pct = Math.round(Math.min(100, Math.max(0, (vote + 8) / 16 * 100)));
  let color;
  if (vote > 1) color = '#00ffe5';
  else if (vote < -1) color = '#ff4800';
  else color = '#4a4a7a';
  const num = vote > 0 ? '+' + vote.toFixed(1) : vote.toFixed(1);
  return { pct, color, num };
}

export function buildApprovalEl(vote) {
  const { pct, color, num } = _approvalParts(vote);
  const wrap = document.createElement('span');
  wrap.className = 'feed-apv';
  const bar = document.createElement('span');
  bar.className = 'feed-apv-bar';
  const fill = document.createElement('span');
  fill.className = 'feed-apv-fill';
  fill.style.width = pct + '%';
  fill.style.background = color;
  bar.appendChild(fill);
  wrap.appendChild(bar);
  const numEl = document.createElement('span');
  numEl.className = 'feed-apv-num';
  numEl.style.color = color;
  numEl.textContent = num;
  wrap.appendChild(numEl);
  return wrap;
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
  add(user, msg, mood, botScore, approvalVote, platform, badges) {
    if (this._filterFn && !this._filterFn(user, msg, mood, botScore, approvalVote)) return;
    this._pending.push({ user, msg, mood, botScore: botScore || 0, approvalVote: approvalVote || 0, platform: platform || '', badges: badges || null });
    if (!this._rafId) this._rafId = requestAnimationFrame(() => this.flush());
  }

  /**
   * Clear the container and re-queue a set of items through the filter.
   * Used by the filter modal to instantly reflect filter edits.
   */
  replaceAll(items) {
    const list = document.getElementById(this._containerId);
    if (!list) return;
    this._pending = [];
    while (list.firstChild) list.removeChild(list.firstChild);
    for (const it of items) {
      this.add(it.user, it.msg, it.mood, it.botScore, it.approvalVote, it.platform, it.badges);
    }
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
      frag.appendChild(buildFeedItemEl(item));
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
  const valEl = document.getElementById('feedFontVal');
  if (valEl) valEl.textContent = state.feedFontSize.toFixed(2);
  saveRaw(FEED_FONT_KEY, state.feedFontSize);
  try { settings.set('feedFont', state.feedFontSize, { scope: 'feedCard' }); } catch {}
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
  const valEl = document.getElementById('outlierFontVal');
  if (valEl) valEl.textContent = state.outlierFontSize.toFixed(2);
  saveRaw(OUTLIER_FONT_KEY, state.outlierFontSize);
  try { settings.set('outlierFont', state.outlierFontSize, { scope: 'outlierCard' }); } catch {}
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
  const valEl = document.getElementById('filteredFeedFontVal');
  if (valEl) valEl.textContent = state.filteredFeedFontSize.toFixed(2);
  saveRaw(FILTERED_FEED_FONT_KEY, state.filteredFeedFontSize);
  try { settings.set('filteredFeedFont', state.filteredFeedFontSize, { scope: 'filteredFeedCard' }); } catch {}
  applyFilteredFeedFontSize();
}

export function applyFilteredFeedFontSize() {
  const list = document.getElementById('filteredFeedList');
  if (!list) return;
  list.style.fontSize = state.filteredFeedFontSize + 'em';
  list.style.lineHeight = Math.max(1.2, 1.4 + (state.filteredFeedFontSize - 2) * 0.15).toFixed(2);
}

/* ── info drawer registration for feed / filtered / outlier ────────── */

function _buildFontSliderRow({ sliderId, valId, value, min, max, step, onInput, label = 'TEXT SIZE' }) {
  const row = document.createElement('div');
  row.className = 'sw-slider-row';
  row.innerHTML = `
    <span class="sw-slider-label">${label}</span>
    <input type="range" id="${sliderId}" min="${min}" max="${max}" step="${step}" value="${value}">
    <span class="sw-slider-val" id="${valId}">${(+value).toFixed(2)}</span>
  `;
  const slider = row.querySelector('input');
  slider.addEventListener('input', () => onInput(slider.value));
  return row;
}

export function registerFeedInfoDrawers() {
  registerModuleSettings('feedCard', (body) => {
    body.appendChild(_buildFontSliderRow({
      sliderId: 'feedFontSlider', valId: 'feedFontVal',
      value: state.feedFontSize, min: 0.1, max: 20, step: 0.05,
      onInput: updateFeedFontSize,
    }));
  }, { title: 'LIVE FEED' });

  registerModuleSettings('outlierCard', (body) => {
    body.appendChild(_buildFontSliderRow({
      sliderId: 'outlierFontSlider', valId: 'outlierFontVal',
      value: state.outlierFontSize, min: 0.1, max: 20, step: 0.05,
      onInput: updateOutlierFontSize,
    }));
  }, { title: 'STANDOUT MESSAGES' });

  registerModuleSettings('filteredFeedCard', (body) => {
    body.appendChild(_buildFontSliderRow({
      sliderId: 'filteredFeedFontSlider', valId: 'filteredFeedFontVal',
      value: state.filteredFeedFontSize, min: 0.1, max: 20, step: 0.05,
      onInput: updateFilteredFeedFontSize,
    }));
    // Secondary action: open the full filter editor modal. The editor is
    // complex enough (simple/advanced tabs, chip inputs, regex, username,
    // history) to warrant its own overlay — this drawer links to it.
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'filter-btn filter-btn-primary';
    editBtn.style.cssText = 'margin-top:4px;width:100%;padding:10px';
    editBtn.textContent = 'Edit filter (regex / chips / username)';
    editBtn.addEventListener('click', () => {
      // Close the info drawer first so the filter modal isn't covered.
      import('./infoDrawer.js').then(m => m.closeInfoDrawer());
      openFilterModal();
    });
    body.appendChild(editBtn);
  }, { title: 'FILTERED FEED' });
}

export function attachFeedInfoButtons() {
  const map = [
    ['feedCard',         'LIVE FEED'],
    ['outlierCard',      'STANDOUT MESSAGES'],
    ['filteredFeedCard', 'FILTERED FEED'],
  ];
  for (const [moduleId, title] of map) {
    const card = document.getElementById(moduleId);
    if (!card) continue;
    const titleRow = card.querySelector('.feed-title-row .feed-title');
    if (!titleRow) continue;
    // Remove the old "?" help button — its content moves into the drawer.
    const oldHelp = titleRow.querySelector('.help-btn');
    if (oldHelp) oldHelp.remove();
    // Only attach once
    if (!titleRow.querySelector('.card-info-btn')) {
      attachInfoButton(titleRow, moduleId, { title });
    }
  }
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

  const parsed = parseSimpleFromRegex(rx || '');
  if (parsed) {
    _applySimpleStateToUI(parsed);
    setFilterTab('simple');
  } else {
    setFilterTab('advanced');
  }
  onFilterModalInput();
}

/* ── simple-mode chip inputs + presets ──────────────────── */

let _includeChip = null;
let _excludeChip = null;
let _presetsBuilt = false;
let _activeTab = 'simple';

function _ensureChipInputs() {
  if (!_includeChip) {
    const inc = document.getElementById('filterIncludeChips');
    if (inc) _includeChip = createChipInput(inc, {
      placeholder: 'type a word, press Enter',
      onChange: () => onFilterModalInput(),
    });
  }
  if (!_excludeChip) {
    const exc = document.getElementById('filterExcludeChips');
    if (exc) _excludeChip = createChipInput(exc, {
      placeholder: 'type a word to exclude',
      onChange: () => onFilterModalInput(),
    });
  }
  if (!_presetsBuilt) {
    const host = document.getElementById('filterPresets');
    if (host) {
      host.innerHTML = '';
      for (const p of FILTER_PRESETS) {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'filter-preset';
        btn.dataset.presetId = p.id;
        btn.textContent = p.label;
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => {
          const on = btn.getAttribute('aria-pressed') !== 'true';
          btn.setAttribute('aria-pressed', on ? 'true' : 'false');
          btn.classList.toggle('active', on);
          onFilterModalInput();
        });
        host.appendChild(btn);
      }
      _presetsBuilt = true;
    }
  }
}

function _currentSimpleState() {
  const wholeWord = !!document.getElementById('filterWholeWord')?.checked;
  const presets = Array.from(document.querySelectorAll('#filterPresets .filter-preset[aria-pressed="true"]'))
    .map(b => b.dataset.presetId);
  return {
    include: _includeChip ? _includeChip.getChips() : [],
    exclude: _excludeChip ? _excludeChip.getChips() : [],
    wholeWord,
    presets,
  };
}

function _applySimpleStateToUI(simple) {
  _ensureChipInputs();
  if (_includeChip) _includeChip.setChips(simple.include || []);
  if (_excludeChip) _excludeChip.setChips(simple.exclude || []);
  const ww = document.getElementById('filterWholeWord');
  if (ww) ww.checked = !!simple.wholeWord;
  const ids = new Set(simple.presets || []);
  for (const btn of document.querySelectorAll('#filterPresets .filter-preset')) {
    const on = ids.has(btn.dataset.presetId);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.classList.toggle('active', on);
  }
}

export function setFilterTab(which) {
  _activeTab = which === 'advanced' ? 'advanced' : 'simple';
  saveRaw(FILTER_TAB_KEY, _activeTab);
  const simplePanel = document.getElementById('filterModeSimple');
  const advPanel = document.getElementById('filterModeAdvanced');
  const simpleTab = document.getElementById('filterTabSimple');
  const advTab = document.getElementById('filterTabAdvanced');
  if (simplePanel) simplePanel.hidden = _activeTab !== 'simple';
  if (advPanel) advPanel.hidden = _activeTab !== 'advanced';
  if (simpleTab) {
    simpleTab.classList.toggle('active', _activeTab === 'simple');
    simpleTab.setAttribute('aria-selected', String(_activeTab === 'simple'));
  }
  if (advTab) {
    advTab.classList.toggle('active', _activeTab === 'advanced');
    advTab.setAttribute('aria-selected', String(_activeTab === 'advanced'));
  }
  onFilterModalInput();
}

/** Active source regex string based on the current tab + inputs. */
function _currentRegexSource() {
  if (_activeTab === 'simple') {
    const simple = _currentSimpleState();
    const { source } = buildRegexFromSimple(simple);
    return { source, ok: true };
  }
  const rxInput = document.getElementById('filterRegexInput');
  const source = (rxInput?.value || '').trim();
  if (!source) return { source: '', ok: true };
  try { new RegExp(source, 'i'); return { source, ok: true }; }
  catch { return { source, ok: false }; }
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

  _suppressLiveCommit = true;

  _ensureChipInputs();

  const rxInput = document.getElementById('filterRegexInput');
  const userInput = document.getElementById('filterUserInput');
  const savedRegex = loadRaw(REGEX_STORAGE_KEY, '') || '';
  if (rxInput) rxInput.value = savedRegex;
  if (userInput) userInput.value = loadRaw(USER_FILTER_STORAGE_KEY, '') || '';

  // Prefer a saved simple state; fall back to reverse-parsing the saved regex.
  let simple = load(FILTER_SIMPLE_STATE_KEY, null);
  if (!simple || typeof simple !== 'object') {
    simple = parseSimpleFromRegex(savedRegex) || { include: [], exclude: [], wholeWord: false, presets: [] };
  }
  _applySimpleStateToUI(simple);
  state.filteredFeedSimple = simple;

  // Decide active tab: persisted choice wins, but switch to Advanced if the
  // saved regex couldn't be round-tripped into a simple state.
  const saved = loadRaw(FILTER_TAB_KEY, 'simple');
  const canSimple = !!parseSimpleFromRegex(savedRegex);
  setFilterTab((saved === 'advanced' || !canSimple) ? (canSimple ? saved : 'advanced') : 'simple');

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

  // Seed the live-commit cache with the current persisted values so the first
  // onFilterModalInput() call doesn't see a spurious change and wipe the feed
  // with the freshly-emptied preview ring.
  _lastLiveRx = (rxInput?.value || '').trim();
  if (_activeTab === 'simple') {
    const { source } = buildRegexFromSimple(_currentSimpleState());
    _lastLiveRx = source;
  }
  _lastLiveUq = (userInput?.value || '').trim().toLowerCase();

  overlay.classList.add('open');
  overlay.hidden = false;
  _suppressLiveCommit = false;
  onFilterModalInput();

  if (_activeTab === 'simple' && _includeChip) setTimeout(() => _includeChip.focus(), 0);
  else if (rxInput) setTimeout(() => rxInput.focus(), 0);
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

  const { source: rxVal, ok: rxOk } = _currentRegexSource();
  const uqVal = userInput.value.trim().toLowerCase();

  let rx = null;
  if (rxVal && rxOk) {
    try { rx = new RegExp(rxVal, 'i'); } catch { /* already flagged */ }
  }
  rxInput.classList.toggle('regex-error', !rxOk);

  // Live-commit: mutate feed state as the user types so the filtered feed
  // updates instantly. The Apply button is only for saving to history.
  _commitFilterLive(rxVal, uqVal, rxOk);

  if (!rxVal && !uqVal) {
    countEl.textContent = `0 of ${_previewRing.length} recent`;
    previewEl.innerHTML = '<div class="filter-preview-hint">'
      + (_activeTab === 'simple'
        ? 'Add a word or preset to preview matches.'
        : 'Type a regex or username to preview matches.')
      + '</div>';
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
    frag.appendChild(buildFeedItemEl({
      user: rec.user, msg: rec.msg, mood: rec.mood,
      botScore: rec.botScore, approvalVote: rec.approvalVote, platform: rec.platform,
      badges: rec.badges
    }));
  }
  previewEl.innerHTML = '';
  previewEl.appendChild(frag);
}

/* ── live commit / apply / clear ─────────────────────── */

// Last-seen values so we skip redundant localStorage writes on every keystroke.
let _lastLiveRx = null;
let _lastLiveUq = null;
// Suppress live commit while openFilterModal is still wiring up UI (setFilterTab
// triggers onFilterModalInput internally, which would otherwise fire before
// we've seeded _lastLiveRx/Uq from the persisted state).
let _suppressLiveCommit = false;

/**
 * Commit the modal's current inputs into live feed state and re-render the
 * filtered feed from the preview ring. Called on every edit in the modal so
 * the feed updates as the user types (no Apply click needed).
 *
 * Invalid regex is ignored (state not clobbered) — the input's .regex-error
 * class is toggled by the caller.
 */
function _commitFilterLive(rxVal, uqVal, rxOk) {
  if (_suppressLiveCommit) return;
  if (!rxOk) return; // leave feed state alone while user is mid-typing a bad regex

  let changed = false;
  if (rxVal !== _lastLiveRx) {
    updateFilteredFeedRegex(rxVal);
    _lastLiveRx = rxVal;
    changed = true;
  }
  if (uqVal !== _lastLiveUq) {
    updateFilteredFeedUserQuery(uqVal);
    _lastLiveUq = uqVal;
    changed = true;
  }
  if (!changed) return;

  // Persist simple-mode state (or reverse-parsed from raw regex) so reopening
  // the modal doesn't lose chips. Only runs when the filter actually changed.
  if (_activeTab === 'simple') {
    const simple = _currentSimpleState();
    state.filteredFeedSimple = simple;
    save(FILTER_SIMPLE_STATE_KEY, simple);
  } else {
    const parsed = parseSimpleFromRegex(rxVal);
    if (parsed) {
      state.filteredFeedSimple = parsed;
      save(FILTER_SIMPLE_STATE_KEY, parsed);
    }
  }

  updateFilterTriggerButton();

  // Replay buffered messages through the new filter so the feed visually
  // reflects the change, not just future messages.
  filteredFeed.replaceAll(_previewRing);
}

export function applyFilterModal() {
  // State was already committed live as the user typed. Apply just saves the
  // current filter to history and closes the modal.
  const rxInput = document.getElementById('filterRegexInput');
  const userInput = document.getElementById('filterUserInput');
  if (!rxInput || !userInput) return;
  const uqVal = userInput.value.trim();

  let rxVal = '';
  if (_activeTab === 'simple') {
    const { source } = buildRegexFromSimple(_currentSimpleState());
    rxVal = source;
  } else {
    rxVal = rxInput.value.trim();
    try { new RegExp(rxVal, 'i'); }
    catch { rxInput.classList.add('regex-error'); return; }
  }

  if (rxVal || uqVal) saveFilterToHistory(rxVal, uqVal.toLowerCase());
  renderFilterHistory();
  closeFilterModal();
}

export function clearFilterModal() {
  const rxInput = document.getElementById('filterRegexInput');
  const userInput = document.getElementById('filterUserInput');
  if (rxInput) { rxInput.value = ''; rxInput.classList.remove('regex-error'); }
  if (userInput) userInput.value = '';
  const empty = { include: [], exclude: [], wholeWord: false, presets: [] };
  _applySimpleStateToUI(empty);
  state.filteredFeedSimple = empty;
  save(FILTER_SIMPLE_STATE_KEY, null);
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
