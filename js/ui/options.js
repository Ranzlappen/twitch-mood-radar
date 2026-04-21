/**
 * Options Drawer — comprehensive customization panel.
 * Manages drawerOptions state and live-preview setters.
 */
import { state } from '../state.js';
import { DEFAULT_OPTIONS, OPTIONS_STORAGE_KEY } from '../config.js';
import { save, load } from '../utils/storage.js';
import { resizeBubbleCanvas } from './bubbles.js';

export const RUMBLE_PROXY_STORAGE_KEY = 'moodradar_rumble_proxy_v1';

/* ── helpers ─────────────────────────────────────────── */

function allCharts() {
  return [
    state.pieChart, state.radarChart,
    state.approvalTimelineChart, state.throughputTimelineChart,
    state.timelineLinearChart, state.timelineLogChart
  ].filter(Boolean);
}

function allTimelineCharts() {
  return [
    state.timelineLinearChart, state.timelineLogChart,
    state.approvalTimelineChart, state.throughputTimelineChart
  ].filter(Boolean);
}

/* ── persistence ─────────────────────────────────────── */

export function loadOptions() {
  const saved = load(OPTIONS_STORAGE_KEY, null);
  if (saved) state.drawerOptions = { ...DEFAULT_OPTIONS, ...saved };
}

export function saveOptions() {
  save(OPTIONS_STORAGE_KEY, state.drawerOptions);
}

/* ── drawer toggle ───────────────────────────────────── */

export function toggleOptionsDrawer() {
  const d = document.getElementById('optionsDrawer');
  const o = document.getElementById('optionsOverlay');
  const open = !d.classList.contains('open');
  d.classList.toggle('open', open);
  o.classList.toggle('open', open);
  if (open) refreshStorageUsage();
}

/* ── storage usage (IndexedDB + cache quota) ─────────── */

