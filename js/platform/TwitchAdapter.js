/**
 * TwitchAdapter — Twitch-specific platform adapter.
 *
 * Handles IRC WebSocket connection, third-party emote loading (BTTV, 7TV, FFZ),
 * OAuth token management, chat message sending, emote picker, and channel history.
 */
import { PlatformAdapter } from './PlatformAdapter.js';
import { state } from '../state.js';
import { sanitize, esc, setStatus } from '../utils/dom.js';
import {
  OAUTH_STORAGE_KEY,
  CHANNEL_HISTORY_KEY,
  CHANNEL_HISTORY_MAX,
  RECONNECT_DELAY_MS
} from '../config.js';
import { saveRaw, loadRaw, load, save } from '../utils/storage.js';

export class TwitchAdapter extends PlatformAdapter {
  constructor() {
    super();
    // Connection state
    this._ws = null;
    this._loggingActive = false;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;

    // Room / channel
    this._currentRoomId = null;
    this._currentChannelName = '';

    // Emote maps (per-source)
    this._bttvEmotes = new Map();
    this._seventvEmotes = new Map();
    this._ffzEmotes = new Map();

    // OAuth
    this._oauthToken = '';
    this._clientId = '';
    this._userId = '';
    this._userLogin = '';

    // Emote picker
    this._emotePickerOpen = false;
    this._emotePickerTab = 'bttv';

    // Restore saved OAuth token on construction
    this._restoreOAuth();
  }

  // ------------------------------------------------------------------
  //  PlatformAdapter interface
  // ------------------------------------------------------------------

  get isConnected() { return this._ws !== null && this._ws.readyState === WebSocket.OPEN; }
  get platformName() { return 'twitch'; }
  get platformColor() { return '#9146ff'; }

  // ------------------------------------------------------------------
  //  Connection
  // ------------------------------------------------------------------

  connect(channel, isReconnect = false) {
    const raw = sanitize(
      typeof channel === 'string' ? channel : document.getElementById('channelInput').value.trim().toLowerCase()
    );
    if (!raw) {
      setStatus('Enter a channel name first.', 'error');
      return;
    }

    // Close existing connection cleanly without clearing loggingActive
    if (this._ws) { this._ws.close(); this._ws = null; }

    if (!isReconnect) {
      this._reconnectAttempt = 0; // reset counter on fresh manual connect
    }

    this._loggingActive = true;
    document.body.classList.remove('disconnected');
    clearTimeout(this._reconnectTimer);

    const ch = raw.startsWith('#') ? raw : '#' + raw;

    setStatus('Connecting to ' + ch + '...', '');
    if (this._onStatusCallback) this._onStatusCallback({ text: 'Connecting to ' + ch + '...', type: '' });

    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) connectBtn.disabled = true;

    this._ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

    this._ws.onopen = () => {
      this._ws.send('CAP REQ :twitch.tv/commands twitch.tv/tags');
      this._ws.send('PASS SCHMOOPIIE');
      this._ws.send('NICK justinfan' + (Math.random() * 80000 + 1000 | 0));
      this._ws.send('JOIN ' + ch);
    };

    this._ws.onmessage = (event) => {
      const now = Date.now();
      const lines = event.data.split('\r\n');
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line) continue;

        // PING / PONG
        if (line.startsWith('PING')) { this._ws.send('PONG :tmi.twitch.tv'); continue; }

        // ROOMSTATE — extract room-id, load third-party emotes
        if (line.includes('ROOMSTATE') && !this._currentRoomId) {
          const roomMatch = line.match(/room-id=(\d+)/);
          if (roomMatch) {
            this._currentRoomId = roomMatch[1];
            this._currentChannelName = ch.replace('#', '');
            this.loadEmotes(this._currentRoomId, this._currentChannelName);
          }
        }

