/**
 * Shared emote rendering — converts text emote codes to visual representations.
 *
 * The segmenter is the single source of truth: it walks the raw (unescaped)
 * message text and emits ordered segments that callers turn into DOM nodes.
 * Building DOM nodes directly (rather than concatenating HTML strings)
 * eliminates a class of bugs where a later pass could accidentally chew
 * through the attributes of an already-emitted <img> tag.
 */
import { RAW_EMOTE_MAP, RAW_EMOTE_REGEX } from '../config.js';
import { state } from '../state.js';

// Placeholder format injected by adapters:
//   [emote:<source>:<id>:<name>]             — 3 parts
//   [emote:<source>:<extra>:<id>:<name>]     — 4 parts (Kick sometimes wraps an extra token)
const PLACEHOLDER_RE = /\[emote:(twitch|kick)(?::[^:\]]+)?:(\d+):([A-Za-z0-9_]+)\]/g;

const CDN = {
  twitch: (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`,
  kick:   (id) => `https://files.kick.com/emotes/${id}/fullsize`,
};

// Trailing punctuation stripped when resolving third-party emote words.
const TRAILING_PUNCT_RE = /[.,!?:;]+$/;

/**
 * Walk raw message text and emit an ordered array of segments. Each segment
 * is either { type: 'text', text } or
 * { type: 'emote', url, name, source } or
 * { type: 'emoji', emoji, name }.
 *
 * @param {string} rawText — raw (unescaped) message text
 * @returns {Array<object>}
 */
export function segmentMessage(rawText) {
  if (typeof rawText !== 'string' || !rawText) return [];

  // Pass 0: split on [emote:...] placeholders.
  let segments = [];
  let lastIdx = 0;
  PLACEHOLDER_RE.lastIndex = 0;
  let m;
  while ((m = PLACEHOLDER_RE.exec(rawText)) !== null) {
    if (m.index > lastIdx) {
      segments.push({ type: 'text', text: rawText.slice(lastIdx, m.index) });
    }
    const [, source, id, name] = m;
    const urlFn = CDN[source];
    if (urlFn) {
      segments.push({ type: 'emote', url: urlFn(id), name, source });
    } else {
      segments.push({ type: 'text', text: m[0] });
    }
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < rawText.length) {
    segments.push({ type: 'text', text: rawText.slice(lastIdx) });
  }

  // Pass 1: replace hardcoded text emotes with Unicode emoji inside text segments.
  segments = _flatMapText(segments, (text) => _splitByEmoji(text));

  // Pass 2: replace third-party emote codes with emote images inside text segments.
  if (state.thirdPartyEmotes && state.thirdPartyEmotes.size > 0) {
    segments = _flatMapText(segments, (text) => _splitByThirdParty(text));
  }

  return segments;
}

function _flatMapText(segments, splitFn) {
  const out = [];
  for (const seg of segments) {
    if (seg.type !== 'text') { out.push(seg); continue; }
    const pieces = splitFn(seg.text);
    for (const p of pieces) out.push(p);
  }
  return out;
}

function _splitByEmoji(text) {
  if (!text) return [];
  const pieces = [];
  let lastIdx = 0;
  RAW_EMOTE_REGEX.lastIndex = 0;
  let m;
  while ((m = RAW_EMOTE_REGEX.exec(text)) !== null) {
    if (m.index > lastIdx) pieces.push({ type: 'text', text: text.slice(lastIdx, m.index) });
    const key = m[0];
    const emoji = RAW_EMOTE_MAP.get(key);
    pieces.push(emoji
      ? { type: 'emoji', emoji, name: key }
      : { type: 'text', text: key });
    lastIdx = m.index + key.length;
  }
  if (lastIdx < text.length) pieces.push({ type: 'text', text: text.slice(lastIdx) });
  return pieces;
}

function _splitByThirdParty(text) {
  if (!text) return [];
  const pieces = [];
  // Tokenize on whitespace while preserving whitespace runs so the round-trip
  // text is identical. Split keeps the delimiters when the pattern has a
  // capture group.
  const parts = text.split(/(\s+)/);
  for (const part of parts) {
    if (!part) continue;
    if (/^\s+$/.test(part)) { pieces.push({ type: 'text', text: part }); continue; }
    let stem = part;
    let tail = '';
    const punctMatch = part.match(TRAILING_PUNCT_RE);
    if (punctMatch) {
      tail = punctMatch[0];
      stem = part.slice(0, -tail.length);
    }
    const emote = state.thirdPartyEmotes.get(stem);
    if (emote) {
      pieces.push({ type: 'emote', url: emote.url, name: stem, source: emote.source });
      if (tail) pieces.push({ type: 'text', text: tail });
    } else {
      pieces.push({ type: 'text', text: part });
    }
  }
  return pieces;
}

/**
 * Append message segments to a container as real DOM nodes (text nodes and
 * <img> elements). Attributes are set via DOM APIs so no string concatenation
 * can produce broken HTML.
 *
 * @param {Element} container — host element
 * @param {string} rawText    — raw (unescaped) message text
 */
export function appendMessageSegments(container, rawText) {
  const segments = segmentMessage(rawText);
  for (const seg of segments) {
    if (seg.type === 'text') {
      container.appendChild(document.createTextNode(seg.text));
    } else if (seg.type === 'emoji') {
      const span = document.createElement('span');
      span.title = seg.name;
      span.textContent = seg.emoji;
      container.appendChild(span);
    } else if (seg.type === 'emote') {
      const img = document.createElement('img');
      img.className = 'chat-emote';
      // Strip the Referer header so CDNs like files.kick.com (which reject
      // cross-origin image loads with a third-party Referer) serve the image.
      img.referrerPolicy = 'no-referrer';
      // If the image fails (CSP block, dead URL, CDN 404), drop it silently
      // instead of letting the browser render its broken-image glyph + alt text.
      img.onerror = () => { img.remove(); };
      img.src = seg.url;
      img.alt = seg.name;
      img.title = `${seg.name} (${seg.source})`;
      img.loading = 'lazy';
      container.appendChild(img);
    }
  }
}
