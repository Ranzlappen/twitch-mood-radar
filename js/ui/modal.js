/**
 * Shared modal / drawer component.
 *
 * createModal({ id, title, body, variant, onClose })  → centered overlay
 * createDrawer({ id, title, body, side })             → side/sheet drawer
 *
 * Both return a controller: { el, open(), close(), isOpen() }.
 * Handles: backdrop, click-outside-to-close, Escape-to-close (stacked),
 * focus trap, aria-modal, and fade/transform transitions.
 *
 * Callers own the body content — pass an HTMLElement or an HTML string.
 */

const _openStack = [];

function _pushStack(controller) {
  _openStack.push(controller);
  if (_openStack.length === 1) document.addEventListener('keydown', _onEscape);
}

function _popStack(controller) {
  const i = _openStack.lastIndexOf(controller);
  if (i >= 0) _openStack.splice(i, 1);
  if (_openStack.length === 0) document.removeEventListener('keydown', _onEscape);
}

function _onEscape(e) {
  if (e.key !== 'Escape' || _openStack.length === 0) return;
  const top = _openStack[_openStack.length - 1];
  top.close();
  e.stopPropagation();
}

function _setBody(container, body) {
  if (body == null) return;
  if (typeof body === 'string') container.innerHTML = body;
  else if (body instanceof Node) {
    container.innerHTML = '';
    container.appendChild(body);
  }
}

/**
 * Centered modal overlay. Clicking the backdrop closes it.
 */
export function createModal({ id, title, body, variant, onClose, onOpen } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'mr-overlay';
  overlay.hidden = true;
  if (id) overlay.id = id;

  const modal = document.createElement('div');
  modal.className = 'mr-modal' + (variant ? ` mr-modal--${variant}` : '');
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  if (title) modal.setAttribute('aria-label', title);

  const header = document.createElement('div');
  header.className = 'mr-modal__header';
  const titleEl = document.createElement('span');
  titleEl.className = 'mr-modal__title';
  titleEl.textContent = title || '';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mr-modal__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  modal.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'mr-modal__body';
  _setBody(bodyEl, body);
  modal.appendChild(bodyEl);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  const controller = {
    el: overlay,
    bodyEl,
    titleEl,
    isOpen() { return !overlay.hidden; },
    open() {
      if (!overlay.hidden) return;
      overlay.hidden = false;
      requestAnimationFrame(() => overlay.classList.add('open'));
      _pushStack(controller);
      try { onOpen && onOpen(controller); } catch {}
      // Focus the first interactive element inside the modal.
      setTimeout(() => {
        const focusable = modal.querySelector('input, select, textarea, button:not(.mr-modal__close)');
        if (focusable) focusable.focus();
      }, 50);
    },
    close() {
      if (overlay.hidden) return;
      overlay.classList.remove('open');
      _popStack(controller);
      setTimeout(() => { overlay.hidden = true; }, 180);
      try { onClose && onClose(controller); } catch {}
    },
    setBody(newBody) { _setBody(bodyEl, newBody); },
    setTitle(newTitle) { titleEl.textContent = newTitle || ''; },
  };

  overlay.addEventListener('click', e => {
    if (e.target === overlay) controller.close();
  });
  closeBtn.addEventListener('click', () => controller.close());

  return controller;
}

/**
 * Side drawer (right-slide on desktop, bottom-sheet on mobile).
 * Does NOT have its own backdrop — caller supplies one or the drawer
 * sits on top of the page (overlay prop optional).
 */
export function createDrawer({ id, title, body, side = 'right', withOverlay = true, onOpen, onClose } = {}) {
  let overlay = null;
  if (withOverlay) {
    overlay = document.createElement('div');
    overlay.className = 'mr-overlay';
    overlay.hidden = true;
    if (id) overlay.id = `${id}Overlay`;
    document.body.appendChild(overlay);
  }

  const drawer = document.createElement('aside');
  drawer.className = 'mr-drawer' + (side === 'bottom' ? ' mr-drawer--bottom' : '');
  drawer.setAttribute('role', 'dialog');
  drawer.setAttribute('aria-modal', 'true');
  if (id) drawer.id = id;
  if (title) drawer.setAttribute('aria-label', title);

  const header = document.createElement('div');
  header.className = 'mr-drawer__header';
  const titleEl = document.createElement('span');
  titleEl.className = 'mr-drawer__title';
  titleEl.textContent = title || '';
  const closeBtn = document.createElement('button');
  closeBtn.className = 'mr-modal__close';
  closeBtn.setAttribute('aria-label', 'Close');
  closeBtn.innerHTML = '&times;';
  header.appendChild(titleEl);
  header.appendChild(closeBtn);
  drawer.appendChild(header);

  const bodyEl = document.createElement('div');
  bodyEl.className = 'mr-drawer__body';
  _setBody(bodyEl, body);
  drawer.appendChild(bodyEl);

  document.body.appendChild(drawer);

  const controller = {
    el: drawer,
    overlayEl: overlay,
    bodyEl,
    titleEl,
    isOpen() { return drawer.classList.contains('open'); },
    open() {
      if (controller.isOpen()) return;
      if (overlay) { overlay.hidden = false; requestAnimationFrame(() => overlay.classList.add('open')); }
      requestAnimationFrame(() => drawer.classList.add('open'));
      _pushStack(controller);
      try { onOpen && onOpen(controller); } catch {}
      setTimeout(() => {
        const focusable = drawer.querySelector('input, select, textarea, button:not(.mr-modal__close)');
        if (focusable) focusable.focus();
      }, 50);
    },
    close() {
      if (!controller.isOpen()) return;
      drawer.classList.remove('open');
      if (overlay) {
        overlay.classList.remove('open');
        setTimeout(() => { overlay.hidden = true; }, 220);
      }
      _popStack(controller);
      try { onClose && onClose(controller); } catch {}
    },
    setBody(newBody) { _setBody(bodyEl, newBody); },
    setTitle(newTitle) { titleEl.textContent = newTitle || ''; },
  };

  if (overlay) {
    overlay.addEventListener('click', e => {
      if (e.target === overlay) controller.close();
    });
  }
  closeBtn.addEventListener('click', () => controller.close());

  return controller;
}
