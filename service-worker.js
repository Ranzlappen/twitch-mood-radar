/* Service Worker — Workbox via CDN */
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.3.0/workbox-sw.js');

if (workbox) {
  /* ---------- Precache critical shell ---------- */
  workbox.precaching.precacheAndRoute([
    { url: '/', revision: '1' },
    { url: '/index.html', revision: '1' },
    { url: '/styles.css', revision: '1' },
    { url: '/app.js', revision: '1' },
    { url: '/manifest.json', revision: '1' },
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

  /* ---------- Cleanup old caches on activate ---------- */
  workbox.precaching.cleanupOutdatedCaches();

  /* ---------- Claim clients immediately ---------- */
  self.skipWaiting();
  workbox.core.clientsClaim();

} else {
  console.warn('Workbox failed to load');
}
