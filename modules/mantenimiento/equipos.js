/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - EQUIPOS & ACTIVOS
   Inventario maestro de equipos de la planta.
   ════════════════════════════════════════════════════════ */

import { fmt } from '../../assets/js/utils/formatters.js';
import { createExportButton } from '../../assets/js/utils/export-helpers.js';
import { getMantData, saveMantData } from './data-mock.js';
import { addDemoBanner } from '../../assets/js/utils/demo-banner.js';

let refreshTimer = null;
let state = {
  search: '',
  areas: new Set(),
  estados: new Set(),
  criticidades: new Set()
};

export async function init(container) {
  addDemoBanner(container);
  wireFilters(container);
  wireSearch(container);
  wireButtons(container);
  wireModal(container);
  injectExportButton(container);
  loadAll(container);

  // Auto refresh 60s
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const c = document.getElementById('panel-equipos') || container;
    if (c && c.isConnected) loadAll(c);
  }, 60000);
}

function injectExportButton(container) {
  if (container.querySelector('.ftp-export-btn')) return;
  const legacyBtn = container.querySelector('#btn-export-equipos');
  const target = legacyBtn?.parentElement
    || container.querySelector('.card-header');
  if (!target) return;

  const btn = createExportButton({
    getData: () => {
      const data = getMantData();
      return applyFilters(data.equipos).map(e => ({
        codigo: e.codigo,
        nombre: e.nombre,
        area: e.area,
        tipo: e.tipo,
        criticidad: e.criticidad,
        estado: e.estado,
        horas_operacion: e.horasUso,
        fabricante: e.fabricante || '',
        modelo: e.modelo || '',
        anio: e.anio || '',
        ultimo_mant: e.ultimaFalla || ''
      }));
    },
    filename: 'equipos',
    sheetName: 'Equipos',
    columns: [
      { key: 'codigo', label: 'Codigo' },
      { key: 'nombre', label: 'Nombre' },
      { key: 'area', label: 'Area' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'criticidad', label: 'Criticidad' },
      { key: 'estado', label: 'Estado' },
      { key: 'horas_operacion', label: 'Horas Operacion' },
      { key: 'fabricante', label: 'Fabricante' },
      { key: 'modelo', label: 'Modelo' },
      { key: 'anio', label: 'Anio' },
      { key: 'ultimo_mant', label: 'Ultimo Mant.' }
    ]
  });

  if (legacyBtn) legacyBtn.parentNode.insertBefore(btn, legacyBtn);
  else target.appendChild(btn);
}

export function refresh() {
  const c = document.getElementById('panel-equipos');
  if (c) loadAll(c);
}

// ════════════════════════════════════════════════════════
// LOADERS
// ════════════════════════════════════════════════════════
function loadAll(container) {
  const data = getMantData();
  renderKpis(container, data);
  renderTable(container, data);
}

function renderKpis(container, data) {
  const total = data.equipos.length;
  const op = data.equipos.filter(e => e.estado === 'operativo').length;
  const al = data.equipos.filter(e => e.estado === 'alerta').length;
  const fa = data.equipos.filter(e => e.estado === 'falla').length;
  setText(container, 'kpi-eq-total', fmt(total));
  setText(container, 'kpi-eq-operativos', fmt(op));
  setText(container, 'kpi-eq-alerta', fmt(al));
  setText(container, 'kpi-eq-falla', fmt(fa));
}

function renderTable(container, data) {
  const tbody = container.querySelector('#tbl-equipos');
  const sub = container.querySelector('#eq-count-sub');
  if (!tbody) return;

  const filtered = applyFilters(data.equipos);

  if (sub) sub.textContent = `Mostrando ${filtered.length} de ${data.equipos.length} equipos`;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:30px">🔍 No se encontraron equipos con los filtros aplicados</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(e => {
    const critBadge = critToBadge(e.criticidad);
    const estadoBadge = estadoToBadge(e.estado);
    return `<tr>
      <td><strong>${escapeHtml(e.codigo)}</strong></td>
      <td>${escapeHtml(e.nombre)}</td>
      <td>${escapeHtml(e.area)}</td>
      <td>${escapeHtml(e.tipo)}</td>
      <td>${critBadge}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${fmt(e.horasUso)}</td>
      <td><div style="font-weight:600">${escapeHtml(e.fabricante || '-')}</div><div style="font-size:12px;color:var(--muted)">${escapeHtml(e.modelo || '-')}</div></td>
      <td>${escapeHtml(e.anio || '-')}</td>
      <td>${estadoBadge}</td>
      <td style="text-align:center"><button class="btn btn-sm btn-secondary" data-eq-ver="${escapeHtml(e.codigo)}">📄 Ver ficha</button></td>
    </tr>`;
  }).join('');

  // Wire "ver ficha"
  tbody.querySelectorAll('[data-eq-ver]').forEach(btn => {
    btn.addEventListener('click', () => openFicha(container, btn.dataset.eqVer));
  });
}

