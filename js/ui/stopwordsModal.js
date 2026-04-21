// Top-Words settings — decay/text-size/emote-size sliders plus the stopword
// editor. Registered as the topWordsCard info drawer builder. State persists
// in localStorage and is pushed live into the counting engine and renderer.

import { load, save } from '../utils/storage.js';
import { createChipInput } from './chipInput.js';
import { setStopwordOverrides, setWindowMs, DEFAULT_WINDOW_MS } from '../analysis/topWords.js';
import { DEFAULT_STOPWORDS } from '../analysis/stopwords.js';
import { applyDisplaySettings } from './topWords.js';
import { registerModuleSettings, attachInfoButton, openInfoDrawer } from './infoDrawer.js';

const STOPWORDS_KEY = 'mr.topwords.stopwords.v1';
const DISPLAY_KEY = 'mr.topwords.display.v1';

const DISPLAY_DEFAULTS = { windowMs: DEFAULT_WINDOW_MS, fontScale: 1.0, emoteSize: 22 };
const WINDOW_MIN = 15_000;
const WINDOW_MAX = 300_000;
const FONT_MIN = 0.7;
const FONT_MAX = 2.0;
const EMOTE_MIN = 14;
const EMOTE_MAX = 40;

let stopwordsState = { add: [], remove: [] };
let displayState = { ...DISPLAY_DEFAULTS };

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

function readStopwords() {
  const raw = load(STOPWORDS_KEY, { add: [], remove: [] }) || {};
  const add = Array.isArray(raw.add) ? raw.add.map(s => String(s).toLowerCase()) : [];
  const remove = Array.isArray(raw.remove) ? raw.remove.map(s => String(s).toLowerCase()) : [];
  return { add, remove };
}

function readDisplay() {
  const raw = load(DISPLAY_KEY, {}) || {};
  return {
    windowMs:  clamp(Number(raw.windowMs)  || DISPLAY_DEFAULTS.windowMs,  WINDOW_MIN, WINDOW_MAX),
    fontScale: clamp(Number(raw.fontScale) || DISPLAY_DEFAULTS.fontScale, FONT_MIN,   FONT_MAX),
    emoteSize: clamp(Number(raw.emoteSize) || DISPLAY_DEFAULTS.emoteSize, EMOTE_MIN,  EMOTE_MAX),
  };
}

function persistStopwords() {
  save(STOPWORDS_KEY, stopwordsState);
  setStopwordOverrides(stopwordsState);
}

function persistDisplay() {
  save(DISPLAY_KEY, displayState);
}

// Called once on boot: apply persisted values to engine + CSS vars before the
// first message arrives. Safe to call before the drawer has been opened.
export function loadStopwordOverrides() {
  stopwordsState = readStopwords();
  setStopwordOverrides(stopwordsState);
  displayState = readDisplay();
  setWindowMs(displayState.windowMs);
  applyDisplaySettings({ fontScale: displayState.fontScale, emoteSize: displayState.emoteSize });
  return stopwordsState;
}

function fmtWindow(ms) {
  if (ms >= 60_000) return (ms / 60_000).toFixed(ms % 60_000 === 0 ? 0 : 1) + 'm';
  return Math.round(ms / 1000) + 's';
}

function renderDefaultsGrid(wrap) {
  wrap.innerHTML = '';
  const unblocked = new Set(stopwordsState.remove);
  const words = Array.from(DEFAULT_STOPWORDS).sort();
  for (const w of words) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sw-default-chip' + (unblocked.has(w) ? ' sw-default-chip-unblocked' : '');
    chip.textContent = w;
    chip.title = unblocked.has(w) ? 'Click to re-block' : 'Click to unblock (let this word appear in the top-10)';
    chip.addEventListener('click', () => {
      const set = new Set(stopwordsState.remove);
      if (set.has(w)) set.delete(w); else set.add(w);
      stopwordsState.remove = Array.from(set);
      persistStopwords();
      renderDefaultsGrid(wrap);
    });
    wrap.appendChild(chip);
  }
}

/**
 * Build the topWordsCard info drawer body. Called every time the drawer opens.
 */
