/**
 * Per-module info drawer registrations for bubbleCard, pieCard, approvalCard.
 * Controls use the same .opt-row / .opt-toggle markup as the global Options
 * Drawer so CSS is reused. Handlers delegate to the existing setOpt* functions
 * in options.js so persistence + live-apply stays unchanged.
 */

import { state } from '../state.js';
import { registerModuleSettings, attachInfoButton } from './infoDrawer.js';
import {
  setOptBubbleCount, setOptBubbleSpeed, setOptBubbleOpacity,
  setOptPieLabels, setOptPieAnimation,
  setOptApprovalMini, setOptApprovalVerdict,
} from './options.js';
import { updateBubbleScale } from './layout.js';

/* ── small DOM builders ───────────────────────────── */

function sliderRow({ label, id, valId, value, min, max, step, onInput, format = v => v }) {
  const row = document.createElement('div');
  row.className = 'opt-row';
  row.innerHTML = `
    <span class="opt-label">${label}</span>
    <input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}">
    <span class="opt-val" id="${valId}">${format(value)}</span>
  `;
  const slider = row.querySelector('input');
  const valEl  = row.querySelector(`#${valId}`);
  slider.addEventListener('input', () => {
    const v = slider.value;
    valEl.textContent = format(v);
    onInput(v);
  });
  return row;
}

function toggleRow({ label, id, checked, onChange }) {
  const wrap = document.createElement('label');
  wrap.className = 'opt-toggle';
  wrap.innerHTML = `
    <input type="checkbox" id="${id}"${checked ? ' checked' : ''}>
    <span class="opt-label">${label}</span>
  `;
  const input = wrap.querySelector('input');
  input.addEventListener('change', () => onChange(input.checked));
  return wrap;
}

/* ── registration ─────────────────────────────────── */

export function registerModuleInfoDrawers() {
  registerModuleSettings('bubbleCard', (body) => {
    const o = state.drawerOptions;
    body.appendChild(sliderRow({
      label: 'MAX COUNT', id: 'optBubbleCount', valId: 'optBubbleCountVal',
      value: o.bubbleCount ?? 22, min: 5, max: 40, step: 1,
      onInput: setOptBubbleCount,
    }));
    body.appendChild(sliderRow({
      label: 'SPEED', id: 'optBubbleSpeed', valId: 'optBubbleSpeedVal',
      value: o.bubbleSpeed ?? 1, min: 0.1, max: 3, step: 0.1,
      format: v => (+v).toFixed(1) + 'x',
      onInput: setOptBubbleSpeed,
    }));
    body.appendChild(sliderRow({
      label: 'OPACITY', id: 'optBubbleOpacity', valId: 'optBubbleOpacityVal',
      value: o.bubbleOpacity ?? 0.28, min: 0.1, max: 1, step: 0.05,
      format: v => Math.round(+v * 100) + '%',
      onInput: setOptBubbleOpacity,
    }));
    body.appendChild(sliderRow({
      label: 'BUBBLE SCALE', id: 'bubbleScaleSlider', valId: 'bubbleScaleVal',
      value: state.bubbleScale ?? 1, min: 0.3, max: 1.5, step: 0.05,
      format: v => (+v).toFixed(2) + 'x',
      onInput: updateBubbleScale,
    }));
  }, { title: 'CONSENSUS BUBBLES' });

  registerModuleSettings('pieCard', (body) => {
    const o = state.drawerOptions;
    body.appendChild(toggleRow({
      label: 'Pie chart labels', id: 'optPieLabels',
      checked: o.pieLabels !== false, onChange: setOptPieLabels,
    }));
    body.appendChild(toggleRow({
      label: 'Pie animation', id: 'optPieAnimation',
      checked: o.pieAnimation !== false, onChange: setOptPieAnimation,
    }));
  }, { title: 'MOOD DISTRIBUTION' });

  registerModuleSettings('approvalCard', (body) => {
    const o = state.drawerOptions;
    body.appendChild(toggleRow({
      label: 'Show mini bar chart', id: 'optApprovalMini',
      checked: o.approvalMini !== false, onChange: setOptApprovalMini,
    }));
    body.appendChild(toggleRow({
      label: 'Show verdict text', id: 'optApprovalVerdict',
      checked: o.approvalVerdict !== false, onChange: setOptApprovalVerdict,
    }));
  }, { title: 'APPROVAL METER' });
}

/**
 * Replace the "?" help button on each affected card's title bar with
 * a single "ⓘ" that opens its module info drawer.
 */
export function attachModuleInfoButtons() {
  const map = [
    ['pieCard',      '.chart-title.card-title',          'MOOD DISTRIBUTION'],
    ['bubbleCard',   '.card-title',                      'CONSENSUS BUBBLES'],
    ['approvalCard', '.approval-label-center',           'APPROVAL METER'],
  ];
  for (const [moduleId, titleSelector, title] of map) {
    const card = document.getElementById(moduleId);
    if (!card) continue;
    const titleEl = card.querySelector(titleSelector);
    if (!titleEl) continue;
    const oldHelp = titleEl.querySelector('.help-btn:not(#topWordsEditStopwords)');
    if (oldHelp) oldHelp.remove();
    if (!titleEl.querySelector('.card-info-btn')) {
      attachInfoButton(titleEl, moduleId, { title });
    }
  }
}
