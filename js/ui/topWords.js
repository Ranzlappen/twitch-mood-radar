// Top-10 substring frequency list — DOM renderer.
// Builds 10 rows once; mutations only touch textContent and a bar width on
// each update (no DOM churn, cheap on high-volume chats).

const ROWS = 10;
let listEl = null;
let rows = [];

function build() {
  listEl.innerHTML = '';
  rows = [];
  for (let i = 0; i < ROWS; i++) {
    const li = document.createElement('li');
    li.className = 'top-words-row';
    const rank = document.createElement('span'); rank.className = 'tw-rank'; rank.textContent = String(i + 1);
    const word = document.createElement('span'); word.className = 'tw-word'; word.textContent = '-';
    const count = document.createElement('span'); count.className = 'tw-count'; count.textContent = '';
    const barWrap = document.createElement('span'); barWrap.className = 'tw-bar-wrap';
    const bar = document.createElement('span'); bar.className = 'tw-bar'; bar.style.width = '0%';
    barWrap.appendChild(bar);
    li.appendChild(rank); li.appendChild(word); li.appendChild(count); li.appendChild(barWrap);
    listEl.appendChild(li);
    rows.push({ li, word, count, bar });
  }
}

export function initTopWords() {
  listEl = document.getElementById('topWordsList');
  if (!listEl) return;
  build();
}

export function updateTopWords(list) {
  if (!listEl || !rows.length) return;
  const maxCount = list[0]?.count || 1;
  for (let i = 0; i < ROWS; i++) {
    const r = rows[i];
    const entry = list[i];
    if (entry) {
      if (r.word.textContent !== entry.word) r.word.textContent = entry.word;
      const cStr = String(entry.count);
      if (r.count.textContent !== cStr) r.count.textContent = cStr;
      const pct = Math.max(2, Math.round((entry.count / maxCount) * 100));
      r.bar.style.width = pct + '%';
      r.li.classList.remove('tw-empty');
    } else {
      if (r.word.textContent !== '-') r.word.textContent = '-';
      if (r.count.textContent !== '') r.count.textContent = '';
      r.bar.style.width = '0%';
      r.li.classList.add('tw-empty');
    }
  }
}

export function clearTopWordsUI() {
  if (!listEl || !rows.length) return;
  for (const r of rows) {
    r.word.textContent = '-';
    r.count.textContent = '';
    r.bar.style.width = '0%';
    r.li.classList.add('tw-empty');
  }
}

// No-op placeholder so layout.js can call it symmetrically with the canvas
// modules. The DOM list is fully flow-sized; the card's aspect-ratio wrapper
// handles sizing automatically.
export function resizeTopWordsPanel() { /* intentional no-op */ }
