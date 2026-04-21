import { describe, it, expect, beforeEach } from 'vitest';
import {
  tokenize, recordMessage, getTop, clear, setStopwordOverrides, _resetForTests,
  BUCKET_MS, BUCKET_COUNT,
} from '../topWords.js';

beforeEach(() => {
  _resetForTests();
});

describe('tokenize', () => {
  it('treats "gg" as its own token, not a substring of "toggle"', () => {
    const a = tokenize('gg wp');
    expect(a).toContain('gg');
    const b = tokenize('toggle the switch');
    expect(b).toContain('toggle');
    expect(b).not.toContain('gg');
  });

  it('drops grammatical stopwords by default', () => {
    const toks = tokenize('this is a hype moment');
    expect(toks).not.toContain('this');
    expect(toks).not.toContain('is');
    expect(toks).not.toContain('a');
    expect(toks).toContain('hype');
    expect(toks).toContain('moment');
  });

  it('keeps chat interjections like gg, lol, xd, pog', () => {
    const toks = tokenize('gg lol xd pog kappa');
    for (const t of ['gg','lol','xd','pog','kappa']) expect(toks).toContain(t);
  });

  it('extracts emote names from [emote:provider:id:Name] placeholders', () => {
    const toks = tokenize('[emote:bttv:abc123:Kappa] nice');
    expect(toks).toContain('kappa');
    expect(toks).not.toContain('emote');
    expect(toks).not.toContain('bttv');
    expect(toks).not.toContain('abc123');
    expect(toks).toContain('nice');
  });

  it('strips bare URLs', () => {
    const toks = tokenize('check https://example.com/foo?bar=1 stream');
    expect(toks).toContain('check');
    expect(toks).toContain('stream');
    expect(toks).not.toContain('https');
    expect(toks).not.toContain('example');
  });

  it('filters pure-digit tokens', () => {
    const toks = tokenize('123 456 banger');
    expect(toks).toContain('banger');
    expect(toks).not.toContain('123');
    expect(toks).not.toContain('456');
  });

  it('deduplicates tokens within a single message', () => {
    const toks = tokenize('gg gg gg gg');
    expect(toks.filter(t => t === 'gg')).toHaveLength(1);
  });

  it('drops tokens under 2 chars and over 20 chars', () => {
    const toks = tokenize('w fireeeeeeeeeeeeeeeeeeeeee banger');
    expect(toks).not.toContain('w');
    expect(toks).toContain('banger');
    expect(toks.some(t => t.length > 20)).toBe(false);
  });
});

describe('setStopwordOverrides', () => {
  it('removing a default stopword makes it appear in tokens', () => {
    setStopwordOverrides({ remove: ['and'] });
    const toks = tokenize('hype and fire');
    expect(toks).toContain('and');
  });

  it('adding a word causes it to be filtered', () => {
    setStopwordOverrides({ add: ['bruh'] });
    const toks = tokenize('bruh moment');
    expect(toks).not.toContain('bruh');
    expect(toks).toContain('moment');
  });

  it('override is case-insensitive', () => {
    setStopwordOverrides({ add: ['POG'] });
    const toks = tokenize('pog moment');
    expect(toks).not.toContain('pog');
  });
});

describe('recordMessage and getTop', () => {
  it('counts each standalone occurrence across messages', () => {
    const t0 = 1_000_000;
    recordMessage('gg wp', t0);
    recordMessage('gg', t0 + 100);
    recordMessage('toggle the switch', t0 + 200);
    const top = getTop(5, t0 + 300);
    const gg = top.find(e => e.word === 'gg');
    expect(gg?.count).toBe(2);
    expect(top.find(e => e.word === 'toggle')?.count).toBe(1);
  });

  it('returns results sorted by count descending', () => {
    const t0 = 2_000_000;
    for (let i = 0; i < 5; i++) recordMessage('banger', t0 + i);
    for (let i = 0; i < 3; i++) recordMessage('pog', t0 + 100 + i);
    recordMessage('fire', t0 + 200);
    const top = getTop(5, t0 + 300);
    expect(top[0].word).toBe('banger');
    expect(top[0].count).toBe(5);
    expect(top[1].word).toBe('pog');
    expect(top[1].count).toBe(3);
    expect(top[2].word).toBe('fire');
    expect(top[2].count).toBe(1);
  });

  it('a word decays out of the window after BUCKET_MS * BUCKET_COUNT of silence', () => {
    const t0 = 3_000_000;
    recordMessage('banger', t0);
    expect(getTop(5, t0).find(e => e.word === 'banger')?.count).toBe(1);
    // Advance past the full window with no new messages.
    const future = t0 + BUCKET_MS * BUCKET_COUNT + BUCKET_MS;
    const top = getTop(5, future);
    expect(top.find(e => e.word === 'banger')).toBeUndefined();
  });

  it('clear() resets all counts', () => {
    recordMessage('banger pog fire', Date.now());
    expect(getTop(5, Date.now()).length).toBeGreaterThan(0);
    clear();
    expect(getTop(5, Date.now()).length).toBe(0);
  });

  it('limits result length to n', () => {
    const t0 = 4_000_000;
    const words = ['one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve'];
    words.forEach((w, i) => recordMessage(w, t0 + i));
    const top = getTop(10, t0 + 100);
    expect(top).toHaveLength(10);
  });
});
