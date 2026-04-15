/**
 * Layout Manager — resize system, custom layout, and scale controls.
 */
import { state } from '../state.js';
import {
  RESIZABLE_IDS, LAYOUT_SECTIONS, LAYOUT_STORAGE_KEY,
  RESIZE_STORAGE_KEY, RESIZE_DEBOUNCE_MS,
  HALFLIFE_KEY, LABEL_SCALE_KEY, BUBBLE_SCALE_KEY
} from '../config.js';
import { load, save } from '../utils/storage.js';
import { resizeBubbleCanvas } from './bubbles.js';

/* ── module-level layout state ───────────────────────── */

let layoutOrder = LAYOUT_SECTIONS.map(s => s.id);
let layoutInline = {}; // id -> true means "inline with next"
let layoutAlignItems = 'start';     // start | center | stretch
let layoutJustifyContent = 'start'; // start | center | between
let isRestoringLayout = false;      // guard against ResizeObserver during DOM rebuild

/* ── helpers ─────────────────────────────────────────── */

function allCharts() {
  return [
    state.pieChart, state.radarChart,
    state.approvalTimelineChart, state.throughputTimelineChart,
    state.timelineLinearChart, state.timelineLogChart
  ].filter(Boolean);
}

/* ── resize system ───────────────────────────────────── */

export function saveSizes() {
  if (isRestoringLayout) return; // don't overwrite saved sizes during init/layout rebuild
  const sizes = {};
  for (const id of RESIZABLE_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    sizes[id] = { h: el.offsetHeight, w: el.offsetWidth };
    if (el.dataset.manualWidth) sizes[id].mw = 1; // flag: user explicitly resized width
  }
  save(RESIZE_STORAGE_KEY, sizes);
}

export function restoreSizes() {
  const sizes = load(RESIZE_STORAGE_KEY, null);
  if (!sizes) return;
  const isCustom = document.body.classList.contains('preset-custom');
  for (const id of RESIZABLE_IDS) {
    const el = document.getElementById(id);
    if (!el || !sizes[id]) continue;
    // Support both old format (number) and new format ({h,w,mw})
    if (typeof sizes[id] === 'number') {
      el.style.height = sizes[id] + 'px';
    } else {
      if (sizes[id].h) el.style.height = sizes[id].h + 'px';
      // Only restore width in custom layout where cards live inside flex rows
      if (sizes[id].mw && isCustom && sizes[id].w) {
        el.style.width = sizes[id].w + 'px';
        el.style.flex = 'none';
        el.dataset.manualWidth = '1';
      }
    }
  }
}

export function notifyChartResize(cardId) {
  if (cardId === 'pieCard'               && state.pieChart)              { state.pieChart.resize(); state.pieChart.update('none'); }
  if (cardId === 'radarCard'             && state.radarChart)            { state.radarChart.resize(); state.radarChart.update('none'); }
  if (cardId === 'approvalTimelineCard'  && state.approvalTimelineChart)  state.approvalTimelineChart.resize();
  if (cardId === 'throughputTimelineCard' && state.throughputTimelineChart) state.throughputTimelineChart.resize();
  if (cardId === 'timelineLinearCard'    && state.timelineLinearChart)    state.timelineLinearChart.resize();
  if (cardId === 'timelineLogCard'       && state.timelineLogChart)      state.timelineLogChart.resize();
  if (cardId === 'bubbleCard')                                           resizeBubbleCanvas();
}

