/**
 * RumbleAdapter — Rumble.com platform adapter.
 *
 * Rumble only provides a REST API (no WebSocket). Chat messages are
 * fetched via polling.
 *
 * Connection strategy (ordered by preference):
 * 1. Try to scrape Rumble page via CORS proxies to find chat ID,
 *    then poll Rumble's chat API directly via CORS proxy.
 * 2. Fall back to a user-provided proxy server URL (saved in localStorage).
 *
 * Limitations:
 * - Polling-only (no real-time push)
 * - CORS proxies may be unreliable
 * - Limited API documentation
 */
import { PlatformAdapter } from './PlatformAdapter.js';
import { sanitize, setStatus } from '../utils/dom.js';

const RUMBLE_PROXY_STORAGE = 'moodradar_rumble_proxy_v1';

/**
 * Fetch a URL with multiple CORS proxy fallbacks.
 */
async function fetchViaCorsProxy(url, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  const attempts = [
    url,
    'https://corsproxy.io/?' + encodeURIComponent(url),
    'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
    'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
  ];
  for (const tryUrl of attempts) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const res = await fetch(tryUrl, { signal: controller.signal });
      clearTimeout(timer);
      if (res.ok) return res;
    } catch (e) { /* continue to next proxy */ }
  }
  return null;
}

export class RumbleAdapter extends PlatformAdapter {
  constructor() {
    super();
    this._polling = false;
    this._pollTimer = null;
    this._pollIntervalMs = 5000;
    this._streamId = '';
    this._proxyUrl = '';
    this._chatId = null;
    this._lastMessageId = null;
    this._seenIds = new Set();
    this._reconnectAttempt = 0;
    this._mode = ''; // 'direct' or 'proxy'
  }

  get isConnected() { return this._polling; }
  get platformName() { return 'Rumble'; }
  get platformColor() { return '#85c742'; }

  /**
   * Try to find a chat ID by scraping the Rumble page via CORS proxy.
   */
  async _resolveChatId(channelInput) {
    const pageUrls = [];
    if (channelInput.startsWith('http')) pageUrls.push(channelInput);
    if (/^v[a-z0-9]+$/i.test(channelInput)) pageUrls.push('https://rumble.com/' + channelInput);
    pageUrls.push(
      'https://rumble.com/' + encodeURIComponent(channelInput),
      'https://rumble.com/c/' + encodeURIComponent(channelInput),
      'https://rumble.com/user/' + encodeURIComponent(channelInput),
    );

    for (const pageUrl of pageUrls) {
      try {
        const res = await fetchViaCorsProxy(pageUrl, 12000);
        if (!res) continue;
        const html = await res.text();
        const m = html.match(/"chat_id"\s*:\s*(\d+)/) ||
                  html.match(/"chatId"\s*:\s*(\d+)/) ||
                  html.match(/data-chat-id="(\d+)"/) ||
                  html.match(/chatroom[_-]?id['"]\s*[:=]\s*['"]?(\d+)/i) ||
                  html.match(/"channel_id"\s*:\s*(\d+)/) ||
                  html.match(/chat\/api\/chat\/(\d+)/);
        if (m) return m[1];
      } catch (e) { /* try next URL */ }
    }
    return null;
  }

  /**
   * Poll for new chat messages — direct mode via CORS proxy.
   */
  async _pollDirect() {
    if (!this._polling || !this._chatId) return;
    try {
      const chatUrl = 'https://rumble.com/chat/api/chat/' + this._chatId + '/messages';
      const res = await fetchViaCorsProxy(chatUrl, 10000);
      if (!res) throw new Error('proxy failed');
      const data = await res.json();
      const messages = data.messages || data.data || (Array.isArray(data) ? data : []);
      const ts = Date.now();

      for (const item of messages) {
        const msgId = item.id || (item.time + '_' + (item.username || ''));
        if (this._seenIds.has(msgId)) continue;
        this._seenIds.add(msgId);
        if (this._seenIds.size > 2000) {
          const first = this._seenIds.values().next().value;
          this._seenIds.delete(first);
        }
        const user = item.username || item.user?.username || item.name || 'unknown';
        const msg = item.text || item.message || item.content || '';
        if (this._onMessageCallback && msg) {
          this._onMessageCallback({ user, msg, ts });
        }
      }
      this._reconnectAttempt = 0;
      if (this._polling) this._pollTimer = setTimeout(() => this._pollDirect(), this._pollIntervalMs);
    } catch (e) {
      this._reconnectAttempt++;
      if (this._reconnectAttempt < 5 && this._polling) {
        this._pollTimer = setTimeout(() => this._pollDirect(), 8000);
      }
    }
  }

  /**
   * Poll for new chat messages — proxy mode via custom server.
   */
  async _pollProxy() {
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
        if (item.id) this._lastMessageId = item.id;
        if (this._onMessageCallback && msg) {
          this._onMessageCallback({ user, msg, ts });
        }
      }
      this._reconnectAttempt = 0;
      if (this._polling) this._pollTimer = setTimeout(() => this._pollProxy(), this._pollIntervalMs);
    } catch (e) {
      this._reconnectAttempt++;
      if (this._reconnectAttempt < 5 && this._polling) {
        this._pollTimer = setTimeout(() => this._pollProxy(), 8000);
      }
    }
  }

