/**
 * YouTubeAdapter — YouTube Live Chat platform adapter.
 *
 * Polls the YouTube Data API v3 liveChatMessages endpoint.
 * Requires either:
 *   - A Firebase proxy URL (recommended, hides API key server-side)
 *   - A user-provided API key (direct polling, exposed client-side)
 *
 * The user provides a YouTube Live video ID or URL, and the adapter
 * resolves the liveChatId from the video, then polls for messages.
 */
import { PlatformAdapter } from './PlatformAdapter.js';
import { sanitize, setStatus } from '../utils/dom.js';

export class YouTubeAdapter extends PlatformAdapter {
  constructor() {
    super();
    this._polling = false;
    this._pollTimer = null;
    this._pollIntervalMs = 3000; // YouTube recommends ~3s between polls
    this._liveChatId = null;
    this._nextPageToken = null;
    this._videoId = '';
    this._apiKey = '';
    this._proxyUrl = ''; // Firebase function URL
    this._reconnectAttempt = 0;
  }

  get isConnected() { return this._polling; }
  get platformName() { return 'YouTube'; }
  get platformColor() { return '#ff0000'; }

  /**
   * Extract video ID from various YouTube URL formats or plain ID.
   */
  _parseVideoId(input) {
    // Already a bare ID (11 chars)
    if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
    // youtube.com/watch?v=ID
    const urlMatch = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (urlMatch) return urlMatch[1];
    // youtu.be/ID
    const shortMatch = input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (shortMatch) return shortMatch[1];
    // youtube.com/live/ID
    const liveMatch = input.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
    if (liveMatch) return liveMatch[1];
    return null;
  }

  /**
   * Fetch the liveChatId for a given video ID.
   */
  async _resolveLiveChatId(videoId) {
    const url = this._proxyUrl
      ? `${this._proxyUrl}/youtube/liveChatId?videoId=${videoId}`
      : `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=${videoId}&key=${this._apiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();

      if (this._proxyUrl) {
        return data.liveChatId || null;
      }
      // Direct API response
      const items = data.items || [];
      if (items.length === 0) return null;
      return items[0]?.liveStreamingDetails?.activeLiveChatId || null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Poll for new chat messages.
   */
  async _pollMessages() {
    if (!this._polling || !this._liveChatId) return;

    const params = new URLSearchParams({
      liveChatId: this._liveChatId,
      part: 'snippet,authorDetails',
      maxResults: '200',
    });
    if (this._nextPageToken) params.set('pageToken', this._nextPageToken);

    const url = this._proxyUrl
      ? `${this._proxyUrl}/youtube/messages?${params}`
      : `https://www.googleapis.com/youtube/v3/liveChat/messages?${params}&key=${this._apiKey}`;

    try {
      const res = await fetch(url);
      if (!res.ok) {
        if (res.status === 403) {
          setStatus('YouTube API quota exceeded or stream ended.', 'error');
          this._polling = false;
          return;
        }
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      this._nextPageToken = data.nextPageToken || null;
      const interval = data.pollingIntervalMillis || this._pollIntervalMs;

      // Process messages
      const items = data.items || [];
      const ts = Date.now();
      for (const item of items) {
        const user = item.authorDetails?.displayName || 'unknown';
        const msg = item.snippet?.displayMessage || '';
        if (this._onMessageCallback && msg) {
          this._onMessageCallback({ user, msg, ts });
        }
      }

      // Schedule next poll
      if (this._polling) {
        this._pollTimer = setTimeout(() => this._pollMessages(), Math.max(interval, 2000));
      }
    } catch (e) {
      // Retry after delay
      this._reconnectAttempt++;
      if (this._reconnectAttempt < 5 && this._polling) {
        this._pollTimer = setTimeout(() => this._pollMessages(), 5000);
      } else {
        setStatus('YouTube polling failed after multiple retries.', 'error');
        this._polling = false;
      }
    }
  }

  /**
   * Connect to YouTube Live chat.
   * @param {boolean} isReconnect - If true, skip UI resets.
   */
  async connect(isReconnect) {
    const input = document.getElementById('channelInput');
    const raw = sanitize((input ? input.value : '').trim());
    if (!raw) { setStatus('Enter a YouTube video ID or URL.', 'error'); return; }

    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = true;

    // Check for API key or proxy URL
    this._apiKey = (document.getElementById('ytApiKey')?.value || '').trim();
    this._proxyUrl = (document.getElementById('ytProxyUrl')?.value || '').trim();

    if (!this._apiKey && !this._proxyUrl) {
      setStatus('YouTube requires an API key or proxy URL. Configure in settings.', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    const videoId = this._parseVideoId(raw);
    if (!videoId) {
      setStatus('Invalid YouTube video ID or URL.', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    this._videoId = videoId;
    setStatus('Resolving YouTube live chat for video: ' + videoId + '...', '');

    const liveChatId = await this._resolveLiveChatId(videoId);
    if (!liveChatId) {
      setStatus('Could not find active live chat for this video. Is the stream live?', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    this._liveChatId = liveChatId;
    this._nextPageToken = null;
    this._reconnectAttempt = 0;
    this._polling = true;

    document.body.classList.remove('disconnected');
    setStatus(`<span class="live-dot"></span>LIVE - YOUTUBE (${videoId})`, 'live');
    if (btn) btn.disabled = false;

    if (this._onStatusCallback) {
      this._onStatusCallback({ type: 'connected', channel: videoId });
    }

    // Start polling
    this._pollMessages();
  }

  disconnect() {
    this._polling = false;
    clearTimeout(this._pollTimer);
    this._liveChatId = null;
    this._nextPageToken = null;
    this._reconnectAttempt = 0;
    document.body.classList.remove('disconnected');
    setStatus('Disconnected.', '');
    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = false;
  }

  async sendMessage(channel, msg) {
    setStatus('Sending YouTube messages requires OAuth (not yet supported).', 'error');
  }
}

export function createYouTubeAdapter() {
  return new YouTubeAdapter();
}
