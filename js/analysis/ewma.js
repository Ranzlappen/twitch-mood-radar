// Exponential Weighted Moving Average scoring
import { state } from '../state.js';
import { MOODS, WINDOW_MS } from '../config.js';

export function expWeight(ageMs) {
  return Math.exp(-ageMs * 0.693147 / state.HALF_LIFE_MS);
}

export function pruneWindow(now) {
  while (state.scoredMessages.length && now - state.scoredMessages[0].ts > WINDOW_MS) {
    state.scoredMessages.shift();
  }
}

export function computeWeightedMoods(now) {
  pruneWindow(now);
  const totals = {hype:0,funny:0,love:0,toxic:0,sad:0,calm:0,angry:0,excited:0,cringe:0,wholesome:0,confused:0,neutral:0};
  let sumW = 0;
  for (const { ts, mood, strength } of state.scoredMessages) {
    const w = expWeight(now - ts) * strength;
    totals[mood] += w; sumW += w;
  }
  if (sumW === 0) return null;
  const pct = {};
  for (const k of MOODS) pct[k] = totals[k] / sumW * 100;
  return pct;
}

export function computeKeywordWeights(now) {
  const cutoff = now - WINDOW_MS;
  for (const [k, arr] of state.keywordStore) {
    while (arr.length && arr[0].ts < cutoff) arr.shift();
    if (arr.length === 0) state.keywordStore.delete(k);
  }
  const result = [];
  for (const [label, arr] of state.keywordStore) {
    let score = 0;
    const moodTotals = {};
    for (const { ts, w, mood:m } of arr) {
      const ew = expWeight(now - ts) * w;
      score += ew;
      moodTotals[m] = (moodTotals[m]||0) + ew;
    }
    let bestM = 'neutral', bestV = 0;
    for (const [m,v] of Object.entries(moodTotals)) if (v > bestV) { bestV = v; bestM = m; }
    result.push({ label, score, mood:bestM });
  }
  result.sort((a,b) => b.score - a.score);
  return result;
}

export function getDominant(pct) {
  if (!pct) return 'neutral';
  let best = 'neutral', bestV = 0;
  for (const m of MOODS) if (m !== 'neutral' && pct[m] > bestV) { bestV = pct[m]; best = m; }
  return best;
}
