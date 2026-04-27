/**
 * TwitchPubSub — singleton WebSocket manager for Twitch's private PubSub API.
 *
 * Topic-agnostic: callers pass a full topic string like `polls.<channel_id>`
 * or `predictions-channel-v1.<channel_id>`. Anonymous LISTENs work for both,
 * which is how twitch.tv shows poll/prediction popups to logged-out viewers.
 *
 * This is an UNOFFICIAL API. Twitch may change the protocol or schema at any
 * time without notice. All parsing is defensive and failures are logged but
 * never crash the renderer.
 *
 * One socket is shared across all subscribers; LISTEN frames carry every
 * subscribed topic. The socket is closed when the last subscriber leaves.
 */
import {
  TWITCH_PUBSUB_URL,
  PUBSUB_PING_INTERVAL_MS,
  RECONNECT_DELAY_MS
} from '../config.js';

class TwitchPubSubManager {
  constructor() {
    this._ws = null;
    this._connecting = false;
    /** @type {Map<string, Set<Function>>} topic -> set of callbacks */
    this._subs = new Map();
    this._pingTimer = null;
    this._reconnectTimer = null;
    this._reconnectAttempt = 0;
    this._lastError = '';
  }

  /** Subscribe a callback to a Twitch PubSub topic (e.g. `polls.123`). */
  subscribe(topic, cb) {
    if (!topic || typeof cb !== 'function') return;
    let set = this._subs.get(topic);
    if (!set) {
      set = new Set();
      this._subs.set(topic, set);
    }
    const wasEmpty = set.size === 0;
    set.add(cb);
    this._ensureConnected();
    if (wasEmpty && this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._sendListen(topic);
    }
  }

  /** Unsubscribe a callback. Closes the socket when no subscribers remain. */
  unsubscribe(topic, cb) {
    const set = this._subs.get(topic);
    if (!set) return;
    set.delete(cb);
    if (set.size === 0) {
      this._subs.delete(topic);
      if (this._ws && this._ws.readyState === WebSocket.OPEN) {
        try {
          this._ws.send(JSON.stringify({
            type: 'UNLISTEN',
            nonce: this._nonce(),
            data: { topics: [topic] }
          }));
        } catch { /* socket may be closing */ }
      }
    }
    if (this._subs.size === 0) {
      this._closeSocket();
    }
  }

  get lastError() { return this._lastError; }

  // -- internals --

  _ensureConnected() {
    if (this._ws || this._connecting) return;
    this._connecting = true;
    let ws;
    try {
      ws = new WebSocket(TWITCH_PUBSUB_URL);
    } catch (e) {
      this._connecting = false;
      this._lastError = 'PubSub connection failed: ' + (e && e.message);
      this._scheduleReconnect();
      return;
    }
    this._ws = ws;

    ws.onopen = () => {
      this._connecting = false;
      this._reconnectAttempt = 0;
      // Re-LISTEN every active topic on (re)connect.
      for (const topic of this._subs.keys()) this._sendListen(topic);
      // Client must ping at least every 5 minutes; we ping every 4.
      clearInterval(this._pingTimer);
      this._pingTimer = setInterval(() => this._sendPing(), PUBSUB_PING_INTERVAL_MS);
    };

    ws.onmessage = (ev) => this._handleFrame(ev.data);

    ws.onerror = () => {
      this._lastError = 'PubSub socket error';
    };

    ws.onclose = () => {
      this._connecting = false;
      this._ws = null;
      clearInterval(this._pingTimer);
      this._pingTimer = null;
      // Only reconnect if there are still subscribers waiting.
      if (this._subs.size > 0) this._scheduleReconnect();
    };
  }

  _sendListen(topic) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    try {
      this._ws.send(JSON.stringify({
        type: 'LISTEN',
        nonce: this._nonce(),
        data: { topics: [topic] }
      }));
    } catch (e) {
      this._lastError = 'PubSub LISTEN failed: ' + (e && e.message);
    }
  }

  _sendPing() {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
    try { this._ws.send(JSON.stringify({ type: 'PING' })); } catch { /* ignore */ }
  }

  _handleFrame(raw) {
    let frame;
    try { frame = JSON.parse(raw); } catch { return; }
    if (!frame || typeof frame !== 'object') return;

    if (frame.type === 'PONG') return;
    if (frame.type === 'PING') { this._sendPing(); return; }
    if (frame.type === 'RECONNECT') {
      // Twitch wants us to reconnect now.
      this._closeSocket();
      this._scheduleReconnect();
      return;
    }
    if (frame.type === 'RESPONSE') {
      if (frame.error) {
        this._lastError = 'PubSub LISTEN rejected: ' + frame.error;
        console.warn('[MoodRadar] Twitch PubSub error:', frame.error);
      }
      return;
    }
    if (frame.type !== 'MESSAGE' || !frame.data) return;

    const topic = frame.data.topic || '';
    if (!topic) return;

    let inner;
    try { inner = JSON.parse(frame.data.message); } catch {
      console.warn('[MoodRadar] Twitch PubSub: malformed inner message');
      return;
    }
    const cbs = this._subs.get(topic);
    if (!cbs || cbs.size === 0) return;
    for (const cb of cbs) {
      try { cb(inner); } catch (e) {
        console.warn('[MoodRadar] Twitch PubSub callback threw:', e && e.message);
      }
    }
  }

  _closeSocket() {
    clearInterval(this._pingTimer);
    this._pingTimer = null;
    clearTimeout(this._reconnectTimer);
    this._reconnectTimer = null;
    if (this._ws) {
      try { this._ws.close(); } catch { /* ignore */ }
      this._ws = null;
    }
  }

  _scheduleReconnect() {
    clearTimeout(this._reconnectTimer);
    if (this._subs.size === 0) return;
    this._reconnectAttempt++;
    // Bounded exponential backoff: 2s, 4s, 8s, ..., capped at RECONNECT_DELAY_MS.
    const delay = Math.min(RECONNECT_DELAY_MS, 1000 * Math.pow(2, this._reconnectAttempt));
    this._reconnectTimer = setTimeout(() => {
      if (this._subs.size > 0) this._ensureConnected();
    }, delay);
  }

  _nonce() {
    return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
  }
}

export const twitchPubSub = new TwitchPubSubManager();
