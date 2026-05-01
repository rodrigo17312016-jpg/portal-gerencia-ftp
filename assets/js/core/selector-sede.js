/* ════════════════════════════════════════════════════════
   SELECTOR DE SEDE - Componente UI del topbar
   ════════════════════════════════════════════════════════
   Crea el botón pill + dropdown con todas las sedes.
   Al hacer click cambia la sede activa (sede-context).
   Reacciona a sede-changed para reflejar el estado actual.
   ════════════════════════════════════════════════════════ */

import { getAllSedesIncludingConsolidado } from '../config/sedes.js';
import {
  getSedeActiva,
  setSedeActiva,
  onSedeChange
} from './sede-context.js';

let _root = null;
let _btn = null;
let _menu = null;
let _isOpen = false;

export async function mountSelectorSede(container) {
  if (!container) return null;

  // Estructura
  const wrapper = document.createElement('div');
  wrapper.className = 'topbar-sede';
  wrapper.setAttribute('data-component', 'selector-sede');

  const sedeActual = getSedeActiva();
  const codigoActual = sedeActual ? sedeActual.codigo : '—';

  wrapper.innerHTML = `
    <button class="topbar-sede-btn" id="topbar-sede-btn"
            aria-haspopup="listbox" aria-expanded="false"
            aria-label="Seleccionar planta o sede">
      <span class="topbar-sede-icon" aria-hidden="true">${escapeHtml(sedeActual?.icono || '🏭')}</span>
      <span class="topbar-sede-label">
        <span class="topbar-sede-name">${escapeHtml(sedeActual?.nombreCorto || '—')}</span>
        <span class="topbar-sede-tipo">${escapeHtml(sedeBadgeTipo(sedeActual))}</span>
      </span>
      <span class="topbar-sede-caret" aria-hidden="true">▾</span>
    </button>
    <div class="topbar-sede-menu" id="topbar-sede-menu" role="listbox" hidden>
      <div class="topbar-sede-menu-header">Selecciona la planta</div>
      <div class="topbar-sede-menu-list" id="topbar-sede-menu-list"></div>
    </div>
  `;

  container.insertBefore(wrapper, container.firstChild);

  _root = wrapper;
  _btn = wrapper.querySelector('#topbar-sede-btn');
  _menu = wrapper.querySelector('#topbar-sede-menu');

  // Llenar menú
  await renderMenuItems();

  // Eventos
  _btn.addEventListener('click', toggleMenu);
  document.addEventListener('click', handleOutsideClick);
  document.addEventListener('keydown', handleEscape);

  // Reaccionar a cambios externos de sede
  onSedeChange((detail) => {
    updateButton(detail.sede);
    markActiveItem(detail.codigo);
    closeMenu();
  });

  return wrapper;
}

async function renderMenuItems() {
  const list = _menu.querySelector('#topbar-sede-menu-list');
  if (!list) return;

  const sedes = await getAllSedesIncludingConsolidado();
  const codigoActual = getSedeActiva()?.codigo;

  list.innerHTML = sedes.map(s => {
    const isAgregado = s.tipo === 'agregado';
    const isMaquila = s.tipo === 'maquila';
    const tipoBadge = isAgregado ? 'AGREGADO'
                    : isMaquila ? 'MAQUILA'
                    : 'PROPIA';
    const tipoClass = isAgregado ? 'is-agregado'
                    : isMaquila ? 'is-maquila'
                    : 'is-propia';

    return `
      <button class="topbar-sede-item ${tipoClass} ${s.codigo === codigoActual ? 'is-active' : ''}"
              data-codigo="${escapeHtml(s.codigo)}"
              role="option"
              aria-selected="${s.codigo === codigoActual ? 'true' : 'false'}">
        <span class="topbar-sede-item-icon" aria-hidden="true" style="background:${escapeHtml(s.color)}1f;color:${escapeHtml(s.color)}">
          ${escapeHtml(s.icono || '🏭')}
        </span>
        <span class="topbar-sede-item-text">
          <span class="topbar-sede-item-name">${escapeHtml(s.nombre)}</span>
          <span class="topbar-sede-item-meta">
            <span class="topbar-sede-item-badge ${tipoClass}">${tipoBadge}</span>
            ${s.ubicacion ? `<span class="topbar-sede-item-loc">${escapeHtml(s.ubicacion)}</span>` : ''}
          </span>
        </span>
        <span class="topbar-sede-item-check" aria-hidden="true">✓</span>
      </button>
    `;
  }).join('');

  // Cablear clicks
  list.querySelectorAll('.topbar-sede-item').forEach(btn => {
    btn.addEventListener('click', async () => {
      const codigo = btn.dataset.codigo;
      if (!codigo) return;
      await setSedeActiva(codigo);
    });
  });
}

function updateButton(sede) {
  if (!_btn || !sede) return;
  const icon = _btn.querySelector('.topbar-sede-icon');
  const name = _btn.querySelector('.topbar-sede-name');
  const tipo = _btn.querySelector('.topbar-sede-tipo');
  if (icon) icon.textContent = sede.icono || '🏭';
  if (name) name.textContent = sede.nombreCorto || sede.nombre || '—';
  if (tipo) tipo.textContent = sedeBadgeTipo(sede);

  // Color de borde por sede
  if (sede.color) _btn.style.setProperty('--sede-accent', sede.color);
}

function markActiveItem(codigo) {
  if (!_menu) return;
  _menu.querySelectorAll('.topbar-sede-item').forEach(item => {
    const isActive = item.dataset.codigo === codigo;
    item.classList.toggle('is-active', isActive);
    item.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
}

function toggleMenu(e) {
  e?.stopPropagation();
  _isOpen ? closeMenu() : openMenu();
}

function openMenu() {
  if (!_menu) return;
  _menu.hidden = false;
  _menu.classList.add('is-open');
  _btn?.setAttribute('aria-expanded', 'true');
  _isOpen = true;
}

function closeMenu() {
  if (!_menu) return;
  _menu.classList.remove('is-open');
  // Esperar animación antes de hidden=true
  setTimeout(() => {
    if (!_isOpen) _menu.hidden = true;
  }, 150);
  _btn?.setAttribute('aria-expanded', 'false');
  _isOpen = false;
}

function handleOutsideClick(e) {
  if (!_isOpen) return;
  if (!_root) return;
  if (_root.contains(e.target)) return;
  closeMenu();
}

function handleEscape(e) {
  if (e.key === 'Escape' && _isOpen) {
    closeMenu();
    _btn?.focus();
  }
}

function sedeBadgeTipo(sede) {
  if (!sede) return '';
  if (sede.tipo === 'agregado') return 'Vista global';
  if (sede.tipo === 'maquila') return 'Maquila';
  return 'Planta propia';
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