function applyFilters(equipos) {
  return equipos.filter(e => {
    if (state.search) {
      const q = state.search.toLowerCase();
      const hay = `${e.codigo} ${e.nombre} ${e.fabricante || ''} ${e.modelo || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (state.areas.size > 0 && !state.areas.has(e.area)) return false;
    if (state.estados.size > 0 && !state.estados.has(e.estado)) return false;
    if (state.criticidades.size > 0 && !state.criticidades.has(e.criticidad)) return false;
    return true;
  });
}

// ════════════════════════════════════════════════════════
// FILTROS Y EVENTOS
// ════════════════════════════════════════════════════════
function wireFilters(container) {
  // Chip "Todos" resetea todos los filtros de chips
  const allChip = container.querySelector('[data-eq-filter="all"]');
  if (allChip) {
    allChip.addEventListener('click', () => {
      state.areas.clear();
      state.estados.clear();
      state.criticidades.clear();
      container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      allChip.classList.add('active');
      renderTable(container, getMantData());
    });
  }

  // Areas (multi-select)
  container.querySelectorAll('[data-eq-area]').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.eqArea;
      if (state.areas.has(v)) { state.areas.delete(v); chip.classList.remove('active'); }
      else { state.areas.add(v); chip.classList.add('active'); }
      if (allChip) allChip.classList.remove('active');
      renderTable(container, getMantData());
    });
  });

  // Estados
  container.querySelectorAll('[data-eq-estado]').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.eqEstado;
      if (state.estados.has(v)) { state.estados.delete(v); chip.classList.remove('active'); }
      else { state.estados.add(v); chip.classList.add('active'); }
      if (allChip) allChip.classList.remove('active');
      renderTable(container, getMantData());
    });
  });

  // Criticidades
  container.querySelectorAll('[data-eq-crit]').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.eqCrit;
      if (state.criticidades.has(v)) { state.criticidades.delete(v); chip.classList.remove('active'); }
      else { state.criticidades.add(v); chip.classList.add('active'); }
      if (allChip) allChip.classList.remove('active');
      renderTable(container, getMantData());
    });
  });
}

function wireSearch(container) {
  const input = container.querySelector('#eq-search');
  if (!input) return;
  let tmr = null;
  input.addEventListener('input', () => {
    clearTimeout(tmr);
    tmr = setTimeout(() => {
      state.search = input.value.trim();
      renderTable(container, getMantData());
    }, 180);
  });
}

function wireButtons(container) {
  const exp = container.querySelector('#btn-export-equipos');
  if (exp) exp.addEventListener('click', () => exportCsv(container));
  const nuevo = container.querySelector('#btn-nuevo-equipo');
  if (nuevo) nuevo.addEventListener('click', () => openNew(container));

  const save = container.querySelector('#eq-save-new');
  if (save) save.addEventListener('click', () => saveNew(container));
}

function wireModal(container) {
  // Ficha tecnica: cerrar
  container.querySelectorAll('[data-eq-close]').forEach(el => {
    el.addEventListener('click', () => closeFicha(container));
  });
  // Nuevo: cerrar
  container.querySelectorAll('[data-eq-close-new]').forEach(el => {
    el.addEventListener('click', () => closeNew(container));
  });
  // Cerrar con ESC
  document.addEventListener('keydown', onEsc);

  function onEsc(e) {
    if (e.key === 'Escape') {
      closeFicha(container);
      closeNew(container);
    }
  }
}

// ════════════════════════════════════════════════════════
// MODAL FICHA TECNICA
// ════════════════════════════════════════════════════════
function openFicha(container, codigo) {
  const data = getMantData();
  const eq = data.equipos.find(e => e.codigo === codigo);
  if (!eq) return;

  const modal = container.querySelector('#eq-modal-ficha');
  const title = container.querySelector('#eq-modal-title');
  const sub = container.querySelector('#eq-modal-sub');
  const body = container.querySelector('#eq-modal-body');
  if (!modal || !body) return;

  title.innerHTML = `🔧 ${escapeHtml(eq.nombre)}`;
  sub.innerHTML = `<strong>${escapeHtml(eq.codigo)}</strong> · ${escapeHtml(eq.area)} · ${escapeHtml(eq.tipo)}`;

  // Historial: ultimas 5 OT
  const ot = data.ordenes
    .filter(o => o.equipoCodigo === eq.codigo)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
    .slice(0, 5);

  const critBadge = critToBadge(eq.criticidad);
  const estadoBadge = estadoToBadge(eq.estado);

  body.innerHTML = `
    <div class="eq-ficha-grid">
      <div class="eq-ficha-item">
        <div class="eq-ficha-label">Estado actual</div>
        <div class="eq-ficha-value">${estadoBadge}</div>
      </div>
      <div class="eq-ficha-item">
        <div class="eq-ficha-label">Criticidad</div>
        <div class="eq-ficha-value">${critBadge}</div>
      </div>
      <div class="eq-ficha-item">
        <div class="eq-ficha-label">Area</div>
        <div class="eq-ficha-value">${escapeHtml(eq.area)}</div>
      </div>
      <div class="eq-ficha-item">
        <div class="eq-ficha-label">Tipo</div>
        <div class="eq-ficha-value">${escapeHtml(eq.tipo)}</div>
      </div>
      <div class="eq-ficha-item">
        <div class="eq-ficha-label">Horas de uso</div>
        <div class="eq-ficha-value">${fmt(eq.horasUso)} h</div>
      </div>
      <div class="eq-ficha-item">
        <div class="eq-ficha-label">Fabricante</div>
        <div class="eq-ficha-value">${escapeHtml(eq.fabricante || '-')}</div>
      </div>
      <div class="eq-ficha-item">
        <div class="eq-ficha-label">Modelo</div>
        <div class="eq-ficha-value">${escapeHtml(eq.modelo || '-')}</div>
      </div>
      <div class="eq-ficha-item">
        <div class="eq-ficha-label">Año fabricacion</div>
        <div class="eq-ficha-value">${escapeHtml(eq.anio || '-')}</div>
      </div>
    </div>

    ${eq.ultimaFalla ? `
      <div style="background:var(--rose-bg);border-left:4px solid var(--danger);padding:12px 16px;border-radius:var(--radius);margin-bottom:12px">
        <div style="font-size:11px;color:var(--danger);font-weight:700;text-transform:uppercase;letter-spacing:0.5px">⚠️ Ultima falla registrada</div>
        <div style="color:var(--texto);margin-top:4px">${escapeHtml(eq.ultimaFalla)}</div>
      </div>
    ` : ''}

    <div class="eq-section-title">📋 Historial de OT (ultimas 5)</div>
    ${ot.length ? ot.map(o => {
      const tipoIcon = { preventivo: '🗓️', correctivo: '🔨', predictivo: '📡' }[o.tipo] || '•';
      const estadoB = otEstadoBadge(o.estado);
      return `<div class="eq-hist-row">
        <div class="eq-hist-code">${escapeHtml(o.codigo)}</div>
        <div class="eq-hist-desc">${tipoIcon} ${escapeHtml(o.descripcion)}</div>
        <div>${estadoB}</div>
        <div class="eq-hist-date">${escapeHtml(o.fecha)}</div>
      </div>`;
    }).join('') : '<div style="text-align:center;color:var(--muted);padding:16px">Sin OT registradas para este equipo</div>'}
  `;

  modal.style.display = 'flex';
}

function closeFicha(container) {
  const modal = container.querySelector('#eq-modal-ficha');
  if (modal) modal.style.display = 'none';
}

// ════════════════════════════════════════════════════════
// MODAL NUEVO EQUIPO
// ════════════════════════════════════════════════════════
function openNew(container) {
  const modal = container.querySelector('#eq-modal-new');
  if (modal) modal.style.display = 'flex';
}

function closeNew(container) {
  const modal = container.querySelector('#eq-modal-new');
  if (modal) {
    modal.style.display = 'none';
    const form = container.querySelector('#eq-form-new');
    if (form) form.reset();
  }
}

function saveNew(container) {
  const form = container.querySelector('#eq-form-new');
  if (!form) return;
  const fd = new FormData(form);
  const codigo = (fd.get('codigo') || '').toString().trim().toUpperCase();
  const nombre = (fd.get('nombre') || '').toString().trim();
  if (!codigo || !nombre) {
    toast(container, 'Codigo y Nombre son obligatorios', true);
    return;
  }

  const data = getMantData();
  if (data.equipos.some(e => e.codigo === codigo)) {
    toast(container, `El codigo ${codigo} ya existe`, true);
    return;
  }

  data.equipos.push({
    codigo,
    nombre,
    area: fd.get('area') || 'Servicios',
    tipo: fd.get('tipo') || 'Mecanico',
    criticidad: fd.get('criticidad') || 'media',
    horasUso: Number(fd.get('horasUso') || 0),
    fabricante: (fd.get('fabricante') || '').toString(),
    modelo: (fd.get('modelo') || '').toString(),
    anio: Number(fd.get('anio') || new Date().getFullYear()),
    estado: fd.get('estado') || 'operativo'
  });

  // Actualizar KPIs
  data.kpis.equiposOperativos = data.equipos.filter(e => e.estado === 'operativo').length;
  data.kpis.equiposAlerta = data.equipos.filter(e => e.estado === 'alerta').length;
  data.kpis.equiposFalla = data.equipos.filter(e => e.estado === 'falla').length;

  saveMantData(data);
  closeNew(container);
  loadAll(container);
  toast(container, `✅ Equipo ${codigo} registrado`);
}

// ════════════════════════════════════════════════════════
// EXPORT CSV
// ════════════════════════════════════════════════════════
function exportCsv(container) {
  const data = getMantData();
  const rows = applyFilters(data.equipos);

  const headers = ['Codigo', 'Nombre', 'Area', 'Tipo', 'Criticidad', 'Horas Uso', 'Fabricante', 'Modelo', 'Año', 'Estado'];
  const csv = [headers.join(',')]
    .concat(rows.map(e => [
      csvCell(e.codigo),
      csvCell(e.nombre),
      csvCell(e.area),
      csvCell(e.tipo),
      csvCell(e.criticidad),
      e.horasUso || 0,
      csvCell(e.fabricante || ''),
      csvCell(e.modelo || ''),
      e.anio || '',
      csvCell(e.estado)
    ].join(',')))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `equipos_${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast(container, `⬇️ Exportado: ${rows.length} equipos`);
}

function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════
function critToBadge(c) {
  if (c === 'alta') return '<span class="badge badge-rose">Alta</span>';
  if (c === 'media') return '<span class="badge badge-amber">Media</span>';
  return '<span class="badge badge-verde">Baja</span>';
}

function estadoToBadge(e) {
  if (e === 'operativo') return '<span class="badge badge-verde">✅ Operativo</span>';
  if (e === 'alerta') return '<span class="badge badge-amber">⚠️ Alerta</span>';
  if (e === 'falla') return '<span class="badge badge-rose">🔴 Falla</span>';
  return `<span class="badge">${escapeHtml(e)}</span>`;
}

function otEstadoBadge(e) {
  if (e === 'abierta') return '<span class="badge badge-azul">Abierta</span>';
  if (e === 'ejecucion') return '<span class="badge badge-amber">En ejecucion</span>';
  if (e === 'completada') return '<span class="badge badge-verde">Completada</span>';
  if (e === 'pausada') return '<span class="badge badge-rose">Pausada</span>';
  return `<span class="badge">${escapeHtml(e)}</span>`;
}

function escapeHtml(s) {
  if (s == null) return '';
  return String(s).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[m]));
}

function setText(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

function toast(container, msg, error) {
  const t = container.querySelector('#eq-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle('error', !!error);
  t.style.display = 'block';
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => { t.style.display = 'none'; }, 2600);
}
