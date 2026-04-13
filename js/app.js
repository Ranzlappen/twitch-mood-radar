// =============================================================
//  APP.JS — Main orchestrator (ES module entry point)
//  Imports all modules, wires platform adapter to processing
//  pipeline, assigns handlers to window for inline HTML events.
// =============================================================

import { state, initState } from './state.js';
import * as config from './config.js';
import { createTwitchAdapter } from './platform/TwitchAdapter.js';
import { createKickAdapter } from './platform/KickAdapter.js';
import { createYouTubeAdapter } from './platform/YouTubeAdapter.js';
import { createRumbleAdapter } from './platform/RumbleAdapter.js';
import { renderEmotes } from './platform/emotes.js';
import { classifyMessage } from './analysis/sentiment.js';
import { detectBot } from './analysis/botDetector.js';
import { computeApproval, approvalVerdict } from './analysis/approval.js';
import { expWeight, computeWeightedMoods, computeKeywordWeights, getDominant } from './analysis/ewma.js';
import { initCharts, pushTimelineSnapshot, pushApprovalTimelineSnapshot, pushThroughputTimelineSnapshot, updateTimelinePoints, updateTimelineInterval, renderMoodLegend } from './ui/charts.js';
import { resizeBubbleCanvas, initBubbles, updateBubbles } from './ui/bubbles.js';
import { mainFeed, outlierFeed, filteredFeed, updateFeedFontSize, applyFeedFontSize, updateOutlierFontSize, applyOutlierFontSize, updateFilteredFeedFontSize, applyFilteredFeedFontSize, updateFilteredFeedRegex, openRegexHistory, closeRegexHistory, selectRegexHistory, deleteRegexFromHistory } from './ui/feeds.js';
import { updateApprovalMeter } from './ui/approval-meter.js';
import { loadOptions, saveOptions, toggleOptionsDrawer, applyAllOptions, resetAllOptions } from './ui/options.js';
import { savePreset, toggleSettings, applyPreset } from './ui/settings.js';
import { saveSizes, restoreSizes, notifyChartResize, setupResizeObserver, loadLayout, saveLayout, renderLayoutManager, applyCustomLayout, restoreDefaultDOM, toggleLayoutInline, setLayoutAlign, setLayoutJustify, updateHalfLife, updateLabelScale, updateBubbleScale } from './ui/layout.js';
import { showHelp, closeHelp, initHelpKeys } from './ui/help.js';
import { sanitize, esc, setStatus, fmtNum } from './utils/dom.js';
import { hexAlpha, lerpColor } from './utils/color.js';
import { startProcessingLoop, flushChatterData } from './processing.js';

// --- Import all setOpt* functions from options ---
import {
  setOptDensity, setOptGap, setOptCardPad, setOptFontScale, setOptCrt, setOptGridBg,
  setOptShowSubtitle, setOptShowLegend, setOptShowDividers, setOptCompactStats,
  setOptBubbleCount, setOptBubbleSpeed, setOptBubbleOpacity, setOptBubbleHeight,
  setOptPieLabels, setOptPieAnimation, setOptRadarAnimation, setOptRadarGrid,
  setOptTimelineHeight, setOptTlGrid, setOptTlSmooth,
  setOptApprovalMini, setOptApprovalVerdict, setOptCardVisibility
} from './ui/options.js';

// =============================================================
//  Platform Adapter Setup — supports runtime switching
// =============================================================
const adapters = {
  twitch: createTwitchAdapter,
  kick: createKickAdapter,
  youtube: createYouTubeAdapter,
  rumble: createRumbleAdapter,
};

let currentPlatform = 'twitch';
let adapter = adapters.twitch();

const platformPlaceholders = {
  twitch: 'channel name',
  kick: 'channel name',
  youtube: 'video ID or URL',
  rumble: 'stream ID or channel',
};
const platformPrefixes = {
  twitch: '#',
  kick: '#',
  youtube: '▶',
  rumble: '▶',
};

function switchPlatform(platform) {
  if (adapter && adapter.isConnected) adapter.disconnect();
  currentPlatform = platform;
  adapter = adapters[platform]();
  // Update input placeholder and prefix
  const input = document.getElementById('channelInput');
  const prefix = document.getElementById('inputPrefix');
  if (input) input.placeholder = platformPlaceholders[platform] || 'channel name';
  if (prefix) prefix.textContent = platformPrefixes[platform] || '#';
}

// =============================================================
//  Window assignments — expose functions for inline HTML handlers
// =============================================================

// Platform switching
window.switchPlatform = switchPlatform;

// Connection
window.connectChat = (isReconnect) => adapter.connect(isReconnect);
window.disconnectChat = () => adapter.disconnect();
window.flushChatterData = flushChatterData;

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
    document.body.classList.remove('preset-dense','preset-loose');
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

// Platform adapter methods exposed to window (safe: checks if method exists)
window.setOAuthToken = () => adapter.setOAuthToken?.();
window.sendChatMessage = () => adapter.sendMessage?.();
window.toggleEmotePicker = () => adapter.toggleEmotePicker?.();
window.switchEmoteTab = (s) => adapter.switchEmoteTab?.(s);
window.filterEmotePicker = (q) => adapter.filterEmotePicker?.(q);
window.insertEmote = (c) => adapter.insertEmote?.(c);
window.selectChannel = (n) => adapter.selectChannel?.(n);
window.deleteChannelFromHistory = (n) => adapter.deleteChannelFromHistory?.(n);
window.handleChannelKey = (e) => adapter.handleChannelKey?.(e);
window.openChannelHistory = () => adapter.openChannelHistory?.();
window.closeChannelHistory = () => adapter.closeChannelHistory?.();
window.copyAuthError = () => adapter.copyAuthError?.();

// Utility exposed for inline handlers
window.sanitize = sanitize;
window.esc = esc;

// =============================================================
//  Initialization
// =============================================================
window.onload = function() {
  // Initialize state from localStorage
  initState();

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

  // Re-trigger chart resize, then release guard
  setTimeout(() => {
    for (const id of config.RESIZABLE_IDS) notifyChartResize(id);
    setTimeout(() => { state.isRestoringLayout = false; }, 300);
  }, 100);
};