export function addResizeHandle(el) {
  const handle = document.createElement('div');
  handle.className = 'resize-handle';
  handle.title = 'Drag corner to resize';
  el.appendChild(handle);

  let startX = 0, startY = 0, startW = 0, startH = 0;
  let debounceTimer = null;

  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    startW = el.offsetWidth;
    startH = el.offsetHeight;

    function onMove(e) {
      const newH = Math.max(80, startH + (e.clientY - startY));
      const newW = Math.max(120, startW + (e.clientX - startX));
      el.style.height = newH + 'px';
      el.style.width = newW + 'px';
      el.style.flex = 'none';
      el.style.maxWidth = '100%';
      el.dataset.manualWidth = '1';
      notifyChartResize(el.id);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(saveSizes, RESIZE_DEBOUNCE_MS);
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      saveSizes();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });

  // Touch support
  handle.addEventListener('touchstart', e => {
    e.preventDefault();
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    startW = el.offsetWidth;
    startH = el.offsetHeight;

    function onMove(e) {
      const t = e.touches[0];
      const newH = Math.max(80, startH + (t.clientY - startY));
      const newW = Math.max(120, startW + (t.clientX - startX));
      el.style.height = newH + 'px';
      el.style.width = newW + 'px';
      el.style.flex = 'none';
      el.style.maxWidth = '100%';
      el.dataset.manualWidth = '1';
      notifyChartResize(el.id);
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(saveSizes, RESIZE_DEBOUNCE_MS);
    }
    function onEnd() {
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
      saveSizes();
    }
    el.addEventListener('touchmove', onMove, { passive: false });
    el.addEventListener('touchend', onEnd);
  }, { passive: false });
}

export function setupResizeObserver() {
  if (!window.ResizeObserver) return;
  let debounceTimer = null;
  const observer = new ResizeObserver(entries => {
    for (const entry of entries) {
      notifyChartResize(entry.target.id);
    }
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (!isRestoringLayout) saveSizes();
    }, RESIZE_DEBOUNCE_MS);
  });
  for (const id of RESIZABLE_IDS) {
    const el = document.getElementById(id);
    if (el) { addResizeHandle(el); observer.observe(el); }
  }
}

/* ── layout persistence ──────────────────────────────── */

export function loadLayout() {
  try {
    const saved = load(LAYOUT_STORAGE_KEY, null);
    if (saved && saved.order) {
      // Validate all IDs exist
      const validIds = new Set(LAYOUT_SECTIONS.map(s => s.id));
      const filtered = saved.order.filter(id => validIds.has(id));
      // Add any missing IDs at end
      for (const s of LAYOUT_SECTIONS) { if (!filtered.includes(s.id)) filtered.push(s.id); }
      layoutOrder = filtered;
      layoutInline = saved.inline || {};
    }
    if (saved && saved.alignItems) layoutAlignItems = saved.alignItems;
    if (saved && saved.justifyContent) layoutJustifyContent = saved.justifyContent;
  } catch { }
}

export function saveLayout() {
  save(LAYOUT_STORAGE_KEY, {
    order: layoutOrder, inline: layoutInline,
    alignItems: layoutAlignItems, justifyContent: layoutJustifyContent
  });
}

/* ── layout manager UI ───────────────────────────────── */

export function renderLayoutManager() {
  const container = document.getElementById('layoutItemList');
  container.innerHTML = '';
  for (let i = 0; i < layoutOrder.length; i++) {
    const id = layoutOrder[i];
    const section = LAYOUT_SECTIONS.find(s => s.id === id);
    if (!section) continue;
    const item = document.createElement('div');
    item.className = 'layout-item';
    item.draggable = true;
    item.dataset.idx = i;
    const isInline = !!layoutInline[id];
    item.innerHTML = `<span class="drag-handle">&#x2630;</span>` +
      `<span class="layout-item-label">${section.label}</span>` +
      `<button class="layout-inline-toggle ${isInline ? 'active' : ''}" onclick="toggleLayoutInline('${id}',this)" title="${isInline ? 'Currently side-by-side with next section. Click to stack vertically instead.' : 'Currently stacked vertically. Click to place side-by-side with next section.'}">${isInline ? '\u2B0C SIDE' : '\u2B0D STACK'}</button>`;

    item.addEventListener('dragstart', e => {
      e.dataTransfer.setData('text/plain', i);
      item.classList.add('dragging');
    });
    item.addEventListener('dragend', () => item.classList.remove('dragging'));
    item.addEventListener('dragover', e => { e.preventDefault(); item.style.borderColor = 'var(--accent)'; });
    item.addEventListener('dragleave', () => { item.style.borderColor = 'transparent'; });
    item.addEventListener('drop', e => {
      e.preventDefault();
      item.style.borderColor = 'transparent';
      const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
      const toIdx = parseInt(item.dataset.idx);
      if (fromIdx === toIdx) return;
      const [moved] = layoutOrder.splice(fromIdx, 1);
      layoutOrder.splice(toIdx, 0, moved);
      saveLayout();
      renderLayoutManager();
    });
    container.appendChild(item);
  }

  // Render flexbox alignment options
  renderFlexOptions();
}

