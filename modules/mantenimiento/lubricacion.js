/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - LUBRICACION
   Control de puntos de lubricación de equipos
   ════════════════════════════════════════════════════════ */

import { fmt, fmtDate } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml, escapeAttr } from '../../assets/js/utils/dom-helpers.js';
import { getMantData, saveMantData } from './data-mock.js';

let charts = [];
let filterEstado = 'all';
let filterFrec = 'all';

export async function init(container) {
  // Filtros estado
  container.querySelectorAll('[data-filter-estado]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-filter-estado]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterEstado = chip.dataset.filterEstado;
      renderTabla(container);
    });
  });

  // Filtros frecuencia
  container.querySelectorAll('[data-filter-frec]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-filter-frec]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterFrec = chip.dataset.filterFrec;
      renderTabla(container);
    });
  });

  // Botones header
  const btnNuevo = container.querySelector('#btn-nuevo-punto');
  if (btnNuevo) btnNuevo.addEventListener('click', () => {
    alert('➕ Formulario de nuevo punto de lubricación (pendiente de implementar)');
  });

  const btnRuta = container.querySelector('#btn-ejecutar-ruta');
  if (btnRuta) btnRuta.addEventListener('click', () => ejecutarRutaCompleta(container));

  loadAll(container);
}

export function refresh() {
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];
  const c = document.getElementById('panel-lubricacion');
  if (c) loadAll(c);
}

function loadAll(container) {
  const data = getMantData();
  const lub = data.lubricacion || [];

  // KPIs
  setText(container, 'kpi-lub-total', fmt(lub.length));
  setText(container, 'kpi-lub-vencidos', fmt(lub.filter(l => l.estado === 'vencido').length));
  setText(container, 'kpi-lub-proximos', fmt(lub.filter(l => l.estado === 'proximo').length));

  // Consumo mensual aproximado (normalizando por frecuencia)
  const frecToMes = { Diario: 30, Semanal: 4, Mensual: 1, Trimestral: 0.33 };
  let consumo = 0;
  lub.forEach(l => {
    const factor = frecToMes[l.frecuencia] || 1;
    consumo += parseFloat(l.cantidad) * factor;
  });
  setText(container, 'kpi-lub-consumo', fmt(consumo, 1));

  // Charts
  renderChartTipos(container, lub);
  renderChartAreas(container, lub);

  // Mapa de areas
  renderMapa(container, lub);

  // Tabla
  renderTabla(container);
}

