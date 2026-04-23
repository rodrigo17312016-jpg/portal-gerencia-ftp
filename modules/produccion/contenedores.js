/* ════════════════════════════════════════════════════════
   CONTENEDORES / DESPACHOS - Ejecutivo v4
   Agrupa empaque_congelado por cliente
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt } from '../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';
import { subscribeToTable, createLiveIndicator } from '../../assets/js/utils/realtime-helpers.js';

let empData = [];
let activeFilters = { rango: '60' };
let refreshInterval = null;
let realtimeSub = null;
let liveIndicator = null;

const FRUTA_COLORS = {
  'MANGO':    '#f59e0b',
  'ARANDANO': '#6366f1',
  'GRANADA':  '#be123c',
  'FRESA':    '#e11d48',
  'PALTA':    '#0e7c3a',
  'PIÑA':     '#eab308'
};

const CLIENT_COLORS = ['#1e40af', '#0e7490', '#6d28d9', '#b45309', '#be123c', '#0e7c3a', '#ea580c', '#6366f1'];

export async function init(container) {
  container.querySelectorAll('.filter-chip[data-cofilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.cofilter;
      container.querySelectorAll(`.filter-chip[data-cofilter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      loadData(container);
    });
  });

  const refreshBtn = container.querySelector('#contRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => refreshBtn.style.transform = '', 700);
    loadData(container);
  });

  await loadData(container);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (document.getElementById('panel-contenedores')) loadData(container);
    else destroy();
  }, 300000);

  // Realtime: reaccionar a cambios en registro_empaque_congelado
  if (!realtimeSub) {
    realtimeSub = subscribeToTable('registro_empaque_congelado', (payload) => {
      if (liveIndicator && liveIndicator.flash) liveIndicator.flash();
      if (document.getElementById('panel-contenedores')) loadData(container);
    });
  }
  if (!liveIndicator) {
    const headerActions = container.querySelector('.area-header-actions') || container.querySelector('.card-header-actions') || container.querySelector('.area-header > div:last-child');
    if (headerActions) {
      liveIndicator = createLiveIndicator();
      headerActions.insertBefore(liveIndicator, headerActions.firstChild);
    }
  }
}

async function loadData(container) {
  try {
    const dias = +activeFilters.rango;
    const since = new Date(); since.setDate(since.getDate() - dias);

    const { data } = await supabase.from('registro_empaque_congelado')
      .select('fecha, fruta, tipo, corte, cajas, kg_pt, kg_presentacion, cliente, lote_mp, supervisor')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha', { ascending: false });

    empData = data || [];

    const lastEl = container.querySelector('#contLastUpdate');
    if (lastEl) {
      const now = new Date();
      lastEl.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error contenedores:', err);
    empData = [];
  }

  render(container);
}

function render(container) {
  // KPIs
  const totalCajas = empData.reduce((s, r) => s + (+(r.cajas || 0)), 0);
  const totalKg = empData.reduce((s, r) => s + (+(r.kg_pt || 0)), 0);
  const totalTN = totalKg / 1000;
  const clientes = [...new Set(empData.map(r => (r.cliente || 'SIN CLIENTE').trim()).filter(Boolean))];
  const frutas = [...new Set(empData.map(r => r.fruta).filter(Boolean))];

  setVal(container, 'contCajas', fmt(totalCajas));
  setVal(container, 'contCajasSub', empData.length ? `${empData.length} registros` : 'Sin datos');
  setVal(container, 'contTN', totalTN.toFixed(1) + ' TN');
  setVal(container, 'contTNSub', fmt(totalKg) + ' kg PT');
  setVal(container, 'contClientes', clientes.length.toString());
  setVal(container, 'contClientesSub', clientes.length ? 'Activos en rango' : 'Sin clientes');
  setVal(container, 'contFrutas', frutas.length.toString());
  setVal(container, 'contFrutasSub', frutas.length ? 'Variedades exportadas' : 'Sin variedades');

  buildClientesChart();
  buildFrutasChart();
  buildTable(container);
}

function buildClientesChart() {
  const byC = {};
  empData.forEach(r => {
    const c = (r.cliente || 'SIN CLIENTE').trim().toUpperCase();
    byC[c] = (byC[c] || 0) + (+(r.cajas || 0));
  });

  const sorted = Object.entries(byC).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!sorted.length) return;

  const labels = sorted.map(([c]) => c.length > 18 ? c.slice(0, 18) + '…' : c);
  const values = sorted.map(([_, v]) => v);
  const colors = sorted.map((_, i) => CLIENT_COLORS[i % CLIENT_COLORS.length]);

  createChart('chartContClientes', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cajas', data: values,
        backgroundColor: colors.map(c => c + 'B3'),
        borderColor: colors,
        borderWidth: 2, borderRadius: 6
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      indexAxis: 'y',
      plugins: { legend: { display: false } }
    }
  });
}

function buildFrutasChart() {
  const byF = {};
  empData.forEach(r => {
    const f = (r.fruta || 'OTRO').toUpperCase();
    byF[f] = (byF[f] || 0) + (+(r.cajas || 0));
  });
  const frutas = Object.keys(byF).sort((a, b) => byF[b] - byF[a]);
  if (!frutas.length) return;
  const values = frutas.map(f => byF[f]);
  const colors = frutas.map(f => FRUTA_COLORS[f] || '#64748b');

  createChart('chartContFrutas', {
    type: 'doughnut',
    data: {
      labels: frutas,
      datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 3, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { color: '#64748b', font: { size: 11, weight: '600' }, padding: 10, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = values.reduce((s, v) => s + v, 0);
              const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${fmt(ctx.raw)} cajas (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function buildTable(container) {
  const tbody = container.querySelector('#contTabla');
  const tfoot = container.querySelector('#contFoot');
  if (!tbody) return;

  // Agrupar por cliente
  const byC = {};
  empData.forEach(r => {
    const c = (r.cliente || 'SIN CLIENTE').trim().toUpperCase();
    if (!byC[c]) byC[c] = { cajas: 0, kg: 0, frutas: new Set(), registros: 0, fechas: [] };
    byC[c].cajas += +(r.cajas || 0);
    byC[c].kg += +(r.kg_pt || 0);
    if (r.fruta) byC[c].frutas.add(r.fruta.toUpperCase());
    byC[c].registros++;
    if (r.fecha) byC[c].fechas.push(r.fecha);
  });

  const sorted = Object.entries(byC).sort((a, b) => b[1].cajas - a[1].cajas);
  setVal(container, 'contCountLabel', sorted.length + ' clientes');

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin despachos registrados</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = sorted.map(([c, v], i) => {
    const color = CLIENT_COLORS[i % CLIENT_COLORS.length];
    const fechas = v.fechas.sort();
    const primera = fechas[0] ? new Date(fechas[0] + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '—';
    const ultima = fechas[fechas.length - 1] ? new Date(fechas[fechas.length - 1] + 'T00:00:00').toLocaleDateString('es-PE', { day: '2-digit', month: 'short' }) : '—';
    const frutasArr = [...v.frutas];
    const frutasLbl = frutasArr.map(f => {
      const fc = FRUTA_COLORS[f] || '#64748b';
      return `<span style="padding:2px 6px;border-radius:4px;font-size:10px;background:${fc}15;color:${fc};border:1px solid ${fc}40;margin-right:3px">${escapeHtml(f)}</span>`;
    }).join('') || '—';

    return `<tr>
      <td style="font-weight:700;color:${color}">🚢 ${escapeHtml(c)}</td>
      <td>${frutasLbl}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--verde)">${fmt(v.cajas)}</td>
      <td style="font-family:monospace;font-weight:600">${fmt(v.kg)}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--naranja)">${(v.kg/1000).toFixed(2)}</td>
      <td style="font-family:monospace;text-align:center;font-weight:600">${v.registros}</td>
      <td style="font-family:monospace;font-size:11px;color:var(--muted)">${primera}</td>
      <td style="font-family:monospace;font-size:11px;color:var(--muted)">${ultima}</td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totalCajas = empData.reduce((s, r) => s + (+(r.cajas || 0)), 0);
    const totalKg = empData.reduce((s, r) => s + (+(r.kg_pt || 0)), 0);
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--azul-bg);border-top:2px solid var(--azul)">
      <td colspan="2" style="color:var(--azul)">🌐 TOTAL (${sorted.length} clientes)</td>
      <td style="font-family:monospace;color:var(--azul)">${fmt(totalCajas)}</td>
      <td style="font-family:monospace;color:var(--azul)">${fmt(totalKg)}</td>
      <td style="font-family:monospace;color:var(--naranja);font-weight:700">${(totalKg/1000).toFixed(2)} TN</td>
      <td style="font-family:monospace;text-align:center">${empData.length}</td>
      <td colspan="2"></td>
    </tr>`;
  }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-contenedores'); if (c) loadData(c); }
export function destroy() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  if (realtimeSub) { realtimeSub.unsubscribe(); realtimeSub = null; }
}

// Lifecycle: pausar al ocultar
export function onHide() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  if (realtimeSub) { realtimeSub.unsubscribe(); realtimeSub = null; }
}

// Reanudar al volver
export function onShow() {
  const c = document.getElementById('panel-contenedores');
  if (!c) return;
  loadData(c);
  if (!refreshInterval) {
    refreshInterval = setInterval(() => {
      const cc = document.getElementById('panel-contenedores');
      if (cc) loadData(cc);
    }, 300000);
  }
}
