/**
 * Link safety modal — intercepts clicks on `.chat-link` anchors anywhere on
 * the page, runs a client-side phishing/safety heuristic, and shows a
 * confirmation modal before opening the URL in a new tab.
 *
 * No network calls — all analysis is local (see js/utils/urlSafety.js).
 */

import { analyzeUrl } from '../utils/urlSafety.js';

const OVERLAY_ID = 'linkModalOverlay';

const VERDICT_LABEL = {
  safe:       'OK',
  caution:    'CAUTION',
  suspicious: 'SUSPICIOUS',
  blocked:    'BLOCKED',
};

function _overlay() { return document.getElementById(OVERLAY_ID); }

function _renderReasons(list, reasons) {
  list.innerHTML = '';
  for (const r of reasons) {
    const li = document.createElement('li');
    li.textContent = r;
    list.appendChild(li);
  }
}

export function openLinkModal(url) {
  const ov = _overlay();
  if (!ov) {
    // Fallback: no modal, just open the tab.
    window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const report = analyzeUrl(url);
  const urlEl    = ov.querySelector('.link-modal-url');
  const badge    = ov.querySelector('.link-modal-badge');
  const reasons  = ov.querySelector('.link-modal-reasons');
  const openBtn  = ov.querySelector('.link-modal-open');
  const blocked  = report.verdict === 'blocked';

  if (urlEl) urlEl.textContent = url;
  if (badge) {
    badge.textContent = VERDICT_LABEL[report.verdict] || report.verdict;
    badge.className = 'link-modal-badge link-modal-badge-' + report.verdict;
  }
  if (reasons) _renderReasons(reasons, report.reasons);
  if (openBtn) {
    openBtn.dataset.href = url;
    openBtn.disabled = blocked;
    openBtn.textContent = blocked ? 'Blocked' : 'Open in new tab';
  }

  ov.hidden = false;
  ov.classList.add('open');
}

export function closeLinkModal() {
  const ov = _overlay();
  if (!ov) return;
  ov.classList.remove('open');
  ov.hidden = true;
  const openBtn = ov.querySelector('.link-modal-open');
  if (openBtn) openBtn.dataset.href = '';
}

function _proceed() {
  const ov = _overlay();
  if (!ov) return;
  const openBtn = ov.querySelector('.link-modal-open');
  const href = openBtn && openBtn.dataset.href;
  closeLinkModal();
  if (href) window.open(href, '_blank', 'noopener,noreferrer');
}

export function initLinkModal() {
  document.addEventListener('click', (e) => {
    const t = e.target;
    if (!(t instanceof HTMLElement)) return;
    const a = t.closest('a.chat-link');
    if (!a) return;
    e.preventDefault();
    e.stopPropagation();
    const href = a.getAttribute('href') || '';
    openLinkModal(href);
  });

  const ov = _overlay();
  if (ov && !ov._wired) {
    ov._wired = true;
    ov.addEventListener('click', (e) => {
      if (e.target === ov) closeLinkModal();
    });
    const closeBtn = ov.querySelector('.link-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', closeLinkModal);
    const cancelBtn = ov.querySelector('.link-modal-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', closeLinkModal);
    const openBtn = ov.querySelector('.link-modal-open');
    if (openBtn) openBtn.addEventListener('click', _proceed);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !ov.hidden) closeLinkModal();
    });
  }
}
