/**
 * RumbleAdapter — Rumble.com platform adapter.
 *
 * Rumble only provides a REST API (no WebSocket). Chat messages are
 * fetched via polling. Requires a Firebase proxy due to CORS restrictions
 * and API key security.
 *
 * Limitations:
 * - Max 50 messages per request
 * - Polling-only (no real-time push)
 * - Limited API documentation
 */
import { PlatformAdapter } from './PlatformAdapter.js';
import { sanitize, setStatus } from '../utils/dom.js';

export class RumbleAdapter extends PlatformAdapter {
  constructor() {
    super();
    this._polling = false;
    this._pollTimer = null;
    this._pollIntervalMs = 5000; // 5s between polls (conservative)
    this._streamId = '';
    this._proxyUrl = '';
    this._lastMessageId = null;
    this._reconnectAttempt = 0;
  }

  get isConnected() { return this._polling; }
  get platformName() { return 'Rumble'; }
  get platformColor() { return '#85c742'; }

  /**
   * Poll for new chat messages via the proxy.
   */
  async _pollMessages() {
    if (!this._polling || !this._streamId) return;

    const params = new URLSearchParams({ streamId: this._streamId });
    if (this._lastMessageId) params.set('after', this._lastMessageId);

    const url = `${this._proxyUrl}/rumble/messages?${params}`;

    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const data = await res.json();
      const messages = data.messages || data.data || [];
      const ts = Date.now();

      for (const item of messages) {
        const user = item.username || item.user?.username || 'unknown';
        const msg = item.text || item.message || '';
        const id = item.id || null;
        if (id) this._lastMessageId = id;

        if (this._onMessageCallback && msg) {
          this._onMessageCallback({ user, msg, ts });
        }
      }

      this._reconnectAttempt = 0;

      if (this._polling) {
        this._pollTimer = setTimeout(() => this._pollMessages(), this._pollIntervalMs);
      }
    } catch (e) {
      this._reconnectAttempt++;
      if (this._polling) {
        this._pollTimer = setTimeout(() => this._pollMessages(), 8000);
      }
    }
  }

  async connect(isReconnect) {
    const input = document.getElementById('channelInput');
    const raw = sanitize((input ? input.value : '').trim());
    if (!raw) { setStatus('Enter a Rumble stream ID or channel.', 'error'); return; }

    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = true;

    this._proxyUrl = (document.getElementById('rumbleProxyUrl')?.value || '').trim();
    if (!this._proxyUrl) {
      setStatus('Rumble requires a proxy URL (Firebase function). Configure in settings.', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    this._streamId = raw;
    this._lastMessageId = null;
    this._reconnectAttempt = 0;
    this._polling = true;

    document.body.classList.remove('disconnected');
    setStatus(`<span class="live-dot"></span>LIVE - RUMBLE (${raw.toUpperCase()})`, 'live');
    if (btn) btn.disabled = false;

    if (this._onStatusCallback) {
      this._onStatusCallback({ type: 'connected', channel: raw });
    }

    this._pollMessages();
  }

  disconnect() {
    this._polling = false;
    clearTimeout(this._pollTimer);
    this._streamId = '';
    this._lastMessageId = null;
    this._reconnectAttempt = 0;
    document.body.classList.remove('disconnected');
    setStatus('Disconnected.', '');
    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = false;
  }

  async sendMessage(channel, msg) {
    setStatus('Sending Rumble messages requires authentication (not yet supported).', 'error');
  }
}

export function createRumbleAdapter() {
  return new RumbleAdapter();
}
