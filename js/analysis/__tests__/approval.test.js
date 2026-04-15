import { describe, it, expect, beforeEach } from 'vitest';
import { computeApproval, approvalVerdict } from '../approval.js';
import { state } from '../../state.js';

describe('computeApproval', () => {
  beforeEach(() => {
    state.approvalStore = [];
    state.HALF_LIFE_MS = 10_000;
  });

  it('returns null when no approval data exists', () => {
    expect(computeApproval(Date.now())).toBeNull();
  });

  it('returns 100 (max approval) when all votes are strongly positive', () => {
    const now = Date.now();
    state.approvalStore = [
      { ts: now, vote: 5 },
      { ts: now, vote: 5 },
      { ts: now, vote: 5 },
    ];
    const result = computeApproval(now);
    expect(result).toBeCloseTo(100, 0);
  });

  it('returns 0 (max dissent) when all votes are strongly negative', () => {
    const now = Date.now();
    state.approvalStore = [
      { ts: now, vote: -5 },
      { ts: now, vote: -5 },
      { ts: now, vote: -5 },
    ];
    const result = computeApproval(now);
    expect(result).toBeCloseTo(0, 0);
  });

  it('returns ~50 when votes are evenly split', () => {
    const now = Date.now();
    state.approvalStore = [
      { ts: now, vote: 3 },
      { ts: now, vote: -3 },
    ];
    const result = computeApproval(now);
    expect(result).toBeCloseTo(50, 0);
  });

  it('weights recent votes more heavily', () => {
    const now = Date.now();
    state.approvalStore = [
      { ts: now - 30000, vote: 5 }, // old positive
      { ts: now, vote: -3 }, // recent negative
    ];
    const result = computeApproval(now);
    // Recent negative should pull score below 50
    expect(result).toBeLessThan(50);
  });

  it('prunes votes older than WINDOW_MS', () => {
    const now = Date.now();
    state.approvalStore = [
      { ts: now - 200_000, vote: 10 }, // way too old
      { ts: now, vote: -2 },
    ];
    const result = computeApproval(now);
    // Old vote should be pruned, only recent negative remains
    expect(result).toBeLessThan(50);
    expect(state.approvalStore.length).toBe(1);
  });

  it('result is always between 0 and 100', () => {
    const now = Date.now();
    state.approvalStore = [{ ts: now, vote: 100 }];
    const high = computeApproval(now);
    expect(high).toBeLessThanOrEqual(100);
    expect(high).toBeGreaterThanOrEqual(0);

    state.approvalStore = [{ ts: now, vote: -100 }];
    const low = computeApproval(now);
    expect(low).toBeLessThanOrEqual(100);
    expect(low).toBeGreaterThanOrEqual(0);
  });
});

describe('approvalVerdict', () => {
  it('returns OVERWHELMING APPROVAL for score > 88', () => {
    const [text, color] = approvalVerdict(95);
    expect(text).toBe('OVERWHELMING APPROVAL');
    expect(color).toBe('#00ffe5');
  });

  it('returns STRONG APPROVAL for score 75-88', () => {
    const [text] = approvalVerdict(80);
    expect(text).toBe('STRONG APPROVAL');
  });

  it('returns MIXED - DIVIDED CHAT for score ~50', () => {
    const [text] = approvalVerdict(50);
    expect(text).toBe('MIXED - DIVIDED CHAT');
  });

  it('returns STRONG DISSENT for score 15-26', () => {
    const [text] = approvalVerdict(20);
    expect(text).toBe('STRONG DISSENT');
  });

  it('returns OVERWHELMING REJECTION for score <= 14', () => {
    const [text, color] = approvalVerdict(5);
    expect(text).toBe('OVERWHELMING REJECTION');
    expect(color).toBe('#ff4800');
  });

  it('covers all verdict tiers without gaps', () => {
    // Test boundary values
    const scores = [0, 14, 15, 26, 27, 38, 39, 46, 47, 54, 55, 62, 63, 74, 75, 88, 89, 100];
    for (const s of scores) {
      const [text, color] = approvalVerdict(s);
      expect(text).toBeTruthy();
      expect(color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
});
