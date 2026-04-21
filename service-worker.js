/* Service Worker — Workbox via CDN */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

if (workbox) {
  /* ---------- Precache critical shell ---------- */
  workbox.precaching.precacheAndRoute([
    { url: '/', revision: '22' },
    { url: '/index.html', revision: '22' },
    { url: '/css/main.css', revision: '3' },
    { url: '/css/tokens.css', revision: '1' },
    { url: '/css/layout.css', revision: '2' },
    { url: '/css/header.css', revision: '1' },
    { url: '/css/connect.css', revision: '7' },
    { url: '/css/cards.css', revision: '1' },
    { url: '/css/feeds.css', revision: '4' },
    { url: '/css/filter-modal.css', revision: '3' },
    { url: '/css/layout-mgr.css', revision: '1' },
    { url: '/css/presets.css', revision: '1' },
    { url: '/css/options-drawer.css', revision: '3' },
    { url: '/css/chat-input.css', revision: '1' },
    { url: '/css/emote-modal.css', revision: '2' },
    { url: '/css/link-modal.css', revision: '1' },
    // JS modules
    { url: '/js/app.js', revision: '12' },
    { url: '/js/config.js', revision: '11' },
    { url: '/js/state.js', revision: '4' },
    { url: '/js/processing.js', revision: '4' },
    // Utils
    { url: '/js/utils/dom.js', revision: '1' },
    { url: '/js/utils/color.js', revision: '1' },
    { url: '/js/utils/storage.js', revision: '1' },
    { url: '/js/utils/cors.js', revision: '2' },
    { url: '/js/utils/CircularBuffer.js', revision: '1' },
    { url: '/js/utils/urlSafety.js', revision: '1' },
    // Analysis
    { url: '/js/analysis/sentiment.js', revision: '2' },
    { url: '/js/analysis/approval.js', revision: '1' },
    { url: '/js/analysis/botDetector.js', revision: '1' },
    { url: '/js/analysis/ewma.js', revision: '1' },
    // Platform
    { url: '/js/platform/PlatformAdapter.js', revision: '1' },
    { url: '/js/platform/TwitchAdapter.js', revision: '2' },
    { url: '/js/platform/KickAdapter.js', revision: '6' },
    { url: '/js/platform/YouTubeAdapter.js', revision: '10' },
    { url: '/js/platform/RumbleAdapter.js', revision: '9' },
    { url: '/js/platform/ConnectionManager.js', revision: '3' },
    { url: '/js/platform/emotes.js', revision: '4' },
    // History (IndexedDB)
    { url: '/js/history/historyDb.js', revision: '1' },
    // UI
    { url: '/js/ui/charts.js', revision: '1' },
    { url: '/js/ui/bubbles.js', revision: '1' },
    { url: '/js/ui/feeds.js', revision: '5' },
    { url: '/js/ui/approval-meter.js', revision: '1' },
    { url: '/js/ui/options.js', revision: '5' },
    { url: '/js/ui/settings.js', revision: '1' },
    { url: '/js/ui/layout.js', revision: '2' },
    { url: '/js/ui/help.js', revision: '3' },
    { url: '/js/ui/wake-lock.js', revision: '1' },
    { url: '/js/ui/userHistoryModal.js', revision: '3' },
    { url: '/js/ui/filterBuilder.js', revision: '1' },
    { url: '/js/ui/chipInput.js', revision: '1' },
    { url: '/js/ui/emoteModal.js', revision: '1' },
    { url: '/js/ui/linkModal.js', revision: '1' },
    // Assets
    { url: '/manifest.json', revision: '2' },
    { url: '/icons/icon-192x192.png', revision: '1' },
    { url: '/icons/icon-512x512.png', revision: '1' }
  ]);

  /* ---------- Runtime caching strategies ---------- */

  // HTML — Network-first with cache fallback
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'document',
    new workbox.strategies.NetworkFirst({
      cacheName: 'html-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 7 * 24 * 60 * 60 })
      ]
    })
  );

  // CSS & JS — Cache-first
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'style' || request.destination === 'script',
    new workbox.strategies.CacheFirst({
      cacheName: 'static-assets',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 })
      ]
    })
  );

  // Images — Cache-first
  workbox.routing.registerRoute(
    ({ request }) => request.destination === 'image',
    new workbox.strategies.CacheFirst({
      cacheName: 'image-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 })
      ]
    })
  );

  // Google Fonts stylesheets — Stale-while-revalidate
  workbox.routing.registerRoute(
    ({ url }) => url.origin === 'https://fonts.googleapis.com',
    new workbox.strategies.StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
  );

  // Google Fonts webfont files — Cache-first (long-lived)
  workbox.routing.registerRoute(
    ({ url }) => url.origin === 'https://fonts.gstatic.com',
    new workbox.strategies.CacheFirst({
      cacheName: 'google-fonts-webfonts',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 }),
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
      ]
    })
  );

  // CDN scripts (Chart.js etc.) — Cache-first
  workbox.routing.registerRoute(
    ({ url }) => url.origin === 'https://cdn.jsdelivr.net',
    new workbox.strategies.CacheFirst({
      cacheName: 'cdn-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
      ]
    })
  );

  // Emote CDNs (Twitch, Kick, BTTV, 7TV, FFZ) — Cache-first
  workbox.routing.registerRoute(
    ({ url }) =>
      url.origin === 'https://static-cdn.jtvnw.net' ||
      url.origin === 'https://files.kick.com' ||
      url.origin === 'https://cdn.betterttv.net' ||
      url.origin === 'https://cdn.7tv.app' ||
      url.origin === 'https://cdn.frankerfacez.com',
    new workbox.strategies.CacheFirst({
      cacheName: 'emote-cache',
      plugins: [
        new workbox.expiration.ExpirationPlugin({ maxEntries: 500, maxAgeSeconds: 30 * 24 * 60 * 60 }),
        new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] })
      ]
    })
  );

  /* ---------- Cleanup old caches on activate ---------- */
  workbox.precaching.cleanupOutdatedCaches();

  /* ---------- Claim clients immediately ---------- */
  self.skipWaiting();
  workbox.core.clientsClaim();

} else {
  console.warn('Workbox failed to load');
}
