/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - PERSONAL TECNICO
   Equipo, especialidades, cargas y desempeno
   ════════════════════════════════════════════════════════ */

import { fmt } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { getMantData } from './data-mock.js';

let charts = [];

const HORAS_TARGET = 176; // Horas objetivo mensual

// Paleta por especialidad (usa colores del sistema)
const ESP_COLORS = {
  'Refrigeracion': '#0891b2',     // cyan
  'Mecanica':      '#2563eb',     // azul
  'Electrica':     '#d97706',     // amber
  'Instrumentacion': '#7c3aed',   // purple
  'Soldadura':     '#e11d48',     // rose
  'Neumatica':     '#16a34a',     // verde
  'Hidraulica':    '#ea580c'      // naranja
};

function colorEspecialidad(esp) {
  return ESP_COLORS[esp] || '#64748b';
}

function nivelBadge(nivel) {
  if (nivel === 'Senior') return '<span class="badge badge-verde">Senior</span>';
  if (nivel === 'Semi-Senior') return '<span class="badge badge-azul">Semi-Sr</span>';
  return '<span class="badge badge-amber">Junior</span>';
}

function estadoBadge(e) {
  if (e === 'activo') return '<span class="badge badge-verde">● Activo</span>';
  if (e === 'vacaciones') return '<span class="badge badge-amber">🏖️ Vacaciones</span>';
  return `<span class="badge badge-rose">${e}</span>`;
}

// ════════════════════════════════════════════════════════
// INIT / REFRESH
// ════════════════════════════════════════════════════════
export async function init(container) {
  container.querySelector('#btn-nuevo-tecnico')?.addEventListener('click', () => {
    alert('Alta de nuevo técnico: pendiente de implementar.');
  });
  wireModal(container);
  await loadAll(container);
}

export function refresh() {
  destroyCharts();
  const c = document.getElementById('panel-tecnicos-mant');
  if (c) loadAll(c);
}

function destroyCharts() {
  charts.forEach(c => { try { c.destroy(); } catch (_) {} });
  charts = [];
}

function wireModal(container) {
  container.querySelector('#tec-modal-close')?.addEventListener('click', () => closeModal(container));
  container.querySelector('.tec-modal-backdrop')?.addEventListener('click', () => closeModal(container));
}

// ════════════════════════════════════════════════════════
// LOAD
// ════════════════════════════════════════════════════════
async function loadAll(container) {
  const data = getMantData();
  const tecs = data.tecnicos || [];

  renderKpis(container, tecs);
  renderChartEspecialidad(container, tecs);
  renderLeyenda(container, tecs);
  renderGrid(container, tecs);
  renderChartOt(container, tecs);
  renderChartHorasEsp(container, tecs);
}

// ════════════════════════════════════════════════════════
// KPIs
// ════════════════════════════════════════════════════════
function renderKpis(container, tecs) {
  const activos = tecs.filter(t => t.estado === 'activo').length;
  const vac = tecs.filter(t => t.estado === 'vacaciones').length;
  const horas = tecs.reduce((s, t) => s + (t.horasMes || 0), 0);
  setText(container, 'kpi-tec-total', fmt(tecs.length));
  setText(container, 'kpi-tec-activos', fmt(activos));
  setText(container, 'kpi-tec-vacaciones', fmt(vac));
  setText(container, 'kpi-tec-horas', fmt(horas));
}

function setText(container, id, v) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = v;
}

