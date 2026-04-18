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
 * options drawer, and the user-history modal.
 */
export function initHelpKeys() {
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      closeHelp();
      document.getElementById('settingsDropdown').classList.remove('open');
      document.getElementById('optionsDrawer').classList.remove('open');
      document.getElementById('optionsOverlay').classList.remove('open');
      const userHist = document.getElementById('userHistoryOverlay');
      if (userHist && userHist.classList.contains('open')) {
        userHist.classList.remove('open');
        userHist.hidden = true;
      }
      const filterOv = document.getElementById('filterOverlay');
      if (filterOv && filterOv.classList.contains('open')) {
        if (typeof window.closeFilterModal === 'function') window.closeFilterModal();
        else { filterOv.classList.remove('open'); filterOv.hidden = true; }
      }
    }
  });
}
