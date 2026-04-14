/**
 * KickAdapter — Kick.com platform adapter.
 *
 * Connects to Kick chat via Pusher WebSocket protocol.
 * No authentication required for reading public chat.
 * Kick uses Pusher channels: chatrooms.<channelId>.v2
 *
 * Channel resolution uses multiple CORS proxy fallbacks since
 * Kick's API blocks cross-origin requests from browsers.
 * Users can also enter a numeric chatroom ID directly to skip resolution.
 */
import { PlatformAdapter } from './PlatformAdapter.js';
import { state } from '../state.js';
import { sanitize, setStatus } from '../utils/dom.js';
import { RECONNECT_DELAY_MS } from '../config.js';

/**
 * Fetch a URL with multiple CORS proxy fallbacks.
 */
async function fetchViaCorsProxy(url, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  const enc = encodeURIComponent(url);
  const attempts = [
    url,
    'https://corsproxy.io/?' + enc,
    'https://api.allorigins.win/raw?url=' + enc,
    'https://api.codetabs.com/v1/proxy?quest=' + enc,
    'https://cors-anywhere.herokuapp.com/' + url,
    'https://crossorigin.me/' + url,
  ];
  for (const tryUrl of attempts) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(tryUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) {
        console.log('[MoodRadar][Kick] CORS proxy succeeded: ' + tryUrl.split('?')[0]);
        return res;
      }
    } catch (e) {
      console.warn('[MoodRadar][Kick] Proxy failed: ' + tryUrl.split('?')[0]);
    }
  }
  console.error('[MoodRadar][Kick] All CORS proxies failed for: ' + url);
  return null;
}

export class KickAdapter extends PlatformAdapter {
  constructor() {
    super();
    this._ws = null;
    this._loggingActive = false;
    this._reconnectAttempt = 0;
    this._reconnectTimer = null;
    this._channelId = null;
    this._channelSlug = '';
    this._socketId = null;
  }

  get isConnected() { return this._ws && this._ws.readyState === WebSocket.OPEN; }
  get platformName() { return 'Kick'; }
  get platformColor() { return '#53fc18'; }

  /**
   * Resolve a Kick channel slug to its chatroom ID via the public API.
   * Tries v2 and v1 APIs with multiple CORS proxy fallbacks.
   */
  async _resolveChannel(slug) {
    // Support direct numeric chatroom ID
    if (/^\d+$/.test(slug)) {
      return { chatroomId: parseInt(slug, 10), channelId: null, channelName: slug };
    }

    const apis = [
      `https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`,
      `https://kick.com/api/v1/channels/${encodeURIComponent(slug)}`,
    ];
    for (const apiUrl of apis) {
      try {
        const res = await fetchViaCorsProxy(apiUrl, 12000);
        if (!res) continue;
        const data = await res.json();
        const chatroomId = (data.chatroom && data.chatroom.id) || data.chatroom_id || null;
        if (chatroomId) {
          return { chatroomId, channelId: data.id, channelName: data.slug || slug };
        }
      } catch (e) { /* try next API version */ }
    }
    return null;
  }

