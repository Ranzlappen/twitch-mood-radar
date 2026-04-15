// =============================================================
//  APP.JS — Main orchestrator (ES module entry point)
//  Uses ConnectionManager for multi-feed slot connections,
//  wires message pipeline to processing loop, and exposes
//  functions to window for inline HTML event handlers.
// =============================================================

import { state, initState } from './state.js';
import * as config from './config.js';
import { ConnectionManager } from './platform/ConnectionManager.js';
import { enqueue, processingLoop, flushChatterData } from './processing.js';
import { initCharts, pushTimelineSnapshot, pushApprovalTimelineSnapshot, pushThroughputTimelineSnapshot, updateTimelinePoints, updateTimelineInterval, renderMoodLegend } from './ui/charts.js';
import { resizeBubbleCanvas } from './ui/bubbles.js';
import { updateFeedFontSize, applyFeedFontSize, updateOutlierFontSize, applyOutlierFontSize, updateFilteredFeedFontSize, applyFilteredFeedFontSize, updateFilteredFeedRegex, openRegexHistory, closeRegexHistory, selectRegexHistory, deleteRegexFromHistory } from './ui/feeds.js';
import { loadOptions, saveOptions, toggleOptionsDrawer, applyAllOptions, resetAllOptions } from './ui/options.js';
import { savePreset, toggleSettings, applyPreset } from './ui/settings.js';
import { saveSizes, restoreSizes, notifyChartResize, setupResizeObserver, loadLayout, renderLayoutManager, applyCustomLayout, restoreDefaultDOM, toggleLayoutInline, setLayoutAlign, setLayoutJustify, updateHalfLife, updateLabelScale, updateBubbleScale } from './ui/layout.js';
import { showHelp, closeHelp, initHelpKeys } from './ui/help.js';
import { requestWakeLock } from './ui/wake-lock.js';
import { sanitize, esc } from './utils/dom.js';

// --- Import all setOpt* functions from options ---
import {
  setOptDensity, setOptGap, setOptCardPad, setOptFontScale, setOptCrt, setOptGridBg,
  setOptShowSubtitle, setOptShowLegend, setOptShowDividers, setOptCompactStats,
  setOptBubbleCount, setOptBubbleSpeed, setOptBubbleOpacity, setOptBubbleHeight,
  setOptPieLabels, setOptPieAnimation, setOptRadarAnimation, setOptRadarGrid,
  setOptTimelineHeight, setOptTlGrid, setOptTlSmooth,
  setOptApprovalMini, setOptApprovalVerdict, setOptCardVisibility,
  setOptWakeLock
} from './ui/options.js';

// =============================================================
//  Connection Manager — multi-feed slot system
// =============================================================
const connMgr = new ConnectionManager();

// Wire incoming messages to the processing pipeline
connMgr.onMessage(({ user, msg, ts, platform }) => {
  enqueue(user, msg, ts, platform);
});

// Start the processing loop when first slot connects
connMgr.onFirstConnect(() => {
  initCharts();
  if (!state.rafHandle) {
    state.lastTimelineTs = Date.now();
    state.rafHandle = requestAnimationFrame(processingLoop);
  }
});

// Stop the processing loop when all slots disconnect
connMgr.onAllDisconnected(() => {
  if (state.rafHandle) {
    cancelAnimationFrame(state.rafHandle);
    state.rafHandle = null;
  }
  state.msgQueue.length = 0;
});

// =============================================================
//  Window assignments — expose functions for inline HTML handlers
// =============================================================

// Multi-feed connection management
window.connectSlot = (slotId, isReconnect) => connMgr.connectSlot(slotId, isReconnect);
window.disconnectSlot = (slotId) => connMgr.disconnectSlot(slotId);
window.addSlot = () => connMgr.addSlot();
window.removeSlot = (slotId) => connMgr.removeSlot(slotId);
window.switchSlotPlatform = (slotId, platform) => connMgr.switchSlotPlatform(slotId, platform);

// Backward-compat wrappers
window.connectChat = (isReconnect) => {
  const slots = connMgr.slots;
  if (slots.length > 0) connMgr.connectSlot(slots[0].id, isReconnect);
};
window.disconnectChat = () => connMgr.disconnectAll();
window.flushChatterData = flushChatterData;

// Channel history (slot-scoped)
window.openChannelHistory = (slotId) => connMgr.openChannelHistory(slotId);
window.closeChannelHistory = (slotId) => connMgr.closeChannelHistory(slotId);
window.selectChannel = (slotId, name) => connMgr.selectChannel(slotId, name);
window.deleteChannelFromHistory = (name, slotId) => connMgr.deleteChannelFromHistory(name, slotId);
window.handleChannelKey = (slotId, e) => connMgr.handleChannelKey(slotId, e);

