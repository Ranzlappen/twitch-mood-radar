// DOM utility functions

export function sanitize(s) {
  if (typeof s !== 'string') return '';
  return s.replace(/[\uFFFD\u200B\u200C\u200D\uFEFF]/g, '').replace(/\s{2,}/g, ' ').trim();
}

export function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

export function setStatus(html, cls) {
  const el = document.getElementById('statusBar');
  el.innerHTML = html;
  el.className = 'status-bar' + (cls ? ' ' + cls : '');
}

export function fmtNum(n) {
  return n >= 1000 ? (n / 1000).toFixed(1) + 'k' : n;
}
