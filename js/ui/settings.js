/**
 * Settings — preset management and settings dropdown.
 */
import { state } from '../state.js';
import { PRESET_STORAGE_KEY } from '../config.js';
import { saveRaw } from '../utils/storage.js';
import { resizeBubbleCanvas } from './bubbles.js';
import { saveOptions } from './options.js';

/* ── helpers ─────────────────────────────────────────── */

function allCharts() {
  return [
    state.pieChart, state.radarChart,
    state.approvalTimelineChart, state.throughputTimelineChart,
    state.timelineLinearChart, state.timelineLogChart
  ].filter(Boolean);
}

/* ── persistence ─────────────────────────────────────── */

export function savePreset(preset) {
  saveRaw(PRESET_STORAGE_KEY, preset);
}

/* ── dropdown toggle ─────────────────────────────────── */

export function toggleSettings() {
  document.getElementById('settingsDropdown').classList.toggle('open');
}

/* ── apply preset ────────────────────────────────────── */

export function applyPreset(preset) {
  state.currentPreset = preset;
  savePreset(preset);
  document.body.classList.remove('preset-list', 'preset-dense', 'preset-loose');
  if (preset === 'list') {
    document.body.classList.add('preset-list');
  } else if (preset === 'dense') {
    document.body.classList.add('preset-dense');
    // Also sync drawer density option
    state.drawerOptions.density = 'dense';
    const densityEl = document.getElementById('optDensity');
    if (densityEl) densityEl.value = 'dense';
    saveOptions();
  }
  // Update active state on buttons
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });
  document.getElementById('settingsDropdown').classList.remove('open');

  // Resize bubble canvas after layout reflows
  setTimeout(resizeBubbleCanvas, 50);
  // Resize charts
  for (const c of allCharts()) {
    c.resize();
    if (c === state.radarChart) c.update('none');
  }
}

/* ── close settings dropdown when clicking outside ───── */

document.addEventListener('click', e => {
  if (!e.target.closest('.settings-wrap')) {
    document.getElementById('settingsDropdown').classList.remove('open');
  }
});
