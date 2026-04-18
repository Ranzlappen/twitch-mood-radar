/**
 * Shared emote rendering — converts text emote codes to visual representations.
 */
import { EMOTE_MAP, EMOTE_REGEX } from '../config.js';
import { state } from '../state.js';

// Placeholder format injected by adapters:
//   [emote:<source>:<id>:<name>]             — 3 parts
//   [emote:<source>:<extra>:<id>:<name>]     — 4 parts (Kick sometimes wraps an extra token)
// Source is "twitch" or "kick"; id is numeric; name is [A-Za-z0-9_]+.
const PLACEHOLDER_RE = /\[emote:(twitch|kick)(?::[^:\]]+)?:(\d+):([A-Za-z0-9_]+)\]/g;

const CDN = {
  twitch: (id) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/1.0`,
  kick:   (id) => `https://files.kick.com/emotes/${id}/fullsize`,
};

// Trailing punctuation stripped when resolving third-party emote words.
const TRAILING_PUNCT_RE = /[.,!?:;]+$/;

/**
 * Replace known emote codes in pre-escaped HTML with emoji spans and
 * third-party emote images.
 * @param {string} escapedHtml — HTML-escaped chat message text
 * @returns {string} HTML with emote codes replaced
 */
export function renderEmotes(escapedHtml) {
  // Pass 0: resolve source-tagged placeholders (Twitch native / Kick) to CDN images.
  let html = escapedHtml.replace(PLACEHOLDER_RE, (_m, source, id, name) => {
    const urlFn = CDN[source];
    if (!urlFn) return _m;
    return `<img class="chat-emote" src="${urlFn(id)}" alt="${name}" title="${name} (${source})" loading="lazy">`;
  });

  // Pass 1: replace hardcoded text emotes with Unicode emoji (fallback).
  // EMOTE_REGEX is built from HTML-escaped keys so matches like `&lt;3` work.
  html = html.replace(EMOTE_REGEX, match => {
    const emoji = EMOTE_MAP.get(match);
    return emoji ? `<span title="${match}">${emoji}</span>` : match;
  });

  // Pass 2: replace third-party emote codes with actual emote images.
  // Accept a trailing punctuation run so `KEKW!` or `catJAM.` still resolve.
  if (state.thirdPartyEmotes.size > 0) {
    html = html.replace(/(?:^|\s)(\S+)(?=\s|$)/g, (full, word) => {
      let stem = word;
      let tail = '';
      const punctMatch = word.match(TRAILING_PUNCT_RE);
      if (punctMatch) {
        tail = punctMatch[0];
        stem = word.slice(0, -tail.length);
      }
      const emote = state.thirdPartyEmotes.get(stem);
      if (!emote) return full;
      const img = `<img class="chat-emote" src="${emote.url}" alt="${stem}" title="${stem} (${emote.source})" loading="lazy">`;
      return full.replace(word, img + tail);
    });
  }
  return html;
}
