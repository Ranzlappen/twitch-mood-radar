/**
 * Bug Report modal — opens from the header bug button.
 *
 * Layout:
 *   1. A free-form textarea where the user describes what went wrong.
 *   2. A read-only diagnostics canvas showing browser/device data that
 *      may help reproduce the issue (UA, viewport, locale, etc.).
 *   3. A "Send bug report" button that builds a `mailto:` URL with a
 *      prefilled subject and the description + diagnostics in the body.
 *
 * Built on the shared createModal() factory in js/ui/modal.js so it
 * inherits the same .mr-overlay / .mr-modal styling, focus trap,
 * Escape-to-close and click-outside-to-close behaviour as every other
 * surface in the app.
 */

import { createModal } from './modal.js';

const BUG_REPORT_TO = 'info@ranzlappen.com';
const BUG_REPORT_SUBJECT = '[Mood Radar] Bug report';

let _modalController = null;
let _descriptionEl = null;
let _diagnosticsEl = null;

function _safe(fn, fallback = '—') {
  try {
    const v = fn();
    if (v == null || v === '') return fallback;
    return v;
  } catch {
    return fallback;
  }
}

function collectDiagnostics() {
  const nav = navigator || {};
  const scr = window.screen || {};
  const conn = nav.connection || nav.mozConnection || nav.webkitConnection || null;

  return {
    'App URL':            _safe(() => location.href),
    'App version':        _safe(() => document.querySelector('meta[name="app-version"]')?.content, 'unknown'),
    'Reported at':        _safe(() => new Date().toISOString()),
    'Local time':         _safe(() => new Date().toString()),
    'Timezone':           _safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
    'User agent':         _safe(() => nav.userAgent),
    'Platform':           _safe(() => nav.userAgentData?.platform || nav.platform),
    'Mobile':             _safe(() => (nav.userAgentData?.mobile ?? /Mobi|Android/i.test(nav.userAgent || '')) ? 'yes' : 'no'),
    'Languages':          _safe(() => (nav.languages || [nav.language]).join(', ')),
    'Viewport':           _safe(() => `${window.innerWidth} × ${window.innerHeight} px`),
    'Screen':             _safe(() => `${scr.width} × ${scr.height} px`),
    'Device pixel ratio': _safe(() => window.devicePixelRatio),
    'Color depth':        _safe(() => `${scr.colorDepth}-bit`),
    'CPU cores':          _safe(() => nav.hardwareConcurrency),
    'Device memory':      _safe(() => nav.deviceMemory ? `${nav.deviceMemory} GB` : '—'),
    'Touch points':       _safe(() => nav.maxTouchPoints ?? 0),
    'Online':             _safe(() => nav.onLine ? 'yes' : 'no'),
    'Cookies enabled':    _safe(() => nav.cookieEnabled ? 'yes' : 'no'),
    'Connection':         _safe(() => conn ? `${conn.effectiveType || '?'} · ${conn.downlink ?? '?'} Mbps · rtt ${conn.rtt ?? '?'} ms` : '—'),
    'Service worker':     _safe(() => ('serviceWorker' in nav) ? (nav.serviceWorker.controller ? 'active' : 'registered') : 'unsupported'),
    'Standalone (PWA)':   _safe(() => window.matchMedia?.('(display-mode: standalone)')?.matches ? 'yes' : 'no'),
    'Referrer':           _safe(() => document.referrer || '—'),
  };
}

function formatDiagnostics(d) {
  const keys = Object.keys(d);
  const pad = Math.max(...keys.map(k => k.length));
  return keys.map(k => `${k.padEnd(pad, ' ')} : ${d[k]}`).join('\n');
}

function buildMailto(description, diagnosticsText) {
  const desc = (description || '').trim() || '(no description provided)';
  const body = [
    'Description',
    '-----------',
    desc,
    '',
    'Diagnostics',
    '-----------',
    diagnosticsText,
  ].join('\n');

  const params = new URLSearchParams({ subject: BUG_REPORT_SUBJECT, body });
  // URLSearchParams encodes spaces as '+'; mailto clients handle %20 more
  // reliably, so swap them.
  return `mailto:${encodeURIComponent(BUG_REPORT_TO)}?${params.toString().replace(/\+/g, '%20')}`;
}

