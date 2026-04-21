// Stopword editor modal — lets the user add extra stopwords and remove
// words from the default list. State is persisted to localStorage and pushed
// into the topWords engine via setStopwordOverrides().

import { load, save } from '../utils/storage.js';
import { createChipInput } from './chipInput.js';
import { setStopwordOverrides } from '../analysis/topWords.js';
import { DEFAULT_STOPWORDS } from '../analysis/stopwords.js';

const STORAGE_KEY = 'mr.topwords.stopwords.v1';

let addedChips = null;
let removedChips = null;
let loaded = null;

function readPersisted() {
  const raw = load(STORAGE_KEY, { add: [], remove: [] }) || {};
  const add = Array.isArray(raw.add) ? raw.add.map(s => String(s).toLowerCase()) : [];
  const remove = Array.isArray(raw.remove) ? raw.remove.map(s => String(s).toLowerCase()) : [];
  return { add, remove };
}

function persist(state) {
  save(STORAGE_KEY, state);
  setStopwordOverrides(state);
}

// Called once at app boot — pushes persisted overrides into the engine so the
// list takes effect before any messages are processed.
export function loadStopwordOverrides() {
  loaded = readPersisted();
  setStopwordOverrides(loaded);
  return loaded;
}

function ensureDom() {
  if (document.getElementById('stopwordsOverlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'stopwordsOverlay';
  overlay.className = 'help-overlay stopwords-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'stopwordsTitle');
  overlay.hidden = true;
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  overlay.innerHTML = `
    <div class="help-modal stopwords-modal">
      <button class="help-close" id="stopwordsClose" aria-label="Close stopword editor">x</button>
      <h3 id="stopwordsTitle">STOPWORDS</h3>
      <p class="stopwords-hint">These words are ignored by the top-10 substring counter. Add words you don't want to see in the list, or remove words from the default list that you do want counted.</p>
      <div class="stopwords-field">
        <span class="stopwords-field-label">ADD EXTRA STOPWORDS</span>
        <div id="stopwordsAddChips"></div>
      </div>
      <div class="stopwords-field">
        <span class="stopwords-field-label">UNBLOCK DEFAULT STOPWORDS</span>
        <div id="stopwordsRemoveChips"></div>
      </div>
      <div class="stopwords-actions">
        <button type="button" class="stopwords-reset" id="stopwordsReset">Reset to defaults</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  document.getElementById('stopwordsClose').addEventListener('click', close);
  document.getElementById('stopwordsReset').addEventListener('click', () => {
    addedChips.setChips([]);
    removedChips.setChips([]);
    persist({ add: [], remove: [] });
  });

  const cur = loaded || readPersisted();

  addedChips = createChipInput(document.getElementById('stopwordsAddChips'), {
    placeholder: 'type a word, press Enter',
    onChange: chips => {
      const state = readPersisted();
      state.add = chips.map(s => s.toLowerCase());
      persist(state);
    }
  });
  addedChips.setChips(cur.add);

  removedChips = createChipInput(document.getElementById('stopwordsRemoveChips'), {
    placeholder: 'word from the default list to unblock',
    onChange: chips => {
      const state = readPersisted();
      state.remove = chips.map(s => s.toLowerCase()).filter(w => DEFAULT_STOPWORDS.has(w));
      persist(state);
    }
  });
  removedChips.setChips(cur.remove);
}

export function openStopwordsModal() {
  ensureDom();
  const overlay = document.getElementById('stopwordsOverlay');
  overlay.hidden = false;
  overlay.classList.add('open');
}

function close() {
  const overlay = document.getElementById('stopwordsOverlay');
  if (!overlay) return;
  overlay.classList.remove('open');
  overlay.hidden = true;
}

export function closeStopwordsModal() { close(); }