function setText(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

// ════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════
function renderChartTipos(container, lub) {
  const canvas = container.querySelector('#chart-lub-tipos');
  if (!canvas) return;
  const col = getColors();

  // Agrupar por lubricante
  const tipos = {};
  lub.forEach(l => {
    if (!tipos[l.lubricante]) tipos[l.lubricante] = { count: 0, color: l.color };
    tipos[l.lubricante].count++;
  });

  const labels = Object.keys(tipos);
  const values = labels.map(l => tipos[l].count);
  const colores = labels.map(l => {
    const c = tipos[l].color;
    return (col[c] && col[c].border) || col.azul.border;
  });

  const ch = createChart('chart-lub-tipos', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: colores,
        borderColor: 'var(--surface)',
        borderWidth: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          display: true, position: 'right',
          labels: { color: getTextColor(), font: { size: 11 }, padding: 8, boxWidth: 12 }
        },
        tooltip: getDefaultOptions().plugins.tooltip
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartAreas(container, lub) {
  const canvas = container.querySelector('#chart-lub-areas');
  if (!canvas) return;
  const col = getColors();

  const areas = {};
  lub.forEach(l => { areas[l.area] = (areas[l.area] || 0) + 1; });

  const labels = Object.keys(areas);
  const values = Object.values(areas);
  const palette = [col.verde.border, col.naranja.border, col.azul.border, col.cyan.border, col.purple.border, col.amber.border, col.rose.border];

  const ch = createChart('chart-lub-areas', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Puntos',
        data: values,
        backgroundColor: labels.map((_, i) => palette[i % palette.length] + '55'),
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
        tooltip: getDefaultOptions().plugins.tooltip
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// MAPA DE AREAS
// ════════════════════════════════════════════════════════
function renderMapa(container, lub) {
  const grid = container.querySelector('#mapa-lub-areas');
  if (!grid) return;

  const iconArea = {
    'Recepcion': '📦', 'Acondicionado': '🔧', 'Tuneles IQF': '❄️',
    'Empaque': '📦', 'Camaras Frio': '🧊', 'Sala Maquinas': '⚙️',
    'Sala Calderas': '🔥', 'PTAP': '💧', 'Servicios': '⚡', 'Logistica': '🚚'
  };

  const areas = {};
  lub.forEach(l => {
    if (!areas[l.area]) areas[l.area] = { total: 0, vencidos: 0, proximos: 0, programados: 0 };
    areas[l.area].total++;
    if (l.estado === 'vencido') areas[l.area].vencidos++;
    else if (l.estado === 'proximo') areas[l.area].proximos++;
    else areas[l.area].programados++;
  });

  const entries = Object.entries(areas).sort((a, b) => b[1].total - a[1].total);

  if (!entries.length) {
    grid.innerHTML = '<div class="empty-state">Sin áreas registradas</div>';
    return;
  }

  grid.innerHTML = entries.map(([nombre, s]) => {
    const cls = s.vencidos > 0 ? 'has-vencidos' : s.proximos > 0 ? 'has-proximos' : '';
    return `<div class="mapa-area-card ${cls}">
      <div class="mapa-area-icon">${iconArea[nombre] || '🏭'}</div>
      <div class="mapa-area-nombre">${escapeHtml(nombre)}</div>
      <div style="display:flex;align-items:baseline;gap:6px">
        <div class="mapa-area-total">${s.total}</div>
        <div class="mapa-area-label">puntos</div>
      </div>
      <div class="mapa-area-stats">
        ${s.vencidos > 0 ? `<span class="mapa-area-chip" style="background:rgba(225,29,72,.15);color:var(--rose)">⚠️ ${s.vencidos} venc.</span>` : ''}
        ${s.proximos > 0 ? `<span class="mapa-area-chip" style="background:rgba(217,119,6,.15);color:var(--amber)">⏰ ${s.proximos} prox.</span>` : ''}
        ${s.programados > 0 ? `<span class="mapa-area-chip" style="background:rgba(22,163,74,.15);color:var(--verde)">✓ ${s.programados} OK</span>` : ''}
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// TABLA
// ════════════════════════════════════════════════════════
function renderTabla(container) {
  const tbody = container.querySelector('#tbl-lub-body');
  const count = container.querySelector('#tbl-lub-count');
  if (!tbody) return;

  const data = getMantData();
  let lub = (data.lubricacion || []).slice();

  if (filterEstado !== 'all') lub = lub.filter(l => l.estado === filterEstado);
  if (filterFrec !== 'all') lub = lub.filter(l => l.frecuencia === filterFrec);

  // Ordenar por dias restantes ascendente (vencidos primero)
  lub.sort((a, b) => a.diasRestantes - b.diasRestantes);

  if (count) count.textContent = `${lub.length} registros`;

  if (!lub.length) {
    tbody.innerHTML = '<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:32px">No hay puntos con los filtros actuales</td></tr>';
    return;
  }

  tbody.innerHTML = lub.map(l => {
    const estadoBadge = {
      'vencido': '<span class="badge badge-rose">⚠️ Vencido</span>',
      'proximo': '<span class="badge badge-amber">⏰ Próximo</span>',
      'programado': '<span class="badge badge-verde">✓ Programado</span>'
    }[l.estado] || escapeHtml(l.estado);

    const diasClass = l.diasRestantes < 0 ? 'dias-neg' : l.diasRestantes < 7 ? 'dias-amber' : 'dias-pos';
    const diasText = l.diasRestantes < 0 ? `${l.diasRestantes}d` : `${l.diasRestantes}d`;

    const lubBadge = `<span class="badge badge-${escapeAttr(l.color || 'azul')}"><span class="lub-dot" style="background:currentColor"></span>${escapeHtml(l.lubricante)}</span>`;

    return `<tr>
      <td><strong>${escapeHtml(l.id)}</strong></td>
      <td>${escapeHtml(l.equipo)}<br><small style="color:var(--muted)">${escapeHtml(l.equipoNombre)}</small></td>
      <td>${escapeHtml(l.area)}</td>
      <td>${escapeHtml(l.puntoLubricacion)}</td>
      <td>${lubBadge}</td>
      <td>${escapeHtml(l.frecuencia)}</td>
      <td><strong>${fmt(l.cantidad)} ${escapeHtml(l.unidad)}</strong></td>
      <td style="white-space:nowrap">${fmtDate(l.proximaFecha)}</td>
      <td class="${diasClass}">${diasText}</td>
      <td>${estadoBadge}</td>
      <td><button class="btn-ejecutar-lub" data-lub-id="${escapeAttr(l.id)}">▶ Ejecutar</button></td>
    </tr>`;
  }).join('');

  // Wire ejecutar
  tbody.querySelectorAll('.btn-ejecutar-lub').forEach(btn => {
    btn.addEventListener('click', () => ejecutarPunto(btn.dataset.lubId, container));
  });
}

// ════════════════════════════════════════════════════════
// EJECUTAR
// ════════════════════════════════════════════════════════
function ejecutarPunto(id, container) {
  const data = getMantData();
  const p = (data.lubricacion || []).find(l => l.id === id);
  if (!p) return;

  // Reprogramar segun frecuencia
  const frecDias = { Diario: 1, Semanal: 7, Mensual: 30, Trimestral: 90 };
  const dias = frecDias[p.frecuencia] || 30;

  const nueva = new Date();
  nueva.setDate(nueva.getDate() + dias);
  p.proximaFecha = nueva.toISOString().substring(0, 10);
  p.diasRestantes = dias;
  p.estado = 'programado';

  saveMantData(data);
  loadAll(container);

  // Feedback visual
  const fb = document.createElement('div');
  fb.textContent = `✅ Punto ${id} ejecutado. Próxima: ${p.proximaFecha}`;
  fb.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--verde);color:white;padding:12px 18px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:9999;font-weight:600';
  document.body.appendChild(fb);
  setTimeout(() => fb.remove(), 2600);
}

function ejecutarRutaCompleta(container) {
  const data = getMantData();
  const pendientes = (data.lubricacion || []).filter(l => l.estado === 'vencido' || l.estado === 'proximo');

  if (!pendientes.length) {
    alert('✅ No hay puntos pendientes de ejecutar en la ruta');
    return;
  }

  if (!confirm(`🚀 Ejecutar ${pendientes.length} puntos pendientes (vencidos + próximos)?`)) return;

  const frecDias = { Diario: 1, Semanal: 7, Mensual: 30, Trimestral: 90 };
  pendientes.forEach(p => {
    const dias = frecDias[p.frecuencia] || 30;
    const nueva = new Date();
    nueva.setDate(nueva.getDate() + dias);
    p.proximaFecha = nueva.toISOString().substring(0, 10);
    p.diasRestantes = dias;
    p.estado = 'programado';
  });

  saveMantData(data);
  loadAll(container);
  alert(`✅ Ruta completada: ${pendientes.length} puntos ejecutados`);
}