function _fmtBytes(n) {
  if (!isFinite(n) || n < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  const d = n >= 100 || i === 0 ? 0 : (n >= 10 ? 1 : 2);
  return n.toFixed(d) + ' ' + units[i];
}

export async function refreshStorageUsage() {
  const el = document.getElementById('optStorageUsage');
  if (!el) return;
  if (!navigator.storage || !navigator.storage.estimate) {
    el.textContent = 'Storage API unavailable';
    return;
  }
  try {
    const [est, persisted] = await Promise.all([
      navigator.storage.estimate(),
      navigator.storage.persisted ? navigator.storage.persisted() : Promise.resolve(false),
    ]);
    const used = _fmtBytes(est.usage || 0);
    const quota = _fmtBytes(est.quota || 0);
    const pct = est.quota ? ((est.usage / est.quota) * 100).toFixed(2) : '—';
    const mode = persisted ? 'persistent' : 'best-effort';
    el.textContent = `${used} of ${quota} (${pct}%) · ${mode}`;
  } catch {
    el.textContent = 'Unable to read storage estimate';
  }
}

/* ── individual live-preview setters ─────────────────── */

export function setOptDensity(val) {
  state.drawerOptions.density = val;
  document.body.classList.remove('preset-dense', 'preset-loose');
  if (val === 'dense') document.body.classList.add('preset-dense');
  else if (val === 'loose') document.body.classList.add('preset-loose');
  saveOptions();
  setTimeout(() => {
    resizeBubbleCanvas();
    allCharts().forEach(c => c.resize());
  }, 100);
}

export function setOptGap(v) {
  state.drawerOptions.gap = parseInt(v);
  document.documentElement.style.setProperty('--gap', v + 'px');
  document.getElementById('optGapVal').textContent = v + 'px';
  saveOptions();
}

export function setOptCardPad(v) {
  state.drawerOptions.cardPad = parseInt(v);
  document.documentElement.style.setProperty('--card-pad', v + 'px');
  document.getElementById('optCardPadVal').textContent = v + 'px';
  saveOptions();
}

export function setOptFontScale(v) {
  state.drawerOptions.fontScale = parseFloat(v);
  document.documentElement.style.setProperty('--font-scale', v);
  document.getElementById('optFontScaleVal').textContent = parseFloat(v).toFixed(2);
  saveOptions();
}

export function setOptCrt(v) {
  state.drawerOptions.crtOpacity = parseFloat(v);
  document.documentElement.style.setProperty('--crt-opacity', v);
  document.getElementById('optCrtVal').textContent = Math.round(v * 100) + '%';
  saveOptions();
}

export function setOptGridBg(v) {
  state.drawerOptions.gridOpacity = parseFloat(v);
  document.documentElement.style.setProperty('--grid-opacity', v);
  document.getElementById('optGridVal').textContent = Math.round(v * 100) + '%';
  saveOptions();
}

export function setOptShowSubtitle(c) {
  state.drawerOptions.showSubtitle = c;
  document.querySelector('.subtitle').style.display = c ? '' : 'none';
  saveOptions();
}

export function setOptShowLegend(c) {
  state.drawerOptions.showLegend = c;
  document.getElementById('moodLegend').style.display = c ? '' : 'none';
  saveOptions();
}

export function setOptShowDividers(c) {
  state.drawerOptions.showDividers = c;
  document.querySelectorAll('.section-divider').forEach(el => el.style.display = c ? '' : 'none');
  saveOptions();
}

export function setOptCompactStats(c) {
  state.drawerOptions.compactStats = c;
  document.querySelector('.stats-row').classList.toggle('compact', c);
  saveOptions();
}

export function setOptRenderTextEmoji(c) {
  state.drawerOptions.renderTextEmoji = !!c;
  saveOptions();
}

export function setOptBubbleCount(v) {
  state.drawerOptions.bubbleCount = parseInt(v);
  document.getElementById('optBubbleCountVal').textContent = v;
  saveOptions();
}

export function setOptBubbleSpeed(v) {
  state.drawerOptions.bubbleSpeed = parseFloat(v);
  document.getElementById('optBubbleSpeedVal').textContent = parseFloat(v).toFixed(1) + 'x';
  saveOptions();
}

export function setOptBubbleOpacity(v) {
  state.drawerOptions.bubbleOpacity = parseFloat(v);
  document.getElementById('optBubbleOpacityVal').textContent = Math.round(v * 100) + '%';
  saveOptions();
}

export function setOptBubbleHeight(v) {
  state.drawerOptions.bubbleHeight = parseInt(v);
  document.documentElement.style.setProperty('--bubble-height', v + 'px');
  document.getElementById('optBubbleHeightVal').textContent = v + 'px';
  saveOptions();
  setTimeout(resizeBubbleCanvas, 50);
}

export function setOptPieLabels(c) {
  state.drawerOptions.pieLabels = c;
  if (state.pieChart) state.pieChart.update('none');
  saveOptions();
}

export function setOptPieAnimation(c) {
  state.drawerOptions.pieAnimation = c;
  if (state.pieChart) state.pieChart.options.animation.duration = c ? 350 : 0;
  saveOptions();
}

export function setOptRadarAnimation(c) {
  state.drawerOptions.radarAnimation = c;
  if (state.radarChart) state.radarChart.options.animation.duration = c ? 400 : 0;
  saveOptions();
}

export function setOptRadarGrid(c) {
  state.drawerOptions.radarGrid = c;
  if (state.radarChart) {
    state.radarChart.options.scales.r.grid.display = c;
    state.radarChart.options.scales.r.angleLines.display = c;
    state.radarChart.update('none');
  }
  saveOptions();
}

export function setOptTimelineHeight(v) {
  state.drawerOptions.timelineHeight = parseInt(v);
  document.documentElement.style.setProperty('--timeline-height', v + 'px');
  document.getElementById('optTimelineHeightVal').textContent = v + 'px';
  saveOptions();
  allTimelineCharts().forEach(c => c.resize());
}

export function setOptTlGrid(c) {
  state.drawerOptions.tlGrid = c;
  allTimelineCharts().forEach(ch => {
    ch.options.scales.x.grid.display = c;
    ch.options.scales.y.grid.display = c;
    ch.update('none');
  });
  saveOptions();
}

export function setOptTlSmooth(c) {
  state.drawerOptions.tlSmooth = c;
  const t = c ? 0.45 : 0;
  allTimelineCharts().forEach(ch => {
    for (const ds of ch.data.datasets) ds.tension = t;
    ch.update('none');
  });
  saveOptions();
}

export function setOptApprovalMini(c) {
  state.drawerOptions.approvalMini = c;
  document.getElementById('approvalMini').style.display = c ? '' : 'none';
  saveOptions();
}

export function setOptApprovalVerdict(c) {
  state.drawerOptions.approvalVerdict = c;
  document.getElementById('approvalVerdict').style.display = c ? '' : 'none';
  saveOptions();
}

export function setOptWakeLock(c) {
  state.drawerOptions.wakeLockEnabled = c;
  if (c) {
    import('./wake-lock.js').then(m => m.requestWakeLock());
  } else {
    import('./wake-lock.js').then(m => m.releaseWakeLock());
  }
  saveOptions();
}

export function setOptCardVisibility(id, vis) {
  if (!state.drawerOptions.cardVisibility) state.drawerOptions.cardVisibility = {};
  state.drawerOptions.cardVisibility[id] = vis;
  const el = document.getElementById(id);
  if (el) el.style.display = vis ? '' : 'none';
  saveOptions();
  // Import notifyChartResize lazily to avoid circular dep
  if (vis) {
    import('./layout.js').then(m => {
      setTimeout(() => m.notifyChartResize(id), 50);
    });
  }
}

/* ── Rumble proxy URL (Cloudflare Worker) ────────────── */

export function loadRumbleProxyUrl() {
  const input = document.getElementById('optRumbleProxyUrl');
  if (!input) return;
  try {
    input.value = localStorage.getItem(RUMBLE_PROXY_STORAGE_KEY) || '';
  } catch { /* private browsing */ }
}

export function saveRumbleProxyUrl() {
  const input = document.getElementById('optRumbleProxyUrl');
  const fb = document.getElementById('optRumbleProxySaved');
  if (!input) return;
  const raw = input.value.trim().replace(/\/+$/, '');

  const showFeedback = (msg, isErr) => {
    if (!fb) return;
    fb.textContent = msg;
    fb.classList.toggle('err', !!isErr);
    fb.classList.add('show');
    clearTimeout(saveRumbleProxyUrl._t);
    saveRumbleProxyUrl._t = setTimeout(() => fb.classList.remove('show'), 2500);
  };

  try {
    if (raw === '') {
      localStorage.removeItem(RUMBLE_PROXY_STORAGE_KEY);
      input.value = '';
      showFeedback('Cleared', false);
      return;
    }
    let u;
    try { u = new URL(raw); } catch { showFeedback('Invalid URL', true); return; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:') {
      showFeedback('Must be http(s)://', true);
      return;
    }
    localStorage.setItem(RUMBLE_PROXY_STORAGE_KEY, raw);
    input.value = raw;
    showFeedback('Saved', false);
  } catch {
    showFeedback('Storage blocked', true);
  }
}

export function resetAllOptions() {
  state.drawerOptions = { ...DEFAULT_OPTIONS };
  saveOptions();
  applyAllOptions();
}

export function applyAllOptions() {
  const o = state.drawerOptions;
  // Density
  document.body.classList.remove('preset-dense', 'preset-loose');
  if (o.density === 'dense') document.body.classList.add('preset-dense');
  else if (o.density === 'loose') document.body.classList.add('preset-loose');
  const densityEl = document.getElementById('optDensity');
  if (densityEl) densityEl.value = o.density;
  // CSS variables
  const root = document.documentElement.style;
  root.setProperty('--gap', o.gap + 'px');
  root.setProperty('--card-pad', o.cardPad + 'px');
  root.setProperty('--font-scale', o.fontScale);
  root.setProperty('--crt-opacity', o.crtOpacity);
  root.setProperty('--grid-opacity', o.gridOpacity);
  root.setProperty('--timeline-height', o.timelineHeight + 'px');
  root.setProperty('--bubble-height', o.bubbleHeight + 'px');
  // Slider values
  const sync = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const text = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  sync('optGap', o.gap); text('optGapVal', o.gap + 'px');
  sync('optCardPad', o.cardPad); text('optCardPadVal', o.cardPad + 'px');
  sync('optFontScale', o.fontScale); text('optFontScaleVal', o.fontScale.toFixed(2));
  sync('optCrt', o.crtOpacity); text('optCrtVal', Math.round(o.crtOpacity * 100) + '%');
  sync('optGrid', o.gridOpacity); text('optGridVal', Math.round(o.gridOpacity * 100) + '%');
  // Toggles
  const chk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  chk('optShowSubtitle', o.showSubtitle);
  document.querySelector('.subtitle').style.display = o.showSubtitle ? '' : 'none';
  chk('optShowLegend', o.showLegend);
  const legendEl = document.getElementById('moodLegend');
  if (legendEl) legendEl.style.display = o.showLegend ? '' : 'none';
  chk('optShowDividers', o.showDividers);
  document.querySelectorAll('.section-divider').forEach(el => el.style.display = o.showDividers ? '' : 'none');
  chk('optCompactStats', o.compactStats);
  const statsEl = document.querySelector('.stats-row');
  if (statsEl) statsEl.classList.toggle('compact', o.compactStats);
  chk('optRenderTextEmoji', o.renderTextEmoji !== false);
  // Bubbles
  sync('optBubbleCount', o.bubbleCount); text('optBubbleCountVal', o.bubbleCount);
  sync('optBubbleSpeed', o.bubbleSpeed); text('optBubbleSpeedVal', o.bubbleSpeed.toFixed(1) + 'x');
  sync('optBubbleOpacity', o.bubbleOpacity); text('optBubbleOpacityVal', Math.round(o.bubbleOpacity * 100) + '%');
  sync('optBubbleHeight', o.bubbleHeight); text('optBubbleHeightVal', o.bubbleHeight + 'px');
  // Charts
  chk('optPieLabels', o.pieLabels);
  chk('optPieAnimation', o.pieAnimation);
  chk('optRadarAnimation', o.radarAnimation);
  chk('optRadarGrid', o.radarGrid);
  // Timelines
  sync('optTimelineHeight', o.timelineHeight); text('optTimelineHeightVal', o.timelineHeight + 'px');
  chk('optTlGrid', o.tlGrid);
  chk('optTlSmooth', o.tlSmooth);
  // Approval
  chk('optApprovalMini', o.approvalMini);
  const miniEl = document.getElementById('approvalMini');
  if (miniEl) miniEl.style.display = o.approvalMini ? '' : 'none';
  chk('optApprovalVerdict', o.approvalVerdict);
  const verdEl = document.getElementById('approvalVerdict');
  if (verdEl) verdEl.style.display = o.approvalVerdict ? '' : 'none';
  // Wake lock — also re-acquire it if persisted state says it should be on,
  // so the setting survives a page reload (checkbox state alone won't rearm it).
  chk('optWakeLock', o.wakeLockEnabled);
  if (o.wakeLockEnabled) {
    import('./wake-lock.js').then(m => m.requestWakeLock());
  }
  // Card visibility
  const visMap = {
    pieCard:'optShowPie', radarCard:'optShowRadar', bubbleCard:'optShowBubble',
    approvalCard:'optShowApproval', approvalTimelineCard:'optShowApprovalTL',
    throughputTimelineCard:'optShowThroughputTL', timelineLinearCard:'optShowLinearTL',
    timelineLogCard:'optShowLogTL', feedCard:'optShowFeed',
    filteredFeedCard:'optShowFilteredFeed', outlierCard:'optShowOutlier'
  };
  for (const [cid, cbid] of Object.entries(visMap)) {
    const vis = o.cardVisibility[cid] !== false;
    chk(cbid, vis);
    const cel = document.getElementById(cid);
    if (cel) cel.style.display = vis ? '' : 'none';
  }
  // Apply to charts if ready
  if (state.chartsReady) {
    if (state.pieChart) state.pieChart.options.animation.duration = o.pieAnimation ? 350 : 0;
    if (state.radarChart) {
      state.radarChart.options.animation.duration = o.radarAnimation ? 400 : 0;
      state.radarChart.options.scales.r.grid.display = o.radarGrid;
      state.radarChart.options.scales.r.angleLines.display = o.radarGrid;
      state.radarChart.update('none');
    }
    allTimelineCharts().forEach(ch => {
      ch.options.scales.x.grid.display = o.tlGrid;
      ch.options.scales.y.grid.display = o.tlGrid;
      for (const ds of ch.data.datasets) ds.tension = o.tlSmooth ? 0.45 : 0;
      ch.update('none');
    });
  }
  // Resize after all changes
  setTimeout(() => {
    resizeBubbleCanvas();
    allCharts().forEach(c => c.resize());
  }, 100);
}
