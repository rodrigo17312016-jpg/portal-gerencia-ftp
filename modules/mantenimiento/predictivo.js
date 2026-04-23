/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - PREDICTIVO
   Monitoreo de condiciones con tecnicas predictivas
   ════════════════════════════════════════════════════════ */

import { fmt, fmtPct, fmtDate } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';
import { getMantData } from './data-mock.js';
import { addDemoBanner } from '../../assets/js/utils/demo-banner.js';

let charts = [];
let refreshTimer = null;
let filterTecnica = 'all';
let filterEstado = 'all';

// Mapeo: slug en UI -> nombre en data
const TECNICA_MAP = {
  vibraciones: 'Analisis de Vibraciones',
  termografia: 'Termografia Infrarroja',
  aceite: 'Analisis de Aceite',
  ultrasonido: 'Ultrasonido'
};

const TECNICA_MAP_INV = Object.fromEntries(
  Object.entries(TECNICA_MAP).map(([k, v]) => [v, k])
);

const TECNICA_COLORS = {
  vibraciones: { bg: 'rgba(37,99,235,0.15)', border: '#2563eb' },
  termografia: { bg: 'rgba(225,29,72,0.15)', border: '#e11d48' },
  aceite: { bg: 'rgba(217,119,6,0.15)', border: '#d97706' },
  ultrasonido: { bg: 'rgba(124,58,237,0.15)', border: '#7c3aed' }
};

const ESTADO_COLOR = {
  normal: '#16a34a',
  alerta: '#d97706',
  critico: '#e11d48'
};

export async function init(container) {
  addDemoBanner(container);
  // Filtros tecnica
  container.querySelectorAll('[data-pd-tecnica]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-pd-tecnica]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterTecnica = chip.dataset.pdTecnica;
      renderTabla(container);
    });
  });

  // Filtros estado
  container.querySelectorAll('[data-pd-estado]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-pd-estado]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterEstado = chip.dataset.pdEstado;
      renderTabla(container);
    });
  });

  container.querySelector('#btn-nuevo-analisis')?.addEventListener('click', () => {
    alert('Funcionalidad de registro de nuevo analisis en construccion.');
  });

  await loadAll(container);

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const c = document.getElementById('panel-predictivo') || document.querySelector('.active-panel');
    if (c) loadAll(c);
  }, 60000);
}

export function refresh() {
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];
  const c = document.getElementById('panel-predictivo') || document.querySelector('.active-panel');
  if (c) loadAll(c);
}

async function loadAll(container) {
  const data = getMantData();
  const predictivo = data.predictivo || [];

  // KPIs
  const total = predictivo.length;
  const normal = predictivo.filter(p => p.estado === 'normal').length;
  const alerta = predictivo.filter(p => p.estado === 'alerta').length;
  const critico = predictivo.filter(p => p.estado === 'critico').length;

  setText(container, 'pd-kpi-total', fmt(total));
  setText(container, 'pd-kpi-normal', fmt(normal));
  setText(container, 'pd-kpi-alerta', fmt(alerta));
  setText(container, 'pd-kpi-critico', fmt(critico));

  // Destruir charts
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];

  // Tarjetas por tecnica
  renderTechCards(container, predictivo);

  // Scatter
  renderScatter(container, predictivo);

  // Tabla
  renderTabla(container);
}

