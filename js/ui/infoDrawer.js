/**
 * Per-module Info Drawer.
 *
 * Every card title bar gets one "ⓘ" button that opens a module-scoped
 * drawer with two sections:
 *   1. ABOUT — description of the module (from HELP_CONTENT in config.js)
 *   2. SETTINGS — controls that affect ONLY this module
 *
 * Modules can register their settings content via registerModuleSettings(moduleId, fn)
 * where fn receives the body container element and populates it. This keeps each
 * module's settings code local to that module's UI file.
 */

import { createDrawer } from './modal.js';
import { HELP_CONTENT } from '../config.js';

// Map card DOM ids to HELP_CONTENT keys.
const MODULE_HELP_KEY = {
  pieCard: 'mood',
  topWordsCard: 'topWords',
  bubbleCard: 'bubbles',
  approvalCard: 'approval',
  feedCard: 'feed',
  filteredFeedCard: 'filteredFeed',
  outlierCard: 'outlier',
  chatInputCard: 'chatAuth',
  approvalTimelineCard: 'approval',
  throughputTimelineCard: 'feed',
  timelineLinearCard: 'mood',
  timelineLogCard: 'mood',
};

const _drawer = { controller: null };
const _moduleSettingsBuilders = new Map(); // moduleId -> (containerEl) => void
const _moduleTitles = new Map();           // moduleId -> display title

export function registerModuleSettings(moduleId, buildFn, { title } = {}) {
  _moduleSettingsBuilders.set(moduleId, buildFn);
  if (title) _moduleTitles.set(moduleId, title);
}

function _ensureDrawer() {
  if (_drawer.controller) return _drawer.controller;
  _drawer.controller = createDrawer({
    id: 'infoDrawer',
    title: 'MODULE',
    body: '',
    side: 'right',
    withOverlay: true,
  });
  return _drawer.controller;
}

export function openInfoDrawer(moduleId) {
  const ctrl = _ensureDrawer();
  const title = _moduleTitles.get(moduleId) || moduleId || 'MODULE';
  ctrl.setTitle(title);

  // Rebuild body each open so settings reflect current state.
  ctrl.bodyEl.innerHTML = '';

  // ── ABOUT section ───────────────────────────────
  const helpKey = MODULE_HELP_KEY[moduleId] || moduleId;
  const help = HELP_CONTENT && HELP_CONTENT[helpKey];
  if (help && help.body) {
    const section = document.createElement('section');
    section.className = 'mr-modal__section';
    const h = document.createElement('div');
    h.className = 'mr-modal__section-title';
    h.textContent = 'About this module';
    const body = document.createElement('div');
    body.className = 'mr-modal__help-text';
    body.innerHTML = help.body;
    section.appendChild(h);
    section.appendChild(body);
    ctrl.bodyEl.appendChild(section);
  }

  // ── SETTINGS section ───────────────────────────
  const build = _moduleSettingsBuilders.get(moduleId);
  if (build) {
    const section = document.createElement('section');
    section.className = 'mr-modal__section';
    const h = document.createElement('div');
    h.className = 'mr-modal__section-title';
    h.textContent = 'Settings';
    const body = document.createElement('div');
    body.style.cssText = 'display:flex;flex-direction:column;gap:10px';
    section.appendChild(h);
    section.appendChild(body);
    ctrl.bodyEl.appendChild(section);
    try { build(body); } catch (err) { console.error('infoDrawer build failed for', moduleId, err); }
  }

  ctrl.open();
}

export function closeInfoDrawer() {
  if (_drawer.controller) _drawer.controller.close();
}

/**
 * Add an "ⓘ" button to a card's title bar that opens its module drawer.
 * Returns the button element (already attached to the container).
 */
export function attachInfoButton(container, moduleId, { title } = {}) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'card-info-btn';
  btn.setAttribute('aria-label', `${title || moduleId} info & settings`);
  btn.title = `${title || moduleId} info & settings`;
  btn.textContent = 'ⓘ';
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    openInfoDrawer(moduleId);
  });
  if (title) _moduleTitles.set(moduleId, title);
  container.appendChild(btn);
  return btn;
}
