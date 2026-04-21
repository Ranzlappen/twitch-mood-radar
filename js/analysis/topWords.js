// Top-10 substring frequency engine.
// Time-bucketed histogram with a running total Map. Handles high-volume chat
// cheaply: per-message cost is O(tokens); pruning is amortized over bucket
// rotations instead of scanned on every query.

import { DEFAULT_STOPWORDS } from './stopwords.js';

export const BUCKET_MS = 10_000;
export const BUCKET_COUNT = 12; // BUCKET_MS * BUCKET_COUNT = 120_000 = WINDOW_MS

const TOKEN_SPLIT_RE = /[^\p{L}\p{N}]+/u;
const APOSTROPHE_RE = /['’]/g;
const EMOTE_RE = /\[emote:[^:\]]*:[^:\]]*:([^\]]+)\]/g;
const URL_RE = /https?:\/\/\S+/gi;
const DIGITS_ONLY_RE = /^\d+$/;
const MIN_LEN = 2;
const MAX_LEN = 20;

// Module-level state.
let buckets = Array.from({ length: BUCKET_COUNT }, () => new Map());
let totals = new Map();
let bucketIdx = 0;
let bucketStart = 0;

// Effective stopword set = DEFAULT_STOPWORDS ∪ added − removed.
let added = new Set();
let removed = new Set();

function isStopword(tok) {
  if (removed.has(tok)) return false;
  return DEFAULT_STOPWORDS.has(tok) || added.has(tok);
}

export function setStopwordOverrides({ add = [], remove = [] } = {}) {
  added = new Set(add.map(s => String(s).toLowerCase()));
  removed = new Set(remove.map(s => String(s).toLowerCase()));
}

export function tokenize(msg) {
  if (!msg) return [];
  const out = new Set();
  let rest = String(msg);

  // 1. Extract emote names first, strip their placeholders.
  rest = rest.replace(EMOTE_RE, (_m, name) => {
    const tok = String(name || '').trim().toLowerCase();
    if (tok && tok.length >= MIN_LEN && tok.length <= MAX_LEN && !DIGITS_ONLY_RE.test(tok) && !isStopword(tok)) {
      out.add(tok);
    }
    return ' ';
  });

  // 2. Strip bare URLs.
  rest = rest.replace(URL_RE, ' ');

  // 3. Collapse apostrophes so "don't" matches "dont" in the stopword list.
  rest = rest.replace(APOSTROPHE_RE, '');

  // 4. Split on any non-letter/number.
  const parts = rest.toLowerCase().split(TOKEN_SPLIT_RE);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!p) continue;
    const len = p.length;
    if (len < MIN_LEN || len > MAX_LEN) continue;
    if (DIGITS_ONLY_RE.test(p)) continue;
    if (isStopword(p)) continue;
    out.add(p);
  }
  return Array.from(out);
}

function rotateIfNeeded(now) {
  if (bucketStart === 0) { bucketStart = now; return; }
  const elapsed = now - bucketStart;
  if (elapsed < BUCKET_MS) return;
  const steps = Math.min(BUCKET_COUNT, Math.floor(elapsed / BUCKET_MS));
  for (let s = 0; s < steps; s++) {
    // Advance to the next bucket; the one we land on becomes the new "current",
    // so its prior contents (now the oldest) get subtracted out first.
    bucketIdx = (bucketIdx + 1) % BUCKET_COUNT;
    const victim = buckets[bucketIdx];
    if (victim.size) {
      for (const [word, c] of victim) {
        const nv = (totals.get(word) || 0) - c;
        if (nv <= 0) totals.delete(word);
        else totals.set(word, nv);
      }
      victim.clear();
    }
  }
  bucketStart = now;
}

export function recordMessage(msg, now) {
  rotateIfNeeded(now);
  const toks = tokenize(msg);
  if (!toks.length) return;
  const cur = buckets[bucketIdx];
  for (let i = 0; i < toks.length; i++) {
    const w = toks[i];
    cur.set(w, (cur.get(w) || 0) + 1);
    totals.set(w, (totals.get(w) || 0) + 1);
  }
}

// Heap-free top-N: maintain a small sorted array by insertion.
export function getTop(n, now) {
  if (now !== undefined) rotateIfNeeded(now);
  const top = [];
  for (const [word, count] of totals) {
    if (top.length < n) {
      top.push({ word, count });
      // Keep sorted descending; small n so O(n) insert is fine.
      for (let i = top.length - 1; i > 0 && top[i].count > top[i - 1].count; i--) {
        const t = top[i]; top[i] = top[i - 1]; top[i - 1] = t;
      }
    } else if (count > top[n - 1].count) {
      top[n - 1] = { word, count };
      for (let i = n - 1; i > 0 && top[i].count > top[i - 1].count; i--) {
        const t = top[i]; top[i] = top[i - 1]; top[i - 1] = t;
      }
    }
  }
  return top;
}

export function clear() {
  for (const b of buckets) b.clear();
  totals.clear();
  bucketIdx = 0;
  bucketStart = 0;
}

// Test-only: deterministic reset including stopword overrides.
export function _resetForTests() {
  buckets = Array.from({ length: BUCKET_COUNT }, () => new Map());
  totals = new Map();
  bucketIdx = 0;
  bucketStart = 0;
  added = new Set();
  removed = new Set();
}
