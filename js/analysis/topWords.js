// Top-10 substring frequency engine.
// Time-bucketed histogram with a running total Map. Handles high-volume chat
// cheaply: per-message cost is O(tokens); pruning is amortized over bucket
// rotations instead of scanned on every query.
//
// Counts both unigrams and bigrams so common phrases ("lets go", "gg wp")
// surface as their own entries. Bigram tokens are stored as "word1 word2".

import { DEFAULT_STOPWORDS } from './stopwords.js';

export const BUCKET_COUNT = 12;
export const DEFAULT_WINDOW_MS = 120_000;
// Mutable so the decay slider can retune without reshuffling the ring.
let BUCKET_MS = Math.floor(DEFAULT_WINDOW_MS / BUCKET_COUNT);

const TOKEN_SPLIT_RE = /[^\p{L}\p{N}]+/u;
const APOSTROPHE_RE = /['’]/g;
const EMOTE_RE = /\[emote:[^:\]]*:[^:\]]*:([^\]]+)\]/g;
const URL_RE = /https?:\/\/\S+/gi;
const MIN_LEN = 2;
const MAX_LEN = 20;

let buckets = Array.from({ length: BUCKET_COUNT }, () => new Map());
let totals = new Map();
let bucketIdx = 0;
let bucketStart = 0;

// Spam dedupe: "user\x00lowercase-trimmed-msg" -> lastSeenTs. Lets the same
// user say the same thing once per window; re-seeing the same message bumps
// the timestamp without counting again. Swept during bucket rotations so it
// stays bounded.
const recentByUserMsg = new Map();
let lastSweepTs = 0;

// Effective stopword set = DEFAULT_STOPWORDS ∪ added − removed.
let added = new Set();
let removed = new Set();

function isStopword(tok) {
  if (removed.has(tok)) return false;
  return DEFAULT_STOPWORDS.has(tok) || added.has(tok);
}

function isValidUnigram(tok) {
  if (!tok) return false;
  const len = tok.length;
  if (len < MIN_LEN || len > MAX_LEN) return false;
  if (isStopword(tok)) return false;
  return true;
}

export function setStopwordOverrides({ add = [], remove = [] } = {}) {
  added = new Set(add.map(s => String(s).toLowerCase()));
  removed = new Set(remove.map(s => String(s).toLowerCase()));
}

export function getBucketMs() { return BUCKET_MS; }
export function getWindowMs() { return BUCKET_MS * BUCKET_COUNT; }

// Change the decay window. Clears current counts — the bucket grid is
// reshaping so stale numbers would be meaningless. Dedupe memory is also
// cleared since its horizon is tied to this same window.
export function setWindowMs(ms) {
  const clamped = Math.max(5_000, Math.min(600_000, Math.floor(Number(ms) || DEFAULT_WINDOW_MS)));
  BUCKET_MS = Math.max(500, Math.floor(clamped / BUCKET_COUNT));
  for (const b of buckets) b.clear();
  totals.clear();
  bucketIdx = 0;
  bucketStart = 0;
  recentByUserMsg.clear();
  lastSweepTs = 0;
  return BUCKET_MS * BUCKET_COUNT;
}

