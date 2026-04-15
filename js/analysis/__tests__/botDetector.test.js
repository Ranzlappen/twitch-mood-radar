import { describe, it, expect, beforeEach } from 'vitest';
import { usernameScore, messageScore, hashStr, detectBot } from '../botDetector.js';
import { state } from '../../state.js';

describe('usernameScore', () => {
  it('returns 100 for known bot names', () => {
    expect(usernameScore('nightbot')).toBe(100);
    expect(usernameScore('streamelements')).toBe(100);
    expect(usernameScore('fossabot')).toBe(100);
    expect(usernameScore('moobot')).toBe(100);
  });

  it('scores high for usernames ending in "bot"', () => {
    expect(usernameScore('mycoolbot')).toBeGreaterThanOrEqual(35);
  });

  it('scores high for usernames starting with "bot"', () => {
    expect(usernameScore('botmaster')).toBeGreaterThanOrEqual(25);
  });

  it('scores for usernames with long trailing numbers', () => {
    expect(usernameScore('user123456')).toBeGreaterThanOrEqual(25);
    expect(usernameScore('user1234')).toBeGreaterThanOrEqual(10);
  });

  it('scores low for normal usernames', () => {
    expect(usernameScore('coolstreamer')).toBe(0);
    expect(usernameScore('gamerguy')).toBe(0);
  });

  it('caps at 80 for non-known-bot heuristics', () => {
    // Even with many heuristic matches, non-known-bots cap at 80
    const score = usernameScore('botstreambot123456789');
    expect(score).toBeLessThanOrEqual(80);
  });
});

describe('messageScore', () => {
  it('scores messages starting with ! (commands)', () => {
    expect(messageScore('!help', '!help')).toBeGreaterThanOrEqual(20);
  });

  it('scores messages with URLs', () => {
    expect(messageScore('check https://example.com', 'check https://example.com')).toBeGreaterThanOrEqual(15);
  });

  it('scores very long messages', () => {
    const longMsg = 'a '.repeat(201);
    expect(messageScore(longMsg, longMsg.toLowerCase())).toBeGreaterThanOrEqual(15);
  });

  it('scores repetitive word patterns', () => {
    const rep = 'buy buy buy buy buy buy buy buy buy buy';
    expect(messageScore(rep, rep)).toBeGreaterThanOrEqual(20);
  });

  it('scores low for normal chat messages', () => {
    expect(messageScore('nice play dude', 'nice play dude')).toBeLessThan(10);
  });
});

describe('hashStr', () => {
  it('returns consistent hash for same input', () => {
    expect(hashStr('hello')).toBe(hashStr('hello'));
  });

  it('returns different hash for different input', () => {
    expect(hashStr('hello')).not.toBe(hashStr('world'));
  });

  it('returns a number', () => {
    expect(typeof hashStr('test')).toBe('number');
  });
});

describe('detectBot', () => {
  beforeEach(() => {
    state.userProfiles = new Map();
    state.botUsersDetected = new Set();
    state.botMessagesFiltered = 0;
    state.botFilterEnabled = true;
  });

  it('detects known bots immediately', () => {
    const result = detectBot('nightbot', 'Followed for 2 years!', Date.now());
    expect(result.isBot).toBe(true);
    expect(result.botScore).toBe(100);
  });

  it('does not flag normal users with normal messages', () => {
    const result = detectBot('regularuser', 'nice play lol', Date.now());
    expect(result.isBot).toBe(false);
    expect(result.botScore).toBeLessThan(60);
  });

  it('detects high-frequency spammers via behavioral profiling', () => {
    const now = Date.now();
    // Simulate rapid-fire identical messages
    for (let i = 0; i < 35; i++) {
      detectBot('spammer', 'buy cheap stuff now', now + i * 100);
    }
    const result = detectBot('spammer', 'buy cheap stuff now', now + 3500);
    // After many rapid identical messages, should flag as bot
    expect(result.botScore).toBeGreaterThanOrEqual(60);
  });

  it('creates user profile on first message', () => {
    detectBot('newuser', 'hello world', Date.now());
    expect(state.userProfiles.has('newuser')).toBe(true);
  });

  it('tracks message history in user profile', () => {
    const now = Date.now();
    detectBot('user1', 'first message', now);
    detectBot('user1', 'second message', now + 1000);
    const profile = state.userProfiles.get('user1');
    expect(profile.msgs.length).toBe(2);
  });

  it('prunes old messages from user profile', () => {
    const now = Date.now();
    detectBot('user2', 'old message', now - 70_000); // older than USER_PROFILE_WINDOW
    detectBot('user2', 'new message', now);
    const profile = state.userProfiles.get('user2');
    // Old message should have been pruned
    expect(profile.msgs.length).toBe(1);
  });
});
