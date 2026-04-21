import { describe, it, expect, beforeEach } from 'vitest';
import {
  tokenize, recordMessage, getTop, clear, setStopwordOverrides,
  setWindowMs, getWindowMs, getBucketMs, _resetForTests,
  BUCKET_COUNT,
} from '../topWords.js';

beforeEach(() => {
  _resetForTests();
});

describe('tokenize (unigrams)', () => {
  it('treats "gg" as its own token, not a substring of "toggle"', () => {
    const a = tokenize('gg wp');
    expect(a.unigrams).toContain('gg');
    const b = tokenize('toggle the switch');
    expect(b.unigrams).toContain('toggle');
    expect(b.unigrams).not.toContain('gg');
  });

  it('drops grammatical stopwords by default', () => {
    const toks = tokenize('this is a hype moment');
    expect(toks.unigrams).not.toContain('this');
    expect(toks.unigrams).not.toContain('is');
    expect(toks.unigrams).not.toContain('a');
    expect(toks.unigrams).toContain('hype');
    expect(toks.unigrams).toContain('moment');
  });

  it('keeps chat interjections like gg, lol, xd, pog', () => {
    const toks = tokenize('gg lol xd pog kappa');
    for (const t of ['gg','lol','xd','pog','kappa']) expect(toks.unigrams).toContain(t);
  });

  it('extracts emote names from [emote:provider:id:Name] placeholders', () => {
    const toks = tokenize('[emote:bttv:abc123:Kappa] nice');
    expect(toks.unigrams).toContain('kappa');
    expect(toks.unigrams).not.toContain('emote');
    expect(toks.unigrams).not.toContain('bttv');
    expect(toks.unigrams).not.toContain('abc123');
    expect(toks.unigrams).toContain('nice');
  });

  it('strips bare URLs', () => {
    const toks = tokenize('check https://example.com/foo?bar=1 stream');
    expect(toks.unigrams).toContain('check');
    expect(toks.unigrams).toContain('stream');
    expect(toks.unigrams).not.toContain('https');
    expect(toks.unigrams).not.toContain('example');
  });

  it('filters pure-digit tokens', () => {
    const toks = tokenize('123 456 banger');
    expect(toks.unigrams).toContain('banger');
    expect(toks.unigrams).not.toContain('123');
    expect(toks.unigrams).not.toContain('456');
  });

  it('deduplicates tokens within a single message', () => {
    const toks = tokenize('gg gg gg gg');
    expect(toks.unigrams.filter(t => t === 'gg')).toHaveLength(1);
  });

  it('drops tokens under 2 chars and over 20 chars', () => {
    const toks = tokenize('w fireeeeeeeeeeeeeeeeeeeeee banger');
    expect(toks.unigrams).not.toContain('w');
    expect(toks.unigrams).toContain('banger');
    expect(toks.unigrams.some(t => t.length > 20)).toBe(false);
  });
});

describe('tokenize (bigrams)', () => {
  it('emits bigrams for adjacent non-stopword pairs', () => {
    const toks = tokenize('lets go pog');
    expect(toks.bigrams).toContain('lets go');
    expect(toks.bigrams).toContain('go pog');
  });

  it('does not emit a bigram across a stopword', () => {
    const toks = tokenize('fire is real');
    expect(toks.bigrams).not.toContain('fire is');
    expect(toks.bigrams).not.toContain('is real');
    expect(toks.bigrams).not.toContain('fire real');
  });

  it('dedupes bigrams within a single message', () => {
    const toks = tokenize('gg wp gg wp');
    expect(toks.bigrams.filter(t => t === 'gg wp')).toHaveLength(1);
  });

  it('does not produce bigrams from single-word messages', () => {
    const toks = tokenize('banger');
    expect(toks.bigrams).toEqual([]);
  });
});

