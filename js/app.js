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
import { initCharts, updateTimelinePoints, updateTimelineInterval, renderMoodLegend } from './ui/charts.js';
import {
  updateFeedFontSize, applyFeedFontSize,
  updateOutlierFontSize, applyOutlierFontSize,
  updateFilteredFeedFontSize, applyFilteredFeedFontSize,
  updateFilteredFeedRegex, updateFilteredFeedUserQuery,
  openFilterModal, closeFilterModal, onFilterModalInput,
  applyFilterModal, clearFilterModal, setFilterTab,
  selectFilterHistoryItem, deleteFilterHistoryItem,
  updateFilterTriggerButton, refreshUserDatalist
} from './ui/feeds.js';
import {
  loadOptions, saveOptions, toggleOptionsDrawer, applyAllOptions, resetAllOptions, refreshStorageUsage,
  loadRumbleProxyUrl, saveRumbleProxyUrl,
  loadYouTubeApiKey, saveYouTubeApiKey, setYouTubeDailyBudget, setYoutubeMinPollMs,
  resetYoutubeQuotaCounter, refreshYoutubeQuotaDisplay,
} from './ui/options.js';
import { savePreset, toggleSettings, applyPreset } from './ui/settings.js';
import { restoreSizes, notifyChartResize, setupResizeObserver, loadLayout, renderLayoutManager, applyCustomLayout, restoreDefaultDOM, toggleLayoutInline, setLayoutAlign, setLayoutJustify, updateHalfLife, updateLabelScale, updateBubbleScale } from './ui/layout.js';
import { showHelp, closeHelp, initHelpKeys } from './ui/help.js';
import { openStopwordsModal, loadStopwordOverrides } from './ui/stopwordsModal.js';
import { requestWakeLock } from './ui/wake-lock.js';
import { sanitize, esc } from './utils/dom.js';
import { initHistoryDb, clearAll as clearAllHistory, setHistoryEnabled, isHistoryEnabled, setRetentionDays, getRetentionDays, setMaxRows, getMaxRows } from './history/historyDb.js';
import { initUserHistoryModal, openUserHistory, closeUserHistory, clearCurrentUserHistory } from './ui/userHistoryModal.js';
import { initEmoteModal } from './ui/emoteModal.js';
import { initLinkModal } from './ui/linkModal.js';

// --- Import all setOpt* functions from options ---
import {
  setOptDensity, setOptGap, setOptCardPad, setOptFontScale, setOptCrt, setOptGridBg,
  setOptShowSubtitle, setOptShowLegend, setOptShowDividers, setOptCompactStats,
  setOptRenderTextEmoji,
  setOptBubbleCount, setOptBubbleSpeed, setOptBubbleOpacity, setOptBubbleHeight,
  setOptPieLabels, setOptPieAnimation,
  setOptTimelineHeight, setOptTlGrid, setOptTlSmooth,
  setOptApprovalMini, setOptApprovalVerdict, setOptCardVisibility,
  setOptWakeLock
} from './ui/options.js';

// =============================================================
//  Connection Manager — multi-feed slot system
// =============================================================
const connMgr = new ConnectionManager();

// Expose ConnectionManager for the user-history modal to read live channel/platform.
window.__connMgr = connMgr;