function setText(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

// ════════════════════════════════════════════════════════
// TARJETAS POR TECNICA
// ════════════════════════════════════════════════════════
function renderTechCards(container, predictivo) {
  container.querySelectorAll('.pd-tech-card').forEach(card => {
    const slug = card.dataset.tech;
    const tecnicaName = TECNICA_MAP[slug];
    const items = predictivo.filter(p => p.tecnica === tecnicaName);

    // Ordenar por fecha desc
    items.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const count = items.length;
    const criticos = items.filter(i => i.estado === 'critico').length;
    const critPct = count > 0 ? (criticos / count * 100) : 0;
    const ultimo = items[0];

    const unit = ultimo?.unidad || '—';
    const countEl = card.querySelector('[data-tech-count]');
    const critEl = card.querySelector('[data-tech-crit-pct]');
    const lastValEl = card.querySelector('[data-tech-last-val]');
    const lastEqEl = card.querySelector('[data-tech-last-equipo]');
    const unitEl = card.querySelector('[data-tech-unit]');

    if (countEl) countEl.textContent = fmt(count);
    if (critEl) critEl.textContent = fmtPct(critPct, 0);
    if (lastValEl) lastValEl.textContent = ultimo ? ultimo.valor.toFixed(2) : '—';
    if (lastEqEl) lastEqEl.textContent = ultimo ? `Ultimo: ${ultimo.equipoNombre}` : 'Sin mediciones';
    if (unitEl) unitEl.textContent = unit;

    // Sparkline
    const canvas = card.querySelector('[data-tech-sparkline]');
    if (canvas && items.length) {
      drawSparkline(canvas, items.slice(0, 12).reverse(), slug);
    }
  });
}

function drawSparkline(canvas, items, slug) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (!items.length) return;

  const values = items.map(i => i.valor);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const colors = TECNICA_COLORS[slug] || TECNICA_COLORS.vibraciones;

  // Fill area
  ctx.beginPath();
  ctx.moveTo(0, h);
  items.forEach((item, i) => {
    const x = (i / (items.length - 1 || 1)) * w;
    const y = h - ((item.valor - min) / range * (h - 8)) - 4;
    if (i === 0) ctx.lineTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.lineTo(w, h);
  ctx.closePath();
  ctx.fillStyle = colors.bg;
  ctx.fill();

  // Line
  ctx.beginPath();
  items.forEach((item, i) => {
    const x = (i / (items.length - 1 || 1)) * w;
    const y = h - ((item.valor - min) / range * (h - 8)) - 4;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  });
  ctx.strokeStyle = colors.border;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Puntos con color segun estado
  items.forEach((item, i) => {
    const x = (i / (items.length - 1 || 1)) * w;
    const y = h - ((item.valor - min) / range * (h - 8)) - 4;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 2 * Math.PI);
    ctx.fillStyle = ESTADO_COLOR[item.estado] || '#999';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
  });
}

// ════════════════════════════════════════════════════════
// SCATTER PLOT
// ════════════════════════════════════════════════════════
function renderScatter(container, predictivo) {
  const canvas = container.querySelector('#pd-chart-scatter');
  if (!canvas) return;

  // Equipos unicos en orden
  const equiposSet = [...new Set(predictivo.map(p => p.equipoNombre))].sort();
  const equipoIndex = Object.fromEntries(equiposSet.map((e, i) => [e, i]));

  // Normalizar valor 0-100 segun limite alerta
  const norm = (p) => {
    const max = p.limiteAlerta || 1;
    return Math.min(100, (p.valor / max) * 100);
  };

  // Separar por estado para distinto color
  const normalPts = [];
  const alertaPts = [];
  const criticoPts = [];

  predictivo.forEach(p => {
    const point = {
      x: norm(p),
      y: equipoIndex[p.equipoNombre],
      equipo: p.equipoNombre,
      tecnica: p.tecnica,
      valor: p.valor,
      unidad: p.unidad,
      estado: p.estado
    };
    if (p.estado === 'normal') normalPts.push(point);
    else if (p.estado === 'alerta') alertaPts.push(point);
    else if (p.estado === 'critico') criticoPts.push(point);
  });

  const ch = createChart('pd-chart-scatter', {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'Normal', data: normalPts, backgroundColor: ESTADO_COLOR.normal, borderColor: '#fff', borderWidth: 1.5, pointRadius: 7, pointHoverRadius: 10 },
        { label: 'Alerta', data: alertaPts, backgroundColor: ESTADO_COLOR.alerta, borderColor: '#fff', borderWidth: 1.5, pointRadius: 8, pointHoverRadius: 11 },
        { label: 'Critico', data: criticoPts, backgroundColor: ESTADO_COLOR.critico, borderColor: '#fff', borderWidth: 1.5, pointRadius: 9, pointHoverRadius: 12 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: {
            title: (items) => items[0].raw.equipo,
            label: (ctx) => {
              const r = ctx.raw;
              return [
                r.tecnica,
                `Valor: ${r.valor.toFixed(2)} ${r.unidad}`,
                `Estado: ${r.estado.toUpperCase()}`,
                `Normalizado: ${r.x.toFixed(0)}%`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          min: 0, max: 110,
          title: { display: true, text: 'Valor normalizado (% del limite de alerta)', color: getTextColor(), font: { size: 11, weight: '600' } },
          ticks: { color: getTextColor(), font: { size: 11 }, callback: (v) => v + '%' },
          grid: { color: 'rgba(0,0,0,0.04)' }
        },
        y: {
          title: { display: true, text: 'Equipo', color: getTextColor(), font: { size: 11, weight: '600' } },
          ticks: {
            color: getTextColor(), font: { size: 10 },
            stepSize: 1,
            callback: (v) => equiposSet[v] ? (equiposSet[v].length > 22 ? equiposSet[v].slice(0, 22) + '…' : equiposSet[v]) : ''
          },
          grid: { color: 'rgba(0,0,0,0.04)' }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// TABLA
// ════════════════════════════════════════════════════════
function renderTabla(container) {
  const tbody = container.querySelector('#pd-tbody');
  const subtitle = container.querySelector('#pd-count-subtitle');
  if (!tbody) return;

  const data = getMantData();
  let items = (data.predictivo || []).slice();

  if (filterTecnica !== 'all') {
    const nombre = TECNICA_MAP[filterTecnica];
    items = items.filter(i => i.tecnica === nombre);
  }
  if (filterEstado !== 'all') items = items.filter(i => i.estado === filterEstado);

  // Criticos primero
  const ord = { critico: 0, alerta: 1, normal: 2 };
  items.sort((a, b) => {
    const dif = (ord[a.estado] ?? 9) - (ord[b.estado] ?? 9);
    if (dif !== 0) return dif;
    return new Date(b.fecha) - new Date(a.fecha);
  });

  if (subtitle) subtitle.textContent = `Mostrando ${items.length} analisis`;

  if (!items.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px">Sin analisis en este filtro</td></tr>';
    return;
  }

  tbody.innerHTML = items.map(i => {
    const estadoBadge = {
      normal: '<span class="badge badge-verde">Normal</span>',
      alerta: '<span class="badge badge-amber">Alerta</span>',
      critico: '<span class="badge badge-rose">Critico</span>'
    }[i.estado] || escapeHtml(i.estado);

    const tecSlug = TECNICA_MAP_INV[i.tecnica] || 'vibraciones';
    const tecColor = { vibraciones: 'azul', termografia: 'rose', aceite: 'amber', ultrasonido: 'purple' }[tecSlug];
    const tecBadge = `<span class="badge badge-${tecColor}">${escapeHtml(i.tecnica.replace('Analisis de ', '').replace('Termografia ', 'Termo. '))}</span>`;

    return `<tr>
      <td><strong>${escapeHtml(i.id)}</strong></td>
      <td>${escapeHtml(i.equipo)}<br><span style="font-size:11px;color:var(--muted)">${escapeHtml(i.equipoNombre)}</span></td>
      <td>${escapeHtml(i.area)}</td>
      <td>${tecBadge}</td>
      <td style="text-align:right;font-weight:700">${i.valor.toFixed(2)} <span style="font-size:10px;color:var(--muted)">${escapeHtml(i.unidad)}</span></td>
      <td style="text-align:right;font-size:12px;color:var(--muted)">${i.limiteOk.toFixed(1)}</td>
      <td style="text-align:right;font-size:12px;color:var(--muted)">${i.limiteAlerta.toFixed(1)}</td>
      <td>${estadoBadge}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(i.fecha)}</td>
      <td style="font-size:12px">${escapeHtml(i.tecnico)}</td>
    </tr>`;
  }).join('');
}