function renderFlexOptions() {
  let wrap = document.getElementById('layoutFlexOptions');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'layoutFlexOptions';
    wrap.className = 'layout-flex-options';
    const itemList = document.getElementById('layoutItemList');
    itemList.parentNode.insertBefore(wrap, itemList.nextSibling);
  }
  const alignOpts = [
    { val: 'start', label: 'TOP' },
    { val: 'center', label: 'CENTER' },
    { val: 'stretch', label: 'STRETCH' }
  ];
  const justifyOpts = [
    { val: 'start', label: 'LEFT' },
    { val: 'center', label: 'CENTER' },
    { val: 'between', label: 'SPREAD' }
  ];
  wrap.innerHTML =
    `<div class="flex-opt-group"><span class="flex-opt-label">ALIGN</span>` +
    alignOpts.map(o => `<button class="flex-opt-btn${layoutAlignItems === o.val ? ' active' : ''}" onclick="setLayoutAlign('${o.val}')">${o.label}</button>`).join('') +
    `</div>` +
    `<div class="flex-opt-group"><span class="flex-opt-label">JUSTIFY</span>` +
    justifyOpts.map(o => `<button class="flex-opt-btn${layoutJustifyContent === o.val ? ' active' : ''}" onclick="setLayoutJustify('${o.val}')">${o.label}</button>`).join('') +
    `</div>`;
}

/* ── custom layout application ───────────────────────── */

export function applyCustomLayout() {
  isRestoringLayout = true; // guard against ResizeObserver during DOM rebuild
  document.body.classList.remove('preset-list');
  document.body.classList.add('preset-custom');
  state.currentPreset = 'custom';

  // Lazy import to avoid circular dep with settings.js
  import('./settings.js').then(m => m.savePreset('custom'));

  document.querySelectorAll('.preset-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === 'custom');
  });

  const container = document.getElementById('customLayoutContainer');
  container.innerHTML = '';

  // Clear manual-width flags and flex overrides before rebuilding rows
  for (const id of layoutOrder) {
    const el = document.getElementById(id);
    if (el) { el.style.flex = ''; delete el.dataset.manualWidth; }
  }

  // Group sections into rows: consecutive items with inline=true are grouped together
  let i = 0;
  while (i < layoutOrder.length) {
    const id = layoutOrder[i];
    const el = document.getElementById(id);
    if (!el) { i++; continue; }

    if (layoutInline[id]) {
      // Collect all consecutive inline items + the next non-inline item
      const rowEls = [el];
      i++;
      while (i < layoutOrder.length) {
        const nextEl = document.getElementById(layoutOrder[i]);
        if (!nextEl) { i++; continue; }
        rowEls.push(nextEl);
        if (!layoutInline[layoutOrder[i]]) { i++; break; }
        i++;
      }
      const row = document.createElement('div');
      row.className = 'layout-row layout-align-' + layoutAlignItems + ' layout-justify-' + layoutJustifyContent;
      for (const re of rowEls) row.appendChild(re);
      container.appendChild(row);
    } else {
      const row = document.createElement('div');
      row.className = 'layout-row layout-align-' + layoutAlignItems + ' layout-justify-' + layoutJustifyContent;
      row.appendChild(el);
      container.appendChild(row);
      i++;
    }
  }

  // Re-apply saved sizes after DOM rebuild so heights/widths persist
  restoreSizes();

  document.getElementById('settingsDropdown').classList.remove('open');
  setTimeout(() => {
    resizeBubbleCanvas();
    for (const c of allCharts()) {
      c.resize();
      if (c === state.radarChart) c.update('none');
    }
    isRestoringLayout = false; // release guard after layout is stable
  }, 50);
}