// ════════════════════════════════════════════════════════
// CHART - ESPECIALIDAD (doughnut)
// ════════════════════════════════════════════════════════
function renderChartEspecialidad(container, tecs) {
  const counts = {};
  tecs.forEach(t => { counts[t.especialidad] = (counts[t.especialidad] || 0) + 1; });
  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const colors = labels.map(l => colorEspecialidad(l));

  const ch = createChart('chart-tec-especialidad', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 3,
        borderColor: 'var(--surface)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: false },
        tooltip: getDefaultOptions().plugins.tooltip
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderLeyenda(container, tecs) {
  const wrap = container.querySelector('#tec-leyenda');
  if (!wrap) return;
  const counts = {};
  tecs.forEach(t => { counts[t.especialidad] = (counts[t.especialidad] || 0) + 1; });
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  wrap.innerHTML = entries.map(([esp, n]) => {
    return `<div class="mant-tec-leg-row">
      <div class="mant-tec-leg-row-label">
        <div class="mant-tec-leg-dot" style="background:${colorEspecialidad(esp)}"></div>
        <div>${esp}</div>
      </div>
      <div class="mant-tec-leg-count">${n}</div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// GRID DE TECNICOS
// ════════════════════════════════════════════════════════
function renderGrid(container, tecs) {
  const wrap = container.querySelector('#tec-grid');
  if (!wrap) return;

  if (!tecs.length) {
    wrap.innerHTML = `<div class="empty-state">Sin técnicos registrados</div>`;
    return;
  }

  wrap.innerHTML = tecs.map(t => {
    const color = colorEspecialidad(t.especialidad);
    const carga = Math.min(100, Math.round((t.horasMes / HORAS_TARGET) * 100));
    const cargaColor = carga >= 95 ? 'var(--danger)' : carga >= 80 ? 'var(--warn)' : 'var(--verde)';
    const promedio = t.otCompletadas > 0 ? (t.horasMes / t.otCompletadas).toFixed(1) : '-';

    return `<div class="mant-tec-card" data-tec-id="${t.id}">
      <div class="mant-tec-head">
        <div class="mant-tec-avatar" style="background:${color}">${t.avatar || '??'}</div>
        <div style="flex:1;min-width:0">
          <div class="mant-tec-name">${t.nombre}</div>
          <div class="mant-tec-esp">🛠️ ${t.especialidad}</div>
        </div>
        <div class="mant-tec-nivel">${nivelBadge(t.nivel)}</div>
      </div>

      <div class="mant-tec-stats">
        <div class="mant-tec-stat">
          <div class="mant-tec-stat-label">OT</div>
          <div class="mant-tec-stat-val">${fmt(t.otCompletadas)}</div>
        </div>
        <div class="mant-tec-stat">
          <div class="mant-tec-stat-label">Horas</div>
          <div class="mant-tec-stat-val">${fmt(t.horasMes)}</div>
        </div>
        <div class="mant-tec-stat">
          <div class="mant-tec-stat-label">H/OT</div>
          <div class="mant-tec-stat-val">${promedio}</div>
        </div>
      </div>

      <div class="mant-tec-carga">
        <div class="mant-tec-carga-label">
          <span>Carga mensual</span>
          <strong style="color:${cargaColor}">${carga}%</strong>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${carga}%;background:${cargaColor}"></div>
        </div>
      </div>

      <div class="mant-tec-footer">
        <div>${estadoBadge(t.estado)}</div>
        <div class="mant-tec-tel">📞 <strong>${t.telefono}</strong></div>
      </div>

      <button class="btn btn-secondary btn-sm" data-ver-ot="${t.id}">Ver OT asignadas</button>
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-ver-ot]').forEach(btn => {
    btn.addEventListener('click', () => openOtModal(container, btn.dataset.verOt));
  });
}

// ════════════════════════════════════════════════════════
// CHART - OT POR TECNICO
// ════════════════════════════════════════════════════════
function renderChartOt(container, tecs) {
  const col = getColors();
  const sorted = tecs.slice().sort((a, b) => b.otCompletadas - a.otCompletadas).slice(0, 10);
  const labels = sorted.map(t => t.nombre.split(' ').slice(0, 2).join(' '));
  const values = sorted.map(t => t.otCompletadas);
  const colors = sorted.map(t => colorEspecialidad(t.especialidad));

  const ch = createChart('chart-tec-ot', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'OT completadas',
        data: values,
        backgroundColor: colors.map(c => c + '40'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: getDefaultOptions().plugins.tooltip
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// CHART - HORAS POR ESPECIALIDAD
// ════════════════════════════════════════════════════════
function renderChartHorasEsp(container, tecs) {
  const mapa = {};
  tecs.forEach(t => {
    if (!mapa[t.especialidad]) mapa[t.especialidad] = 0;
    mapa[t.especialidad] += t.horasMes || 0;
  });
  const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);
  const colors = labels.map(l => colorEspecialidad(l));

  const ch = createChart('chart-tec-horas', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Horas/mes',
        data: values,
        backgroundColor: colors.map(c => c + '40'),
        borderColor: colors,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: ctx => fmt(ctx.parsed.y) + ' horas' }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// MODAL - OT DEL TECNICO
// ════════════════════════════════════════════════════════
function openOtModal(container, tecnicoId) {
  const data = getMantData();
  const tec = (data.tecnicos || []).find(t => t.id === tecnicoId);
  if (!tec) return;
  const ots = (data.ordenes || []).filter(o => o.tecnicoId === tecnicoId)
    .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  const title = container.querySelector('#tec-modal-title');
  const sub = container.querySelector('#tec-modal-sub');
  const tbody = container.querySelector('#tec-modal-tbody');

  if (title) title.textContent = `OT de ${tec.nombre}`;
  if (sub) sub.textContent = `${tec.especialidad} · ${tec.nivel} · ${ots.length} OT totales`;

  if (tbody) {
    if (!ots.length) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Sin OT asignadas</td></tr>`;
    } else {
      tbody.innerHTML = ots.map(o => {
        const prio = {
          'alta': '<span class="badge badge-rose">Alta</span>',
          'media': '<span class="badge badge-amber">Media</span>',
          'baja': '<span class="badge badge-verde">Baja</span>'
        }[o.prioridad] || '-';
        const est = {
          'abierta': '<span class="badge badge-azul">Abierta</span>',
          'ejecucion': '<span class="badge badge-amber">Ejecución</span>',
          'completada': '<span class="badge badge-verde">Completada</span>',
          'pausada': '<span class="badge badge-rose">Pausada</span>'
        }[o.estado] || o.estado;
        const tipoIcon = { preventivo: '🗓️', correctivo: '🔨', predictivo: '📡' }[o.tipo] || '•';
        return `<tr>
          <td><strong>${o.codigo}</strong></td>
          <td>${o.equipo}</td>
          <td>${o.area}</td>
          <td>${tipoIcon} ${o.tipo[0].toUpperCase() + o.tipo.slice(1)}</td>
          <td>${prio}</td>
          <td>${est}</td>
          <td style="white-space:nowrap">${o.fecha}</td>
        </tr>`;
      }).join('');
    }
  }

  const modal = container.querySelector('#tec-modal');
  if (modal) modal.style.display = 'flex';
}

function closeModal(container) {
  const modal = container.querySelector('#tec-modal');
  if (modal) modal.style.display = 'none';
}