        // JOIN detection — successful join
        if (line.includes('366') || (line.includes('JOIN') && line.includes(ch))) {
          this._reconnectAttempt = 0;
          document.body.classList.remove('disconnected');
          this.saveChannelToHistory(ch);

          const liveMsg = '<span class="live-dot"></span>LIVE - ' + ch.replace('#', '').toUpperCase();
          setStatus(liveMsg, 'live');
          if (this._onStatusCallback) this._onStatusCallback({ text: liveMsg, type: 'live' });
        }

        // PRIVMSG — chat messages
        if (!line.includes('PRIVMSG')) continue;
        const privIdx = line.indexOf('PRIVMSG'), colonIdx = line.indexOf(':', privIdx);
        if (colonIdx < 0) continue;
        const msgText = line.slice(colonIdx + 1);
        const atStart = line.charCodeAt(0) === 64;
        const userStart = atStart ? line.indexOf(' :') + 2 : 1;
        const bangIdx = line.indexOf('!', userStart);
        if (bangIdx < 0) continue;
        const user = line.slice(userStart, bangIdx);

        // Parse IRCv3 tags (atStart === line begins with '@') and rewrite native
        // Twitch emote positions into [emote:twitch:<id>:<name>] placeholders so
        // renderEmotes() can swap them for CDN images.
        let finalMsg = msgText;
        if (atStart) {
          const emotesTag = this._readIrcTag(line, 'emotes');
          if (emotesTag) finalMsg = this._rewriteTwitchEmotes(msgText, emotesTag);
        }

