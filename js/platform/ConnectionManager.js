/**
 * ConnectionManager — multi-feed slot system.
 *
 * Manages up to MAX_FEEDS simultaneous platform connections. Each "slot"
 * wraps a platform adapter and tracks per-slot UI state (status dot, etc.).
 *
 * Message flow: adapter.onMessage → onMessageCallback → enqueue + tsThroughput
 */
import { state } from '../state.js';
import { sanitize, esc, setStatus } from '../utils/dom.js';
import { save, load } from '../utils/storage.js';
import { createTwitchAdapter } from './TwitchAdapter.js';
import { createKickAdapter } from './KickAdapter.js';
import { createYouTubeAdapter } from './YouTubeAdapter.js';
import { createRumbleAdapter } from './RumbleAdapter.js';
import { CHANNEL_HISTORY_KEY, CHANNEL_HISTORY_MAX, RECONNECT_DELAY_MS } from '../config.js';

const MAX_FEEDS = 10;

const PLATFORM_PLACEHOLDERS = {
  twitch: 'channel name',
  kick: 'channel name',
  youtube: 'channel name, @handle, or video URL',
  rumble: 'stream ID or channel',
};
const PLATFORM_PREFIXES = {
  twitch: '#', kick: '#', youtube: '\u25b6', rumble: '\u25b6',
};

const ADAPTER_FACTORIES = {
  twitch: createTwitchAdapter,
  kick: createKickAdapter,
  youtube: createYouTubeAdapter,
  rumble: createRumbleAdapter,
};

/**
 * @typedef {Object} Slot
 * @property {number} id
 * @property {string} platform
 * @property {string} channelName
 * @property {import('./PlatformAdapter.js').PlatformAdapter} adapter
 * @property {boolean} loggingActive
 * @property {number} reconnectAttempt
 * @property {number|null} reconnectTimer
 * @property {string} status — 'idle' | 'connecting' | 'live' | 'reconnecting' | 'error'
 */

export class ConnectionManager {
  constructor() {
    /** @type {Slot[]} */
    this._slots = [];
    this._slotIdCounter = 0;
    /** @type {((msg: {user:string, msg:string, ts:number, platform:string}) => void)|null} */
    this._onMessageCallback = null;
    /** @type {(() => void)|null} */
    this._onFirstConnect = null;
    /** @type {(() => void)|null} */
    this._onAllDisconnected = null;

    // Create first slot
    this._addSlotInternal();
  }

  // --- Public API ---

  /** Register callback for incoming messages from any slot */
  onMessage(cb) { this._onMessageCallback = cb; }

  /** Register callback for when first slot goes live (start processing loop) */
  onFirstConnect(cb) { this._onFirstConnect = cb; }

  /** Register callback for when all slots disconnect (stop processing loop) */
  onAllDisconnected(cb) { this._onAllDisconnected = cb; }

  /** Get all slots */
  get slots() { return this._slots; }

  /** Check if any slot is actively connected */
  anyActive() { return this._slots.some(s => s.loggingActive); }

  /** Get all live slots */
  getLiveSlots() { return this._slots.filter(s => s.status === 'live'); }

  /** Get the primary Twitch room ID (for emotes, OAuth chat) */
  getPrimaryRoomId() {
    const twitchSlot = this._slots.find(s => s.platform === 'twitch' && s.loggingActive && s.adapter._currentRoomId);
    return twitchSlot ? twitchSlot.adapter._currentRoomId : null;
  }

  getPrimaryChannelName() {
    const twitchSlot = this._slots.find(s => s.platform === 'twitch' && s.loggingActive && s.adapter._currentChannelName);
    return twitchSlot ? twitchSlot.adapter._currentChannelName : '';
  }

  // --- Slot lifecycle ---

  addSlot() {
    if (this._slots.length >= MAX_FEEDS) return;
    this._addSlotInternal();
    this.renderAllSlots();
  }

  removeSlot(slotId) {
    const idx = this._slots.findIndex(s => s.id === slotId);
    if (idx <= 0) return; // never remove the first slot
    this.disconnectSlot(slotId);
    this._slots.splice(idx, 1);
    this.renderAllSlots();
  }

  switchSlotPlatform(slotId, platform) {
    const slot = this._getSlot(slotId);
    if (!slot) return;
    if (slot.loggingActive) this.disconnectSlot(slotId);
    slot.platform = platform;
    slot.adapter = ADAPTER_FACTORIES[platform]();
    this._wireAdapter(slot);
    const input = document.getElementById('channelInput_' + slotId);
    const prefix = document.getElementById('inputPrefix_' + slotId);
    if (input) input.placeholder = PLATFORM_PLACEHOLDERS[platform] || 'channel name';
    if (prefix) prefix.textContent = PLATFORM_PREFIXES[platform] || '#';
  }

