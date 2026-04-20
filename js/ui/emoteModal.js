/**
 * Emote modal — click any `.chat-emote` anywhere on the page to open a
 * small centered overlay showing the emote's original code, a larger
 * rendered image, the provider source label, and the CDN URL.
 *
 * Uses one delegated document-level click listener so every rendered emote
 * (main feed, outlier feed, filtered feed, filter preview, user-history
 * modal body) is covered without per-element wiring.
 */

const OVERLAY_ID = 'emoteModalOverlay';

const SOURCE_LABEL = {
  twitch: 'Twitch',
  kick:   'Kick',
  bttv:   'BTTV',
  '7tv':  '7TV',
  ffz:    'FFZ',
};

function _overlay() { return document.getElementById(OVERLAY_ID); }

function _readEmoteData(el) {
  return {
    name:   el.dataset.emoteName   || el.alt || '',
    url:    el.dataset.emoteSrc    || el.src || '',
    source: el.dataset.emoteSource || '',
  };
}

export function openEmoteModal({ name, url, source }) {
  const ov = _overlay();
  if (!ov) return;
  const img   = ov.querySelector('.emote-modal-img');
  const code  = ov.querySelector('.emote-modal-code');
  const srcEl = ov.querySelector('.emote-modal-source');
  const urlEl = ov.querySelector('.emote-modal-url');
  if (img) {
    img.src = url || '';
    img.alt = name || '';
    img.referrerPolicy = 'no-referrer';
  }
  if (code)  code.textContent  = name || '';
  if (srcEl) srcEl.textContent = SOURCE_LABEL[source] || (source || '').toUpperCase();
  if (urlEl) urlEl.textContent = url || '';
  ov.hidden = false;
  ov.classList.add('open');
}

export function closeEmoteModal() {
  const ov = _overlay();
  if (!ov) return;
  ov.classList.remove('open');
  ov.hidden = true;
}

export function initEmoteModal() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.classList.contains('chat-emote')) return;
    e.preventDefault();
    e.stopPropagation();
    openEmoteModal(_readEmoteData(t));
  });

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    if (!t.classList.contains('chat-emote')) return;
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    openEmoteModal(_readEmoteData(t));
  });

  const ov = _overlay();
  if (ov && !ov._wired) {
    ov._wired = true;
    ov.addEventListener('click', (e) => {
      if (e.target === ov) closeEmoteModal();
    });
    const btn = ov.querySelector('.emote-modal-close');
    if (btn) btn.addEventListener('click', closeEmoteModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !ov.hidden) closeEmoteModal();
    });
  }
}
