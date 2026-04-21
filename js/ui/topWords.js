// Top-10 substring frequency list — DOM renderer.
// Builds 10 rows once; mutations touch only textContent, image src, and bar
// width on each update. Handles emote rendering for rows whose word matches a
// known Twitch/Kick placeholder or a third-party BTTV/7TV/FFZ emote.

import { state } from '../state.js';

const ROWS = 10;
const FETCH_POOL = 30; // pull a few extras to give the phrase-dedupe room to work

let listEl = null;
let rows = [];

// Emotes captured live from [emote:...] placeholders. Keyed by lowercase name.
const seenEmotes = new Map();
const EMOTE_PH_RE = /\[emote:(twitch|kick)(?::[^:\]]+)?:([A-Za-z0-9_]+):([A-Za-z0-9_]+)\]/g;
const CDN = {
  twitch: (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`,
  kick:   (id) => `https://files.kick.com/emotes/${id}/fullsize`,
};

// Lazy case-insensitive index over state.thirdPartyEmotes — refreshed only
// when its size changes so hot-path lookups stay cheap.
let tpeIdx = new Map();
let tpeIdxSize = -1;
function refreshTpeIdx() {
  const tpe = state.thirdPartyEmotes;
  if (!tpe) { tpeIdx.clear(); tpeIdxSize = 0; return; }
  if (tpe.size === tpeIdxSize) return;
  tpeIdx = new Map();
  for (const [name, v] of tpe) {
    tpeIdx.set(String(name).toLowerCase(), { url: v.url, name });
  }
  tpeIdxSize = tpe.size;
}

export function captureEmotesFromMessage(msg) {
  if (!msg || typeof msg !== 'string') return;
  EMOTE_PH_RE.lastIndex = 0;
  let m;
  while ((m = EMOTE_PH_RE.exec(msg)) !== null) {
    const [, source, id, name] = m;
    const k = name.toLowerCase();
    if (seenEmotes.has(k)) continue;
    const urlFn = CDN[source];
    if (urlFn) seenEmotes.set(k, { url: urlFn(id), name });
  }
}

function lookupEmote(word) {
  if (!word || word.indexOf(' ') !== -1) return null; // bigrams never render as emotes
  const k = word.toLowerCase();
  const hit = seenEmotes.get(k);
  if (hit) return hit;
  refreshTpeIdx();
  return tpeIdx.get(k) || null;
}

function build() {
  listEl.innerHTML = '';
  rows = [];
  for (let i = 0; i < ROWS; i++) {
    const li = document.createElement('li');
    li.className = 'top-words-row tw-empty';
    const rank = document.createElement('span'); rank.className = 'tw-rank'; rank.textContent = String(i + 1);
    const img = document.createElement('img'); img.className = 'tw-emote'; img.alt = ''; img.hidden = true; img.decoding = 'async'; img.loading = 'lazy';
    const word = document.createElement('span'); word.className = 'tw-word'; word.textContent = '-';
    const count = document.createElement('span'); count.className = 'tw-count'; count.textContent = '';
    const barWrap = document.createElement('span'); barWrap.className = 'tw-bar-wrap';
    const bar = document.createElement('span'); bar.className = 'tw-bar'; bar.style.width = '0%';
    barWrap.appendChild(bar);
    li.appendChild(rank);
    li.appendChild(img);
    li.appendChild(word);
    li.appendChild(count);
    li.appendChild(barWrap);
    listEl.appendChild(li);
    rows.push({ li, rank, img, word, count, bar, currentImgSrc: null });
  }
}

export function initTopWords() {
  listEl = document.getElementById('topWordsList');
  if (!listEl) return;
  build();
}

// Drop unigrams whose count is mostly accounted for by a bigram that contains
// them. This lets the phrase take the slot the constituent word would have
// otherwise claimed.
function dedupePhrases(list) {
  const bigramFloorByWord = new Map();
  for (const e of list) {
    const sp = e.word.indexOf(' ');
    if (sp === -1) continue;
    const w1 = e.word.slice(0, sp);
    const w2 = e.word.slice(sp + 1);
    if ((bigramFloorByWord.get(w1) || 0) < e.count) bigramFloorByWord.set(w1, e.count);
    if ((bigramFloorByWord.get(w2) || 0) < e.count) bigramFloorByWord.set(w2, e.count);
  }
  const out = [];
  for (const e of list) {
    const isBigram = e.word.indexOf(' ') !== -1;
    if (isBigram) { out.push(e); continue; }
    const bf = bigramFloorByWord.get(e.word) || 0;
    if (bf >= e.count * 0.5) continue; // phrase dominates → drop the unigram
    out.push(e);
  }
  return out;
}

export function updateTopWords(rawList) {
  if (!listEl || !rows.length) return;
  const deduped = dedupePhrases(rawList || []);
  const display = deduped.slice(0, ROWS);
  const maxCount = display[0]?.count || 1;

  for (let i = 0; i < ROWS; i++) {
    const r = rows[i];
    const entry = display[i];
    if (entry) {
      if (r.word.textContent !== entry.word) r.word.textContent = entry.word;
      const cStr = String(entry.count);
      if (r.count.textContent !== cStr) r.count.textContent = cStr;
      const pct = Math.max(2, Math.round((entry.count / maxCount) * 100));
      r.bar.style.width = pct + '%';
      r.li.classList.remove('tw-empty');

      const emote = lookupEmote(entry.word);
      if (emote) {
        if (r.currentImgSrc !== emote.url) {
          r.img.src = emote.url;
          r.img.alt = emote.name;
          r.currentImgSrc = emote.url;
        }
        r.img.hidden = false;
      } else {
        if (!r.img.hidden) {
          r.img.hidden = true;
          r.img.removeAttribute('src');
          r.currentImgSrc = null;
          r.img.alt = '';
        }
      }
    } else {
      if (r.word.textContent !== '-') r.word.textContent = '-';
      if (r.count.textContent !== '') r.count.textContent = '';
      r.bar.style.width = '0%';
      r.li.classList.add('tw-empty');
      if (!r.img.hidden) {
        r.img.hidden = true;
        r.img.removeAttribute('src');
        r.currentImgSrc = null;
        r.img.alt = '';
      }
    }
  }
}

// How many entries the engine should hand us so phrase-dedupe has room to work.
export function fetchPoolSize() { return FETCH_POOL; }

export function clearTopWordsUI() {
  if (!listEl || !rows.length) return;
  for (const r of rows) {
    r.word.textContent = '-';
    r.count.textContent = '';
    r.bar.style.width = '0%';
    r.li.classList.add('tw-empty');
    r.img.hidden = true;
    r.img.removeAttribute('src');
    r.currentImgSrc = null;
    r.img.alt = '';
  }
}

// Apply display settings — the CSS vars are read by css/top-words.css.
export function applyDisplaySettings({ fontScale, emoteSize }) {
  const root = document.getElementById('topWordsCard');
  if (!root) return;
  if (typeof fontScale === 'number' && isFinite(fontScale)) {
    root.style.setProperty('--tw-font-scale', String(fontScale));
  }
  if (typeof emoteSize === 'number' && isFinite(emoteSize)) {
    root.style.setProperty('--tw-emote-size', Math.round(emoteSize) + 'px');
  }
}

export function resizeTopWordsPanel() { /* flow-sized — nothing to recompute */ }
