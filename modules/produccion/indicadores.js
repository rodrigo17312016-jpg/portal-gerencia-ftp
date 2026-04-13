/* ════════════════════════════════════════════════════════
   INDICADORES DE PRODUCCION
   KPIs semanales, charts de TN y rendimiento, tabla diaria
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

let charts = [];
let allData = [];
let activeFilter = 'all';
let weekFilter = 'current';

export async function init(container) {
  // Filter chips - fruta
  container.querySelectorAll('.filter-chip[data-fruta]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip[data-fruta]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilter = chip.dataset.fruta;
      renderAll(container);
    });
  });

  // Week selector
  const weekSel = container.querySelector('#indWeekSelect');
  if (weekSel) {
    weekSel.addEventListener('change', () => {
      weekFilter = weekSel.value;
      renderAll(container);
    });
  }

  await loadData(container);
}

async function loadData(container) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const { data, error } = await supabase
      .from('registro_produccion')
      .select('fecha, fruta, consumo_mp, producto_terminado, personal, turno')
      .gte('fecha', sinceStr)
      .order('fecha', { ascending: false });

    if (error) throw error;
    allData = data || [];

    if (allData.length > 0) {
      renderAll(container);
    } else {
      setVal(container, 'ind-tn-semana', '0 TN');
      setChangeIndicator(container, 'ind-tn-change', 0, 'Sin datos');
      setVal(container, 'ind-tn-campana', '0 TN');
      setVal(container, 'ind-rendimiento', '0%');
      setChangeIndicator(container, 'ind-rend-change', 0, 'Sin datos');
      setVal(container, 'ind-cajas', '0');
    }
  } catch (err) {
    console.error('Error indicadores:', err);
    setVal(container, 'ind-tn-semana', 'Error');
    setChangeIndicator(container, 'ind-tn-change', 0, 'Sin conexion');
  }
}

function getFilteredData() {
  let data = [...allData];
  if (activeFilter !== 'all') {
    data = data.filter(r => (r.fruta || 'mango').toLowerCase() === activeFilter);
  }
  return data;
}

function getWeekData(data) {
  const now = new Date();
  if (weekFilter === 'current') {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekStr = weekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return data.filter(r => r.fecha >= weekStr);
  } else if (weekFilter === 'last') {
    const twoWeeksAgo = new Date();
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const startStr = twoWeeksAgo.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const endStr = weekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    return data.filter(r => r.fecha >= startStr && r.fecha < endStr);
  }
  return data; // 'all' = ultimas 4 semanas
}

function renderAll(container) {
  const data = getFilteredData();
  updateKPIs(container, data);
  buildCharts(container, data);
  buildTable(container, data);
}

function updateKPIs(container, data) {
  const weekData = getWeekData(data);
  const totalMP = weekData.reduce((s, r) => s + (r.consumo_mp || 0), 0);
  const totalPT = weekData.reduce((s, r) => s + (r.producto_terminado || 0), 0);
  const rend = totalMP > 0 ? (totalPT / totalMP * 100) : 0;

  // Compare with previous week
  const prevWeekAgo = new Date();
  prevWeekAgo.setDate(prevWeekAgo.getDate() - 14);
  const prevWeekStr = prevWeekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const oneWeekStr = oneWeekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
  const prevWeekData = data.filter(r => r.fecha >= prevWeekStr && r.fecha < oneWeekStr);
  const prevPT = prevWeekData.reduce((s, r) => s + (r.producto_terminado || 0), 0);
  const prevMP = prevWeekData.reduce((s, r) => s + (r.consumo_mp || 0), 0);
  const prevRend = prevMP > 0 ? (prevPT / prevMP * 100) : 0;

  // TN Procesadas (semana)
  setVal(container, 'ind-tn-semana', fmt(totalPT / 1000, 1) + ' TN');
  const tnChange = prevPT > 0 ? ((totalPT - prevPT) / prevPT * 100) : 0;
  setChangeIndicator(container, 'ind-tn-change', tnChange, fmt(totalMP / 1000, 1) + ' TN MP consumida');

  // TN Campana
  const allPT = data.reduce((s, r) => s + (r.producto_terminado || 0), 0);
  setVal(container, 'ind-tn-campana', fmt(allPT / 1000, 1) + ' TN');
  const metaPct = Math.round(allPT / 1000 / 2000 * 100);
  setVal(container, 'ind-tn-meta', `Meta: 2,000 TN · ${metaPct}% cumplido`);

  // Rendimiento
  setVal(container, 'ind-rendimiento', fmtPct(rend));
  const rendChange = prevRend > 0 ? (rend - prevRend) : 0;
  const rendEl = container.querySelector('#ind-rend-change');
  if (rendEl) {
    const isUp = rendChange >= 0;
    rendEl.textContent = `${isUp ? '▲' : '▼'} ${Math.abs(rendChange).toFixed(1)}% vs semana ant.`;
    rendEl.className = `kpi-change ${isUp ? 'positive' : 'negative'}`;
  }

  // Cajas
  const cajas = Math.round(allPT / 10);
  setVal(container, 'ind-cajas', fmt(cajas));
  setVal(container, 'ind-cajas-meta', `Campana actual · ~${fmt(cajas)} cajas x 10kg`);
}

function setChangeIndicator(container, id, pctChange, fallbackText) {
  const el = container.querySelector('#' + id);
  if (!el) return;
  if (pctChange !== 0 && !isNaN(pctChange)) {
    const isUp = pctChange > 0;
    el.textContent = `${isUp ? '▲' : '▼'} ${Math.abs(pctChange).toFixed(1)}% ${fallbackText ? '· ' + fallbackText : ''}`;
    el.className = `kpi-change ${isUp ? 'positive' : 'negative'}`;
  } else {
    el.textContent = fallbackText || 'Sin datos';
    el.className = 'kpi-change';
    el.style.color = 'var(--muted)';
  }
}

function buildCharts(container, data) {
  const colors = getColors();

  // Group by week number
  const weeks = {};
  data.forEach(r => {
    const d = new Date(r.fecha + 'T00:00:00');
    const week = getWeekNumber(d);
    const key = `S${week}`;
    if (!weeks[key]) weeks[key] = { mp: 0, pt: 0, count: 0 };
    weeks[key].mp += r.consumo_mp || 0;
    weeks[key].pt += r.producto_terminado || 0;
    weeks[key].count++;
  });

  const weekLabels = Object.keys(weeks).slice(-6);
  const weekPT = weekLabels.map(w => +(weeks[w].pt / 1000).toFixed(1));
  const weekRend = weekLabels.map(w => weeks[w].mp > 0 ? +(weeks[w].pt / weeks[w].mp * 100).toFixed(1) : 0);

  // Chart 1: TN Procesadas por Semana (bar)
  const c1 = createChart('chartTNSemana', {
    type: 'bar',
    data: {
      labels: weekLabels,
      datasets: [{
        label: 'TN Procesadas',
        data: weekPT,
        backgroundColor: colors.verde.bg,
        borderColor: colors.verde.border,
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        ...getDefaultOptions('bar').plugins,
        tooltip: {
          ...getDefaultOptions('bar').plugins.tooltip,
          callbacks: {
            label: ctx => `${ctx.parsed.y} TN procesadas`
          }
        }
      }
    }
  });

  // Chart 2: Rendimiento Semanal (line)
  const c2 = createChart('chartRendSemana', {
    type: 'line',
    data: {
      labels: weekLabels,
      datasets: [
        {
          label: 'Rendimiento %',
          data: weekRend,
          borderColor: colors.naranja.border,
          backgroundColor: colors.naranja.bg,
          fill: true,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: colors.naranja.border,
          pointHoverRadius: 7
        },
        {
          label: 'Objetivo 50%',
          data: weekLabels.map(() => 50),
          borderColor: colors.rose.border,
          borderDash: [6, 4],
          fill: false,
          pointRadius: 0,
          borderWidth: 2
        }
      ]
    },
    options: {
      ...getDefaultOptions('line'),
      plugins: {
        legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } },
        tooltip: {
          ...getDefaultOptions('line').plugins.tooltip,
          callbacks: {
            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%`
          }
        }
      }
    }
  });

  charts = [c1, c2].filter(Boolean);
  window.__activeCharts = [...(window.__activeCharts || []), ...charts];
}

function buildTable(container, data) {
  const tbody = container.querySelector('#ind-tabla');
  const countBadge = container.querySelector('#ind-row-count');
  if (!tbody) return;

  // Group by date+fruta, split by turno
  const grouped = {};
  data.forEach(r => {
    const fruta = r.fruta || 'Mango';
    const key = r.fecha + '|' + fruta;
    if (!grouped[key]) grouped[key] = { fecha: r.fecha, fruta, t1mp: 0, t1pt: 0, t2mp: 0, t2pt: 0 };
    const isDia = r.turno === 'DIA' || r.turno === 'TURNO DIA';
    if (isDia) {
      grouped[key].t1mp += r.consumo_mp || 0;
      grouped[key].t1pt += r.producto_terminado || 0;
    } else {
      grouped[key].t2mp += r.consumo_mp || 0;
      grouped[key].t2pt += r.producto_terminado || 0;
    }
  });

  const rows = Object.values(grouped)
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
    .slice(0, 15);

  if (countBadge) countBadge.textContent = `${rows.length} registros`;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px">Sin datos para el filtro seleccionado</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const t1r = r.t1mp > 0 ? (r.t1pt / r.t1mp * 100).toFixed(1) : '-';
    const t2r = r.t2mp > 0 ? (r.t2pt / r.t2mp * 100).toFixed(1) : '-';
    const totalMP = r.t1mp + r.t2mp;
    const totalPT = r.t1pt + r.t2pt;
    const totalR = totalMP > 0 ? (totalPT / totalMP * 100).toFixed(1) : '-';
    const rendColor = totalR !== '-' && parseFloat(totalR) >= 50 ? 'var(--verde)' : 'var(--naranja)';

    return `<tr>
      <td style="font-size:12px">${r.fecha}</td>
      <td><span class="badge badge-${getFrutaBadge(r.fruta)}">${r.fruta}</span></td>
      <td style="font-family:monospace">${fmt(r.t1mp)}</td>
      <td style="font-family:monospace">${fmt(r.t1pt)}</td>
      <td style="color:var(--verde);font-weight:600">${t1r !== '-' ? t1r + '%' : '-'}</td>
      <td style="font-family:monospace">${r.t2mp > 0 ? fmt(r.t2mp) : '-'}</td>
      <td style="font-family:monospace">${r.t2pt > 0 ? fmt(r.t2pt) : '-'}</td>
      <td style="color:var(--verde);font-weight:600">${t2r !== '-' ? t2r + '%' : '-'}</td>
      <td style="font-family:monospace;font-weight:700">${fmt(totalMP)}</td>
      <td style="color:${rendColor};font-weight:700">${totalR !== '-' ? totalR + '%' : '-'}</td>
    </tr>`;
  }).join('');
}

function getFrutaBadge(fruta) {
  const map = { 'Mango': 'amber', 'MANGO': 'amber', 'Arandano': 'purple', 'ARANDANO': 'purple', 'Granada': 'rose', 'GRANADA': 'rose' };
  return map[fruta] || 'verde';
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