  // --- Connection ---

  connectSlot(slotId, isReconnect) {
    const slot = this._getSlot(slotId);
    if (!slot) return;
    const input = document.getElementById('channelInput_' + slotId);
    const raw = sanitize((input ? input.value : '').trim().toLowerCase());
    if (!raw) { this._setSlotStatus(slotId, 'Enter a name', 'error'); return; }

    // Block duplicate connections
    const dup = this._slots.find(s => s.id !== slotId && s.loggingActive && s.platform === slot.platform && s.channelName === raw);
    if (dup) { this._setSlotStatus(slotId, 'Already connected', 'error'); return; }

    if (!isReconnect) {
      slot.reconnectAttempt = 0;
      // Fire onFirstConnect when first slot connects
      if (!this.anyActive() && this._onFirstConnect) {
        this._onFirstConnect();
      }
    }

    slot.loggingActive = true;
    slot.channelName = raw;
    slot.status = 'connecting';
    clearTimeout(slot.reconnectTimer);
    this._setSlotStatus(slotId, 'Connecting...', 'connecting');

    const connectBtn = document.getElementById('slotConnectBtn_' + slotId);
    if (connectBtn) connectBtn.disabled = true;

    // Delegate to the adapter
    slot.adapter.connect(raw, isReconnect);
  }

  disconnectSlot(slotId) {
    const slot = this._getSlot(slotId);
    if (!slot) return;
    slot.loggingActive = false;
    clearTimeout(slot.reconnectTimer);
    slot.reconnectAttempt = 0;
    slot.channelName = '';
    slot.status = 'idle';
    slot.adapter.disconnect();
    this._mergeAllEmotes();
    this._setSlotStatus(slotId, '', '');
    const btn = document.getElementById('slotConnectBtn_' + slotId);
    if (btn) btn.disabled = false;
    if (!this.anyActive() && this._onAllDisconnected) {
      this._onAllDisconnected();
    }
  }

  disconnectAll() {
    for (const slot of this._slots) {
      slot.loggingActive = false;
      clearTimeout(slot.reconnectTimer);
      slot.reconnectAttempt = 0;
      slot.channelName = '';
      slot.status = 'idle';
      slot.adapter.disconnect();
      this._setSlotStatus(slot.id, '', '');
      const btn = document.getElementById('slotConnectBtn_' + slot.id);
      if (btn) btn.disabled = false;
    }
    this._mergeAllEmotes();
    document.body.classList.remove('disconnected');
    setStatus('Disconnected.', '');
    if (this._onAllDisconnected) this._onAllDisconnected();
  }

  // --- Channel history (shared across all slots) ---

  loadChannelHistory() { return load(CHANNEL_HISTORY_KEY, []); }