  async connect(isReconnect) {
    const input = document.getElementById('channelInput');
    const raw = sanitize((input ? input.value : '').trim());
    if (!raw) { setStatus('Enter a Rumble stream ID or channel.', 'error'); return; }

    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = true;

    // --- Approach 1: Try to resolve chat ID from Rumble page ---
    setStatus('Resolving Rumble channel: ' + raw + '...', '');
    const chatId = await this._resolveChatId(raw);

    if (chatId) {
      this._chatId = chatId;
      this._streamId = raw;
      this._lastMessageId = null;
      this._seenIds.clear();
      this._reconnectAttempt = 0;
      this._polling = true;
      this._mode = 'direct';

      document.body.classList.remove('disconnected');
      setStatus(`<span class="live-dot"></span>LIVE - RUMBLE (${raw.toUpperCase()})`, 'live');
      if (btn) btn.disabled = false;
      if (this._onStatusCallback) this._onStatusCallback({ type: 'connected', channel: raw });
      this._pollDirect();
      return;
    }

    // --- Approach 2: Fall back to custom proxy URL ---
    let proxyUrl = '';
    try { proxyUrl = localStorage.getItem(RUMBLE_PROXY_STORAGE) || ''; } catch(e) {}
    if (!proxyUrl) {
      proxyUrl = (prompt(
        'Could not resolve Rumble chat directly (CORS).\n\n' +
        'Enter your proxy URL (e.g., https://your-proxy.web.app):\n' +
        'The proxy must implement: GET /rumble/messages?streamId=...\n' +
        'Your URL will be saved for future use.'
      ) || '').trim();
      if (!proxyUrl) {
        setStatus('No proxy URL configured.', 'error');
        if (btn) btn.disabled = false;
        return;
      }
      try { localStorage.setItem(RUMBLE_PROXY_STORAGE, proxyUrl); } catch(e) {}
    }

    this._proxyUrl = proxyUrl;
    this._streamId = raw;
    this._lastMessageId = null;
    this._reconnectAttempt = 0;
    this._polling = true;
    this._mode = 'proxy';

    document.body.classList.remove('disconnected');
    setStatus(`<span class="live-dot"></span>LIVE - RUMBLE (${raw.toUpperCase()})`, 'live');
    if (btn) btn.disabled = false;
    if (this._onStatusCallback) this._onStatusCallback({ type: 'connected', channel: raw });
    this._pollProxy();
  }

  disconnect() {
    this._polling = false;
    clearTimeout(this._pollTimer);
    this._streamId = '';
    this._chatId = null;
    this._lastMessageId = null;
    this._seenIds.clear();
    this._reconnectAttempt = 0;
    this._mode = '';
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
