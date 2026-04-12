/**
 * Help modal — show/close help overlays and global Escape key handler.
 */
import { HELP_CONTENT } from '../config.js';

export function showHelp(key) {
  const h = HELP_CONTENT[key];
  if (!h) return;
  document.getElementById('helpTitle').textContent = h.title;
  document.getElementById('helpBody').innerHTML = h.body;
  document.getElementById('helpOverlay').classList.add('open');
}

export function closeHelp() {
  document.getElementById('helpOverlay').classList.remove('open');
}

/**
 * Attach Escape key handler that closes help, settings dropdown,
 * and options drawer.
 */
export function initHelpKeys() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeHelp();
      document.getElementById('settingsDropdown').classList.remove('open');
      document.getElementById('optionsDrawer').classList.remove('open');
      document.getElementById('optionsOverlay').classList.remove('open');
    }
  });
}
