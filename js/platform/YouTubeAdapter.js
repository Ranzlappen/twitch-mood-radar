/**
 * YouTubeAdapter — YouTube Live Chat platform adapter.
 *
 * Connection strategy (ordered by preference):
 * 1. Innertube API via CORS proxy (no API key needed) — scrapes the
 *    YouTube live chat page to extract a continuation token, then polls
 *    the internal innertube API for new messages.
 * 2. YouTube Data API v3 (requires user-provided API key) — classic
 *    approach using liveChatMessages endpoint.
 */
import { PlatformAdapter } from './PlatformAdapter.js';
import { sanitize, setStatus } from '../utils/dom.js';

const YT_API_KEY_STORAGE = 'moodradar_yt_apikey_v1';

/**
 * Fetch a URL with multiple CORS proxy fallbacks.
 * Supports POST via the fetchOptions parameter.
 */
async function fetchViaCorsProxy(url, timeoutMs, fetchOptions) {
  timeoutMs = timeoutMs || 10000;
  fetchOptions = fetchOptions || {};
  const isPost = fetchOptions.method && fetchOptions.method.toUpperCase() === 'POST';
  const attempts = isPost
    ? [url, 'https://corsproxy.io/?' + encodeURIComponent(url)]
    : [
        url,
        'https://corsproxy.io/?' + encodeURIComponent(url),
        'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
        'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
      ];
  for (const tryUrl of attempts) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const opts = { ...fetchOptions, signal: controller.signal };
      const res = await fetch(tryUrl, opts);
      clearTimeout(timer);
      if (res.ok) return res;
    } catch (e) { /* continue to next proxy */ }
  }
  return null;
}

// --- Innertube helpers ---

function _parseVideoId(input) {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const m = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
            input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
            input.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

/**
 * Resolve a channel name, @handle, or channel URL to the current live stream video ID.
 */
async function _resolveChannelToLive(input) {
  const raw = input.trim();
  const urls = [];

  if (/^https?:\/\//.test(raw)) urls.push(raw);
  const handle = raw.startsWith('@') ? raw : '@' + raw.replace(/\s+/g, '');
  urls.push('https://www.youtube.com/' + handle + '/live');
  urls.push('https://www.youtube.com/' + handle);
  const slug = raw.replace(/^@/, '').replace(/\s+/g, '');
  urls.push('https://www.youtube.com/c/' + slug + '/live');
  urls.push('https://www.youtube.com/c/' + encodeURIComponent(raw.replace(/^@/, '')) + '/live');

  for (const pageUrl of urls) {
    try {
      const res = await fetchViaCorsProxy(pageUrl, 15000);
      if (!res) continue;
      const html = await res.text();

      const liveMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"[^}]*?"isLive"\s*:\s*true/);
      if (liveMatch) return liveMatch[1];

      const canonMatch = html.match(/rel="canonical"\s+href="[^"]*[?&]v=([a-zA-Z0-9_-]{11})/);
      if (canonMatch && (html.includes('"isLive":true') || html.includes('"isLiveContent":true') || html.includes('LIVE_STREAM'))) {
        return canonMatch[1];
      }

      const watchMatch = html.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (watchMatch && (html.includes('"isLive":true') || html.includes('"isLiveContent":true'))) {
        return watchMatch[1];
      }

      if (pageUrl.includes('/live')) {
        const vidMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
        if (vidMatch) return vidMatch[1];
      }
    } catch (e) { /* try next URL */ }
  }
  return null;
}

function _parseInitialData(html) {
  const m = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*(\{.+?\});\s*<\/script>/s);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch (e) { return null; }
}

function _extractContinuation(data) {
  try {
    const conts = data.contents.liveChatRenderer.continuations;
    if (!conts?.[0]) return null;
    return conts[0].invalidationContinuationData?.continuation ||
           conts[0].timedContinuationData?.continuation ||
           conts[0].reloadContinuationData?.continuation || null;
  } catch (e) { return null; }
}

