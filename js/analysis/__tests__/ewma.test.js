import { describe, it, expect, beforeEach } from 'vitest';
import { expWeight, computeWeightedMoods, computeKeywordWeights, getDominant, pruneWindow } from '../ewma.js';
import { state } from '../../state.js';

describe('expWeight', () => {
  it('returns 1.0 for age=0 (brand new message)', () => {
    expect(expWeight(0)).toBeCloseTo(1.0);
  });

  it('returns ~0.5 for age equal to half-life', () => {
    // state.HALF_LIFE_MS defaults to 10_000
    expect(expWeight(state.HALF_LIFE_MS)).toBeCloseTo(0.5, 1);
  });

  it('returns ~0.25 for age equal to 2x half-life', () => {
    expect(expWeight(state.HALF_LIFE_MS * 2)).toBeCloseTo(0.25, 1);
  });

  it('returns very small value for very old messages', () => {
    expect(expWeight(state.HALF_LIFE_MS * 10)).toBeLessThan(0.01);
  });

  it('returns value between 0 and 1 for positive age', () => {
    const w = expWeight(5000);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThanOrEqual(1);
  });
});

describe('computeWeightedMoods', () => {
  beforeEach(() => {
    state.scoredMessages = [];
    state.HALF_LIFE_MS = 10_000;
  });

  it('returns null when no scored messages exist', () => {
    expect(computeWeightedMoods(Date.now())).toBeNull();
  });

  it('returns percentages summing to ~100', () => {
    const now = Date.now();
    state.scoredMessages = [
      { ts: now, mood: 'hype', strength: 2 },
      { ts: now, mood: 'funny', strength: 1 },
      { ts: now, mood: 'love', strength: 1 },
    ];
    const pct = computeWeightedMoods(now);
    expect(pct).not.toBeNull();
    const sum = Object.values(pct).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(100, 0);
  });

  it('weights recent messages more heavily than old ones', () => {
    const now = Date.now();
    state.scoredMessages = [
      { ts: now - 30000, mood: 'hype', strength: 2 }, // old hype
      { ts: now, mood: 'funny', strength: 2 }, // recent funny
    ];
    const pct = computeWeightedMoods(now);
    expect(pct.funny).toBeGreaterThan(pct.hype);
  });

  it('prunes messages older than WINDOW_MS', () => {
    const now = Date.now();
    state.scoredMessages = [
      { ts: now - 200_000, mood: 'hype', strength: 2 }, // way too old
      { ts: now, mood: 'funny', strength: 1 },
    ];
    const pct = computeWeightedMoods(now);
    // Old message should have been pruned
    expect(state.scoredMessages.length).toBe(1);
    expect(pct.funny).toBe(100);
  });
});

describe('computeKeywordWeights', () => {
  beforeEach(() => {
    state.keywordStore = new Map();
    state.HALF_LIFE_MS = 10_000;
  });

  it('returns empty array when no keywords tracked', () => {
    const result = computeKeywordWeights(Date.now());
    expect(result).toHaveLength(0);
  });

  it('returns keywords sorted by score descending', () => {
    const now = Date.now();
    state.keywordStore.set('PogChamp', [
      { ts: now, w: 3, mood: 'hype' },
      { ts: now, w: 2, mood: 'hype' },
    ]);
    state.keywordStore.set('KEKW', [{ ts: now, w: 1, mood: 'funny' }]);

    const result = computeKeywordWeights(now);
    expect(result.length).toBe(2);
    expect(result[0].label).toBe('PogChamp');
    expect(result[0].score).toBeGreaterThan(result[1].score);
  });

  it('prunes old keyword entries', () => {
    const now = Date.now();
    state.keywordStore.set('old', [{ ts: now - 200_000, w: 1, mood: 'hype' }]);
    state.keywordStore.set('new', [{ ts: now, w: 1, mood: 'funny' }]);

    const result = computeKeywordWeights(now);
    expect(result.length).toBe(1);
    expect(result[0].label).toBe('new');
    expect(state.keywordStore.has('old')).toBe(false);
  });
});

describe('getDominant', () => {
  it('returns neutral for null input', () => {
    expect(getDominant(null)).toBe('neutral');
  });

  it('returns the mood with highest percentage (excluding neutral)', () => {
    const pct = {
      hype: 30,
      funny: 10,
      love: 5,
      toxic: 0,
      sad: 0,
      calm: 0,
      angry: 0,
      excited: 0,
      cringe: 0,
      wholesome: 0,
      confused: 0,
      neutral: 55,
    };
    expect(getDominant(pct)).toBe('hype');
  });

  it('ignores neutral even if it has the highest percentage', () => {
    const pct = {
      hype: 5,
      funny: 0,
      love: 0,
      toxic: 0,
      sad: 0,
      calm: 0,
      angry: 0,
      excited: 0,
      cringe: 0,
      wholesome: 0,
      confused: 0,
      neutral: 95,
    };
    expect(getDominant(pct)).toBe('hype');
  });
});

describe('pruneWindow', () => {
  beforeEach(() => {
    state.scoredMessages = [];
  });

  it('removes messages older than WINDOW_MS', () => {
    const now = Date.now();
    state.scoredMessages = [
      { ts: now - 200_000, mood: 'hype', strength: 1 },
      { ts: now - 150_000, mood: 'funny', strength: 1 },
      { ts: now - 1000, mood: 'love', strength: 1 },
      { ts: now, mood: 'calm', strength: 1 },
    ];
    pruneWindow(now);
    expect(state.scoredMessages.length).toBe(2);
    expect(state.scoredMessages[0].mood).toBe('love');
  });

  it('keeps all messages within window', () => {
    const now = Date.now();
    state.scoredMessages = [
      { ts: now - 1000, mood: 'hype', strength: 1 },
      { ts: now, mood: 'funny', strength: 1 },
    ];
    pruneWindow(now);
    expect(state.scoredMessages.length).toBe(2);
  });
});
