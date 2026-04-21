/**
 * YouTubeAdapter — YouTube Live Chat platform adapter.
 *
 * Connection strategy (ordered by preference):
 * 1. Innertube 'next' API via CORS proxy (no API key needed) — calls
 *    YouTube's internal JSON API to get a chat continuation token, then
 *    polls get_live_chat for messages. No HTML scraping needed.
 * 2. Scrape the live_chat page via CORS proxy as fallback.
 * 3. YouTube Data API v3 (requires user-provided API key) — last resort.
 *
 * Accepts: channel names, @handles, channel URLs, video URLs, bare video IDs.
 */
import { PlatformAdapter } from './PlatformAdapter.js';
import { sanitize, setStatus } from '../utils/dom.js';
import { fetchViaCorsProxy } from '../utils/cors.js';

const YT_API_KEY_STORAGE = 'moodradar_yt_apikey_v1';
const YT_INNERTUBE_KEY = 'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8';
const YT_CLIENT_VERSION = '2.20260414.01.00';

function _parseVideoId(input) {
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;
  const m = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/) ||
            input.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/) ||
            input.match(/youtube\.com\/live\/([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : null;
}

async function _resolveChannelToLive(input) {
  const raw = input.trim();
  const urls = [];
  if (/^https?:\/\//.test(raw)) urls.push(raw);
  const handle = raw.startsWith('@') ? raw : '@' + raw.replace(/\s+/g, '');
  urls.push('https://www.youtube.com/' + handle + '/live');
  urls.push('https://www.youtube.com/' + handle + '/streams');
  const slug = raw.replace(/^@/, '').replace(/\s+/g, '');
  urls.push('https://www.youtube.com/c/' + slug + '/live');

  for (const pageUrl of urls) {
    try {
      const res = await fetchViaCorsProxy(pageUrl, 12000);
      if (!res) continue;
      const html = await res.text();
      const liveMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"[^}]*?"isLive"\s*:\s*true/) ||
                        html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"[^}]*?"isLiveContent"\s*:\s*true/);
      if (liveMatch) return liveMatch[1];
      if (pageUrl.includes('/live')) {
        const vidMatch = html.match(/"videoId"\s*:\s*"([a-zA-Z0-9_-]{11})"/);
        if (vidMatch) return vidMatch[1];
      }
    } catch (e) { console.warn('[MoodRadar] YouTube channel resolve failed, trying next URL:', e.message); }
  }
  return null;
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

function _findContinuation(obj) {
  if (!obj) return null;
  try {
    const conts = obj.contents?.liveChatRenderer?.continuations;
    if (conts?.[0]) {
      return conts[0].invalidationContinuationData?.continuation ||
             conts[0].timedContinuationData?.continuation ||
             conts[0].reloadContinuationData?.continuation || null;
    }
  } catch { }
  try {
    const bar = obj.contents?.twoColumnWatchNextResults?.conversationBar;
    const conts = bar?.liveChatRenderer?.continuations;
    if (conts?.[0]) {
      return conts[0].reloadContinuationData?.continuation ||
             conts[0].invalidationContinuationData?.continuation ||
             conts[0].timedContinuationData?.continuation || null;
    }
  } catch { }
  return null;
}

export class YouTubeAdapter extends PlatformAdapter {
  constructor() {
    super();
    this._polling = false;
    this._pollTimer = null;
    this._videoId = '';
    this._reconnectAttempt = 0;
    this._continuation = null;
  }

  get isConnected() { return this._polling; }
  get platformName() { return 'YouTube'; }
  get platformColor() { return '#ff0000'; }

  async _getContinuationViaNext(videoId) {
    const body = JSON.stringify({
      context: { client: { clientName: 'WEB', clientVersion: YT_CLIENT_VERSION } },
      videoId
    });
    const res = await fetchViaCorsProxy(
      'https://www.youtube.com/youtubei/v1/next?key=' + YT_INNERTUBE_KEY,
      15000,
      { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
    );
    if (!res) return null;
    const data = await res.json();
    return _findContinuation(data);
  }

  async _getContinuationViaChatPage(videoId) {
    const res = await fetchViaCorsProxy(
      'https://www.youtube.com/live_chat?is_popout=1&v=' + videoId, 15000
    );
    if (!res) return null;
    const html = await res.text();
    const m = html.match(/(?:var\s+ytInitialData|window\["ytInitialData"\])\s*=\s*(\{.+?\});\s*<\/script>/s);
    if (!m) return null;
    try { return _findContinuation(JSON.parse(m[1])); } catch { return null; }
  }

  async _pollInnertube() {
    if (!this._polling) return;
    try {
      const body = JSON.stringify({
        context: { client: { clientName: 'WEB', clientVersion: YT_CLIENT_VERSION } },
        continuation: this._continuation
      });
      const res = await fetchViaCorsProxy(
        'https://www.youtube.com/youtubei/v1/live_chat/get_live_chat?key=' + YT_INNERTUBE_KEY,
        12000,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body }
      );
      if (!res) throw new Error('proxy failed');
      const data = await res.json();
      const liveChatCont = data.continuationContents?.liveChatContinuation;
      if (!liveChatCont) throw new Error('no chat data');

      const msgs = _extractMessages(liveChatCont.actions || []);
      const ts = Date.now();
      for (const m of msgs) {
        if (this._onMessageCallback) this._onMessageCallback({ user: m.user, msg: m.msg, ts, platform: 'youtube' });
      }

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
      console.warn('[MoodRadar] YouTube innertube poll failed, will retry:', e.message);
      this._reconnectAttempt++;
      if (this._reconnectAttempt < 5 && this._polling) {
        this._pollTimer = setTimeout(() => this._pollInnertube(), 8000);
      } else if (this._polling) {
        // Exhausted retries — surface a clear error so the slot doesn't hang
        this._polling = false;
        setStatus('YouTube chat lost connection (CORS proxy or API failure).', 'error');
        if (this._onStatusCallback) {
          this._onStatusCallback({ type: 'error', text: 'Lost connection' });
        }
      }
    }
  }

  async connect(channel, _isReconnect) {
    console.info('[MoodRadar][YouTube] YouTube connection uses unofficial methods. For compliant access, use a YouTube Data API v3 key.');
    const raw = sanitize(typeof channel === 'string' ? channel : '').trim();

    const btn = document.getElementById('connectBtn');
    const reportError = (text) => {
      setStatus(text, 'error');
      if (btn) btn.disabled = false;
      if (this._onStatusCallback) this._onStatusCallback({ type: 'error', text });
    };
    const reportProgress = (text) => {
      setStatus(text, '');
      if (this._onStatusCallback) this._onStatusCallback({ type: 'progress', text });
    };

    if (!raw) { reportError('Enter a channel name, @handle, or video URL.'); return; }

    if (btn) btn.disabled = true;

    let videoId = _parseVideoId(raw);
    if (!videoId) {
      reportProgress('Looking for live stream...');
      videoId = await _resolveChannelToLive(raw);
      if (!videoId) {
        reportError('No live stream found (channel offline, handle wrong, or CORS proxies blocked).');
        return;
      }
    }
    this._videoId = videoId;

    // Approach 1: innertube 'next' API
    reportProgress('Connecting to chat (innertube)...');
    let continuation = null;
    try { continuation = await this._getContinuationViaNext(videoId); } catch(e) { console.warn('[MoodRadar] YouTube innertube next API failed, trying chat page scrape:', e.message); }

    // Approach 2: scrape chat page
    if (!continuation) {
      reportProgress('Connecting to chat (page scrape)...');
      try { continuation = await this._getContinuationViaChatPage(videoId); } catch(e) { console.warn('[MoodRadar] YouTube chat page scrape failed:', e.message); }
    }

    if (continuation) {
      this._continuation = continuation;
      this._polling = true;
      this._reconnectAttempt = 0;
      document.body.classList.remove('disconnected');
      setStatus(`<span class="live-dot"></span>LIVE - YOUTUBE (${videoId})`, 'live');
      if (btn) btn.disabled = false;
      if (this._onStatusCallback) this._onStatusCallback({ type: 'connected', channel: videoId });
      this._pollInnertube();
      return;
    }

    // Approach 3: API key fallback (only if pre-saved)
    let apiKey = '';
    try { apiKey = localStorage.getItem(YT_API_KEY_STORAGE) || ''; } catch { }
    if (!apiKey) {
      reportError('Could not reach YouTube chat — all CORS proxies failed. A YouTube Data API v3 key is the only fallback.');
      console.warn('[MoodRadar][YouTube] No saved API key. To enable the Data API fallback, run in DevTools:\n  localStorage.setItem("' + YT_API_KEY_STORAGE + '", "<your-api-key>")\nGet a key at console.cloud.google.com (enable "YouTube Data API v3").');
      return;
    }

    reportProgress('Resolving via API key...');
    try {
      const res = await fetch(
        'https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&id=' + videoId + '&key=' + apiKey
      );
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const liveChatId = data.items?.[0]?.liveStreamingDetails?.activeLiveChatId;
      if (!liveChatId) { reportError('No active live chat found.'); return; }

      // Poll via Data API
      this._polling = true;
      this._reconnectAttempt = 0;
      document.body.classList.remove('disconnected');
      setStatus(`<span class="live-dot"></span>LIVE - YOUTUBE (${videoId})`, 'live');
      if (btn) btn.disabled = false;
      if (this._onStatusCallback) this._onStatusCallback({ type: 'connected', channel: videoId });

      let nextPageToken = null;
      const self = this;
      async function pollApiKey() {
        if (!self._polling) return;
        const params = 'liveChatId=' + liveChatId + '&part=snippet,authorDetails&maxResults=200&key=' + apiKey +
          (nextPageToken ? '&pageToken=' + nextPageToken : '');
        try {
          const r = await fetch('https://www.googleapis.com/youtube/v3/liveChat/messages?' + params);
          if (r.status === 403) {
            setStatus('Quota exceeded', 'error');
            self._polling = false;
            if (self._onStatusCallback) self._onStatusCallback({ type: 'error', text: 'Quota exceeded' });
            return;
          }
          if (!r.ok) throw new Error('HTTP ' + r.status);
          const d = await r.json();
          nextPageToken = d.nextPageToken || null;
          const interval = d.pollingIntervalMillis || 3000;
          const ts = Date.now();
          for (const item of (d.items || [])) {
            const user = item.authorDetails?.displayName || 'unknown';
            const msg = item.snippet?.displayMessage || '';
            if (self._onMessageCallback && msg) self._onMessageCallback({ user, msg, ts, platform: 'youtube' });
          }
          if (self._polling) self._pollTimer = setTimeout(pollApiKey, Math.max(interval, 2000));
        } catch (e) {
          console.warn('[MoodRadar] YouTube Data API poll failed, will retry:', e.message);
          if (self._polling) self._pollTimer = setTimeout(pollApiKey, 5000);
        }
      }
      pollApiKey();
    } catch (e) {
      console.warn('[MoodRadar] YouTube live chat resolution via API key failed:', e.message);
      reportError('Failed to resolve live chat via API key.');
      try { localStorage.removeItem(YT_API_KEY_STORAGE); } catch { }
    }
  }

  disconnect() {
    this._polling = false;
    clearTimeout(this._pollTimer);
    this._continuation = null;
    this._reconnectAttempt = 0;
    document.body.classList.remove('disconnected');
    setStatus('Disconnected.', '');
    const btn = document.getElementById('connectBtn');
    if (btn) btn.disabled = false;
  }

  async sendMessage(_channel, _msg) {
    setStatus('Sending YouTube messages requires OAuth (not yet supported).', 'error');
  }
}

export function createYouTubeAdapter() {
  return new YouTubeAdapter();
}