function _extractMessages(actions) {
  const msgs = [];
  for (const action of (actions || [])) {
    let item = action.addChatItemAction?.item;
    if (!item && action.replayChatItemAction?.actions?.[0]) {
      item = action.replayChatItemAction.actions[0].addChatItemAction?.item;
    }
    const renderer = item?.liveChatTextMessageRenderer || item?.liveChatPaidMessageRenderer;
    if (!renderer) continue;
    const user = renderer.authorName?.simpleText || 'unknown';
    const runs = renderer.message?.runs || [];
    const msg = runs.map(r => r.text || r.emoji?.emojiId || '').join('');
    if (msg) msgs.push({ user, msg });
  }
  return msgs;
}

export class YouTubeAdapter extends PlatformAdapter {
  constructor() {
    super();
    this._polling = false;
    this._pollTimer = null;
    this._videoId = '';
    this._reconnectAttempt = 0;
    this._mode = ''; // 'innertube' or 'apikey'
    // Innertube state
    this._innertubeKey = null;
    this._clientVersion = null;
    this._continuation = null;
    // API key state
    this._apiKey = '';
    this._liveChatId = null;
    this._nextPageToken = null;
  }

  get isConnected() { return this._polling; }
  get platformName() { return 'YouTube'; }
  get platformColor() { return '#ff0000'; }