export function restoreDefaultDOM() {
  const app = document.querySelector('.app');
  const customContainer = document.getElementById('customLayoutContainer');
  const chartsTop = document.querySelector('.charts-top');

  // Collect all card elements by ID (safe references survive DOM moves)
  const allCardIds = ['pieCard', 'radarCard', 'bubbleCard', 'approvalCard', 'approvalTimelineCard', 'throughputTimelineCard', 'timelineLinearCard', 'timelineLogCard', 'feedCard', 'filteredFeedCard', 'outlierCard', 'chatInputCard'];
  const cards = {};
  for (const id of allCardIds) {
    const el = document.getElementById(id);
    if (el) {
      // Detach from current parent (custom layout row or wherever it is)
      if (el.parentNode) el.parentNode.removeChild(el);
      cards[id] = el;
    }
  }

  // Clear custom layout wrapper rows (now empty of cards)
  customContainer.innerHTML = '';

  // Ensure we have exactly 3 section dividers in the app
  const dividers = Array.from(app.querySelectorAll('.section-divider'));
  while (dividers.length < 3) {
    const d = document.createElement('div');
    d.className = 'section-divider';
    app.insertBefore(d, customContainer);
    dividers.push(d);
  }

  // Restore pie + radar into charts-top grid
  if (chartsTop) {
    while (chartsTop.firstChild) chartsTop.removeChild(chartsTop.firstChild);
    if (cards.pieCard) chartsTop.appendChild(cards.pieCard);
    if (cards.radarCard) chartsTop.appendChild(cards.radarCard);
  }

  // Insert remaining cards in default order before customLayoutContainer
  const insertionRef = customContainer;
  const defaultOrderEls = [
    dividers[0],
    cards.bubbleCard,
    dividers[1],
    cards.approvalCard,
    cards.approvalTimelineCard,
    cards.throughputTimelineCard,
    dividers[2],
    cards.timelineLinearCard,
    cards.timelineLogCard,
    cards.feedCard,
    cards.filteredFeedCard,
    cards.outlierCard,
    cards.chatInputCard,
  ].filter(Boolean);

  for (const el of defaultOrderEls) {
    if (el.parentNode) el.parentNode.removeChild(el);
    app.insertBefore(el, insertionRef);
  }
}

/* ── layout inline/align/justify controls ────────────── */

export function toggleLayoutInline(id, btn) {
  layoutInline[id] = !layoutInline[id];
  btn.classList.toggle('active', layoutInline[id]);
  btn.textContent = layoutInline[id] ? '\u2B0C SIDE' : '\u2B0D STACK';
  btn.title = layoutInline[id]
    ? 'Currently side-by-side with next section. Click to stack vertically instead.'
    : 'Currently stacked vertically. Click to place side-by-side with next section.';
  saveLayout();
}

export function setLayoutAlign(val) {
  layoutAlignItems = val;
  saveLayout();
  renderFlexOptions();
}

export function setLayoutJustify(val) {
  layoutJustifyContent = val;
  saveLayout();
  renderFlexOptions();
}

/* ── half-life, label scale, bubble scale controls ───── */

export function updateHalfLife(v) {
  state.HALF_LIFE_MS = parseInt(v) * 1000;
  document.getElementById('hlVal').textContent = v + 's';
  try { localStorage.setItem(HALFLIFE_KEY, v); } catch { }
}

export function updateLabelScale(v) {
  state.labelScale = Math.min(2.5, Math.max(0.4, parseFloat(v)));
  document.getElementById('labelScaleVal').textContent = state.labelScale.toFixed(1) + 'x';
  try { localStorage.setItem(LABEL_SCALE_KEY, state.labelScale); } catch { }
  // Pie redraws on next update cycle; bubble redraws on next animation frame
  if (state.pieChart) state.pieChart.update('none');
}

export function updateBubbleScale(v) {
  state.bubbleScale = Math.min(1.5, Math.max(0.3, parseFloat(v)));
  document.getElementById('bubbleScaleVal').textContent = state.bubbleScale.toFixed(2) + 'x';
  try { localStorage.setItem(BUBBLE_SCALE_KEY, state.bubbleScale); } catch { }
}
