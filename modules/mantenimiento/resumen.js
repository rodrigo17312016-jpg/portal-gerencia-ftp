/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - RESUMEN
   Panel principal del area de mantenimiento industrial
   ════════════════════════════════════════════════════════ */

import { fmt, fmtPct, fmtSoles } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { showPanel } from '../../assets/js/core/router.js';
import { getMantData } from './data-mock.js';

let charts = [];
let refreshTimer = null;
let currentOtFilter = 'all';

export async function init(container) {
  // Wire quick access buttons
  container.querySelectorAll('.mant-quick').forEach(btn => {
    btn.addEventListener('click', () => {
      const panel = btn.dataset.panel;
      const module = btn.dataset.module;
      if (panel && module) showPanel(panel, module);
    });
  });

  // Wire filters de OT
  container.querySelectorAll('[data-ot-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-ot-filter]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currentOtFilter = chip.dataset.otFilter;
      renderOtTable(container);
    });
  });

  await loadAll(container);

  // Auto-refresh 60s
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const c = document.getElementById('panel-resumen-mant');
    if (c) loadAll(c);
  }, 60000);
}

export function refresh() {
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];
  const c = document.getElementById('panel-resumen-mant');
  if (c) loadAll(c);
}

async function loadAll(container) {
  const data = getMantData();

  // KPIs Hero
  setText(container, 'hero-equipos-total', fmt(data.equipos.length));
  setText(container, 'hero-ot-abiertas', fmt(data.ordenes.filter(o => o.estado !== 'completada').length));
  setText(container, 'hero-pm-cumplimiento', fmtPct(data.kpis.pmCumplimiento));
  setText(container, 'hero-disponibilidad', fmtPct(data.kpis.disponibilidad));

  // KPIs principales
  setText(container, 'kpi-mttr', data.kpis.mttr.toFixed(1) + ' h');
  setText(container, 'kpi-mtbf', fmt(data.kpis.mtbf) + ' h');
  setText(container, 'kpi-oee', fmtPct(data.kpis.oee));
  setText(container, 'kpi-ot-criticas', fmt(data.ordenes.filter(o => o.prioridad === 'alta' && o.estado !== 'completada').length));
  setText(container, 'kpi-backlog', fmt(data.ordenes.filter(o => o.estado === 'abierta').length));
  setText(container, 'kpi-costo-mes', fmtSoles(data.kpis.costoMes, 0));

  // Charts
  renderChartAreas(container, data);
  renderChartTipos(container, data);
  renderChartTendencia(container, data);
  renderChartCostosArea(container, data);

  // Tabla OT
  renderOtTable(container);

  // Alertas criticas
  renderAlertasCriticas(container, data);
}

