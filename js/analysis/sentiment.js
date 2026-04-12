// Sentiment classification — mood detection + approval voting
import { TERM_MAP, TERM_KEYS, APPROVAL_TERMS, APPROVAL_KEYS } from '../config.js';

export function classifyMessage(msg) {
  const lower = msg.toLowerCase();
  const scores = {hype:0,funny:0,love:0,toxic:0,sad:0,calm:0,angry:0,excited:0,cringe:0,wholesome:0,confused:0};
  const hits = [];

  for (let i = 0; i < TERM_KEYS.length; i++) {
    const term = TERM_KEYS[i];
    if (lower.includes(term)) {
      const { mood, weight, label } = TERM_MAP.get(term);
      scores[mood] += weight;
      hits.push({ label, mood, weight });
    }
  }

  const capR = (msg.match(/[A-Z]/g)||[]).length / (msg.length||1);
  if (capR > 0.65 && msg.length > 5) scores.toxic += 0.6;

  let best = 'neutral', bestS = 0;
  for (const [m, s] of Object.entries(scores)) if (s > bestS) { bestS = s; best = m; }

  const wordCount = lower.split(/\s+/).filter(w => w.length > 0).length;
  let lengthMult;
  if      (wordCount <= 1)  lengthMult = 0.5;
  else if (wordCount <= 3)  lengthMult = 0.75;
  else if (wordCount <= 7)  lengthMult = 1.0;
  else if (wordCount <= 15) lengthMult = 1.2;
  else                      lengthMult = 1.35;

  const strength = Math.max(0.3, Math.min(bestS, 4.0) * lengthMult);

  let approvalVote = 0;
  for (let i = 0; i < APPROVAL_KEYS.length; i++) {
    if (lower.includes(APPROVAL_KEYS[i])) approvalVote += APPROVAL_TERMS.get(APPROVAL_KEYS[i]);
  }
  approvalVote *= lengthMult;
  if (capR > 0.65 && msg.length > 4) approvalVote *= 1.4;

  return { mood:best, strength, hits, approvalVote };
}