describe('setStopwordOverrides', () => {
  it('removing a default stopword makes it appear in tokens', () => {
    setStopwordOverrides({ remove: ['and'] });
    const toks = tokenize('hype and fire');
    expect(toks.unigrams).toContain('and');
  });

  it('adding a word causes it to be filtered', () => {
    setStopwordOverrides({ add: ['bruh'] });
    const toks = tokenize('bruh moment');
    expect(toks.unigrams).not.toContain('bruh');
    expect(toks.unigrams).toContain('moment');
  });

  it('override is case-insensitive', () => {
    setStopwordOverrides({ add: ['POG'] });
    const toks = tokenize('pog moment');
    expect(toks.unigrams).not.toContain('pog');
  });
});

describe('recordMessage and getTop', () => {
  it('counts each standalone occurrence across messages', () => {
    const t0 = 1_000_000;
    recordMessage('gg wp', t0);
    recordMessage('gg', t0 + 100);
    recordMessage('toggle the switch', t0 + 200);
    const top = getTop(10, t0 + 300);
    const gg = top.find(e => e.word === 'gg');
    expect(gg?.count).toBe(2);
    expect(top.find(e => e.word === 'toggle')?.count).toBe(1);
  });

  it('surfaces recurring phrases as bigrams', () => {
    const t0 = 5_000_000;
    for (let i = 0; i < 4; i++) recordMessage('lets go', t0 + i);
    const top = getTop(10, t0 + 100);
    const bg = top.find(e => e.word === 'lets go');
    expect(bg?.count).toBe(4);
  });

  it('returns results sorted by count descending', () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i++) recordMessage('banger', t0 + i);
    for (let i = 0; i < 3; i++) recordMessage('pog', t0 + 100 + i);
    recordMessage('fire', t0 + 200);
    const top = getTop(10, t0 + 300);
    expect(top[0].word).toBe('banger');
    expect(top[0].count).toBe(5);
    expect(top[1].word).toBe('pog');
    expect(top[1].count).toBe(3);
    expect(top[2].word).toBe('fire');
    expect(top[2].count).toBe(1);
  });

  it('a word decays out of the window after the full window of silence', () => {
    const t0 = 3_000_000;
    recordMessage('banger', t0);
    expect(getTop(5, t0).find(e => e.word === 'banger')?.count).toBe(1);
    const future = t0 + getWindowMs() + getBucketMs();
    const top = getTop(5, future);
    expect(top.find(e => e.word === 'banger')).toBeUndefined();
  });

  it('clear() resets all counts', () => {
    recordMessage('banger pog fire', Date.now());
    expect(getTop(5, Date.now()).length).toBeGreaterThan(0);
    clear();
    expect(getTop(5, Date.now()).length).toBe(0);
  });
});

describe('setWindowMs', () => {
  it('clamps to a sane range and keeps 12 buckets', () => {
    const w1 = setWindowMs(60_000);
    expect(w1).toBe(60_000);
    expect(getBucketMs()).toBe(5_000);
    expect(getBucketMs() * BUCKET_COUNT).toBe(w1);

    const w2 = setWindowMs(999_999_999);
    expect(w2).toBeLessThanOrEqual(600_000);

    const w3 = setWindowMs(100);
    expect(w3).toBeGreaterThanOrEqual(5_000);
  });

  it('clears counts when the window changes', () => {
    recordMessage('banger', Date.now());
    expect(getTop(5, Date.now()).length).toBeGreaterThan(0);
    setWindowMs(30_000);
    expect(getTop(5, Date.now()).length).toBe(0);
  });

  it('a short window decays faster', () => {
    const t0 = 6_000_000;
    setWindowMs(12_000); // 12 buckets * 1000ms
    recordMessage('banger', t0);
    expect(getTop(5, t0).find(e => e.word === 'banger')?.count).toBe(1);
    const top = getTop(5, t0 + 15_000);
    expect(top.find(e => e.word === 'banger')).toBeUndefined();
  });
});
