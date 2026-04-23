/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - ORDENES DE TRABAJO (OT)
   Gestion completa del ciclo de vida de OT.
   ════════════════════════════════════════════════════════ */

import { fmt, fmtSoles, fmtPct, fmtDate } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { getMantData, saveMantData } from './data-mock.js';

let charts = [];
let refreshTimer = null;
let state = {
  estados: new Set(),   // vacio = todos
  tipos: new Set(),
  prioridades: new Set()
};

export async function init(container) {
  wireFilters(container);
  wireButtons(container);
  wireModals(container);
  loadAll(container);

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const c = document.getElementById('panel-ordenes-trabajo') || container;
    if (c && c.isConnected) loadAll(c);
  }, 60000);
}

export function refresh() {
  charts.forEach(c => { try { c.destroy(); } catch (_) {} });
  charts = [];
  const c = document.getElementById('panel-ordenes-trabajo');
  if (c) loadAll(c);
}

// ════════════════════════════════════════════════════════
// LOADERS
// ════════════════════════════════════════════════════════
function loadAll(container) {
  // Destruir charts previos
  charts.forEach(c => { try { c.destroy(); } catch (_) {} });
  charts = [];

  const data = getMantData();
  renderKpis(container, data);
  renderChartAreas(container, data);
  renderChartTipos(container, data);
  renderTable(container, data);
  populateSelects(container, data);
}

function renderKpis(container, data) {
  const total = data.ordenes.length;
  const abiertas = data.ordenes.filter(o => o.estado === 'abierta').length;
  const ejecucion = data.ordenes.filter(o => o.estado === 'ejecucion').length;
  const completadas = data.ordenes.filter(o => o.estado === 'completada').length;

  setText(container, 'kpi-ot-total', fmt(total));
  setText(container, 'kpi-ot-abiertas', fmt(abiertas));
  setText(container, 'kpi-ot-ejecucion', fmt(ejecucion));
  setText(container, 'kpi-ot-completadas', fmt(completadas));

  const pct = n => total > 0 ? fmtPct((n * 100) / total, 0) : '0%';
  setText(container, 'kpi-ot-total-sub', `${data.ordenes.filter(o => o.estado !== 'completada').length} pendientes`);
  setText(container, 'kpi-ot-abiertas-pct', `${pct(abiertas)} del total`);
  setText(container, 'kpi-ot-ejecucion-pct', `${pct(ejecucion)} del total`);
  setText(container, 'kpi-ot-completadas-pct', `${pct(completadas)} del total`);
}

