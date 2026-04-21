// Top-Words settings modal — decay/text-size/emote-size sliders plus the
// stopword editor. State persists in localStorage and is pushed live into the
// counting engine and the DOM renderer.

import { load, save } from '../utils/storage.js';
import { createChipInput } from './chipInput.js';
import { setStopwordOverrides, setWindowMs, DEFAULT_WINDOW_MS } from '../analysis/topWords.js';
import { DEFAULT_STOPWORDS } from '../analysis/stopwords.js';
import { applyDisplaySettings } from './topWords.js';

const STOPWORDS_KEY = 'mr.topwords.stopwords.v1';
const DISPLAY_KEY = 'mr.topwords.display.v1';

const DISPLAY_DEFAULTS = { windowMs: DEFAULT_WINDOW_MS, fontScale: 1.0, emoteSize: 22 };
const WINDOW_MIN = 15_000;
const WINDOW_MAX = 300_000;
const FONT_MIN = 0.7;
const FONT_MAX = 2.0;
const EMOTE_MIN = 14;
const EMOTE_MAX = 40;

let addedChips = null;
let defaultsInited = false;
let defaultsWrap = null;

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
// first message arrives. Safe to call before the modal DOM exists.
export function loadStopwordOverrides() {
  stopwordsState = readStopwords();
  setStopwordOverrides(stopwordsState);
  displayState = readDisplay();
  setWindowMs(displayState.windowMs);
  applyDisplaySettings({ fontScale: displayState.fontScale, emoteSize: displayState.emoteSize });
  return stopwordsState;
}

function renderDefaultsGrid() {
  if (!defaultsWrap) return;
  defaultsWrap.innerHTML = '';
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
      renderDefaultsGrid();
    });
    defaultsWrap.appendChild(chip);
  }
}

function fmtWindow(ms) {
  if (ms >= 60_000) return (ms / 60_000).toFixed(ms % 60_000 === 0 ? 0 : 1) + 'm';
  return Math.round(ms / 1000) + 's';
}

function buildDom() {
  const overlay = document.createElement('div');
  overlay.id = 'stopwordsOverlay';
  overlay.className = 'help-overlay stopwords-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'stopwordsTitle');
  overlay.hidden = true;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.innerHTML = `
    <div class="help-modal stopwords-modal">
      <button class="help-close" id="stopwordsClose" aria-label="Close top-words settings">x</button>
      <h3 id="stopwordsTitle">TOP WORDS SETTINGS</h3>

      <div class="sw-slider-section">
        <div class="sw-slider-row">
          <span class="sw-slider-label">DECAY WINDOW</span>
          <input type="range" id="swDecaySlider" min="${WINDOW_MIN}" max="${WINDOW_MAX}" step="5000">
          <span class="sw-slider-val" id="swDecayVal"></span>
        </div>
        <div class="sw-slider-row">
          <span class="sw-slider-label">TEXT SIZE</span>
          <input type="range" id="swFontSlider" min="${FONT_MIN}" max="${FONT_MAX}" step="0.05">
          <span class="sw-slider-val" id="swFontVal"></span>
        </div>
        <div class="sw-slider-row">
          <span class="sw-slider-label">EMOTE SIZE</span>
          <input type="range" id="swEmoteSlider" min="${EMOTE_MIN}" max="${EMOTE_MAX}" step="1">
          <span class="sw-slider-val" id="swEmoteVal"></span>
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
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('stopwordsClose').addEventListener('click', close);

  document.getElementById('stopwordsReset').addEventListener('click', () => {
    // Clear all stopword overrides
    stopwordsState = { add: [], remove: [] };
    addedChips.setChips([]);
    persistStopwords();
    renderDefaultsGrid();
    // Reset display settings
    displayState = { ...DISPLAY_DEFAULTS };
    persistDisplay();
    setWindowMs(displayState.windowMs);
    applyDisplaySettings(displayState);
    syncSliderUi();
  });

  // Chip input for extra stopwords
  addedChips = createChipInput(document.getElementById('stopwordsAddChips'), {
    placeholder: 'type a word, press Enter',
    onChange: chips => {
      stopwordsState.add = chips.map(s => s.toLowerCase());
      persistStopwords();
    }
  });
  addedChips.setChips(stopwordsState.add);

  // Defaults grid
  defaultsWrap = document.getElementById('stopwordsDefaultsGrid');
  renderDefaultsGrid();

  // Sliders — wire up live-update
  const decay = document.getElementById('swDecaySlider');
  const decayVal = document.getElementById('swDecayVal');
  decay.addEventListener('input', () => {
    const ms = Number(decay.value);
    decayVal.textContent = fmtWindow(ms);
  });
  decay.addEventListener('change', () => {
    const ms = clamp(Number(decay.value), WINDOW_MIN, WINDOW_MAX);
    displayState.windowMs = ms;
    persistDisplay();
    setWindowMs(ms);
  });

  const font = document.getElementById('swFontSlider');
  const fontVal = document.getElementById('swFontVal');
  font.addEventListener('input', () => {
    const v = Number(font.value);
    fontVal.textContent = v.toFixed(2) + 'x';
    applyDisplaySettings({ fontScale: v });
    displayState.fontScale = v;
  });
  font.addEventListener('change', () => persistDisplay());

  const emote = document.getElementById('swEmoteSlider');
  const emoteVal = document.getElementById('swEmoteVal');
  emote.addEventListener('input', () => {
    const v = Number(emote.value);
    emoteVal.textContent = Math.round(v) + 'px';
    applyDisplaySettings({ emoteSize: v });
    displayState.emoteSize = v;
  });
  emote.addEventListener('change', () => persistDisplay());

  syncSliderUi();
  defaultsInited = true;
}

function syncSliderUi() {
  const decay = document.getElementById('swDecaySlider');
  const decayVal = document.getElementById('swDecayVal');
  const font = document.getElementById('swFontSlider');
  const fontVal = document.getElementById('swFontVal');
  const emote = document.getElementById('swEmoteSlider');
  const emoteVal = document.getElementById('swEmoteVal');
  if (decay && decayVal) { decay.value = String(displayState.windowMs); decayVal.textContent = fmtWindow(displayState.windowMs); }
  if (font && fontVal)   { font.value  = String(displayState.fontScale); fontVal.textContent  = displayState.fontScale.toFixed(2) + 'x'; }
  if (emote && emoteVal) { emote.value = String(displayState.emoteSize); emoteVal.textContent = Math.round(displayState.emoteSize) + 'px'; }
}

function ensureDom() {
  if (document.getElementById('stopwordsOverlay')) return;
  stopwordsState = readStopwords();
  displayState = readDisplay();
  buildDom();
}

export function openStopwordsModal() {
  ensureDom();
  // Refresh state from storage in case it drifted (e.g. opened in another tab).
  stopwordsState = readStopwords();
  displayState = readDisplay();
  if (defaultsInited) {
    addedChips.setChips(stopwordsState.add);
    renderDefaultsGrid();
    syncSliderUi();
  }
  const overlay = document.getElementById('stopwordsOverlay');
  overlay.hidden = false;
  overlay.classList.add('open');
}

function close() {
  const overlay = document.getElementById('stopwordsOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.hidden = true;
}

export function closeStopwordsModal() { close(); }
