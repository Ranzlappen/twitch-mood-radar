// Sentiment classification — mood detection + approval voting
// Uses a trie for O(m) single-pass keyword matching (replaces O(n*m) linear scan).
import { TERM_MAP, TERM_KEYS, APPROVAL_TERMS, APPROVAL_KEYS } from '../config.js';

// --- Trie construction (runs once at module load) ---

function buildTrie(keys) {
  const root = Object.create(null);
  root._match = null;
  for (const key of keys) {
    let node = root;
    for (let i = 0; i < key.length; i++) {
      const ch = key[i];
      if (!node[ch]) {
        node[ch] = Object.create(null);
        node[ch]._match = null;
      }
      node = node[ch];
    }
    node._match = key; // store the full key at the terminal node
  }
  return root;
}

const TERM_TRIE = buildTrie(TERM_KEYS);
const APPROVAL_TRIE = buildTrie(APPROVAL_KEYS);

/**
 * Scan `text` against a trie and invoke `onMatch(matchedKey)` for each hit.
 * Greedy longest-match at each position.
 */
function trieSearch(text, trie, onMatch) {
  for (let i = 0; i < text.length; i++) {
    let node = trie;
    let lastMatch = null;
    for (let j = i; j < text.length; j++) {
      const ch = text[j];
      if (!node[ch]) break;
      node = node[ch];
      if (node._match !== null) lastMatch = node._match;
    }
    if (lastMatch !== null) {
      onMatch(lastMatch);
      // Advance past the match to avoid double-counting overlapping terms
      i += lastMatch.length - 1;
    }
  }
}

export function classifyMessage(msg) {
  const lower = msg.toLowerCase();
  const scores = { hype: 0, funny: 0, love: 0, toxic: 0, sad: 0, calm: 0, angry: 0, excited: 0, cringe: 0, wholesome: 0, confused: 0 };
  const hits = [];

  // Single-pass trie scan for mood keywords
  trieSearch(lower, TERM_TRIE, (term) => {
    const { mood, weight, label } = TERM_MAP.get(term);
    scores[mood] += weight;
    hits.push({ label, mood, weight });
  });

  const capR = (msg.match(/[A-Z]/g) || []).length / (msg.length || 1);
  if (capR > 0.65 && msg.length > 5) scores.toxic += 0.6;

  let best = 'neutral', bestS = 0;
  for (const [m, s] of Object.entries(scores)) if (s > bestS) { bestS = s; best = m; }

  const wordCount = lower.split(/\s+/).filter(w => w.length > 0).length;
  let lengthMult;
  if (wordCount <= 1) lengthMult = 0.5;
  else if (wordCount <= 3) lengthMult = 0.75;
  else if (wordCount <= 7) lengthMult = 1.0;
  else if (wordCount <= 15) lengthMult = 1.2;
  else lengthMult = 1.35;

  const strength = Math.max(0.3, Math.min(bestS, 4.0) * lengthMult);

  // Single-pass trie scan for approval terms
  let approvalVote = 0;
  trieSearch(lower, APPROVAL_TRIE, (term) => {
    approvalVote += APPROVAL_TERMS.get(term);
  });
  approvalVote *= lengthMult;
  if (capR > 0.65 && msg.length > 4) approvalVote *= 1.4;

  return { mood: best, strength, hits, approvalVote };
}
