/* ════════════════════════════════════════════════════════
   INDICADORES DE PRODUCCION
   ════════════════════════════════════════════════════════ */

import { supabase } from '/assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '/assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '/assets/js/utils/chart-helpers.js';

let charts = [];

export async function init(container) {
  // Filter chips
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });

  await loadData(container);
}

async function loadData(container) {
  try {
    // Last 30 days of production
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const { data } = await supabase
      .from('registro_produccion')
      .select('fecha, fruta, consumo_mp, producto_terminado, personal, turno')
      .gte('fecha', sinceStr)
      .order('fecha', { ascending: false });

    if (data && data.length > 0) {
      updateKPIs(container, data);
      buildCharts(container, data);
      buildTable(container, data);
    } else {
      setVal(container, 'ind-tn-semana', '0 TN');
      setVal(container, 'ind-tn-change', 'Sin datos');
      setVal(container, 'ind-tn-campana', '0 TN');
      setVal(container, 'ind-rendimiento', '0%');
      setVal(container, 'ind-rend-change', 'Sin datos');
      setVal(container, 'ind-cajas', '0');
    }
  } catch (err) {
    console.error('Error indicadores:', err);
    setVal(container, 'ind-tn-semana', 'Error');
    setVal(container, 'ind-tn-change', 'Sin conexion');
  }
}

function updateKPIs(container, data) {
  // Last 7 days = week
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekStr = weekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const weekData = data.filter(r => r.fecha >= weekStr);
  const totalMP = weekData.reduce((s, r) => s + (r.consumo_mp || 0), 0);
  const totalPT = weekData.reduce((s, r) => s + (r.producto_terminado || 0), 0);
  const rend = totalMP > 0 ? (totalPT / totalMP * 100) : 0;

  setVal(container, 'ind-tn-semana', fmt(totalPT / 1000, 1) + ' TN');
  setVal(container, 'ind-tn-change', fmt(totalMP / 1000, 1) + ' TN MP consumida');
  setVal(container, 'ind-tn-campana', fmt(data.reduce((s, r) => s + (r.producto_terminado || 0), 0) / 1000, 1) + ' TN');
  setVal(container, 'ind-rendimiento', fmtPct(rend));
  setVal(container, 'ind-rend-change', rend >= 50 ? '▲ Sobre objetivo' : '▼ Bajo objetivo 50%');
  setVal(container, 'ind-cajas', fmt(Math.round(totalPT / 10)));
}

function buildCharts(container, data) {
  const colors = getColors();

  // Group by week
  const weeks = {};
  data.forEach(r => {
    const d = new Date(r.fecha + 'T00:00:00');
    const week = getWeekNumber(d);
    const key = `S${week}`;
    if (!weeks[key]) weeks[key] = { mp: 0, pt: 0 };
    weeks[key].mp += r.consumo_mp || 0;
    weeks[key].pt += r.producto_terminado || 0;
  });

  const weekLabels = Object.keys(weeks).slice(-6);
  const weekPT = weekLabels.map(w => (weeks[w].pt / 1000).toFixed(1));
  const weekRend = weekLabels.map(w => weeks[w].mp > 0 ? (weeks[w].pt / weeks[w].mp * 100).toFixed(1) : 0);

  const c1 = createChart('chartTNSemana', {
    type: 'bar',
    data: {
      labels: weekLabels,
      datasets: [{
        label: 'TN Procesadas',
        data: weekPT,
        backgroundColor: colors.verde.bg,
        borderColor: colors.verde.border,
        borderWidth: 2, borderRadius: 8
      }]
    },
    options: getDefaultOptions('bar')
  });

  const c2 = createChart('chartRendSemana', {
    type: 'line',
    data: {
      labels: weekLabels,
      datasets: [{
        label: 'Rendimiento %',
        data: weekRend,
        borderColor: colors.naranja.border,
        backgroundColor: colors.naranja.bg,
        fill: true, tension: 0.4, pointRadius: 4,
        pointBackgroundColor: colors.naranja.border
      }]
    },
    options: getDefaultOptions('line')
  });

  charts = [c1, c2].filter(Boolean);
  window.__activeCharts = [...(window.__activeCharts || []), ...charts];
}

function buildTable(container, data) {
  const tbody = container.querySelector('#ind-tabla');
  if (!tbody) return;

  // Group by date+fruta
  const grouped = {};
  data.forEach(r => {
    const key = r.fecha + '|' + (r.fruta || 'Mango');
    if (!grouped[key]) grouped[key] = { fecha: r.fecha, fruta: r.fruta || 'Mango', t1mp: 0, t1pt: 0, t2mp: 0, t2pt: 0 };
    if (r.turno === 'DIA' || r.turno === 'TURNO DIA') {
      grouped[key].t1mp += r.consumo_mp || 0;
      grouped[key].t1pt += r.producto_terminado || 0;
    } else {
      grouped[key].t2mp += r.consumo_mp || 0;
      grouped[key].t2pt += r.producto_terminado || 0;
    }
  });

  const rows = Object.values(grouped).slice(0, 10);
  tbody.innerHTML = rows.map(r => {
    const t1r = r.t1mp > 0 ? (r.t1pt / r.t1mp * 100).toFixed(1) : '-';
    const t2r = r.t2mp > 0 ? (r.t2pt / r.t2mp * 100).toFixed(1) : '-';
    const totalMP = r.t1mp + r.t2mp;
    const totalPT = r.t1pt + r.t2pt;
    const totalR = totalMP > 0 ? (totalPT / totalMP * 100).toFixed(1) : '-';
    return `<tr>
      <td>${r.fecha}</td><td>${r.fruta}</td>
      <td style="font-family:monospace">${fmt(r.t1mp)}</td><td style="font-family:monospace">${fmt(r.t1pt)}</td><td style="color:var(--verde);font-weight:600">${t1r}%</td>
      <td style="font-family:monospace">${r.t2mp > 0 ? fmt(r.t2mp) : '-'}</td><td style="font-family:monospace">${r.t2pt > 0 ? fmt(r.t2pt) : '-'}</td><td style="color:var(--verde);font-weight:600">${t2r}%</td>
      <td style="font-family:monospace;font-weight:700">${fmt(totalMP)}</td><td style="color:var(--verde);font-weight:700">${totalR}%</td>
    </tr>`;
  }).join('') || '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px">Sin datos</td></tr>';
}

function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7);
}

function setVal(container, id, val) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = val;
}

export function refresh() {
  const container = document.getElementById('panel-indicadores');
  if (container) loadData(container);
}