  /**
   * Connect to Kick chat for a given channel slug or numeric chatroom ID.
   */
  async connect(isReconnect) {
    const input = document.getElementById('channelInput');
    const raw = sanitize((input ? input.value : '').trim().toLowerCase());
    if (!raw) { setStatus('Enter a channel name or chatroom ID.', 'error'); return; }

    // Close existing
    if (this._ws) { this._ws.close(); this._ws = null; }

    if (!isReconnect) {
      this._reconnectAttempt = 0;
    }

    this._loggingActive = true;
    this._channelSlug = raw;
    document.body.classList.remove('disconnected');
    clearTimeout(this._reconnectTimer);
    setStatus('Resolving Kick channel: ' + raw + '...', '');

    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = true;

    // Resolve channel slug to chatroom ID
    const info = await this._resolveChannel(raw);
    if (!info || !info.chatroomId) {
      setStatus('Channel not found. Try a numeric chatroom ID.', 'error');
      if (btn) btn.disabled = false;
      this._loggingActive = false;
      return;
    }

    this._channelId = info.chatroomId;
    setStatus('Connecting to Kick chat: ' + raw + '...', '');
    console.log('[MoodRadar][Kick] Resolved chatroom ID: ' + info.chatroomId);

    // Try connecting with known Pusher keys (Kick has rotated keys historically)
    const pusherKeys = ['eb1d5f283081a78b932c', '32cbd69e4b950bf97679'];
    let connected = false;

    for (let ki = 0; ki < pusherKeys.length && !connected; ki++) {
      const pusherKey = pusherKeys[ki];
      const wsUrl = `wss://ws-us2.pusher.com/app/${pusherKey}?protocol=7&client=js&version=7.6.0&flash=false`;
      console.log('[MoodRadar][Kick] Trying Pusher key ' + (ki + 1) + '/' + pusherKeys.length);

      connected = await new Promise((resolve) => {
        if (this._ws) { this._ws.close(); this._ws = null; }
        this._ws = new WebSocket(wsUrl);
        const handshakeTimer = setTimeout(() => {
          console.warn('[MoodRadar][Kick] Pusher handshake timeout');
          if (this._ws) { this._ws.close(); this._ws = null; }
          resolve(false);
        }, 15000);

        this._ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            console.log('[MoodRadar][Kick] Pusher event: ' + data.event);
            if (data.event === 'pusher:connection_established') {
              clearTimeout(handshakeTimer);
              this._socketId = JSON.parse(data.data).socket_id;
              this._ws.send(JSON.stringify({
                event: 'pusher:subscribe',
                data: { channel: `chatrooms.${this._channelId}.v2` }
              }));
            }
            if (data.event === 'pusher_internal:subscription_succeeded') {
              clearTimeout(handshakeTimer);
              resolve(true);
            }
            if (data.event === 'pusher:error') {
              console.error('[MoodRadar][Kick] Pusher error:', data.data);
              clearTimeout(handshakeTimer);
              if (this._ws) { this._ws.close(); this._ws = null; }
              resolve(false);
            }
          } catch (e) { /* ignore */ }
        };
        this._ws.onerror = () => { clearTimeout(handshakeTimer); resolve(false); };
        this._ws.onclose = () => { clearTimeout(handshakeTimer); };
      });
    }

    if (!connected || !this._ws) {
      setStatus('Pusher connection failed. Kick may have changed their API.', 'error');
      console.error('[MoodRadar][Kick] All Pusher keys failed');
      if (btn) btn.disabled = false;
      this._loggingActive = false;
      return;
    }

    // Connected — set up persistent message handler
    this._reconnectAttempt = 0;
    document.body.classList.remove('disconnected');
    setStatus(`<span class="live-dot"></span>LIVE - ${raw.toUpperCase()} (KICK)`, 'live');
    if (btn) btn.disabled = false;
    if (this._onStatusCallback) {
      this._onStatusCallback({ type: 'connected', channel: raw });
    }

    this._ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle chat messages
        if (data.event === 'App\\Events\\ChatMessageEvent') {
          const msgData = JSON.parse(data.data);
          const user = msgData.sender?.username || msgData.sender?.slug || 'unknown';
          const msg = msgData.content || '';
          const ts = Date.now();

          if (this._onMessageCallback && msg) {
            this._onMessageCallback({ user, msg, ts });
          }
        }

        // Handle Pusher ping
        if (data.event === 'pusher:ping') {
          this._ws.send(JSON.stringify({ event: 'pusher:pong', data: {} }));
        }

      } catch (e) {
        // Ignore parse errors on non-JSON frames
      }
    };

    this._ws.onerror = () => {
      if (btn) btn.disabled = false;
      this._setDisconnectedState(true);
    };

    this._ws.onclose = () => {
      if (btn) btn.disabled = false;
      this._setDisconnectedState(this._loggingActive);
    };
  }

  disconnect() {
    this._loggingActive = false;
    clearTimeout(this._reconnectTimer);
    this._reconnectAttempt = 0;
    document.body.classList.remove('disconnected');
    if (this._ws) { this._ws.close(); this._ws = null; }
    setStatus('Disconnected.', '');
    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = false;
  }

  _setDisconnectedState(shouldReconnect) {
    if (this._loggingActive) {
      document.body.classList.add('disconnected');
    }
    if (shouldReconnect && this._loggingActive) {
      this._reconnectAttempt++;
      const attempt = this._reconnectAttempt;
      setStatus(`Disconnected. Reconnecting in 10s (attempt ${attempt})...`, 'error');
      this._reconnectTimer = setTimeout(() => {
        if (this._loggingActive) this.connect(true);
      }, RECONNECT_DELAY_MS);
    }
  }

  async sendMessage(channel, msg) {
    // Kick requires authentication for sending — not supported in anonymous mode
    setStatus('Sending messages on Kick requires authentication (not yet supported).', 'error');
  }
}

export function createKickAdapter() {
  return new KickAdapter();
}