function setText(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

// ════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════
function renderChartAreas(container, data) {
  const canvas = container.querySelector('#chart-areas');
  if (!canvas) return;
  const col = getColors();

  const areas = {};
  data.equipos.forEach(e => {
    if (!areas[e.area]) areas[e.area] = { total: 0, alerta: 0 };
    areas[e.area].total++;
    if (e.estado === 'alerta' || e.estado === 'falla') areas[e.area].alerta++;
  });

  const labels = Object.keys(areas);
  const totales = labels.map(a => areas[a].total);
  const alertas = labels.map(a => areas[a].alerta);

  const ch = createChart('chart-areas', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Equipos', data: totales, backgroundColor: col.azul.bg, borderColor: col.azul.border, borderWidth: 2, borderRadius: 8 },
        { label: 'Alertas', data: alertas, backgroundColor: col.rose.bg, borderColor: col.rose.border, borderWidth: 2, borderRadius: 8 }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: getDefaultOptions('bar').plugins.tooltip
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartTipos(container, data) {
  const canvas = container.querySelector('#chart-tipos');
  if (!canvas) return;
  const col = getColors();

  const tipos = { preventivo: 0, correctivo: 0, predictivo: 0 };
  data.ordenes.forEach(o => { if (tipos[o.tipo] !== undefined) tipos[o.tipo]++; });

  const ch = createChart('chart-tipos', {
    type: 'doughnut',
    data: {
      labels: ['Preventivo', 'Correctivo', 'Predictivo'],
      datasets: [{
        data: [tipos.preventivo, tipos.correctivo, tipos.predictivo],
        backgroundColor: [col.verde.border, col.rose.border, col.purple.border],
        borderWidth: 3,
        borderColor: 'var(--surface)'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: true, position: 'right', labels: { color: getTextColor(), font: { size: 12 }, padding: 10 } },
        tooltip: getDefaultOptions().plugins.tooltip
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartTendencia(container, data) {
  const canvas = container.querySelector('#chart-tendencia');
  if (!canvas) return;
  const col = getColors();

  const ch = createChart('chart-tendencia', {
    type: 'line',
    data: {
      labels: data.tendencia.meses,
      datasets: [
        { label: 'MTTR (h)', data: data.tendencia.mttr, borderColor: col.rose.border, backgroundColor: col.rose.bg, borderWidth: 3, tension: 0.4, fill: true, pointRadius: 4, pointHoverRadius: 7, yAxisID: 'y' },
        { label: 'MTBF (h)', data: data.tendencia.mtbf, borderColor: col.verde.border, backgroundColor: col.verde.bg, borderWidth: 3, tension: 0.4, fill: false, pointRadius: 4, pointHoverRadius: 7, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: getDefaultOptions().plugins.tooltip
      },
      scales: {
        x: { ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { position: 'left', ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' }, title: { display: true, text: 'MTTR (h)', color: col.rose.border, font: { size: 10 } } },
        y1: { position: 'right', ticks: { color: getTextColor() }, grid: { drawOnChartArea: false }, title: { display: true, text: 'MTBF (h)', color: col.verde.border, font: { size: 10 } } }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartCostosArea(container, data) {
  const canvas = container.querySelector('#chart-costos-area');
  if (!canvas) return;
  const col = getColors();

  const labels = Object.keys(data.costos.porArea);
  const values = Object.values(data.costos.porArea);
  const palette = [col.verde.border, col.naranja.border, col.azul.border, col.cyan.border, col.purple.border, col.amber.border, col.rose.border];

  const ch = createChart('chart-costos-area', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Costo S/',
        data: values,
        backgroundColor: labels.map((_, i) => palette[i % palette.length] + '40'),
        borderColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: (ctx) => 'S/ ' + fmt(ctx.parsed.x, 0) }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// TABLAS
// ════════════════════════════════════════════════════════
function renderOtTable(container) {
  const tbody = container.querySelector('#tbl-ot-recientes');
  if (!tbody) return;
  const data = getMantData();

  let ots = data.ordenes.slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  if (currentOtFilter !== 'all') {
    ots = ots.filter(o => o.estado === currentOtFilter);
  }
  ots = ots.slice(0, 10);

  if (!ots.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">No hay OT en este filtro</td></tr>';
    return;
  }

  tbody.innerHTML = ots.map(o => {
    const prioridadBadge = {
      'alta': '<span class="badge badge-rose">Alta</span>',
      'media': '<span class="badge badge-amber">Media</span>',
      'baja': '<span class="badge badge-verde">Baja</span>'
    }[o.prioridad] || '-';

    const estadoBadge = {
      'abierta': '<span class="badge badge-azul">Abierta</span>',
      'ejecucion': '<span class="badge badge-amber">En Ejecucion</span>',
      'completada': '<span class="badge badge-verde">Completada</span>',
      'pausada': '<span class="badge badge-rose">Pausada</span>'
    }[o.estado] || o.estado;

    const tipoIcon = { preventivo: '🗓️', correctivo: '🔨', predictivo: '📡' }[o.tipo] || '•';

    return `<tr>
      <td><strong>${o.codigo}</strong></td>
      <td>${o.equipo}</td>
      <td>${o.area}</td>
      <td>${tipoIcon} ${o.tipo[0].toUpperCase() + o.tipo.slice(1)}</td>
      <td>${prioridadBadge}</td>
      <td>${o.tecnico}</td>
      <td>${estadoBadge}</td>
      <td style="white-space:nowrap">${o.fecha}</td>
    </tr>`;
  }).join('');
}

function renderAlertasCriticas(container, data) {
  const grid = container.querySelector('#alertas-criticas-grid');
  const count = container.querySelector('#badge-alertas-count');
  if (!grid) return;

  const alertas = data.equipos.filter(e => e.estado === 'alerta' || e.estado === 'falla').slice(0, 6);

  if (count) count.textContent = alertas.length + ' alertas';

  if (!alertas.length) {
    grid.innerHTML = '<div style="text-align:center;color:var(--muted);padding:20px;grid-column:1/-1">✅ Sin alertas criticas</div>';
    return;
  }

  grid.innerHTML = alertas.map(e => {
    const icon = e.estado === 'falla' ? '🔴' : '⚠️';
    const estadoChip = e.estado === 'falla' ? 'FALLA' : 'ALERTA';
    return `<div class="mant-alert">
      <div class="mant-alert-icon">${icon}</div>
      <div class="mant-alert-body">
        <div class="mant-alert-title">${e.codigo} — ${e.nombre}</div>
        <div class="mant-alert-desc">${e.ultimaFalla || 'Requiere intervencion inmediata'}</div>
        <div class="mant-alert-meta">
          <span class="mant-alert-chip">${e.area}</span>
          <span class="mant-alert-chip">${e.tipo}</span>
          <span class="mant-alert-chip" style="background:var(--rose-bg);color:var(--danger)">${estadoChip}</span>
        </div>
      </div>
    </div>`;
  }).join('');
}
