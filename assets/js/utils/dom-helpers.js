/* ════════════════════════════════════════════════════════
   DOM HELPERS - Toast, Modales, Confirmaciones
   ════════════════════════════════════════════════════════ */

// ── Toast Notifications ──
let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

export function showToast(message, type = 'success', duration = 3000) {
  const container = ensureToastContainer();
  const icons = { success: '\u2705', error: '\u274C', warning: '\u26A0\uFE0F', info: '\u2139\uFE0F' };

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span style="font-size:18px">${icons[type] || ''}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">\u00D7</button>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ── Modal ──
export function showModal(title, content, actions = []) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const actionsHTML = actions.map(a =>
    `<button class="btn ${a.class || 'btn-secondary'}" data-action="${a.id}">${a.label}</button>`
  ).join('');

  overlay.innerHTML = `
    <div class="modal">
      <h3 class="modal-title">${title}</h3>
      <div class="modal-body">${content}</div>
      <div class="modal-actions">
        <button class="btn btn-secondary" data-action="close">Cerrar</button>
        ${actionsHTML}
      </div>
    </div>
  `;

  overlay.addEventListener('click', (e) => {
    const action = e.target.dataset.action;
    if (action === 'close' || e.target === overlay) {
      overlay.remove();
      return;
    }
    if (action) {
      const handler = actions.find(a => a.id === action);
      if (handler && handler.onClick) handler.onClick();
      overlay.remove();
    }
  });

  document.body.appendChild(overlay);
  return overlay;
}

// ── Confirm Dialog ──
export function showConfirm(message) {
  return new Promise(resolve => {
    showModal('Confirmar', `<p style="color:var(--texto);font-size:14px">${message}</p>`, [
      { id: 'confirm', label: 'Confirmar', class: 'btn-primary', onClick: () => resolve(true) }
    ]);
    // Si se cierra sin confirmar
    const overlay = document.querySelector('.modal-overlay:last-child');
    if (overlay) {
      overlay.addEventListener('click', (e) => {
        if (e.target === overlay || e.target.dataset.action === 'close') resolve(false);
      }, { once: true });
    }
  });
}

// ── Helpers DOM ──
export function $(selector, parent = document) {
  return parent.querySelector(selector);
}

export function $$(selector, parent = document) {
  return [...parent.querySelectorAll(selector)];
}

export function createElement(tag, attrs = {}, children = '') {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === 'className') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  });
  if (typeof children === 'string') el.innerHTML = children;
  else if (children instanceof Element) el.appendChild(children);
  return el;
}
