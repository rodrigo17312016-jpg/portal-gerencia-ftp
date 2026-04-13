/* ════════════════════════════════════════════════════════
   RENDIMIENTOS
   KPIs por fruta con objetivos, historico multi-linea,
   dia vs noche grouped bar, tabla por lote con status pills
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

const OBJECTIVES = { mango: 50, arandano: 85, granada: 45 };

let charts = [];

export async function init(container) {
  await loadData(container);
}

async function loadData(container) {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const sinceStr = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const { data, error } = await supabase
      .from('registro_produccion')
      .select('fecha, fruta, consumo_kg, pt_aprox_kg, turno, lote, proveedor, variedad')
      .gte('fecha', sinceStr)
      .order('fecha', { ascending: false });

    if (error) throw error;
    const recs = data || [];
    if (recs.length === 0) {
      setVal(container, 'rendMango', '—');
      setVal(container, 'rendArandano', '—');
      setVal(container, 'rendGranada', '—');
      setVal(container, 'rendPromedio', '—');
      return;
    }

    updateKPIs(container, recs);
    buildCharts(container, recs);
    buildTable(container, recs);
  } catch (err) {
    console.error('Error rendimientos:', err);
  }
}

function updateKPIs(container, data) {
  // Group by fruta
  const byFruta = {};
  data.forEach(r => {
    const f = (r.fruta || 'mango').toLowerCase();
    if (!byFruta[f]) byFruta[f] = { mp: 0, pt: 0 };
    byFruta[f].mp += r.consumo_kg || 0;
    byFruta[f].pt += r.pt_aprox_kg || 0;
  });

  // Rend per fruit + comparison vs objective
  ['mango', 'arandano', 'granada'].forEach(fruta => {
    const d = byFruta[fruta];
    const rend = d && d.mp > 0 ? (d.pt / d.mp * 100) : 0;
    const obj = OBJECTIVES[fruta];
    const kpiId = 'rend' + fruta.charAt(0).toUpperCase() + fruta.slice(1);
    const objId = kpiId + 'Obj';

    setVal(container, kpiId, d ? fmtPct(rend) : '—');

    const objEl = container.querySelector('#' + objId);
    if (objEl && d && d.mp > 0) {
      const diff = rend - obj;
      const isAbove = diff >= 0;
      objEl.textContent = `${isAbove ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}% vs obj ${obj}%`;
      objEl.style.color = isAbove ? 'var(--verde)' : 'var(--naranja)';
    }
  });

  // Promedio planta
  const totalMP = data.reduce((s, r) => s + (r.consumo_kg || 0), 0);
  const totalPT = data.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
  const promedio = totalMP > 0 ? (totalPT / totalMP * 100) : 0;
  setVal(container, 'rendPromedio', fmtPct(promedio));

  // Trend: compare last 7 days vs previous 7 days
  const trendEl = container.querySelector('#rendPromedioTrend');
  if (trendEl) {
    const now = new Date();
    const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
    const twoWeeksAgo = new Date(); twoWeeksAgo.setDate(now.getDate() - 14);
    const weekStr = weekAgo.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const twoWeekStr = twoWeeksAgo.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const recentData = data.filter(r => r.fecha >= weekStr);
    const prevData = data.filter(r => r.fecha >= twoWeekStr && r.fecha < weekStr);

    const recentMP = recentData.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const recentPT = recentData.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    const prevMP = prevData.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const prevPT = prevData.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);

    const recentRend = recentMP > 0 ? (recentPT / recentMP * 100) : 0;
    const prevRend = prevMP > 0 ? (prevPT / prevMP * 100) : 0;
    const diff = recentRend - prevRend;

    if (prevRend > 0) {
      trendEl.textContent = `${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}% vs semana ant.`;
      trendEl.className = `kpi-change ${diff >= 0 ? 'positive' : 'negative'}`;
    } else {
      trendEl.textContent = `Prom. 30 dias: ${fmt(totalMP)} kg MP`;
      trendEl.style.color = 'var(--muted)';
    }
  }
}

function buildCharts(container, data) {
  const colors = getColors();

  // ── Chart 1: Rendimiento Historico por Fruta (multi-line) ──
  const fechas = [...new Set(data.map(r => r.fecha))].sort().slice(-14);
  const frutas = [...new Set(data.map(r => (r.fruta || 'Mango').toLowerCase()))];

  const frutaColorMap = {
    mango: { border: colors.naranja.border, bg: colors.naranja.bg },
    arandano: { border: colors.purple.border, bg: colors.purple.bg },
    granada: { border: colors.rose.border, bg: colors.rose.bg },
    fresa: { border: colors.rose.border, bg: colors.rose.bg },
    palta: { border: colors.verde.border, bg: colors.verde.bg }
  };

  const datasets = frutas.map(fruta => {
    const fc = frutaColorMap[fruta] || { border: colors.cyan.border, bg: colors.cyan.bg };
    const rendPorFecha = fechas.map(f => {
      const recs = data.filter(r => r.fecha === f && (r.fruta || 'mango').toLowerCase() === fruta);
      const mp = recs.reduce((s, r) => s + (r.consumo_kg || 0), 0);
      const pt = recs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
      return mp > 0 ? +(pt / mp * 100).toFixed(1) : null;
    });
    return {
      label: fruta.charAt(0).toUpperCase() + fruta.slice(1),
      data: rendPorFecha,
      borderColor: fc.border,
      backgroundColor: fc.bg,
      fill: false,
      tension: 0.4,
      pointRadius: 4,
      pointBackgroundColor: fc.border,
      spanGaps: true
    };
  });

  const c1 = createChart('chartRendHistorico', {
    type: 'line',
    data: { labels: fechas.map(f => f.slice(5)), datasets },
    options: {
      ...getDefaultOptions('line'),
      plugins: {
        legend: { display: true, labels: { color: '#64748b', font: { size: 11 }, usePointStyle: true } },
        tooltip: {
          ...getDefaultOptions('line').plugins.tooltip,
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` }
        }
      }
    }
  });

  // ── Chart 2: Rendimiento Dia vs Noche (grouped bar per fruit) ──
  const frutaLabels = frutas.map(f => f.charAt(0).toUpperCase() + f.slice(1));

  const diaRends = frutas.map(fruta => {
    const recs = data.filter(r =>
      (r.fruta || 'mango').toLowerCase() === fruta &&
      (r.turno === 'DIA' || r.turno === 'TURNO DIA')
    );
    const mp = recs.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const pt = recs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    return mp > 0 ? +(pt / mp * 100).toFixed(1) : 0;
  });

  const nocheRends = frutas.map(fruta => {
    const recs = data.filter(r =>
      (r.fruta || 'mango').toLowerCase() === fruta &&
      (r.turno !== 'DIA' && r.turno !== 'TURNO DIA')
    );
    const mp = recs.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const pt = recs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    return mp > 0 ? +(pt / mp * 100).toFixed(1) : 0;
  });

  const c2 = createChart('chartRendTurno', {
    type: 'bar',
    data: {
      labels: frutaLabels,
      datasets: [
        {
          label: 'Turno Dia',
          data: diaRends,
          backgroundColor: colors.amber.bg,
          borderColor: colors.amber.border,
          borderWidth: 2,
          borderRadius: 6
        },
        {
          label: 'Turno Noche',
          data: nocheRends,
          backgroundColor: colors.azul.bg,
          borderColor: colors.azul.border,
          borderWidth: 2,
          borderRadius: 6
        }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } },
        tooltip: {
          ...getDefaultOptions('bar').plugins.tooltip,
          callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y}%` }
        }
      }
    }
  });

  charts = [c1, c2].filter(Boolean);
  window.__activeCharts = [...(window.__activeCharts || []), ...charts];
}

function buildTable(container, data) {
  const tbody = container.querySelector('#rendTabla');
  const countBadge = container.querySelector('#rendRowCount');
  if (!tbody) return;

  // Group by lote (or fecha+fruta if no lote)
  const byLote = {};
  data.forEach(r => {
    const lote = r.lote || r.fecha;
    const key = lote + '|' + (r.fruta || 'Mango');
    if (!byLote[key]) {
      byLote[key] = {
        lote,
        proveedor: r.proveedor || '—',
        variedad: r.variedad || (r.fruta || 'Mango'),
        mp: 0,
        pt: 0
      };
    }
    byLote[key].mp += r.consumo_kg || 0;
    byLote[key].pt += r.pt_aprox_kg || 0;
  });

  const rows = Object.values(byLote)
    .sort((a, b) => b.mp - a.mp)
    .slice(0, 20);

  if (countBadge) countBadge.textContent = `${rows.length} lotes`;

  if (rows.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Sin datos</td></tr>';
    return;
  }

  tbody.innerHTML = rows.map(r => {
    const rend = r.mp > 0 ? (r.pt / r.mp * 100) : 0;
    const status = getRendStatus(rend);
    return `<tr>
      <td style="font-family:monospace;font-size:12px;font-weight:600">${r.lote}</td>
      <td style="font-size:12px">${r.proveedor}</td>
      <td style="font-size:12px">${r.variedad}</td>
      <td style="font-family:monospace">${fmt(r.mp)}</td>
      <td style="font-family:monospace;font-weight:700">${fmt(r.pt)}</td>
      <td style="font-weight:700;color:${rend >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${fmtPct(rend)}</td>
      <td><span class="badge badge-${status.badge}">${status.label}</span></td>
    </tr>`;
  }).join('');
}

function getRendStatus(rend) {
  if (rend >= 55) return { badge: 'verde', label: 'Excelente' };
  if (rend >= 50) return { badge: 'amber', label: 'Bueno' };
  if (rend >= 40) return { badge: 'naranja', label: 'Regular' };
  return { badge: 'rose', label: 'Bajo' };
}

function setVal(c, id, v) {
  const el = c.querySelector('#' + id);
  if (el) el.textContent = v;
}

export function refresh() {
  const c = document.getElementById('panel-rendimientos');
  if (c) loadData(c);
}