function buildBody() {
  const wrap = document.createElement('div');
  wrap.className = 'bug-report-modal';

  // ── Description section ─────────────────────────────
  const descSection = document.createElement('section');
  descSection.className = 'mr-modal__section';
  const descTitle = document.createElement('div');
  descTitle.className = 'mr-modal__section-title';
  descTitle.textContent = 'Describe the bug';
  const descHint = document.createElement('div');
  descHint.className = 'mr-modal__help-text';
  descHint.textContent = 'What did you expect to happen? What actually happened? Steps to reproduce, if you have them.';
  const descArea = document.createElement('textarea');
  descArea.className = 'bug-report-description';
  descArea.rows = 6;
  descArea.placeholder = 'e.g. After connecting to a Twitch channel, the timeline freezes when I switch tabs…';
  descSection.appendChild(descTitle);
  descSection.appendChild(descHint);
  descSection.appendChild(descArea);

  // ── Diagnostics section ─────────────────────────────
  const diagSection = document.createElement('section');
  diagSection.className = 'mr-modal__section';
  const diagTitle = document.createElement('div');
  diagTitle.className = 'mr-modal__section-title';
  diagTitle.textContent = 'Browser & device data (auto-collected)';
  const diagHint = document.createElement('div');
  diagHint.className = 'mr-modal__help-text';
  diagHint.textContent = 'This block is included with the report so the issue can be reproduced. It is read-only — review it before sending.';
  const diagPre = document.createElement('pre');
  diagPre.className = 'bug-report-diagnostics';
  diagPre.setAttribute('aria-readonly', 'true');
  diagPre.tabIndex = 0;
  diagSection.appendChild(diagTitle);
  diagSection.appendChild(diagHint);
  diagSection.appendChild(diagPre);

  // ── Actions ─────────────────────────────────────────
  const actions = document.createElement('div');
  actions.className = 'bug-report-actions';
  const sendBtn = document.createElement('a');
  sendBtn.className = 'bug-report-send';
  sendBtn.textContent = 'Send bug report';
  sendBtn.setAttribute('role', 'button');
  sendBtn.href = '#';
  sendBtn.addEventListener('click', (e) => {
    // Recompute diagnostics at click time so values like viewport size are
    // current. The href is also kept fresh on description input below.
    const href = buildMailto(descArea.value, diagPre.textContent || '');
    sendBtn.href = href;
    // Let the browser handle the mailto navigation, then close the modal.
    setTimeout(() => _modalController?.close(), 0);
    // Don't preventDefault — we want the mailto to fire.
    void e;
  });
  actions.appendChild(sendBtn);

  wrap.appendChild(descSection);
  wrap.appendChild(diagSection);
  wrap.appendChild(actions);

  // Stash references so refresh-on-open can repopulate diagnostics.
  _descriptionEl = descArea;
  _diagnosticsEl = diagPre;

  // Keep the mailto href live so middle-click / right-click "copy link"
  // also yields a usable mailto: URL.
  const refreshHref = () => {
    sendBtn.href = buildMailto(descArea.value, diagPre.textContent || '');
  };
  descArea.addEventListener('input', refreshHref);

  return wrap;
}

function refreshDiagnostics() {
  if (!_diagnosticsEl) return;
  _diagnosticsEl.textContent = formatDiagnostics(collectDiagnostics());
}

export function openBugReportModal() {
  if (!_modalController) {
    _modalController = createModal({
      id: 'bugReportOverlay',
      title: 'REPORT A BUG',
      variant: 'wide',
      body: buildBody(),
      onOpen: () => {
        refreshDiagnostics();
        // Reset description text each time the modal opens so users don't
        // accidentally re-send a stale draft. Diagnostics regenerate fresh.
        if (_descriptionEl) _descriptionEl.value = '';
      },
    });
  }
  _modalController.open();
}

export function initBugReportModal() {
  const btn = document.getElementById('bugReportBtn');
  if (!btn || btn._wired) return;
  btn._wired = true;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    openBugReportModal();
  });
}
