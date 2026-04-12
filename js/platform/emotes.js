/**
 * Shared emote rendering — converts text emote codes to visual representations.
 */
import { EMOTE_MAP, EMOTE_REGEX } from '../config.js';
import { state } from '../state.js';

/**
 * Replace known emote codes in pre-escaped HTML with emoji spans and
 * third-party emote images.
 * @param {string} escapedHtml — HTML-escaped chat message text
 * @returns {string} HTML with emote codes replaced
 */
export function renderEmotes(escapedHtml) {
  // Pass 1: replace hardcoded text emotes with Unicode emoji (fallback)
  let html = escapedHtml.replace(EMOTE_REGEX, match => {
    const emoji = EMOTE_MAP.get(match);
    return emoji ? `<span title="${match}">${emoji}</span>` : match;
  });
  // Pass 2: replace third-party emote codes with actual emote images
  if (state.thirdPartyEmotes.size > 0) {
    html = html.replace(/(?:^|\s)(\S+)(?=\s|$)/g, (full, word) => {
      const emote = state.thirdPartyEmotes.get(word);
      if (!emote) return full;
      const img = `<img class="chat-emote" src="${emote.url}" alt="${word}" title="${word} (${emote.source})" loading="lazy">`;
      return full.replace(word, img);
    });
  }
  return html;
}