// Settings & Presets
window.toggleSettings = toggleSettings;
window.applyPreset = (preset) => {
  if (preset === 'custom') {
    document.getElementById('layoutManagerSection').style.display = 'block';
    renderLayoutManager();
    applyCustomLayout();
    savePreset('custom');
    return;
  }
  state.isRestoringLayout = true;
  document.getElementById('layoutManagerSection').style.display = 'none';
  document.body.classList.remove('preset-custom');
  restoreDefaultDOM();
  applyPreset(preset);
  restoreSizes();
  if (preset === 'dense') {
    state.drawerOptions.density = 'dense';
  } else if (preset === 'dashboard' || preset === 'list') {
    state.drawerOptions.density = 'normal';
    document.body.classList.remove('preset-dense', 'preset-loose');
  }
  const dEl = document.getElementById('optDensity');
  if (dEl) dEl.value = state.drawerOptions.density;
  saveOptions();
  setTimeout(() => { state.isRestoringLayout = false; }, 200);
};

// Options drawer
window.toggleOptionsDrawer = toggleOptionsDrawer;
window.setOptDensity = setOptDensity;
window.setOptGap = setOptGap;
window.setOptCardPad = setOptCardPad;
window.setOptFontScale = setOptFontScale;
window.setOptCrt = setOptCrt;
window.setOptGridBg = setOptGridBg;
window.setOptShowSubtitle = setOptShowSubtitle;
window.setOptShowLegend = setOptShowLegend;
window.setOptShowDividers = setOptShowDividers;
window.setOptCompactStats = setOptCompactStats;
window.setOptBubbleCount = setOptBubbleCount;
window.setOptBubbleSpeed = setOptBubbleSpeed;
window.setOptBubbleOpacity = setOptBubbleOpacity;
window.setOptBubbleHeight = setOptBubbleHeight;
window.setOptPieLabels = setOptPieLabels;
window.setOptPieAnimation = setOptPieAnimation;
window.setOptRadarAnimation = setOptRadarAnimation;
window.setOptRadarGrid = setOptRadarGrid;
window.setOptTimelineHeight = setOptTimelineHeight;
window.setOptTlGrid = setOptTlGrid;
window.setOptTlSmooth = setOptTlSmooth;
window.setOptApprovalMini = setOptApprovalMini;
window.setOptApprovalVerdict = setOptApprovalVerdict;
window.setOptCardVisibility = setOptCardVisibility;
window.setOptWakeLock = setOptWakeLock;
window.resetAllOptions = resetAllOptions;

// Help
window.showHelp = showHelp;
window.closeHelp = closeHelp;

// Layout
window.toggleLayoutInline = toggleLayoutInline;
window.setLayoutAlign = setLayoutAlign;
window.setLayoutJustify = setLayoutJustify;

// Sliders
window.updateHalfLife = updateHalfLife;
window.updateLabelScale = updateLabelScale;
window.updateBubbleScale = updateBubbleScale;
window.updateTimelinePoints = updateTimelinePoints;
window.updateTimelineInterval = updateTimelineInterval;
window.showDecayRecommendation = () => {
  const now = Date.now();
  const cut3 = now - 3000;
  const currentMps = parseFloat((state.tsThroughput.filter(t => t >= cut3).length / 3).toFixed(1));
  let rec, details;
  if (currentMps < 2) { rec = '20-40s'; details = 'Low throughput (' + currentMps.toFixed(1) + ' msg/s). Use a higher decay so sparse messages linger long enough.'; }
  else if (currentMps < 10) { rec = '10-20s'; details = 'Moderate throughput (' + currentMps.toFixed(1) + ' msg/s). Balanced decay for responsive charts.'; }
  else if (currentMps < 30) { rec = '5-10s'; details = 'High throughput (' + currentMps.toFixed(1) + ' msg/s). Lower decay keeps charts snappy.'; }
  else { rec = '2-5s'; details = 'Very high throughput (' + currentMps.toFixed(1) + ' msg/s). Short decay to track rapid swings.'; }
  showHelp('_decayRec');
  document.getElementById('helpTitle').textContent = 'DECAY RECOMMENDATION';
  document.getElementById('helpBody').innerHTML =
    '<p><strong>Current throughput:</strong> ' + currentMps.toFixed(1) + ' msg/s</p>' +
    '<p><strong>Recommended decay:</strong> ' + rec + '</p><p>' + details + '</p>';
};

// Feeds
window.updateFeedFontSize = updateFeedFontSize;
window.updateOutlierFontSize = updateOutlierFontSize;
window.updateFilteredFeedFontSize = updateFilteredFeedFontSize;
window.updateFilteredFeedRegex = updateFilteredFeedRegex;
window.openRegexHistory = openRegexHistory;
window.closeRegexHistory = closeRegexHistory;
window.selectRegexHistory = selectRegexHistory;
window.deleteRegexFromHistory = deleteRegexFromHistory;

