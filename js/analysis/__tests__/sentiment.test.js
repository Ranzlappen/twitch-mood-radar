import { describe, it, expect } from 'vitest';
import { classifyMessage } from '../sentiment.js';

describe('classifyMessage', () => {
  // --- Mood classification ---

  it('classifies "POGGERS LETS GO" as hype', () => {
    const result = classifyMessage('POGGERS LETS GO');
    expect(result.mood).toBe('hype');
    expect(result.strength).toBeGreaterThan(0);
  });

  it('classifies "OMEGALUL KEKW" as funny', () => {
    const result = classifyMessage('OMEGALUL KEKW');
    expect(result.mood).toBe('funny');
  });

  it('classifies "I love this streamer <3" as love', () => {
    const result = classifyMessage('I love this streamer <3');
    expect(result.mood).toBe('love');
  });

  it('classifies "trash streamer garbage" as toxic', () => {
    const result = classifyMessage('trash streamer garbage');
    expect(result.mood).toBe('toxic');
  });

  it('classifies "Sadge FeelsBadMan rip" as sad', () => {
    const result = classifyMessage('Sadge FeelsBadMan rip');
    expect(result.mood).toBe('sad');
  });

  it('classifies "so comfy and cozy vibes" as calm', () => {
    const result = classifyMessage('so comfy and cozy vibes');
    expect(result.mood).toBe('calm');
  });

  it('classifies "rage WTF STFU" as angry', () => {
    const result = classifyMessage('rage WTF STFU');
    expect(result.mood).toBe('angry');
  });

  it('classifies "OMG WOOO hyped" as excited', () => {
    const result = classifyMessage('OMG WOOO hyped');
    expect(result.mood).toBe('excited');
  });

  it('classifies "yikes WeirdChamp cringe" as cringe', () => {
    const result = classifyMessage('yikes WeirdChamp cringe');
    expect(result.mood).toBe('cringe');
  });

  it('classifies "wholesome blessed adorable" as wholesome', () => {
    const result = classifyMessage('wholesome blessed adorable');
    expect(result.mood).toBe('wholesome');
  });

  it('classifies "huh what ??? confused" as confused', () => {
    const result = classifyMessage('huh what ??? confused');
    expect(result.mood).toBe('confused');
  });

  it('classifies plain text with no keywords as neutral', () => {
    const result = classifyMessage('hello there');
    expect(result.mood).toBe('neutral');
  });

  // --- Strength ---

  it('gives higher strength to longer messages with clear sentiment', () => {
    const short = classifyMessage('pog');
    const long = classifyMessage('that was an insane poggers play what a clutch');
    expect(long.strength).toBeGreaterThan(short.strength);
  });

  it('strength is always between 0.3 and max cap', () => {
    const neutral = classifyMessage('ok');
    expect(neutral.strength).toBeGreaterThanOrEqual(0.3);
    const heavy = classifyMessage('POGGERS POGCHAMP BASED GOATED BANGER CLUTCH INSANE INCREDIBLE');
    expect(heavy.strength).toBeLessThanOrEqual(6);
  });

  // --- Caps detection adds toxic score ---

  it('adds toxic score bonus for ALL CAPS messages (>65% caps, len>5)', () => {
    // The caps bonus adds +0.6 to toxic score. With a message that has
    // no other keyword matches, the caps bonus alone makes it toxic.
    const result = classifyMessage('AAAAAAA BBBBBBB CCCCCC');
    expect(result.mood).toBe('toxic');
  });

  it('does not add caps bonus for short ALL CAPS', () => {
    const result = classifyMessage('OK');
    expect(result.mood).toBe('neutral');
  });

  // --- Approval voting ---

  it('returns positive approval vote for agreement terms', () => {
    const result = classifyMessage('facts based so true frfr');
    expect(result.approvalVote).toBeGreaterThan(0);
  });

  it('returns negative approval vote for dissent terms', () => {
    const result = classifyMessage('ratio wrong bad take cope');
    expect(result.approvalVote).toBeLessThan(0);
  });

  it('returns zero approval vote for neutral messages', () => {
    const result = classifyMessage('hello there friend');
    expect(result.approvalVote).toBe(0);
  });

  // --- Keyword hits ---

  it('returns matched keyword hits with labels', () => {
    const result = classifyMessage('poggers kekw');
    expect(result.hits.length).toBeGreaterThan(0);
    const labels = result.hits.map((h) => h.label);
    expect(labels).toContain('PogChamp');
    expect(labels).toContain('KEKW');
  });

  it('returns empty hits for messages with no keywords', () => {
    const result = classifyMessage('just a regular message');
    expect(result.hits).toHaveLength(0);
  });

  // --- Edge cases ---

  it('handles empty string', () => {
    const result = classifyMessage('');
    expect(result.mood).toBe('neutral');
    expect(result.approvalVote).toBe(0);
  });

  it('handles single character', () => {
    const result = classifyMessage('a');
    expect(result.mood).toBe('neutral');
  });

  it('is case-insensitive', () => {
    const lower = classifyMessage('poggers');
    const upper = classifyMessage('POGGERS');
    expect(lower.mood).toBe(upper.mood);
  });
});
