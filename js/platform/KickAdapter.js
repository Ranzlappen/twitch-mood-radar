/**
 * KickAdapter — Kick.com platform adapter.
 *
 * Connects to Kick chat via Pusher WebSocket protocol.
 * No authentication required for reading public chat.
 * Kick uses Pusher channels: chatrooms.<channelId>.v2
 */
import { PlatformAdapter } from './PlatformAdapter.js';
import { state } from '../state.js';
import { sanitize, setStatus } from '../utils/dom.js';
import { RECONNECT_DELAY_MS } from '../config.js';

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
   */
  async _resolveChannel(slug) {
    try {
      const res = await fetch(`https://kick.com/api/v2/channels/${encodeURIComponent(slug)}`);
      if (!res.ok) return null;
      const data = await res.json();
      return {
        chatroomId: data.chatroom?.id,
        channelId: data.id,
        channelName: data.slug || slug,
      };
    } catch (e) {
      return null;
    }
  }

  /**
   * Connect to Kick chat for a given channel slug.
   */
  async connect(isReconnect) {
    const input = document.getElementById('channelInput');
    const raw = sanitize((input ? input.value : '').trim().toLowerCase());
    if (!raw) { setStatus('Enter a channel name first.', 'error'); return; }

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
      setStatus('Could not find Kick channel: ' + raw, 'error');
      if (btn) btn.disabled = false;
      this._loggingActive = false;
      return;
    }

    this._channelId = info.chatroomId;
    setStatus('Connecting to Kick chat: ' + raw + '...', '');

    // Connect to Pusher WebSocket (Kick's Pusher app key)
    const pusherKey = 'eb1d5f283081a78b932c';
    const wsUrl = `wss://ws-us2.pusher.com/app/${pusherKey}?protocol=7&client=js&version=7.6.0&flash=false`;

    this._ws = new WebSocket(wsUrl);

    this._ws.onopen = () => {
      // Pusher connection established — wait for connection_established event
    };

    this._ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Handle Pusher protocol events
        if (data.event === 'pusher:connection_established') {
          const connData = JSON.parse(data.data);
          this._socketId = connData.socket_id;

          // Subscribe to the chatroom channel
          const subscribeMsg = JSON.stringify({
            event: 'pusher:subscribe',
            data: { channel: `chatrooms.${this._channelId}.v2` }
          });
          this._ws.send(subscribeMsg);
        }

        if (data.event === 'pusher_internal:subscription_succeeded') {
          this._reconnectAttempt = 0;
          document.body.classList.remove('disconnected');
          setStatus(`<span class="live-dot"></span>LIVE - ${raw.toUpperCase()} (KICK)`, 'live');
          if (btn) btn.disabled = false;

          // Fire the processing loop via status callback
          if (this._onStatusCallback) {
            this._onStatusCallback({ type: 'connected', channel: raw });
          }
        }

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
