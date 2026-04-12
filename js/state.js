// Centralized mutable application state
// All modules import this and read/write properties directly

export const state = {
  // Connection
  ws: null,
  loggingActive: false,
  reconnectAttempt: 0,
  reconnectTimer: null,
  currentRoomId: null,
  currentChannelName: '',

  // Message processing
  msgQueue: [],
  scoredMessages: [],
  keywordStore: new Map(),
  approvalStore: [],
  msgTimestamps: [],
  tsThroughput: [],
  droppedMessages: 0,
  totalMessages: 0,
  uniqueUsers: new Set(),

  // Bot detection
  userProfiles: new Map(),
  botMessagesFiltered: 0,
  botUsersDetected: new Set(),
  botFilterEnabled: true,

  // UI state
  drawerOptions: {},
  currentPreset: 'dashboard',
  chartsReady: false,
  rafHandle: null,
  frameIdx: 0,
  prevDominant: null,
  lastTimelineTs: 0,
  isRestoringLayout: false,

  // Configurable values (loaded from localStorage)
  HALF_LIFE_MS: 10_000,
  TIMELINE_POINTS: 200,
  TIMELINE_INTERVAL: 1000,
  labelScale: 1.4,
  bubbleScale: 1.0,

  // Approval display
  approvalDisplayVal: 50,
  approvalHistory: Array(40).fill(50),

  // Feed state
  feedFontSize: 2,
  outlierFontSize: 2,
  filteredFeedFontSize: 2,
  filteredFeedRegex: null,

  // Emote state
  bttvEmotes: new Map(),
  seventvEmotes: new Map(),
  ffzEmotes: new Map(),
  thirdPartyEmotes: new Map(),

  // Auth
  twitchOAuthToken: '',
  twitchClientId: '',
  twitchUserId: '',
  twitchUserLogin: '',
  emotePickerOpen: false,
  emotePickerTab: 'bttv',

  // Charts (references)
  pieChart: null,
  radarChart: null,
  timelineLinearChart: null,
  timelineLogChart: null,
  approvalTimelineChart: null,
  throughputTimelineChart: null,

  // Bubbles
  bubbles: [],
  hoveredBubble: null,

  // Layout
  layoutOrder: [],
  layoutInline: {},
  layoutAlignItems: 'start',
  layoutJustifyContent: 'start',
};

// Initialize state from localStorage persisted values
export function initState() {
  // Import lazily to avoid circular dependency with config.js at module load time
  // (config.js has no imports so this is safe)

  try {
    const v = parseInt(localStorage.getItem('moodradar_halflife_v1'));
    state.HALF_LIFE_MS = isNaN(v) ? 10_000 : Math.min(60_000, Math.max(1_000, v * 1000));
  } catch { state.HALF_LIFE_MS = 10_000; }

  try {
    const v = parseInt(localStorage.getItem('moodradar_tlpoints_v1'));
    state.TIMELINE_POINTS = isNaN(v) ? 200 : Math.min(1000, Math.max(50, v));
  } catch { state.TIMELINE_POINTS = 200; }

  try {
    const v = parseInt(localStorage.getItem('moodradar_tlinterval_v1'));
    state.TIMELINE_INTERVAL = isNaN(v) ? 1000 : Math.min(5000, Math.max(200, v));
  } catch { state.TIMELINE_INTERVAL = 1000; }

  try {
    const v = parseFloat(localStorage.getItem('moodradar_labelscale_v1'));
    state.labelScale = isNaN(v) ? 1.4 : Math.min(2.5, Math.max(0.4, v));
  } catch { state.labelScale = 1.4; }

  try {
    const v = parseFloat(localStorage.getItem('moodradar_bubblescale_v1'));
    state.bubbleScale = isNaN(v) ? 1.0 : Math.min(1.5, Math.max(0.3, v));
  } catch { state.bubbleScale = 1.0; }

  try {
    state.currentPreset = localStorage.getItem('moodradar_preset_v1') || 'dashboard';
  } catch { state.currentPreset = 'dashboard'; }

  try {
    const v = parseFloat(localStorage.getItem('moodradar_feedfont_v1'));
    state.feedFontSize = isNaN(v) ? 2 : Math.min(20, Math.max(0.1, v));
  } catch { state.feedFontSize = 2; }

  try {
    const v = parseFloat(localStorage.getItem('moodradar_outlierfont_v1'));
    state.outlierFontSize = isNaN(v) ? 2 : Math.min(20, Math.max(0.1, v));
  } catch { state.outlierFontSize = 2; }

  try {
    const v = parseFloat(localStorage.getItem('moodradar_filteredfeedfont_v1'));
    state.filteredFeedFontSize = isNaN(v) ? 2 : Math.min(20, Math.max(0.1, v));
  } catch { state.filteredFeedFontSize = 2; }

  // Default options will be applied when config.js DEFAULT_OPTIONS is available
  // via loadOptions() in the options module
}