        if (this._onMessageCallback) {
          this._onMessageCallback({ user, msg: finalMsg, ts: now, platform: 'twitch' });
        }
      }
    };

    this._ws.onerror = () => {
      if (connectBtn) connectBtn.disabled = false;
      this._setDisconnectedState(true);
    };

    this._ws.onclose = () => {
      if (connectBtn) connectBtn.disabled = false;
      // Only treat as unexpected if loggingActive (not a manual disconnect)
      this._setDisconnectedState(this._loggingActive);
    };
  }

  disconnect() {
    this._loggingActive = false;             // user intentionally stopped
    clearTimeout(this._reconnectTimer);
    this._reconnectAttempt = 0;
    this._currentRoomId = null;              // reset so emotes reload for next channel
    document.body.classList.remove('disconnected');
    if (this._ws) { this._ws.close(); this._ws = null; }

    setStatus('Disconnected.', '');
    if (this._onStatusCallback) this._onStatusCallback({ text: 'Disconnected.', type: '' });

    const connectBtn = document.getElementById('connectBtn');
    if (connectBtn) connectBtn.disabled = false;
  }

  _setDisconnectedState(shouldReconnect) {
    if (this._loggingActive) {
      document.body.classList.add('disconnected');
    }
    if (shouldReconnect && this._loggingActive) {
      this._reconnectAttempt++;
      const attemptNum = this._reconnectAttempt;
      const msg = `Disconnected. Reconnecting in 10s (attempt ${attemptNum})...`;
      setStatus(msg, 'error');
      if (this._onStatusCallback) this._onStatusCallback({ text: msg, type: 'error' });
      this._reconnectTimer = setTimeout(() => {
        if (this._loggingActive) this.connect(this._currentChannelName, true);
      }, RECONNECT_DELAY_MS);
    }
  }

  // ------------------------------------------------------------------
  //  IRCv3 tag parsing — native Twitch emote rewriting
  // ------------------------------------------------------------------

  /**
   * Read a single IRCv3 tag value from the prefix of a tagged IRC line.
   * Returns '' when the tag is absent or empty. Expects `line[0] === '@'`.
   */
  _readIrcTag(line, name) {
    const spaceIdx = line.indexOf(' ');
    if (spaceIdx < 2) return '';
    const prefix = line.slice(1, spaceIdx);
    const key = name + '=';
    let i = 0;
    while (i < prefix.length) {
      const end = prefix.indexOf(';', i);
      const part = end < 0 ? prefix.slice(i) : prefix.slice(i, end);
      if (part.startsWith(key)) return part.slice(key.length);
      if (end < 0) break;
      i = end + 1;
    }
    return '';
  }

  /**
   * Rewrite native Twitch emote positions (from the `emotes` IRCv3 tag) into
   * source-tagged placeholders understood by renderEmotes().
   *
   * Tag format: `id:start-end,start-end/id:start-end` — positions are
   * code-point indices (not UTF-16 code units), so we split the message into
   * a code-point array before splicing.
   */
  _rewriteTwitchEmotes(msgText, emotesTag) {
    if (!emotesTag) return msgText;
    const ranges = [];
    for (const group of emotesTag.split('/')) {
      const colon = group.indexOf(':');
      if (colon < 0) continue;
      const id = group.slice(0, colon);
      if (!/^\d+$/.test(id)) continue;
      for (const span of group.slice(colon + 1).split(',')) {
        const dash = span.indexOf('-');
        if (dash < 0) continue;
        const start = parseInt(span.slice(0, dash), 10);
        const end = parseInt(span.slice(dash + 1), 10);
        if (!isFinite(start) || !isFinite(end) || end < start) continue;
        ranges.push({ id, start, end });
      }
    }
    if (!ranges.length) return msgText;
    ranges.sort((a, b) => b.start - a.start); // splice from the right so earlier indices stay valid

    const cps = Array.from(msgText);
    for (const r of ranges) {
      if (r.start < 0 || r.end >= cps.length) continue;
      const nameRaw = cps.slice(r.start, r.end + 1).join('');
      const name = nameRaw.replace(/[^A-Za-z0-9_]/g, '');
      if (!name) continue;
      cps.splice(r.start, r.end - r.start + 1, `[emote:twitch:${r.id}:${name}]`);
    }
    return cps.join('');
  }

  // ------------------------------------------------------------------
  //  Third-party emotes — BTTV, 7TV, FrankerFaceZ
  // ------------------------------------------------------------------

  async loadEmotes(roomId, channelName) {
    await Promise.all([
      this._fetchBTTVEmotes(roomId),
      this._fetch7TVEmotes(roomId),
      this._fetchFFZEmotes(channelName)
    ]);
    // Merge: FFZ first (lowest priority), then 7TV, then BTTV (highest priority)
    state.thirdPartyEmotes.clear();
    for (const [k, v] of this._ffzEmotes) state.thirdPartyEmotes.set(k, v);
    for (const [k, v] of this._seventvEmotes) state.thirdPartyEmotes.set(k, v);
    for (const [k, v] of this._bttvEmotes) state.thirdPartyEmotes.set(k, v);
    console.log(
      '[MoodRadar] Loaded ' + state.thirdPartyEmotes.size + ' third-party emotes (BTTV: ' +
      this._bttvEmotes.size + ', 7TV: ' + this._seventvEmotes.size + ', FFZ: ' + this._ffzEmotes.size + ')'
    );
  }

  async _fetchBTTVEmotes(roomId) {
    this._bttvEmotes.clear();
    try {
      const [globalRes, channelRes] = await Promise.all([
        fetch('https://api.betterttv.net/3/cached/emotes/global'),
        fetch('https://api.betterttv.net/3/cached/users/twitch/' + roomId)
      ]);
      if (globalRes.ok) {
        const global = await globalRes.json();
        for (const e of global) {
          this._bttvEmotes.set(e.code, { url: 'https://cdn.betterttv.net/emote/' + e.id + '/1x', id: e.id, source: 'bttv' });
        }
      }
      if (channelRes.ok) {
        const data = await channelRes.json();
        const channelEmotes = (data.channelEmotes || []).concat(data.sharedEmotes || []);
        for (const e of channelEmotes) {
          this._bttvEmotes.set(e.code, { url: 'https://cdn.betterttv.net/emote/' + e.id + '/1x', id: e.id, source: 'bttv' });
        }
      }
    } catch (e) { console.warn('[MoodRadar] BTTV emote fetch failed:', e.message); }
  }

  async _fetch7TVEmotes(roomId) {
    this._seventvEmotes.clear();
    try {
      const [globalRes, channelRes] = await Promise.all([
        fetch('https://7tv.io/v3/emote-sets/global'),
        fetch('https://7tv.io/v3/users/twitch/' + roomId)
      ]);
      if (globalRes.ok) {
        const data = await globalRes.json();
        const emotes = data.emotes || [];
        for (const e of emotes) {
          const fileHost = e.data && e.data.host;
          if (!fileHost) continue;
          const baseUrl = 'https:' + fileHost.url;
          const file = (fileHost.files || []).find(f => f.name === '1x.webp') || (fileHost.files || [])[0];
          if (!file) continue;
          this._seventvEmotes.set(e.name, { url: baseUrl + '/' + file.name, id: e.id, source: '7tv' });
        }
      }
      if (channelRes.ok) {
        const user = await channelRes.json();
        const emoteSet = user.emote_set;
        if (emoteSet && emoteSet.emotes) {
          for (const e of emoteSet.emotes) {
            const fileHost = e.data && e.data.host;
            if (!fileHost) continue;
            const baseUrl = 'https:' + fileHost.url;
            const file = (fileHost.files || []).find(f => f.name === '1x.webp') || (fileHost.files || [])[0];
            if (!file) continue;
            this._seventvEmotes.set(e.name, { url: baseUrl + '/' + file.name, id: e.id, source: '7tv' });
          }
        }
      }
    } catch (e) { console.warn('[MoodRadar] 7TV emote fetch failed:', e.message); }
  }

  async _fetchFFZEmotes(channelName) {
    this._ffzEmotes.clear();
    try {
      const [globalRes, channelRes] = await Promise.all([
        fetch('https://api.frankerfacez.com/v1/set/global'),
        fetch('https://api.frankerfacez.com/v1/room/' + channelName)
      ]);
      const extractFFZ = (data) => {
        const sets = data.sets || {};
        for (const setId of Object.keys(sets)) {
          const emotes = sets[setId].emoticons || [];
          for (const e of emotes) {
            const url = e.urls && (e.urls['1'] || e.urls['2'] || e.urls['4']);
            if (!url) continue;
            const fullUrl = url.startsWith('//') ? 'https:' + url : url;
            this._ffzEmotes.set(e.name, { url: fullUrl, id: e.id, source: 'ffz' });
          }
        }
      };
      if (globalRes.ok) extractFFZ(await globalRes.json());
      if (channelRes.ok) extractFFZ(await channelRes.json());
    } catch (e) { console.warn('[MoodRadar] FFZ emote fetch failed:', e.message); }
  }

  // ------------------------------------------------------------------
  //  OAuth — token validation, storage, chat message sending
  // ------------------------------------------------------------------

  _restoreOAuth() {
    const saved = loadRaw(OAUTH_STORAGE_KEY, '');
    if (saved) {
      this._oauthToken = saved;
      this.validateToken(saved).then(ok => {
        if (ok) this.updateAuthStatus(this._userLogin);
      });
    }
  }

  async validateToken(token) {
    try {
      const clean = token.replace(/^oauth:/i, '');
      const res = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: { 'Authorization': 'OAuth ' + clean }
      });
      if (!res.ok) return false;
      const data = await res.json();
      this._clientId = data.client_id || '';
      this._userId = data.user_id || '';
      this._userLogin = data.login || '';
      this._oauthToken = clean;
      return true;
    } catch (e) { console.warn('[MoodRadar] Token validation request failed:', e.message); return false; }
  }

  async setOAuthToken() {
    const input = document.getElementById('oauthTokenInput');
    const raw = (input.value || '').trim();
    if (!raw) return;
    const ok = await this.validateToken(raw);
    if (ok) {
      saveRaw(OAUTH_STORAGE_KEY, this._oauthToken);
      this.updateAuthStatus(this._userLogin);
      input.value = '';
    } else {
      this.updateAuthStatus('');
      const el = document.getElementById('chatAuthStatus');
      if (el) { el.textContent = 'invalid token'; el.style.color = '#ff4800'; }
      this.showCopyErrorBtn();
    }
  }

  async sendMessage(channel, msg) {
    const input = document.getElementById('chatMessageInput');
    const message = msg || (input ? (input.value || '').trim() : '');
    if (!message) return;

    if (!this._oauthToken || !this._clientId) {
      const el = document.getElementById('chatAuthStatus');
      if (el) { el.textContent = 'set token first'; el.style.color = '#ff4800'; }
      this.showCopyErrorBtn();
      return;
    }
    if (!this._currentRoomId) {
      const el = document.getElementById('chatAuthStatus');
      if (el) { el.textContent = 'connect to channel first'; el.style.color = '#ff4800'; }
      this.showCopyErrorBtn();
      return;
    }

    const btn = document.getElementById('chatSendBtn');
    if (btn) btn.disabled = true;

    try {
      const res = await fetch('https://api.twitch.tv/helix/chat/messages', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + this._oauthToken,
          'Client-Id': this._clientId,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          broadcaster_id: this._currentRoomId,
          sender_id: this._userId,
          message: message
        })
      });
      if (res.ok) {
        if (input) input.value = '';
      } else {
        const err = await res.json().catch(() => ({}));
        const el = document.getElementById('chatAuthStatus');
        if (el) { el.textContent = err.message || 'send failed'; el.style.color = '#ff4800'; }
        this.showCopyErrorBtn();
      }
    } catch {
      const el = document.getElementById('chatAuthStatus');
      if (el) { el.textContent = 'network error'; el.style.color = '#ff4800'; }
      this.showCopyErrorBtn();
    }

    setTimeout(() => { if (btn) btn.disabled = false; }, 1500);
  }

  updateAuthStatus(login) {
    const el = document.getElementById('chatAuthStatus');
    if (!el) return;
    const copyBtn = document.getElementById('copyErrorBtn');
    if (copyBtn) copyBtn.style.display = 'none';
    if (login) {
      el.textContent = login;
      el.style.color = 'var(--accent)';
    } else {
      el.textContent = 'not connected';
      el.style.color = 'var(--muted)';
    }
  }

  copyAuthError() {
    const el = document.getElementById('chatAuthStatus');
    if (!el || !el.textContent) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
      const btn = document.getElementById('copyErrorBtn');
      if (btn) { btn.textContent = 'COPIED'; setTimeout(() => btn.textContent = 'COPY', 1500); }
    }).catch(() => {});
  }

  showCopyErrorBtn() {
    const btn = document.getElementById('copyErrorBtn');
    if (btn) btn.style.display = '';
  }

  // ------------------------------------------------------------------
  //  Emote Picker
  // ------------------------------------------------------------------

  toggleEmotePicker() {
    this._emotePickerOpen = !this._emotePickerOpen;
    const modal = document.getElementById('emotePickerModal');
    if (!modal) return;
    modal.style.display = this._emotePickerOpen ? 'flex' : 'none';
    if (this._emotePickerOpen) this.renderEmotePickerGrid(this._emotePickerTab, '');
  }

  switchEmoteTab(source) {
    this._emotePickerTab = source;
    document.querySelectorAll('.emote-tab').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.source === source);
    });
    const search = document.getElementById('emoteSearch');
    this.renderEmotePickerGrid(source, search ? search.value : '');
  }

  filterEmotePicker(query) {
    this.renderEmotePickerGrid(this._emotePickerTab, query);
  }

  renderEmotePickerGrid(source, filter) {
    const grid = document.getElementById('emotePickerGrid');
    if (!grid) return;
    let sourceMap;
    if (source === 'bttv') sourceMap = this._bttvEmotes;
    else if (source === '7tv') sourceMap = this._seventvEmotes;
    else sourceMap = this._ffzEmotes;
    const lowerFilter = (filter || '').toLowerCase();
    let html = '';
    let count = 0;
    for (const [code, emote] of sourceMap) {
      if (lowerFilter && !code.toLowerCase().includes(lowerFilter)) continue;
      if (count++ > 300) break; // cap for performance
      html += '<img class="emote-pick" src="' + emote.url + '" alt="' + esc(code) + '" title="' + esc(code) + '" onclick="insertEmote(\'' + esc(code).replace(/'/g, "\\'") + '\')" loading="lazy">';
    }
    if (!html) html = '<div class="emote-picker-empty">No emotes loaded \u2014 connect to a channel first</div>';
    grid.innerHTML = html;
  }

  insertEmote(code) {
    const input = document.getElementById('chatMessageInput');
    if (!input) return;
    const start = input.selectionStart || input.value.length;
    const before = input.value.slice(0, start);
    const after = input.value.slice(start);
    const space = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
    input.value = before + space + code + ' ' + after;
    input.focus();
    const pos = start + space.length + code.length + 1;
    input.setSelectionRange(pos, pos);
  }

  // ------------------------------------------------------------------
  //  Channel History
  // ------------------------------------------------------------------

  loadChannelHistory() {
    return load(CHANNEL_HISTORY_KEY, []);
  }

  saveChannelToHistory(name) {
    const clean = name.replace(/^#/, '').toLowerCase().trim();
    if (!clean) return;
    let hist = this.loadChannelHistory();
    hist = hist.filter(h => h !== clean);   // remove duplicate
    hist.unshift(clean);                    // add to front
    if (hist.length > CHANNEL_HISTORY_MAX) hist = hist.slice(0, CHANNEL_HISTORY_MAX);
    save(CHANNEL_HISTORY_KEY, hist);
  }

  deleteChannelFromHistory(name) {
    const hist = this.loadChannelHistory().filter(h => h !== name);
    save(CHANNEL_HISTORY_KEY, hist);
    this.renderChannelHistory();
  }

  renderChannelHistory() {
    const dropdown = document.getElementById('channelHistoryDropdown');
    const hist = this.loadChannelHistory();
    const filter = sanitize(document.getElementById('channelInput').value.trim().toLowerCase().replace(/^#/, ''));

    const filtered = filter ? hist.filter(h => h.startsWith(filter)) : hist;

    if (filtered.length === 0) {
      dropdown.innerHTML = '<div class="history-empty">No saved channels</div>';
      return;
    }

    dropdown.innerHTML = filtered.map(name =>
      `<div class="history-item" onmousedown="selectChannel('${esc(name)}')">
        <span class="history-item-name">${esc(name)}</span>
        <button class="history-delete" onmousedown="event.stopPropagation();deleteChannelFromHistory('${esc(name)}')" title="Remove">\u00d7</button>
      </div>`
    ).join('');
  }

  openChannelHistory() {
    this.renderChannelHistory();
    document.getElementById('channelHistoryDropdown').classList.add('open');
  }

  closeChannelHistory() {
    document.getElementById('channelHistoryDropdown').classList.remove('open');
  }

  selectChannel(name) {
    document.getElementById('channelInput').value = name;
    this.closeChannelHistory();
  }

  handleChannelKey(e) {
    if (e.key === 'Escape') { this.closeChannelHistory(); return; }
    if (e.key === 'Enter') { this.closeChannelHistory(); this.connect(); return; }
  }
}

/**
 * Factory function — returns a new TwitchAdapter singleton instance.
 */
export function createTwitchAdapter() {
  return new TwitchAdapter();
}