  async _tryInnertube(videoId) {
    const chatPageUrl = 'https://www.youtube.com/live_chat?is_popout=1&v=' + videoId;
    const res = await fetchViaCorsProxy(chatPageUrl, 15000);
    if (!res) return false;

    const html = await res.text();
    const keyMatch = html.match(/"INNERTUBE_API_KEY"\s*:\s*"([^"]+)"/);
    const verMatch = html.match(/"clientVersion"\s*:\s*"([^"]+)"/);
    if (!keyMatch) return false;

    this._innertubeKey = keyMatch[1];
    this._clientVersion = verMatch ? verMatch[1] : '2.20240101.00.00';

    const initialData = _parseInitialData(html);
    if (!initialData) return false;

    this._continuation = _extractContinuation(initialData);
    if (!this._continuation) return false;

    // Process initial messages
    try {
      const actions = initialData.contents.liveChatRenderer.actions;
      const msgs = _extractMessages(actions);
      const ts = Date.now();
      for (const m of msgs) {
        if (this._onMessageCallback) this._onMessageCallback({ user: m.user, msg: m.msg, ts });
      }
    } catch (e) { /* no initial messages */ }

    this._mode = 'innertube';
    return true;
  }

  async _pollInnertube() {
    if (!this._polling) return;
    try {
      const body = JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: this._clientVersion } },
        continuation: this._continuation
      });
      const apiUrl = 'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=' + this._innertubeKey;
      const res = await fetchViaCorsProxy(apiUrl, 12000, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body
      });
      if (!res) throw new Error('proxy failed');
      const data = await res.json();
      const liveChatCont = data.continuationContents?.liveChatContinuation;
      if (!liveChatCont) throw new Error('no chat data');

      const msgs = _extractMessages(liveChatCont.actions || []);
      const ts = Date.now();
      for (const m of msgs) {
        if (this._onMessageCallback) this._onMessageCallback({ user: m.user, msg: m.msg, ts });
      }

      // Update continuation
      const conts = liveChatCont.continuations;
      if (conts?.[0]) {
        this._continuation =
          conts[0].invalidationContinuationData?.continuation ||
          conts[0].timedContinuationData?.continuation ||
          conts[0].reloadContinuationData?.continuation ||
          this._continuation;
      }

      let interval = 5000;
      if (conts?.[0]?.timedContinuationData?.timeoutMs) {
        interval = parseInt(conts[0].timedContinuationData.timeoutMs) || 5000;
      }

      this._reconnectAttempt = 0;
      if (this._polling) this._pollTimer = setTimeout(() => this._pollInnertube(), Math.max(interval, 2000));
    } catch (e) {
      this._reconnectAttempt++;
      if (this._reconnectAttempt < 5 && this._polling) {
        this._pollTimer = setTimeout(() => this._pollInnertube(), 8000);
      }
    }
  }

  async _pollApiKey() {
    if (!this._polling || !this._liveChatId) return;
    const params = new URLSearchParams({
      liveChatId: this._liveChatId,
      part: 'snippet,authorDetails',
      maxResults: '200',
      key: this._apiKey,
    });
    if (this._nextPageToken) params.set('pageToken', this._nextPageToken);

    try {
      const res = await fetch('https://www.googleapis.com/youtube/v3/liveChat/messages?' + params);
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
      const interval = data.pollingIntervalMillis || 3000;
      const ts = Date.now();
      for (const item of (data.items || [])) {
        const user = item.authorDetails?.displayName || 'unknown';
        const msg = item.snippet?.displayMessage || '';
        if (this._onMessageCallback && msg) {
          this._onMessageCallback({ user, msg, ts });
        }
      }
      this._reconnectAttempt = 0;
      if (this._polling) this._pollTimer = setTimeout(() => this._pollApiKey(), Math.max(interval, 2000));
    } catch (e) {
      this._reconnectAttempt++;
      if (this._polling) this._pollTimer = setTimeout(() => this._pollApiKey(), 5000);
    }
  }

  async connect(isReconnect) {
    const input = document.getElementById('channelInput');
    const raw = sanitize((input ? input.value : '').trim());
    if (!raw) { setStatus('Enter a channel name, @handle, or video URL.', 'error'); return; }

    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = true;

    // Try to parse as a direct video ID or video URL first
    let videoId = _parseVideoId(raw);

    // If not a video ID, treat as channel name/@handle and resolve to live stream
    if (!videoId) {
      setStatus('Looking for live stream...', '');
      videoId = await _resolveChannelToLive(raw);
      if (!videoId) {
        setStatus('No live stream found for this channel.', 'error');
        if (btn) btn.disabled = false;
        return;
      }
    }
    this._videoId = videoId;

    // --- Approach 1: Innertube (no API key) ---
    setStatus('Resolving YouTube live chat for: ' + videoId + '...', '');
    try {
      const ok = await this._tryInnertube(videoId);
      if (ok) {
        this._polling = true;
        this._reconnectAttempt = 0;
        document.body.classList.remove('disconnected');
        setStatus(`<span class="live-dot"></span>LIVE - YOUTUBE (${videoId})`, 'live');
        if (btn) btn.disabled = false;
        if (this._onStatusCallback) this._onStatusCallback({ type: 'connected', channel: videoId });
        this._pollInnertube();
        return;
      }
    } catch (e) { /* fall through */ }

    // --- Approach 2: API key fallback ---
    this._apiKey = '';
    try { this._apiKey = localStorage.getItem(YT_API_KEY_STORAGE) || ''; } catch(e) {}
    if (!this._apiKey) {
      this._apiKey = (prompt(
        'Could not connect via innertube (CORS).\n\n' +
        'Fallback: Enter a YouTube Data API v3 key.\n' +
        'Get one free at console.cloud.google.com\n' +
        '(enable "YouTube Data API v3").\n\n' +
        'Your key will be saved to localStorage.'
      ) || '').trim();
      if (!this._apiKey) {
        setStatus('No API key provided.', 'error');
        if (btn) btn.disabled = false;
        return;
      }
      try { localStorage.setItem(YT_API_KEY_STORAGE, this._apiKey); } catch(e) {}
    }

    setStatus('Resolving via API key...', '');
    try {
      const res = await fetch(
        'https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=' + videoId + '&key=' + this._apiKey
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      this._liveChatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId || null;
    } catch (e) {
      setStatus('Failed to resolve live chat. Check API key.', 'error');
      if (btn) btn.disabled = false;
      try { localStorage.removeItem(YT_API_KEY_STORAGE); } catch(e2) {}
      return;
    }

    if (!this._liveChatId) {
      setStatus('No active live chat found. Is the stream live?', 'error');
      if (btn) btn.disabled = false;
      return;
    }

    this._mode = 'apikey';
    this._polling = true;
    this._reconnectAttempt = 0;
    this._nextPageToken = null;
    document.body.classList.remove('disconnected');
    setStatus(`<span class="live-dot"></span>LIVE - YOUTUBE (${videoId})`, 'live');
    if (btn) btn.disabled = false;
    if (this._onStatusCallback) this._onStatusCallback({ type: 'connected', channel: videoId });
    this._pollApiKey();
  }

  disconnect() {
    this._polling = false;
    clearTimeout(this._pollTimer);
    this._liveChatId = null;
    this._nextPageToken = null;
    this._continuation = null;
    this._reconnectAttempt = 0;
    this._mode = '';
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