// ════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════
function renderChartAreas(container, data) {
  const canvas = container.querySelector('#chart-ot-areas');
  if (!canvas) return;
  const col = getColors();

  const porArea = {};
  data.ordenes.forEach(o => {
    if (!porArea[o.area]) porArea[o.area] = { abiertas: 0, completadas: 0 };
    if (o.estado === 'completada') porArea[o.area].completadas++;
    else porArea[o.area].abiertas++;
  });

  const labels = Object.keys(porArea);
  const ab = labels.map(a => porArea[a].abiertas);
  const co = labels.map(a => porArea[a].completadas);

  const ch = createChart('chart-ot-areas', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Abiertas', data: ab, backgroundColor: col.azul.bg, borderColor: col.azul.border, borderWidth: 2, borderRadius: 6 },
        { label: 'Completadas', data: co, backgroundColor: col.verde.bg, borderColor: col.verde.border, borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: getDefaultOptions('bar').plugins.tooltip
      },
      scales: {
        x: { stacked: false, ticks: { color: getTextColor(), font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { beginAtZero: true, ticks: { color: getTextColor(), stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.04)' } }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartTipos(container, data) {
  const canvas = container.querySelector('#chart-ot-tipos');
  if (!canvas) return;
  const col = getColors();

  const tipos = { preventivo: 0, correctivo: 0, predictivo: 0 };
  data.ordenes.forEach(o => { if (tipos[o.tipo] !== undefined) tipos[o.tipo]++; });

  const ch = createChart('chart-ot-tipos', {
    type: 'doughnut',
    data: {
      labels: ['🗓️ Preventivo', '🔨 Correctivo', '📡 Predictivo'],
      datasets: [{
        data: [tipos.preventivo, tipos.correctivo, tipos.predictivo],
        backgroundColor: [col.verde.border, col.rose.border, col.purple.border],
        borderWidth: 3,
        borderColor: 'var(--surface)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: true, position: 'right', labels: { color: getTextColor(), font: { size: 12 }, padding: 12 } },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: {
            label: ctx => {
              const total = tipos.preventivo + tipos.correctivo + tipos.predictivo;
              const pct = total > 0 ? ((ctx.parsed * 100) / total).toFixed(1) : 0;
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            }
          }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// TABLA
// ════════════════════════════════════════════════════════
function renderTable(container, data) {
  const tbody = container.querySelector('#tbl-ot');
  const sub = container.querySelector('#ot-count-sub');
  if (!tbody) return;

  const filtered = applyFilters(data.ordenes).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  if (sub) sub.textContent = `Mostrando ${filtered.length} de ${data.ordenes.length} OT`;

  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:30px">🔍 No hay OT con los filtros aplicados</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map(o => {
    const tipoIcon = { preventivo: '🗓️', correctivo: '🔨', predictivo: '📡' }[o.tipo] || '•';
    const prioBadge = prioToBadge(o.prioridad);
    const estadoBadge = otEstadoBadge(o.estado);
    const horas = o.horasReales != null ? `${o.horasEstimadas}h / <strong>${o.horasReales.toFixed(1)}h</strong>` : `${o.horasEstimadas}h / —`;
    const costo = o.costoReal != null ? fmtSoles(o.costoReal, 0) : fmtSoles(o.costoEstimado, 0);

    const puedeCompletar = o.estado === 'abierta' || o.estado === 'ejecucion' || o.estado === 'pausada';

    return `<tr>
      <td><strong>${escapeHtml(o.codigo)}</strong></td>
      <td>${escapeHtml(o.equipo)}</td>
      <td>${escapeHtml(o.area)}</td>
      <td>${tipoIcon} ${cap(escapeHtml(o.tipo))}</td>
      <td>${prioBadge}</td>
      <td>${escapeHtml(o.tecnico)}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${horas}</td>
      <td style="text-align:right;font-variant-numeric:tabular-nums">${costo}</td>
      <td>${estadoBadge}</td>
      <td style="white-space:nowrap">${fmtDate(o.fecha)}</td>
      <td>
        <div class="ot-row-actions">
          <button class="btn btn-sm btn-secondary" data-ot-ver="${escapeHtml(o.codigo)}">📄 Ver</button>
          ${puedeCompletar ? `<button class="btn btn-sm btn-primary" data-ot-completar="${escapeHtml(o.codigo)}">✅ Completar</button>` : ''}
        </div>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-ot-ver]').forEach(btn => {
    btn.addEventListener('click', () => openDetalle(container, btn.dataset.otVer));
  });
  tbody.querySelectorAll('[data-ot-completar]').forEach(btn => {
    btn.addEventListener('click', () => completarOt(container, btn.dataset.otCompletar));
  });
}

function applyFilters(ordenes) {
  return ordenes.filter(o => {
    if (state.estados.size > 0 && !state.estados.has(o.estado)) return false;
    if (state.tipos.size > 0 && !state.tipos.has(o.tipo)) return false;
    if (state.prioridades.size > 0 && !state.prioridades.has(o.prioridad)) return false;
    return true;
  });
}

// ════════════════════════════════════════════════════════
// FILTROS
// ════════════════════════════════════════════════════════
function wireFilters(container) {
  const allChip = container.querySelector('[data-ot-filter="all"]');
  if (allChip) {
    allChip.addEventListener('click', () => {
      state.estados.clear();
      state.tipos.clear();
      state.prioridades.clear();
      container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      allChip.classList.add('active');
      renderTable(container, getMantData());
    });
  }

  container.querySelectorAll('[data-ot-estado]').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.otEstado;
      if (state.estados.has(v)) { state.estados.delete(v); chip.classList.remove('active'); }
      else { state.estados.add(v); chip.classList.add('active'); }
      if (allChip) allChip.classList.remove('active');
      renderTable(container, getMantData());
    });
  });

  container.querySelectorAll('[data-ot-tipo]').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.otTipo;
      if (state.tipos.has(v)) { state.tipos.delete(v); chip.classList.remove('active'); }
      else { state.tipos.add(v); chip.classList.add('active'); }
      if (allChip) allChip.classList.remove('active');
      renderTable(container, getMantData());
    });
  });

  container.querySelectorAll('[data-ot-prio]').forEach(chip => {
    chip.addEventListener('click', () => {
      const v = chip.dataset.otPrio;
      if (state.prioridades.has(v)) { state.prioridades.delete(v); chip.classList.remove('active'); }
      else { state.prioridades.add(v); chip.classList.add('active'); }
      if (allChip) allChip.classList.remove('active');
      renderTable(container, getMantData());
    });
  });
}

// ════════════════════════════════════════════════════════
// BOTONES
// ════════════════════════════════════════════════════════
function wireButtons(container) {
  const exp = container.querySelector('#btn-export-ot');
  if (exp) exp.addEventListener('click', () => exportCsv(container));
  const nuevo = container.querySelector('#btn-nueva-ot');
  if (nuevo) nuevo.addEventListener('click', () => openNew(container));

  const save = container.querySelector('#ot-save-new');
  if (save) save.addEventListener('click', () => saveNew(container));
}

function wireModals(container) {
  container.querySelectorAll('[data-ot-close]').forEach(el => {
    el.addEventListener('click', () => closeDetalle(container));
  });
  container.querySelectorAll('[data-ot-close-new]').forEach(el => {
    el.addEventListener('click', () => closeNew(container));
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeDetalle(container); closeNew(container); }
  });
}

// ════════════════════════════════════════════════════════
// MODAL DETALLE
// ════════════════════════════════════════════════════════
function openDetalle(container, codigo) {
  const data = getMantData();
  const o = data.ordenes.find(x => x.codigo === codigo);
  if (!o) return;

  const modal = container.querySelector('#ot-modal-detalle');
  const title = container.querySelector('#ot-modal-title');
  const sub = container.querySelector('#ot-modal-sub');
  const body = container.querySelector('#ot-modal-body');
  const btnComp = container.querySelector('#ot-modal-complete');
  if (!modal || !body) return;

  const tipoIcon = { preventivo: '🗓️', correctivo: '🔨', predictivo: '📡' }[o.tipo] || '•';
  title.innerHTML = `${tipoIcon} ${escapeHtml(o.codigo)}`;
  sub.innerHTML = `${escapeHtml(o.equipo)} · ${escapeHtml(o.area)}`;

  body.innerHTML = `
    <div class="ot-detail-grid">
      <div class="ot-detail-item">
        <div class="ot-detail-label">Estado</div>
        <div class="ot-detail-value">${otEstadoBadge(o.estado)}</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Prioridad</div>
        <div class="ot-detail-value">${prioToBadge(o.prioridad)}</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Tipo</div>
        <div class="ot-detail-value">${tipoIcon} ${cap(escapeHtml(o.tipo))}</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Fecha</div>
        <div class="ot-detail-value">${fmtDate(o.fecha)}</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Tecnico asignado</div>
        <div class="ot-detail-value">${escapeHtml(o.tecnico)}</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Area</div>
        <div class="ot-detail-value">${escapeHtml(o.area)}</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Horas estimadas</div>
        <div class="ot-detail-value">${o.horasEstimadas} h</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Horas reales</div>
        <div class="ot-detail-value">${o.horasReales != null ? o.horasReales.toFixed(1) + ' h' : '—'}</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Costo estimado</div>
        <div class="ot-detail-value">${fmtSoles(o.costoEstimado, 0)}</div>
      </div>
      <div class="ot-detail-item">
        <div class="ot-detail-label">Costo real</div>
        <div class="ot-detail-value">${o.costoReal != null ? fmtSoles(o.costoReal, 0) : '—'}</div>
      </div>
    </div>

    <div class="ot-desc-box">
      <div class="ot-desc-label">📝 Descripcion del trabajo</div>
      <div class="ot-desc-text">${escapeHtml(o.descripcion)}</div>
    </div>
  `;

  // Configurar boton Completar
  if (btnComp) {
    const puede = o.estado === 'abierta' || o.estado === 'ejecucion' || o.estado === 'pausada';
    btnComp.style.display = puede ? 'inline-flex' : 'none';
    btnComp.onclick = () => { completarOt(container, o.codigo); closeDetalle(container); };
  }

  modal.style.display = 'flex';
}

function closeDetalle(container) {
  const modal = container.querySelector('#ot-modal-detalle');
  if (modal) modal.style.display = 'none';
}

// ════════════════════════════════════════════════════════
// MODAL NUEVA OT
// ════════════════════════════════════════════════════════
function populateSelects(container, data) {
  const equipoSel = container.querySelector('#ot-new-equipo');
  const tecnicoSel = container.querySelector('#ot-new-tecnico');
  const fechaInp = container.querySelector('#ot-new-fecha');

  if (equipoSel && !equipoSel.options.length) {
    equipoSel.innerHTML = data.equipos
      .slice()
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
      .map(e => `<option value="${escapeHtml(e.codigo)}">${escapeHtml(e.codigo)} — ${escapeHtml(e.nombre)}</option>`)
      .join('');
  }
  if (tecnicoSel && !tecnicoSel.options.length) {
    tecnicoSel.innerHTML = data.tecnicos
      .filter(t => t.estado === 'activo')
      .map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.nombre)} (${escapeHtml(t.especialidad)})</option>`)
      .join('');
  }
  if (fechaInp && !fechaInp.value) {
    fechaInp.value = new Date().toISOString().substring(0, 10);
  }
}

function openNew(container) {
  const modal = container.querySelector('#ot-modal-new');
  if (modal) modal.style.display = 'flex';
}

function closeNew(container) {
  const modal = container.querySelector('#ot-modal-new');
  if (modal) {
    modal.style.display = 'none';
    const form = container.querySelector('#ot-form-new');
    if (form) form.reset();
    const fechaInp = container.querySelector('#ot-new-fecha');
    if (fechaInp) fechaInp.value = new Date().toISOString().substring(0, 10);
  }
}

function saveNew(container) {
  const form = container.querySelector('#ot-form-new');
  if (!form) return;
  const fd = new FormData(form);

  const equipoCodigo = (fd.get('equipoCodigo') || '').toString();
  const tecnicoId = (fd.get('tecnicoId') || '').toString();
  const descripcion = (fd.get('descripcion') || '').toString().trim();
  const fecha = (fd.get('fecha') || '').toString();

  if (!equipoCodigo || !tecnicoId || !descripcion || !fecha) {
    toast(container, 'Completa todos los campos obligatorios', true);
    return;
  }

  const data = getMantData();
  const equipo = data.equipos.find(e => e.codigo === equipoCodigo);
  const tecnico = data.tecnicos.find(t => t.id === tecnicoId);
  if (!equipo || !tecnico) {
    toast(container, 'Equipo o tecnico no valido', true);
    return;
  }

  // Generar siguiente codigo OT
  const maxNum = data.ordenes.reduce((max, o) => {
    const n = parseInt((o.codigo || '').replace(/\D/g, ''), 10) || 0;
    return Math.max(max, n);
  }, 2040);
  const codigo = 'OT-' + (maxNum + 1);

  const horasEst = Number(fd.get('horasEstimadas') || 2);
  const costoEst = Number(fd.get('costoEstimado') || 500);

  const nueva = {
    codigo,
    equipo: `${equipo.codigo} ${equipo.nombre}`,
    equipoCodigo: equipo.codigo,
    area: equipo.area,
    tipo: fd.get('tipo') || 'preventivo',
    prioridad: fd.get('prioridad') || 'media',
    estado: fd.get('estado') || 'abierta',
    tecnico: tecnico.nombre,
    tecnicoId: tecnico.id,
    descripcion,
    fecha,
    horasEstimadas: horasEst,
    horasReales: null,
    costoEstimado: costoEst,
    costoReal: null
  };

  data.ordenes.unshift(nueva);

  // Actualizar KPI relacionado
  data.kpis.otAbiertas = data.ordenes.filter(o => o.estado !== 'completada').length;

  saveMantData(data);
  closeNew(container);
  loadAll(container);
  toast(container, `✅ OT ${codigo} creada correctamente`);
}

// ════════════════════════════════════════════════════════
// COMPLETAR OT
// ════════════════════════════════════════════════════════
function completarOt(container, codigo) {
  const data = getMantData();
  const o = data.ordenes.find(x => x.codigo === codigo);
  if (!o) return;

  if (!confirm(`¿Completar la OT ${codigo}?`)) return;

  o.estado = 'completada';
  // Si no tiene horas/costo real, usar estimado + variacion leve
  if (o.horasReales == null) o.horasReales = o.horasEstimadas + (Math.random() - 0.5);
  if (o.costoReal == null) o.costoReal = o.costoEstimado + (Math.random() - 0.3) * (o.costoEstimado * 0.15);

  data.kpis.otAbiertas = data.ordenes.filter(x => x.estado !== 'completada').length;
  saveMantData(data);
  loadAll(container);
  toast(container, `✅ OT ${codigo} marcada como completada`);
}

// ════════════════════════════════════════════════════════
// EXPORT CSV
// ════════════════════════════════════════════════════════
function exportCsv(container) {
  const data = getMantData();
  const rows = applyFilters(data.ordenes).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const headers = ['OT', 'Equipo Cod', 'Equipo', 'Area', 'Tipo', 'Prioridad', 'Estado', 'Tecnico', 'Fecha', 'Horas Est', 'Horas Real', 'Costo Est', 'Costo Real', 'Descripcion'];
  const csv = [headers.join(',')]
    .concat(rows.map(o => [
      csvCell(o.codigo),
      csvCell(o.equipoCodigo),
      csvCell(o.equipo),
      csvCell(o.area),
      csvCell(o.tipo),
      csvCell(o.prioridad),
      csvCell(o.estado),
      csvCell(o.tecnico),
      csvCell(o.fecha),
      o.horasEstimadas ?? '',
      o.horasReales != null ? Number(o.horasReales).toFixed(2) : '',
      o.costoEstimado ?? '',
      o.costoReal != null ? Number(o.costoReal).toFixed(2) : '',
      csvCell(o.descripcion)
    ].join(',')))
    .join('\n');

  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ordenes_trabajo_${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  toast(container, `⬇️ Exportado: ${rows.length} OT`);
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
function prioToBadge(p) {
  if (p === 'alta') return '<span class="badge badge-rose">🔴 Alta</span>';
  if (p === 'media') return '<span class="badge badge-amber">🟡 Media</span>';
  return '<span class="badge badge-verde">🟢 Baja</span>';
}

function otEstadoBadge(e) {
  if (e === 'abierta') return '<span class="badge badge-azul">📬 Abierta</span>';
  if (e === 'ejecucion') return '<span class="badge badge-amber">🔧 En ejecucion</span>';
  if (e === 'completada') return '<span class="badge badge-verde">✅ Completada</span>';
  if (e === 'pausada') return '<span class="badge badge-rose">⏸️ Pausada</span>';
  return `<span class="badge">${escapeHtml(e)}</span>`;
}

function cap(s) {
  if (!s) return '';
  return s.charAt(0).toUpperCase() + s.slice(1);
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
  const t = container.querySelector('#ot-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.toggle('error', !!error);
  t.style.display = 'block';
  clearTimeout(t._tmr);
  t._tmr = setTimeout(() => { t.style.display = 'none'; }, 2600);
}