// Wire incoming messages to the processing pipeline
connMgr.onMessage(({ user, msg, ts, platform, channel, badges }) => {
  enqueue(user, msg, ts, platform, channel, badges);
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
window.disconnectAll = () => connMgr.disconnectAll();
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
window.setOptRenderTextEmoji = setOptRenderTextEmoji;
window.setOptBubbleCount = setOptBubbleCount;
window.setOptBubbleSpeed = setOptBubbleSpeed;
window.setOptBubbleOpacity = setOptBubbleOpacity;
window.setOptBubbleHeight = setOptBubbleHeight;
window.setOptPieLabels = setOptPieLabels;
window.setOptPieAnimation = setOptPieAnimation;
window.setOptTimelineHeight = setOptTimelineHeight;
window.setOptTlGrid = setOptTlGrid;
window.setOptTlSmooth = setOptTlSmooth;
window.setOptApprovalMini = setOptApprovalMini;
window.setOptApprovalVerdict = setOptApprovalVerdict;
window.setOptCardVisibility = setOptCardVisibility;
window.setOptWakeLock = setOptWakeLock;
window.resetAllOptions = resetAllOptions;
window.saveRumbleProxyUrl = saveRumbleProxyUrl;
window.saveYouTubeApiKey = saveYouTubeApiKey;
window.setYouTubeDailyBudget = setYouTubeDailyBudget;
window.setYoutubeMinPollMs = setYoutubeMinPollMs;
window.resetYoutubeQuotaCounter = resetYoutubeQuotaCounter;

// Help
window.showHelp = showHelp;
window.closeHelp = closeHelp;

// User history modal
window.openUserHistory = openUserHistory;
window.closeUserHistory = closeUserHistory;
window.clearCurrentUserHistory = clearCurrentUserHistory;
window.clearAllUserHistory = async () => {
  if (!window.confirm('Delete ALL logged user-history messages across every channel?\n\nThis cannot be undone.')) return;
  await clearAllHistory();
  // If the modal is open, refresh it.
  const ov = document.getElementById('userHistoryOverlay');
  if (ov && ov.classList.contains('open')) closeUserHistory();
};
window.setHistoryEnabled = (v) => {
  setHistoryEnabled(v);
  const cb = document.getElementById('optHistoryEnabled');
  if (cb) cb.checked = isHistoryEnabled();
};
window.setHistoryRetentionDays = (v) => {
  const n = setRetentionDays(v);
  const valEl = document.getElementById('optHistoryDaysVal');
  if (valEl) valEl.textContent = n + 'd';
};
window.setHistoryMaxRows = (v) => {
  const n = setMaxRows(v);
  const valEl = document.getElementById('optHistoryRowsVal');
  if (valEl) valEl.textContent = n.toLocaleString();
};

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
  const currentMps = parseFloat((state.tsThroughput.countWhere(t => t >= cut3) / 3).toFixed(1));
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
window.updateFilteredFeedUserQuery = updateFilteredFeedUserQuery;
window.openFilterModal = openFilterModal;
window.closeFilterModal = closeFilterModal;
window.onFilterModalInput = onFilterModalInput;
window.applyFilterModal = applyFilterModal;
window.clearFilterModal = clearFilterModal;
window.setFilterTab = setFilterTab;
window.selectFilterHistoryItem = selectFilterHistoryItem;
window.deleteFilterHistoryItem = deleteFilterHistoryItem;

// Platform adapter methods exposed to window — delegate to first Twitch adapter
window.setOAuthToken = () => connMgr.getFirstAdapter()?.setOAuthToken?.();
window.sendChatMessage = () => connMgr.getFirstAdapter()?.sendMessage?.();
window.toggleEmotePicker = () => connMgr.getFirstAdapter()?.toggleEmotePicker?.();
window.switchEmoteTab = (s) => connMgr.getFirstAdapter()?.switchEmoteTab?.(s);
window.filterEmotePicker = (q) => connMgr.getFirstAdapter()?.filterEmotePicker?.(q);
window.insertEmote = (c) => connMgr.getFirstAdapter()?.insertEmote?.(c);
window.copyAuthError = () => connMgr.getFirstAdapter()?.copyAuthError?.();

// Bot filter toggle (used by inline checkbox in index.html)
Object.defineProperty(window, 'botFilterEnabled', {
  get() { return state.botFilterEnabled; },
  set(v) { state.botFilterEnabled = v; },
});

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

  // Init filtered-feed filter from storage (regex + username substring)
  const savedRegex = localStorage.getItem(config.REGEX_STORAGE_KEY) ?? config.REGEX_DEFAULT;
  if (savedRegex) updateFilteredFeedRegex(savedRegex);
  const savedUserQuery = localStorage.getItem(config.USER_FILTER_STORAGE_KEY) || '';
  if (savedUserQuery) updateFilteredFeedUserQuery(savedUserQuery);
  refreshUserDatalist();
  updateFilterTriggerButton();

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

  // --- Tablet viewport defaults on first visit ---
  // If no preset has been saved yet, this is a first visit. On tablet-sized
  // viewports, seed localStorage with a dense custom layout before loadLayout()
  // reads it. This gives tablet users a better default experience.
  const isFirstVisit = localStorage.getItem(config.PRESET_STORAGE_KEY) === null;
  const isTablet = window.innerWidth >= 600 && window.innerWidth <= 1366;
  if (isFirstVisit && isTablet) {
    // Compact parameters for tablet
    state.labelScale = 0.6;
    state.bubbleScale = 0.4;
    state.TIMELINE_POINTS = 100;
    state.TIMELINE_INTERVAL = 500;
    state.currentPreset = 'custom';
    state.drawerOptions.density = 'dense';
    state.drawerOptions.timelineHeight = 220;

    // Update sliders to reflect new values
    const lsSlider = document.getElementById('labelScaleSlider');
    if (lsSlider) lsSlider.value = state.labelScale;
    document.getElementById('labelScaleVal').textContent = state.labelScale.toFixed(1) + 'x';
    if (bsSlider) bsSlider.value = state.bubbleScale;
    document.getElementById('bubbleScaleVal').textContent = state.bubbleScale.toFixed(2) + 'x';
    if (tlPtsSlider) tlPtsSlider.value = state.TIMELINE_POINTS;
    document.getElementById('tlPointsVal').textContent = state.TIMELINE_POINTS;
    if (tlIntSlider) tlIntSlider.value = state.TIMELINE_INTERVAL;
    document.getElementById('tlIntervalVal').textContent = state.TIMELINE_INTERVAL + 'ms';

    // Seed localStorage so loadLayout() and restoreSizes() pick up the defaults
    const tabletLayout = {
      order: config.LAYOUT_SECTIONS.map(s => s.id),
      inline: {
        pieCard: true, topWordsCard: true, bubbleCard: true,
        approvalTimelineCard: true, throughputTimelineCard: true, timelineLinearCard: true,
      },
      alignItems: 'start',
      justifyContent: 'start',
    };
    try {
      localStorage.setItem(config.LAYOUT_STORAGE_KEY, JSON.stringify(tabletLayout));
      localStorage.setItem(config.RESIZE_STORAGE_KEY, JSON.stringify({
        pieCard: { h: 200 }, topWordsCard: { h: 200 },
        bubbleCard: { h: 200 }, approvalCard: { h: 200 },
        approvalTimelineCard: { h: 220 }, throughputTimelineCard: { h: 220 },
        timelineLinearCard: { h: 220 }, timelineLogCard: { h: 220 },
      }));
      localStorage.setItem(config.LABEL_SCALE_KEY, String(state.labelScale));
      localStorage.setItem(config.BUBBLE_SCALE_KEY, String(state.bubbleScale));
      localStorage.setItem(config.TL_POINTS_KEY, String(state.TIMELINE_POINTS));
      localStorage.setItem(config.TL_INTERVAL_KEY, String(state.TIMELINE_INTERVAL));
    } catch { /* private browsing */ }

    savePreset('custom');
    saveOptions();
  }

  // Load layout config (reads from localStorage, including tablet defaults if seeded above)
  loadLayout();

  // Initialize charts and resize observer
  initCharts();
  setupResizeObserver();

  // Initialize help keyboard shortcuts
  initHelpKeys();

  // Load persisted stopword overrides and wire the settings-cog button.
  loadStopwordOverrides();
  const swBtn = document.getElementById('topWordsEditStopwords');
  if (swBtn) swBtn.addEventListener('click', openStopwordsModal);

  // Request persistent storage so the browser doesn't evict chat history
  // under disk pressure. On Chromium this also raises the per-origin quota
  // to ~60% of disk (typically multi-GB). Best-effort; silently falls back.
  if (navigator.storage && navigator.storage.persist) {
    navigator.storage.persist().then((granted) => {
      console.info('[MoodRadar] persistent storage:', granted ? 'granted' : 'best-effort');
    }).catch(() => {});
  }

  // Initialize per-user message history (IndexedDB) and modal click-to-open
  initHistoryDb();
  initUserHistoryModal();
  initEmoteModal();
  initLinkModal();
  refreshStorageUsage();

  // Sync history settings UI to stored values
  const histCb = document.getElementById('optHistoryEnabled');
  if (histCb) histCb.checked = isHistoryEnabled();
  const histDays = document.getElementById('optHistoryDays');
  const histDaysVal = document.getElementById('optHistoryDaysVal');
  if (histDays) histDays.value = getRetentionDays();
  if (histDaysVal) histDaysVal.textContent = getRetentionDays() + 'd';
  const histRows = document.getElementById('optHistoryRows');
  const histRowsVal = document.getElementById('optHistoryRowsVal');
  if (histRows) histRows.value = getMaxRows();
  if (histRowsVal) histRowsVal.textContent = getMaxRows().toLocaleString();

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
  loadRumbleProxyUrl();
  loadYouTubeApiKey();
  refreshYoutubeQuotaDisplay();

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
