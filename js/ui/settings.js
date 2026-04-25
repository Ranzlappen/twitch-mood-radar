/**
 * Preset management. The former standalone Settings Dropdown has been
 * retired — preset buttons now live at the top of the Options Drawer.
 */
import { state } from '../state.js';
import { PRESET_STORAGE_KEY } from '../config.js';
import { saveRaw } from '../utils/storage.js';
import { resizeBubbleCanvas } from './bubbles.js';
import { saveOptions } from './options.js';

function allCharts() {
  return [
    state.pieChart,
    state.approvalTimelineChart, state.throughputTimelineChart,
    state.timelineLinearChart, state.timelineLogChart
  ].filter(Boolean);
}

export function savePreset(preset) {
  saveRaw(PRESET_STORAGE_KEY, preset);
}

/**
 * No-op stub kept for back-compat with any inline onclick that may still
 * reference toggleSettings(). The dropdown no longer exists; opening the
 * Options Drawer is the user-facing flow now.
 */
export function toggleSettings() { /* retired */ }

export function applyPreset(preset) {
  state.currentPreset = preset;
  savePreset(preset);
  document.body.classList.remove('preset-list', 'preset-dense', 'preset-loose');
  if (preset === 'list') {
    document.body.classList.add('preset-list');
  } else if (preset === 'dense') {
    document.body.classList.add('preset-dense');
    state.drawerOptions.density = 'dense';
    const densityEl = document.getElementById('optDensity');
    if (densityEl) densityEl.value = 'dense';
    saveOptions();
  }
  // Update active state on preset buttons in the Options Drawer.
  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });

  setTimeout(resizeBubbleCanvas, 50);
  for (const c of allCharts()) c.resize();
}
