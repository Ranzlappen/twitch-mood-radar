/**
 * Wake Lock — prevents screen from dimming/locking while active.
 * Uses the Screen Wake Lock API (Chrome 84+, Edge 84+, Safari 16.4+).
 * Silently degrades on unsupported browsers.
 */

let wakeLockSentinel = null;

export async function requestWakeLock() {
  if (!('wakeLock' in navigator)) return;
  if (wakeLockSentinel) return; // already held
  try {
    wakeLockSentinel = await navigator.wakeLock.request('screen');
    wakeLockSentinel.addEventListener('release', () => {
      wakeLockSentinel = null;
    });
  } catch (e) {
    wakeLockSentinel = null;
  }
}

export async function releaseWakeLock() {
  if (wakeLockSentinel) {
    await wakeLockSentinel.release();
    wakeLockSentinel = null;
  }
}

export function isWakeLockActive() {
  return wakeLockSentinel !== null;
}