function buildTopWordsSettings(body) {
  // Refresh state in case it drifted (another tab, etc.)
  stopwordsState = readStopwords();
  displayState = readDisplay();

  body.innerHTML = `
    <div class="sw-slider-section">
      <div class="sw-slider-row">
        <span class="sw-slider-label">DECAY WINDOW</span>
        <input type="range" id="swDecaySlider" min="${WINDOW_MIN}" max="${WINDOW_MAX}" step="5000" value="${displayState.windowMs}">
        <span class="sw-slider-val" id="swDecayVal">${fmtWindow(displayState.windowMs)}</span>
      </div>
      <div class="sw-slider-row">
        <span class="sw-slider-label">TEXT SIZE</span>
        <input type="range" id="swFontSlider" min="${FONT_MIN}" max="${FONT_MAX}" step="0.05" value="${displayState.fontScale}">
        <span class="sw-slider-val" id="swFontVal">${displayState.fontScale.toFixed(2)}x</span>
      </div>
      <div class="sw-slider-row">
        <span class="sw-slider-label">EMOTE SIZE</span>
        <input type="range" id="swEmoteSlider" min="${EMOTE_MIN}" max="${EMOTE_MAX}" step="1" value="${displayState.emoteSize}">
        <span class="sw-slider-val" id="swEmoteVal">${Math.round(displayState.emoteSize)}px</span>
      </div>
    </div>

    <div class="stopwords-field">
      <span class="stopwords-field-label">EXTRA STOPWORDS</span>
      <div id="stopwordsAddChips"></div>
    </div>

    <div class="stopwords-field">
      <span class="stopwords-field-label">DEFAULT STOPWORDS &mdash; CLICK TO UNBLOCK</span>
      <div class="sw-defaults-grid" id="stopwordsDefaultsGrid"></div>
    </div>

    <div class="stopwords-actions">
      <button type="button" class="stopwords-reset" id="stopwordsReset">Reset all</button>
    </div>
  `;

  // Chip input
  const addedChips = createChipInput(body.querySelector('#stopwordsAddChips'), {
    placeholder: 'type a word, press Enter',
    onChange: chips => {
      stopwordsState.add = chips.map(s => s.toLowerCase());
      persistStopwords();
    },
  });
  addedChips.setChips(stopwordsState.add);

  // Defaults grid
  const defaultsWrap = body.querySelector('#stopwordsDefaultsGrid');
  renderDefaultsGrid(defaultsWrap);

  // Sliders
  const decay = body.querySelector('#swDecaySlider');
  const decayVal = body.querySelector('#swDecayVal');
  decay.addEventListener('input', () => {
    decayVal.textContent = fmtWindow(Number(decay.value));
  });
  decay.addEventListener('change', () => {
    const ms = clamp(Number(decay.value), WINDOW_MIN, WINDOW_MAX);
    displayState.windowMs = ms;
    persistDisplay();
    setWindowMs(ms);
  });

  const font = body.querySelector('#swFontSlider');
  const fontVal = body.querySelector('#swFontVal');
  font.addEventListener('input', () => {
    const v = Number(font.value);
    fontVal.textContent = v.toFixed(2) + 'x';
    applyDisplaySettings({ fontScale: v });
    displayState.fontScale = v;
  });
  font.addEventListener('change', () => persistDisplay());

  const emote = body.querySelector('#swEmoteSlider');
  const emoteVal = body.querySelector('#swEmoteVal');
  emote.addEventListener('input', () => {
    const v = Number(emote.value);
    emoteVal.textContent = Math.round(v) + 'px';
    applyDisplaySettings({ emoteSize: v });
    displayState.emoteSize = v;
  });
  emote.addEventListener('change', () => persistDisplay());

  body.querySelector('#stopwordsReset').addEventListener('click', () => {
    stopwordsState = { add: [], remove: [] };
    persistStopwords();
    displayState = { ...DISPLAY_DEFAULTS };
    persistDisplay();
    setWindowMs(displayState.windowMs);
    applyDisplaySettings(displayState);
    // Rebuild this drawer body to reflect the reset.
    buildTopWordsSettings(body);
  });
}

export function registerTopWordsInfoDrawer() {
  registerModuleSettings('topWordsCard', buildTopWordsSettings, { title: 'TOP 10 SUBSTRINGS' });
}

export function attachTopWordsInfoButton() {
  const card = document.getElementById('topWordsCard');
  if (!card) return;
  const titleEl = card.querySelector('.chart-title.card-title');
  if (!titleEl) return;
  // Remove the standalone help-btn "?" and gear-icon buttons — all content
  // moves into the module info drawer.
  titleEl.querySelectorAll('.help-btn').forEach(b => b.remove());
  if (!titleEl.querySelector('.card-info-btn')) {
    attachInfoButton(titleEl, 'topWordsCard', { title: 'TOP 10 SUBSTRINGS' });
  }
}

/**
 * Back-compat: any external caller of openStopwordsModal() opens the new
 * info drawer for topWordsCard instead.
 */
export function openStopwordsModal() { openInfoDrawer('topWordsCard'); }
export function closeStopwordsModal() {
  // The info drawer handles its own close; callers that used to flip the
  // old overlay hidden flag are no longer needed.
}