// Returns { unigrams, bigrams }, each a Set<string>. Bigrams are only emitted
// when BOTH adjacent raw tokens would survive the unigram filter — preserving
// the idea that a phrase is a chain of meaningful words.
export function tokenize(msg) {
  if (!msg) return { unigrams: [], bigrams: [] };
  let rest = String(msg);

  const emoteUnigrams = [];
  rest = rest.replace(EMOTE_RE, (_m, name) => {
    const tok = String(name || '').trim().toLowerCase();
    if (isValidUnigram(tok)) emoteUnigrams.push(tok);
    return ' ';
  });

  rest = rest.replace(URL_RE, ' ');
  rest = rest.replace(APOSTROPHE_RE, '');

  const raw = rest.toLowerCase().split(TOKEN_SPLIT_RE);

  const uniSet = new Set(emoteUnigrams);
  const biSet = new Set();

  for (let i = 0; i < raw.length; i++) {
    const a = raw[i];
    if (!a) continue;
    const aOk = isValidUnigram(a);
    if (aOk) uniSet.add(a);

    // Bigrams: skip if either side fails the unigram filter. Phrase length
    // capped to keep the histogram bounded.
    if (!aOk) continue;
    const b = raw[i + 1];
    if (!b || !isValidUnigram(b)) continue;
    const phrase = a + ' ' + b;
    if (phrase.length <= MAX_LEN * 2 + 1) biSet.add(phrase);
  }

  return { unigrams: Array.from(uniSet), bigrams: Array.from(biSet) };
}

function rotateIfNeeded(now) {
  if (bucketStart === 0) { bucketStart = now; return; }
  const elapsed = now - bucketStart;
  if (elapsed < BUCKET_MS) return;
  const steps = Math.min(BUCKET_COUNT, Math.floor(elapsed / BUCKET_MS));
  for (let s = 0; s < steps; s++) {
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
  sweepRecent(now);
}

// Drop dedupe entries older than the current window. Called during bucket
// rotation so it runs at most once per BUCKET_MS.
function sweepRecent(now) {
  const windowMs = BUCKET_MS * BUCKET_COUNT;
  const cutoff = now - windowMs;
  for (const [k, ts] of recentByUserMsg) {
    if (ts < cutoff) recentByUserMsg.delete(k);
  }
  lastSweepTs = now;
}

// True → caller should skip recording this (user, msg) pair. Also refreshes
// the timestamp so sustained spam keeps being blocked.
function shouldDedupe(user, msg, now) {
  if (!user) return false;                    // anonymous can't be deduped
  const norm = String(msg || '').trim().toLowerCase();
  if (!norm) return true;                     // blank message: skip entirely
  const key = String(user).toLowerCase() + '\x00' + norm;
  const last = recentByUserMsg.get(key);
  const windowMs = BUCKET_MS * BUCKET_COUNT;
  if (last !== undefined && now - last < windowMs) {
    recentByUserMsg.set(key, now);
    return true;
  }
  recentByUserMsg.set(key, now);
  return false;
}

export function recordMessage(user, msg, now) {
  rotateIfNeeded(now);
  if (shouldDedupe(user, msg, now)) return;
  const { unigrams, bigrams } = tokenize(msg);
  if (!unigrams.length && !bigrams.length) return;
  const cur = buckets[bucketIdx];
  for (let i = 0; i < unigrams.length; i++) {
    const w = unigrams[i];
    cur.set(w, (cur.get(w) || 0) + 1);
    totals.set(w, (totals.get(w) || 0) + 1);
  }
  for (let i = 0; i < bigrams.length; i++) {
    const w = bigrams[i];
    cur.set(w, (cur.get(w) || 0) + 1);
    totals.set(w, (totals.get(w) || 0) + 1);
  }
}

// Top-N via insertion into a small sorted array. Small n so O(n) insert wins.
export function getTop(n, now) {
  if (now !== undefined) rotateIfNeeded(now);
  const top = [];
  for (const [word, count] of totals) {
    if (top.length < n) {
      top.push({ word, count });
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
  recentByUserMsg.clear();
  lastSweepTs = 0;
}

// Test-only: deterministic reset including stopword overrides and window size.
export function _resetForTests() {
  buckets = Array.from({ length: BUCKET_COUNT }, () => new Map());
  totals = new Map();
  bucketIdx = 0;
  bucketStart = 0;
  added = new Set();
  removed = new Set();
  BUCKET_MS = Math.floor(DEFAULT_WINDOW_MS / BUCKET_COUNT);
  recentByUserMsg.clear();
  lastSweepTs = 0;
}
