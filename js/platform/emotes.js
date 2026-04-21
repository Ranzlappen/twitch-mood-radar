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
const PLACEHOLDER_RE = /\[emote:(twitch|kick)(?::[^:\]]+)?:([A-Za-z0-9_]+):([A-Za-z0-9_]+)\]/g;

const CDN = {
  twitch: (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`,
  kick:   (id) => `https://files.kick.com/emotes/${id}/fullsize`,
};

// Trailing punctuation stripped when resolving third-party emote words.
const TRAILING_PUNCT_RE = /[.,!?:;]+$/;

// URL detection — http(s) only, captures most links chatters post. Trailing
// punctuation is stripped so "visit https://example.com/foo." keeps the period
// outside the link. Intentionally narrow to avoid matching IRC-style text.
const URL_RE = /\bhttps?:\/\/[^\s<>"'`]+/gi;
// Trailing characters that should not be part of the clickable URL.
const URL_TAIL_STRIP_RE = /[.,!?:;)\]}'"]+$/;

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

  // Pass -1: carve out URLs first so no downstream pass munges link contents.
  // URL segments are opaque to all subsequent passes (text-emoji, provider
  // emotes, third-party emotes).
  let segments = _splitByUrl(rawText);

  // Pass 0: split on [emote:...] placeholders inside remaining text segments.
  segments = _flatMapText(segments, (text) => _splitByPlaceholder(text));

  // Pass 1: replace hardcoded text emotes with Unicode emoji (e.g. :) -> 🙂).
  // Gated on a persistent user preference — when disabled, text shortcuts stay
  // as plain text. Provider emote rendering is NOT affected.
  const emojiOn = state.drawerOptions
    ? state.drawerOptions.renderTextEmoji !== false
    : true;
  if (emojiOn) {
    segments = _flatMapText(segments, (text) => _splitByEmoji(text));
  }

  // Pass 2: replace third-party emote codes (BTTV/7TV/FFZ) with emote images.
  if (state.thirdPartyEmotes && state.thirdPartyEmotes.size > 0) {
    segments = _flatMapText(segments, (text) => _splitByThirdParty(text));
  }

  return segments;
}

function _splitByPlaceholder(text) {
  if (!text) return [];
  const out = [];
  let lastIdx = 0;
  PLACEHOLDER_RE.lastIndex = 0;
  let m;
  while ((m = PLACEHOLDER_RE.exec(text)) !== null) {
    if (m.index > lastIdx) out.push({ type: 'text', text: text.slice(lastIdx, m.index) });
    const [, source, id, name] = m;
    const urlFn = CDN[source];
    if (urlFn) out.push({ type: 'emote', url: urlFn(id), name, source });
    else       out.push({ type: 'text', text: m[0] });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) out.push({ type: 'text', text: text.slice(lastIdx) });
  return out;
}

function _splitByUrl(text) {
  if (!text) return [];
  const out = [];
  let lastIdx = 0;
  URL_RE.lastIndex = 0;
  let m;
  while ((m = URL_RE.exec(text)) !== null) {
    let raw = m[0];
    let tail = '';
    const tailMatch = raw.match(URL_TAIL_STRIP_RE);
    if (tailMatch) {
      tail = tailMatch[0];
      raw = raw.slice(0, -tail.length);
    }
    if (m.index > lastIdx) out.push({ type: 'text', text: text.slice(lastIdx, m.index) });
    if (raw) out.push({ type: 'url', text: raw, href: raw });
    if (tail) out.push({ type: 'text', text: tail });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) out.push({ type: 'text', text: text.slice(lastIdx) });
  return out;
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
      img.dataset.emoteName = seg.name;
      img.dataset.emoteSrc = seg.url;
      img.dataset.emoteSource = seg.source;
      img.setAttribute('role', 'button');
      img.tabIndex = 0;
      container.appendChild(img);
    } else if (seg.type === 'url') {
      // Render as an anchor, but suppress the native navigation — a
      // document-level delegated handler in linkModal.js intercepts the
      // click to run the safety check before allowing the tab to open.
      const a = document.createElement('a');
      a.className = 'chat-link';
      a.href = seg.href;
      a.textContent = seg.text;
      a.rel = 'noopener noreferrer';
      a.target = '_blank';
      a.dataset.chatLink = '1';
      container.appendChild(a);
    }
  }
}
