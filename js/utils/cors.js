/**
 * Shared CORS proxy utility — tries multiple proxies for cross-origin requests.
 * Used by Kick, YouTube, and Rumble adapters.
 */

const GET_PROXIES = [
  (url) => url,
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url),
  (url) => 'https://cors.eu.org/' + url,
  (url) => 'https://proxy.cors.sh/' + url,
  (url) => 'https://cors.isomorphic-git.org/' + url,
  (url) => 'https://thingproxy.freeboard.io/fetch/' + url,
];

// POST-safe proxies (codetabs is GET-only)
const POST_PROXIES = [
  (url) => url,
  (url) => 'https://corsproxy.io/?url=' + encodeURIComponent(url),
  (url) => 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
  (url) => 'https://cors.eu.org/' + url,
  (url) => 'https://proxy.cors.sh/' + url,
  (url) => 'https://cors.isomorphic-git.org/' + url,
  (url) => 'https://thingproxy.freeboard.io/fetch/' + url,
];

/**
 * Fetch a URL with multiple CORS proxy fallbacks.
 * @param {string} url — the target URL
 * @param {number} [timeoutMs=10000] — per-attempt timeout
 * @param {RequestInit} [fetchOptions={}] — additional fetch options (method, headers, body)
 * @returns {Promise<Response|null>} — the first successful response, or null
 */
export async function fetchViaCorsProxy(url, timeoutMs, fetchOptions) {
  timeoutMs = timeoutMs || 10000;
  fetchOptions = fetchOptions || {};
  const isPost = fetchOptions.method && fetchOptions.method.toUpperCase() === 'POST';
  const proxies = isPost ? POST_PROXIES : GET_PROXIES;

  for (const buildUrl of proxies) {
    const tryUrl = buildUrl(url);
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const opts = { ...fetchOptions, signal: controller.signal };
      const res = await fetch(tryUrl, opts);
      clearTimeout(timer);
      if (res.ok) {
        if (tryUrl !== url) console.log('[MoodRadar] CORS proxy succeeded: ' + tryUrl.split('?')[0]);
        return res;
      }
      console.warn('[MoodRadar] Proxy returned HTTP ' + res.status + ': ' + tryUrl.split('?')[0]);
    } catch (e) {
      console.warn('[MoodRadar] Proxy failed (' + (e.name || 'error') + '): ' + tryUrl.split('?')[0]);
    }
  }
  console.error('[MoodRadar] All CORS proxies failed for: ' + url);
  return null;
}
