/**
 * Chip-input widget — user types a term, presses Enter/comma, it becomes a
 * removable chip. Backspace on empty input removes the last chip.
 *
 * Keeps its state internally and surfaces it via getChips() / setChips(),
 * notifying consumers through onChange on every mutation.
 */

export function createChipInput(container, { placeholder = '', onChange = null } = {}) {
  container.classList.add('chip-input');
  container.innerHTML = '';

  const chipsWrap = document.createElement('span');
  chipsWrap.className = 'chip-input-chips';
  container.appendChild(chipsWrap);

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'chip-input-field';
  input.spellcheck = false;
  input.autocomplete = 'off';
  input.placeholder = placeholder;
  container.appendChild(input);

  let chips = [];

  function render() {
    chipsWrap.innerHTML = '';
    for (let i = 0; i < chips.length; i++) {
      const term = chips[i];
      const chip = document.createElement('span');
      chip.className = 'chip';
      const label = document.createElement('span');
      label.className = 'chip-label';
      label.textContent = term;
      chip.appendChild(label);
      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'chip-remove';
      rm.setAttribute('aria-label', `Remove ${term}`);
      rm.textContent = '×';
      rm.addEventListener('mousedown', (e) => e.preventDefault());
      rm.addEventListener('click', () => removeAt(i));
      chip.appendChild(rm);
      chipsWrap.appendChild(chip);
    }
  }

  function notify() { if (onChange) onChange(chips.slice()); }

  function commit(term) {
    const t = String(term || '').trim();
    if (!t) return false;
    if (chips.includes(t)) { input.value = ''; return false; }
    chips.push(t);
    input.value = '';
    render();
    notify();
    return true;
  }

  function removeAt(i) {
    if (i < 0 || i >= chips.length) return;
    chips.splice(i, 1);
    render();
    notify();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commit(input.value);
    } else if (e.key === 'Backspace' && !input.value && chips.length) {
      e.preventDefault();
      removeAt(chips.length - 1);
    }
  });
  input.addEventListener('blur', () => {
    if (input.value.trim()) commit(input.value);
  });

  container.addEventListener('click', (e) => {
    if (e.target === container || e.target === chipsWrap) input.focus();
  });

  return {
    getChips: () => chips.slice(),
    setChips: (next) => {
      chips = Array.isArray(next) ? next.map(String).map(s => s.trim()).filter(Boolean) : [];
      render();
    },
    focus: () => input.focus(),
    element: container,
  };
}
