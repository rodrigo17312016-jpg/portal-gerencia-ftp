/* ════════════════════════════════════════════════════════
   ALMUERZOS - Ejecutivo v4
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtSoles, today } from '../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';

let persData = [];
let costData = [];
let refreshInterval = null;

const AREA_COLORS = {
  'PRODUCCION':   '#0e7c3a',
  'ACONDICIONADO': '#0e7c3a',
  'EMPAQUE':       '#1e40af',
  'TUNELES':       '#0e7490',
  'RECEPCION':     '#ea580c',
  'CALIDAD':       '#6d28d9',
  'ALMACEN':       '#b45309'
};

export async function init(container) {
  const refreshBtn = container.querySelector('#almRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => refreshBtn.style.transform = '', 700);
    loadData(container);
  });

  await loadData(container);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (document.getElementById('panel-almuerzos')) loadData(container);
    else destroy();
  }, 300000);
}

async function loadData(container) {
  try {
    const hoy = today();
    const since = new Date(); since.setDate(since.getDate() - 14);
    const sinceISO = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const [pR, cR] = await Promise.all([
      supabase.from('registro_personal').select('fecha, num_personal, area').gte('fecha', sinceISO).order('fecha', { ascending: false }),
      supabase.from('config_costos').select('fecha, tarifa_almuerzo_soles, tarifa_almuerzo_usd').gte('fecha', sinceISO).order('fecha', { ascending: false })
    ]);

    persData = pR.data || [];
    costData = cR.data || [];

    const lastEl = container.querySelector('#almLastUpdate');
    if (lastEl) {
      const now = new Date();
      lastEl.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error almuerzos:', err);
    persData = []; costData = [];
  }

  render(container);
}

function render(container) {
  const hoy = today();
  const todayPers = persData.filter(r => r.fecha === hoy);
  const totalHoy = todayPers.reduce((s, r) => s + (r.num_personal || 0), 0);
  const costoAlm = costData.find(c => c.fecha === hoy)?.tarifa_almuerzo_soles || 0;
  const costoTotalHoy = totalHoy * costoAlm;

  setVal(container, 'almHoy', fmt(totalHoy));
  setVal(container, 'almHoySub', todayPers.length ? `${todayPers.length} areas registradas` : 'Sin registros hoy');
  setVal(container, 'almCostoTotal', fmtSoles(costoTotalHoy));
  setVal(container, 'almCostoTotalSub', `Tarifa: ${fmtSoles(costoAlm)}/pers`);
  setVal(container, 'almCostoPP', costoAlm > 0 ? fmtSoles(costoAlm) : '—');
  setVal(container, 'almCostoPPSub', costoAlm > 0 ? 'Configurado hoy' : 'Sin tarifa configurada');

  // 14 dias acumulado
  let total14d = 0;
  const fechas = [...new Set(persData.map(r => r.fecha))];
  fechas.forEach(f => {
    const dayPers = persData.filter(r => r.fecha === f).reduce((s, r) => s + (r.num_personal || 0), 0);
    const cU = costData.find(c => c.fecha === f)?.tarifa_almuerzo_soles || 0;
    total14d += dayPers * cU;
  });
  setVal(container, 'alm14d', fmtSoles(total14d));
  setVal(container, 'alm14dSub', `${fechas.length} dias registrados`);

  buildCostoChart();
  buildAreasChart();
  buildTable(container);
}

function buildCostoChart() {
  const fechas = [...new Set(persData.map(r => r.fecha))].sort();
  if (!fechas.length) return;

  const labels = fechas.map(f => {
    const d = new Date(f + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
  });
  const cantidades = fechas.map(f => persData.filter(r => r.fecha === f).reduce((s, r) => s + (r.num_personal || 0), 0));
  const costos = fechas.map((f, i) => {
    const cU = costData.find(c => c.fecha === f)?.tarifa_almuerzo_soles || 0;
    return cantidades[i] * cU;
  });

  createChart('chartAlmCosto', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Costo (S/)', data: costos, backgroundColor: 'rgba(180,83,9,0.7)', borderColor: '#b45309', borderWidth: 2, borderRadius: 6, yAxisID: 'y' },
        { label: 'Raciones', data: cantidades, type: 'line', borderColor: '#0e7c3a', backgroundColor: 'rgba(14,124,58,0.1)', fill: false, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#0e7c3a', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } },
      scales: {
        y:  { position: 'left',  title: { display: true, text: 'Costo S/', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'Raciones', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x:  { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(15,23,42,0.04)' } }
      }
    }
  });
}

function buildAreasChart() {
  const byA = {};
  persData.forEach(r => {
    const a = (r.area || 'SIN AREA').toUpperCase();
    byA[a] = (byA[a] || 0) + (r.num_personal || 0);
  });
  const areas = Object.keys(byA).sort((a, b) => byA[b] - byA[a]);
  if (!areas.length) return;
  const values = areas.map(a => byA[a]);
  const colors = areas.map(a => AREA_COLORS[a] || '#64748b');

  createChart('chartAlmAreas', {
    type: 'doughnut',
    data: {
      labels: areas,
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
              return ` ${ctx.label}: ${ctx.raw} raciones (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function buildTable(container) {
  const tbody = container.querySelector('#almTabla');
  const tfoot = container.querySelector('#almFoot');
  if (!tbody) return;

  const fechas = [...new Set(persData.map(r => r.fecha))].sort().reverse();
  if (!fechas.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin registros de personal</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = fechas.map(f => {
    const dayPers = persData.filter(r => r.fecha === f);
    const cantidad = dayPers.reduce((s, r) => s + (r.num_personal || 0), 0);
    const cU = costData.find(c => c.fecha === f)?.tarifa_almuerzo_soles || 0;
    const cT = cantidad * cU;
    const areas = [...new Set(dayPers.map(r => r.area).filter(Boolean))];
    const areasLbl = areas.map(a => {
      const color = AREA_COLORS[(a || '').toUpperCase()] || '#64748b';
      return `<span style="padding:2px 6px;border-radius:4px;font-size:10px;background:${color}15;color:${color};border:1px solid ${color}33;margin-right:3px">${escapeHtml(a)}</span>`;
    }).join('') || '—';
    const fechaD = new Date(f + 'T00:00:00');
    const fechaLbl = fechaD.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' });

    return `<tr>
      <td style="font-size:11.5px;font-family:monospace">${fechaLbl}</td>
      <td style="font-family:monospace;font-weight:700">${fmt(cantidad)}</td>
      <td style="font-family:monospace;color:var(--muted)">${fmtSoles(cU)}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--amber)">${fmtSoles(cT)}</td>
      <td>${areasLbl}</td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totalPers = persData.reduce((s, r) => s + (r.num_personal || 0), 0);
    let totalCost = 0;
    fechas.forEach(f => {
      const dp = persData.filter(r => r.fecha === f).reduce((s, r) => s + (r.num_personal || 0), 0);
      const cU = costData.find(c => c.fecha === f)?.tarifa_almuerzo_soles || 0;
      totalCost += dp * cU;
    });
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--amber-bg);border-top:2px solid var(--amber)">
      <td style="color:var(--amber)">🍽️ TOTAL (${fechas.length} dias)</td>
      <td style="font-family:monospace;color:var(--amber)">${fmt(totalPers)}</td>
      <td></td>
      <td style="font-family:monospace;color:var(--amber)">${fmtSoles(totalCost)}</td>
      <td></td>
    </tr>`;
  }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-almuerzos'); if (c) loadData(c); }
export function destroy() { if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; } }
