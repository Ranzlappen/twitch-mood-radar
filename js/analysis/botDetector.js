// Bot detection — multi-criteria scoring
import { state } from '../state.js';
import { BOT_THRESHOLD, KNOWN_BOTS, USER_PROFILE_WINDOW } from '../config.js';

export function usernameScore(user) {
  if (KNOWN_BOTS.has(user)) return 100;
  let s = 0;
  if (/bot$/i.test(user)) s += 35;
  if (/streambot/i.test(user)) s += 40;
  if (/^bot/i.test(user)) s += 25;
  const num = user.match(/\d+$/);
  if (num) { if (num[0].length >= 6) s += 25; else if (num[0].length >= 4) s += 10; }
  if (user.length <= 5 && /\d/.test(user)) s += 10;
  if (user.length >= 16 && /^[a-z0-9]+$/.test(user)) s += 15;
  return Math.min(s, 80);
}

export function hashStr(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = (h * 0x01000193) >>> 0; }
  return h;
}

export function messageScore(msg, lower) {
  let s = 0;
  if (msg.startsWith('!')) s += 20;
  if (/https?:\/\//i.test(msg)) s += 15;
  const words = lower.split(/\s+/);
  if (words.length >= 3) {
    const rep = 1 - new Set(words).size / words.length;
    if (rep > 0.7) s += 20; else if (rep > 0.5) s += 10;
  }
  if (msg.length > 200) s += 15;
  if (msg.length > 400) s += 20;
  const an = (msg.match(/[a-zA-Z0-9]/g)||[]).length;
  if (msg.length > 5 && an / msg.length < 0.2) s += 15;
  return s;
}

export function detectBot(user, msg, ts) {
  const lower = msg.toLowerCase();
  let score = usernameScore(user);
  if (score >= 100) return { botScore:100, isBot:true };
  score += messageScore(msg, lower);

  if (!state.userProfiles.has(user)) state.userProfiles.set(user, { msgs:[],lengths:[],flagCount:0 });
  const p = state.userProfiles.get(user);
  while (p.msgs.length && ts - p.msgs[0].ts > USER_PROFILE_WINDOW) p.msgs.shift();
  p.msgs.push({ ts, hash:hashStr(lower.trim()) });

  const rate = p.msgs.length / (USER_PROFILE_WINDOW / 60_000);
  if (rate > 30) score += 30; else if (rate > 15) score += 15; else if (rate > 8) score += 5;

  if (p.msgs.length >= 3) {
    const hashes = p.msgs.slice(-10).map(m => m.hash);
    const rep = 1 - new Set(hashes).size / hashes.length;
    if (rep > 0.8) score += 30; else if (rep > 0.5) score += 15; else if (rep > 0.3) score += 5;
  }

  p.lengths.push(msg.length);
  if (p.lengths.length > 20) p.lengths.shift();
  if (p.lengths.length >= 5) {
    const mean = p.lengths.reduce((a,b)=>a+b,0) / p.lengths.length;
    const sd = Math.sqrt(p.lengths.reduce((a,b)=>a+(b-mean)**2,0) / p.lengths.length);
    if (mean > 10 && sd < 2) score += 20; else if (mean > 10 && sd < 5) score += 8;
  }

  if (score >= BOT_THRESHOLD) {
    p.flagCount++;
    if (p.flagCount >= 5) score = Math.min(score + 20, 100);
  }
  return { botScore:Math.min(score,100), isBot:score >= BOT_THRESHOLD };
}