// Platform adapter methods exposed to window — delegate to first Twitch adapter
window.setOAuthToken = () => connMgr.getFirstAdapter()?.setOAuthToken?.();
window.sendChatMessage = () => connMgr.getFirstAdapter()?.sendMessage?.();
window.toggleEmotePicker = () => connMgr.getFirstAdapter()?.toggleEmotePicker?.();
window.switchEmoteTab = (s) => connMgr.getFirstAdapter()?.switchEmoteTab?.(s);
window.filterEmotePicker = (q) => connMgr.getFirstAdapter()?.filterEmotePicker?.(q);
window.insertEmote = (c) => connMgr.getFirstAdapter()?.insertEmote?.(c);
window.copyAuthError = () => connMgr.getFirstAdapter()?.copyAuthError?.();

// Utility exposed for inline handlers
window.sanitize = sanitize;
window.esc = esc;

// =============================================================
//  Initialization
// =============================================================
window.onload = function () {
  // Initialize state from localStorage
  initState();

  // Render initial slot UI
  connMgr.renderAllSlots();

  // Init label scale slider
  const slider = document.getElementById('labelScaleSlider');
  if (slider) slider.value = state.labelScale;
  document.getElementById('labelScaleVal').textContent = state.labelScale.toFixed(1) + 'x';

  // Init bubble scale slider
  const bsSlider = document.getElementById('bubbleScaleSlider');
  if (bsSlider) bsSlider.value = state.bubbleScale;
  document.getElementById('bubbleScaleVal').textContent = state.bubbleScale.toFixed(2) + 'x';

  // Init feed font size slider
  const feedSlider = document.getElementById('feedFontSlider');
  if (feedSlider) feedSlider.value = state.feedFontSize;
  document.getElementById('feedFontVal').textContent = state.feedFontSize.toFixed(2);
  applyFeedFontSize();

  // Init filtered feed font size slider
  const filteredFeedSlider = document.getElementById('filteredFeedFontSlider');
  if (filteredFeedSlider) filteredFeedSlider.value = state.filteredFeedFontSize;
  document.getElementById('filteredFeedFontVal').textContent = state.filteredFeedFontSize.toFixed(2);
  applyFilteredFeedFontSize();

  // Init regex filter from storage
  const savedRegex = localStorage.getItem(config.REGEX_STORAGE_KEY) ?? config.REGEX_DEFAULT;
  if (savedRegex) {
    const regexInput = document.getElementById('filteredFeedRegex');
    if (regexInput) {
      regexInput.value = savedRegex;
      updateFilteredFeedRegex(savedRegex);
    }
  }

  // Wire regex history dropdown
  {
    const regexInput = document.getElementById('filteredFeedRegex');
    if (regexInput) {
      regexInput.addEventListener('focus', openRegexHistory);
      regexInput.addEventListener('blur', () => setTimeout(closeRegexHistory, 150));
    }
  }

  // Init outlier font size slider
  const outlierSlider = document.getElementById('outlierFontSlider');
  if (outlierSlider) outlierSlider.value = state.outlierFontSize;
  document.getElementById('outlierFontVal').textContent = state.outlierFontSize.toFixed(2);
  applyOutlierFontSize();

  // Init timeline settings sliders
  const tlPtsSlider = document.getElementById('tlPointsSlider');
  if (tlPtsSlider) tlPtsSlider.value = state.TIMELINE_POINTS;
  document.getElementById('tlPointsVal').textContent = state.TIMELINE_POINTS;
  const tlIntSlider = document.getElementById('tlIntervalSlider');
  if (tlIntSlider) tlIntSlider.value = state.TIMELINE_INTERVAL;
  document.getElementById('tlIntervalVal').textContent = state.TIMELINE_INTERVAL + 'ms';

  // Init half-life slider
  const savedHL = state.HALF_LIFE_MS / 1000;
  const hlSlider = document.getElementById('hlSlider');
  if (hlSlider) hlSlider.value = savedHL;
  document.getElementById('hlVal').textContent = savedHL + 's';

  // Render mood legend
  renderMoodLegend();

  // Load layout config
  loadLayout();

  // Initialize charts and resize observer
  initCharts();
  setupResizeObserver();

  // Initialize help keyboard shortcuts
  initHelpKeys();

  // Guard against ResizeObserver overwriting saved sizes during init
  state.isRestoringLayout = true;

  // Restore saved preset
  if (state.currentPreset && state.currentPreset !== 'dashboard') {
    window.applyPreset(state.currentPreset);
  } else {
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.preset === 'dashboard');
    });
  }

  // Restore sizes after preset
  restoreSizes();

  // Load and apply Options Drawer settings
  loadOptions();
  applyAllOptions();

  // Re-acquire wake lock when tab becomes visible again
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.drawerOptions.wakeLockEnabled) {
      requestWakeLock();
    }
  });

  // Close channel history dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.input-wrap')) {
      for (const slot of connMgr.slots) connMgr.closeChannelHistory(slot.id);
    }
  });

  // Re-trigger chart resize, then release guard
  setTimeout(() => {
    for (const id of config.RESIZABLE_IDS) notifyChartResize(id);
    setTimeout(() => { state.isRestoringLayout = false; }, 300);
  }, 100);
};