  saveChannelToHistory(name) {
    const clean = name.replace(/^#/, '').toLowerCase().trim();
    if (!clean) return;
    let hist = this.loadChannelHistory();
    hist = hist.filter(h => h !== clean);
    hist.unshift(clean);
    if (hist.length > CHANNEL_HISTORY_MAX) hist = hist.slice(0, CHANNEL_HISTORY_MAX);
    save(CHANNEL_HISTORY_KEY, hist);
  }

  deleteChannelFromHistory(name, slotId) {
    const hist = this.loadChannelHistory().filter(h => h !== name);
    save(CHANNEL_HISTORY_KEY, hist);
    this.renderChannelHistory(slotId != null ? slotId : 0);
  }

  renderChannelHistory(slotId) {
    const dropdown = document.getElementById('channelHistoryDropdown_' + slotId);
    if (!dropdown) return;
    const input = document.getElementById('channelInput_' + slotId);
    const hist = this.loadChannelHistory();
    const filter = sanitize((input ? input.value : '').trim().toLowerCase().replace(/^#/, ''));
    const filtered = filter ? hist.filter(h => h.startsWith(filter)) : hist;
    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="history-empty">No saved channels</div>';
      return;
    }
    dropdown.innerHTML = filtered.map(name =>
      `<div class="history-item" onmousedown="selectChannel(${slotId},'${esc(name)}')">
        <span class="history-item-name">${esc(name)}</span>
        <button class="history-delete" onmousedown="event.stopPropagation();deleteChannelFromHistory('${esc(name)}',${slotId})" title="Remove">\u00d7</button>
      </div>`
    ).join('');
  }

  openChannelHistory(slotId) {
    this.renderChannelHistory(slotId);
    const dd = document.getElementById('channelHistoryDropdown_' + slotId);
    if (dd) dd.classList.add('open');
  }

  closeChannelHistory(slotId) {
    const dd = document.getElementById('channelHistoryDropdown_' + slotId);
    if (dd) dd.classList.remove('open');
  }

  selectChannel(slotId, name) {
    const input = document.getElementById('channelInput_' + slotId);
    if (input) input.value = name;
    this.closeChannelHistory(slotId);
  }

  handleChannelKey(slotId, e) {
    if (e.key === 'Escape') { this.closeChannelHistory(slotId); return; }
    if (e.key === 'Enter') { this.closeChannelHistory(slotId); this.connectSlot(slotId); return; }
  }

  // --- Slot UI rendering ---

  renderAllSlots() {
    const container = document.getElementById('connectionSlots');
    if (!container) return;
    container.innerHTML = this._slots.map(s => this._renderSlotHTML(s)).join('');
    const addBtn = document.getElementById('addFeedBtn');
    if (addBtn) addBtn.style.display = this._slots.length >= MAX_FEEDS ? 'none' : '';
  }

  // --- Emote access (for OAuth chat / emote picker) ---

  getActiveAdapter(platform) {
    const slot = this._slots.find(s => s.platform === platform && s.loggingActive);
    return slot ? slot.adapter : null;
  }

  getFirstAdapter() {
    return this._slots[0] ? this._slots[0].adapter : null;
  }

  // --- Internal ---

  _addSlotInternal() {
    const id = this._slotIdCounter++;
    const slot = {
      id,
      platform: 'twitch',
      channelName: '',
      adapter: ADAPTER_FACTORIES.twitch(),
      loggingActive: false,
      reconnectAttempt: 0,
      reconnectTimer: null,
      status: 'idle',
    };
    this._wireAdapter(slot);
    this._slots.push(slot);
  }

  _wireAdapter(slot) {
    // Wire adapter's onMessage to push through to the manager's callback.
    // Inject the slot's channel so downstream consumers (history log) can
    // partition by stream without each adapter needing to know.
    slot.adapter.onMessage((msg) => {
      state.tsThroughput.push(msg.ts);
      if (this._onMessageCallback) {
        this._onMessageCallback({ ...msg, channel: msg.channel || slot.channelName });
      }
    });

    // Wire adapter's onStatus to update slot status
    slot.adapter.onStatus((statusInfo) => {
      if (statusInfo.type === 'live' || statusInfo.type === 'connected') {
        slot.reconnectAttempt = 0;
        slot.status = 'live';
        this.saveChannelToHistory(slot.channelName);
        this._setSlotStatus(slot.id, 'LIVE', 'live');
        const btn = document.getElementById('slotConnectBtn_' + slot.id);
        if (btn) btn.disabled = false;
        // Start processing loop on first live connection
        if (this._onFirstConnect && !state.rafHandle) {
          this._onFirstConnect();
        }
      } else if (statusInfo.type === 'progress') {
        // Intermediate step during connect — keep yellow 'connecting' dot,
        // update text so user sees what the adapter is doing.
        this._setSlotStatus(slot.id, statusInfo.text || 'Connecting...', 'connecting');
      } else if (statusInfo.type === 'error') {
        slot.status = 'error';
        slot.loggingActive = false;
        this._setSlotStatus(slot.id, statusInfo.text || 'Error', 'error');
        const btn = document.getElementById('slotConnectBtn_' + slot.id);
        if (btn) btn.disabled = false;
      } else if (statusInfo.type === 'disconnected') {
        this._handleSlotDisconnect(slot);
      }
    });
  }

  _handleSlotDisconnect(slot) {
    if (slot.loggingActive) {
      slot.reconnectAttempt++;
      slot.status = 'reconnecting';
      this._setSlotStatus(slot.id, 'Reconnecting (attempt ' + slot.reconnectAttempt + ')...', 'reconnecting');
      slot.reconnectTimer = setTimeout(() => {
        if (slot.loggingActive) this.connectSlot(slot.id, true);
      }, RECONNECT_DELAY_MS);
    }
  }

  _getSlot(slotId) {
    return this._slots.find(s => s.id === slotId);
  }

  _setSlotStatus(slotId, text, cls) {
    const dot = document.getElementById('slotDot_' + slotId);
    const txt = document.getElementById('slotStatusText_' + slotId);
    if (dot) dot.className = 'slot-dot' + (cls ? ' slot-dot-' + cls : '');
    if (txt) txt.textContent = text;
    this._updateGlobalStatus();
  }

  _updateGlobalStatus() {
    const live = this._slots.filter(s => s.status === 'live');
    const active = this._slots.filter(s => s.loggingActive);
    const bar = document.getElementById('statusBar');
    if (!bar) return;
    if (live.length === 0 && active.length === 0) {
      bar.innerHTML = 'Enter a channel name and connect';
      bar.className = 'status-bar';
    } else if (live.length === active.length && live.length > 0) {
      const names = live.map(s => s.channelName.toUpperCase()).join(', ');
      bar.innerHTML = '<span class="live-dot"></span>' + live.length + '/' + active.length + ' FEEDS LIVE \u2014 ' + names;
      bar.className = 'status-bar live';
    } else {
      bar.innerHTML = live.length + '/' + active.length + ' feeds connected';
      bar.className = 'status-bar' + (live.length > 0 ? ' live' : '');
    }
    const anyError = this._slots.some(s => s.loggingActive && (s.status === 'error' || s.status === 'reconnecting'));
    document.body.classList.toggle('disconnected', anyError);
  }

  _mergeAllEmotes() {
    state.thirdPartyEmotes.clear();
    for (const slot of this._slots) {
      if (!slot.loggingActive) continue;
      const a = slot.adapter;
      // Merge emotes from adapters that have them (Twitch adapters)
      if (a._ffzEmotes) for (const [k, v] of a._ffzEmotes) state.thirdPartyEmotes.set(k, v);
      if (a._seventvEmotes) for (const [k, v] of a._seventvEmotes) state.thirdPartyEmotes.set(k, v);
      if (a._bttvEmotes) for (const [k, v] of a._bttvEmotes) state.thirdPartyEmotes.set(k, v);
    }
  }

  _renderSlotHTML(slot) {
    const isFirst = slot.id === this._slots[0].id;
    return '<div class="connection-slot" id="slot_' + slot.id + '" data-slot="' + slot.id + '">' +
      '<select class="platform-select" id="slotPlatform_' + slot.id + '" onchange="switchSlotPlatform(' + slot.id + ',this.value)" aria-label="Platform">' +
        '<option value="twitch"' + (slot.platform==='twitch'?' selected':'') + '>Twitch</option>' +
        '<option value="kick"' + (slot.platform==='kick'?' selected':'') + '>Kick (unofficial)</option>' +
        '<option value="youtube"' + (slot.platform==='youtube'?' selected':'') + '>YouTube (unofficial)</option>' +
        '<option value="rumble"' + (slot.platform==='rumble'?' selected':'') + '>Rumble (unofficial)</option>' +
      '</select>' +
      '<div class="input-wrap" style="position:relative">' +
        '<span class="input-prefix" id="inputPrefix_' + slot.id + '">' + (PLATFORM_PREFIXES[slot.platform] || '#') + '</span>' +
        '<input type="text" id="channelInput_' + slot.id + '" name="mr-chan" placeholder="' + (PLATFORM_PLACEHOLDERS[slot.platform] || 'channel name') + '" spellcheck="false" autocomplete="off" autocorrect="off" autocapitalize="off" ' +
          'onfocus="openChannelHistory(' + slot.id + ')" oninput="openChannelHistory(' + slot.id + ')" ' +
          'onblur="setTimeout(function(){closeChannelHistory(' + slot.id + ')},150)" ' +
          'onkeydown="handleChannelKey(' + slot.id + ',event)" aria-label="Channel name"/>' +
        '<div class="channel-history-dropdown" id="channelHistoryDropdown_' + slot.id + '"></div>' +
      '</div>' +
      '<button class="btn btn-connect" id="slotConnectBtn_' + slot.id + '" onclick="connectSlot(' + slot.id + ')">Connect</button>' +
      '<button class="btn btn-disconnect slot-disconnect-btn" onclick="disconnectSlot(' + slot.id + ')">Disconnect</button>' +
      '<span class="slot-status">' +
        '<span class="slot-dot" id="slotDot_' + slot.id + '"></span>' +
        '<span class="slot-status-text" id="slotStatusText_' + slot.id + '"></span>' +
      '</span>' +
      (isFirst ? '' : '<button class="btn-slot-remove" onclick="removeSlot(' + slot.id + ')" title="Remove feed">\u00d7</button>') +
    '</div>';
  }
}
