/* ================================================================
   AREA DE RECEPCION - Version Completa
   Control de ingreso de materia prima
   Usa registro_produccion (sin tabla dedicada aun)
   ================================================================ */

import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../../assets/js/utils/chart-helpers.js';

const FRUTA_COLORS = {
  'MANGO':    { color: '#f59e0b', emoji: '\uD83E\uDD6D' },
  'ARANDANO': { color: '#6366f1', emoji: '\uD83E\uDED0' },
  'GRANADA':  { color: '#dc2626', emoji: '\uD83C\uDF4E' },
  'FRESA':    { color: '#e11d48', emoji: '\uD83C\uDF53' },
  'PALTA':    { color: '#16a34a', emoji: '\uD83E\uDD51' },
  'PI\u00D1A':    { color: '#eab308', emoji: '\uD83C\uDF4D' }
};

let allData = [];

export async function init(container) {
  await loadData(container);
}

async function loadData(container) {
  const hoy = today();
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const { data } = await supabase
      .from('registro_produccion')
      .select('fecha, fruta, consumo_mp, lote, calidad, brix, proveedor, jabas')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha', { ascending: false });
    allData = data || [];
  } catch { allData = []; }

  const hoyRecs = allData.filter(r => r.fecha === hoy);
  const last7 = allData.filter(r => {
    const d = new Date(r.fecha + 'T00:00:00');
    const diff = (new Date() - d) / (1000 * 60 * 60 * 24);
    return diff <= 7;
  });

  updateKPIs(container, hoyRecs, allData);
  buildTable(container, last7);
  updateCharts(container);
}

/* ── KPIs ──────────────────────────────────────────────── */
function updateKPIs(container, todayRecs, allRecs) {
  // TN recepcionadas hoy
  const totalMP = todayRecs.reduce((s, r) => s + (r.consumo_mp || 0), 0);
  const tnHoy = totalMP / 1000;
  setVal(container, 'recKpiTN', tnHoy.toFixed(1) + ' TN');

  // Progress bar (meta 20 TN/dia estimado)
  const metaTN = 20;
  const pctTN = Math.min(100, Math.round(tnHoy / metaTN * 100));
  const barTN = container.querySelector('#recProgressTN');
  if (barTN) barTN.style.width = pctTN + '%';
  setVal(container, 'recKpiTNMeta', `Hoy \u00B7 ${pctTN}% meta ${metaTN} TN`);

  // Calidad A/A+
  const calidadA = todayRecs.filter(r => r.calidad === 'A' || r.calidad === 'A+').length;
  const pctCalidad = todayRecs.length > 0 ? (calidadA / todayRecs.length * 100) : 0;
  setVal(container, 'recKpiCalidad', fmtPct(pctCalidad));
  const barCalidad = container.querySelector('#recProgressCalidad');
  if (barCalidad) barCalidad.style.width = Math.min(100, pctCalidad) + '%';

  // Lotes unicos hoy
  const lotesUnicos = [...new Set(todayRecs.map(r => r.lote).filter(Boolean))].length;
  setVal(container, 'recKpiLotes', lotesUnicos.toString());

  // Brix promedio
  const brixValues = todayRecs.map(r => r.brix).filter(v => v != null && !isNaN(v));
  const brixProm = brixValues.length > 0 ? brixValues.reduce((s, v) => s + v, 0) / brixValues.length : 0;
  setVal(container, 'recKpiBrix', brixProm > 0 ? brixProm.toFixed(1) + '\u00B0' : '--\u00B0');

  // Proveedores unicos hoy
  const provUnicos = [...new Set(todayRecs.map(r => r.proveedor).filter(Boolean))].length;
  setVal(container, 'recKpiProveedores', provUnicos.toString());

  // TN campana (ultimos 30 dias)
  const tnCampana = allRecs.reduce((s, r) => s + (r.consumo_mp || 0), 0) / 1000;
  setVal(container, 'recKpiCampana', fmt(tnCampana, 1) + ' TN');
}

/* ── Tabla ─────────────────────────────────────────────── */
function buildTable(container, recs) {
  const tbody = container.querySelector('#recLiveBody');
  const tfoot = container.querySelector('#recLiveFoot');
  if (!tbody) return;

  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted)">Sin lotes recepcionados</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  // Agrupar por lote unico para evitar duplicados
  const loteMap = {};
  recs.forEach(r => {
    const key = (r.lote || '') + '_' + (r.fecha || '') + '_' + (r.fruta || '');
    if (!loteMap[key]) {
      loteMap[key] = { ...r, consumo_mp: 0, count: 0 };
    }
    loteMap[key].consumo_mp += r.consumo_mp || 0;
    loteMap[key].count++;
  });
  const lotes = Object.values(loteMap).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  tbody.innerHTML = lotes.slice(0, 40).map(r => {
    const fc = FRUTA_COLORS[(r.fruta || '').toUpperCase()] || { emoji: '\uD83C\uDF47', color: '#64748b' };
    const calidadClass = (r.calidad === 'A' || r.calidad === 'A+') ? 'verde' : (r.calidad === 'B' ? 'naranja' : 'gris');
    const pesoNeto = r.consumo_mp || 0;
    return `<tr>
      <td style="font-size:12px">${r.fecha || '--'}</td>
      <td style="font-weight:700;font-family:monospace">${r.lote || '--'}</td>
      <td style="font-size:12px">${r.proveedor || '--'}</td>
      <td style="font-size:12px">${fc.emoji} ${r.fruta || '--'}</td>
      <td style="font-family:monospace;font-weight:700">${fmt(pesoNeto)} kg</td>
      <td style="font-family:monospace;text-align:center">${r.jabas || '--'}</td>
      <td><span class="badge badge-${calidadClass}">${r.calidad || '--'}</span></td>
      <td style="font-family:monospace;color:var(--purple);font-weight:600">${r.brix != null ? r.brix.toFixed(1) + '\u00B0' : '--'}</td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totalKg = lotes.reduce((s, r) => s + (r.consumo_mp || 0), 0);
    const totalLotes = lotes.length;
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--naranja-bg);border-top:2px solid var(--naranja)">
      <td style="color:var(--naranja)">TOTAL (${totalLotes} lotes)</td>
      <td></td><td></td><td></td>
      <td style="font-family:monospace;color:var(--naranja)">${fmt(totalKg)} kg</td>
      <td colspan="3"></td>
    </tr>`;
  }
}

/* ── Charts ────────────────────────────────────────────── */
function updateCharts(container) {
  if (!allData.length) return;
  const colors = getColors();

  // Chart 1: Recepcion por Semana (bar) - ultimos 7 dias
  const last7dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    last7dates.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  }
  const kgPorDia = last7dates.map(f => allData.filter(r => r.fecha === f).reduce((s, r) => s + (r.consumo_mp || 0), 0));
  const labels = last7dates.map(f => {
    const d = new Date(f + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric' });
  });

  let acum = 0;
  const acumData = kgPorDia.map(v => { acum += v; return acum; });

  createChart('chartRecSemana', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Kg Recepcionados', data: kgPorDia, backgroundColor: colors.naranja.bg, borderColor: colors.naranja.border, borderWidth: 2, borderRadius: 6, yAxisID: 'y' },
        { label: 'Acumulado', data: acumData, type: 'line', borderColor: colors.verde.border, backgroundColor: colors.verde.bg, fill: false, tension: 0.3, pointRadius: 4, pointBackgroundColor: colors.verde.border, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'Kg/dia', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y1: { position: 'right', title: { display: true, text: 'Acumulado', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });

  // Chart 2: Distribucion por Fruta (doughnut) - ultimos 7 dias
  const last7 = allData.filter(r => {
    const d = new Date(r.fecha + 'T00:00:00');
    return (new Date() - d) / (1000 * 60 * 60 * 24) <= 7;
  });
  const byFruta = {};
  last7.forEach(r => {
    const f = (r.fruta || 'OTROS').toUpperCase();
    byFruta[f] = (byFruta[f] || 0) + (r.consumo_mp || 0);
  });

  const frutas = Object.keys(byFruta).sort((a, b) => byFruta[b] - byFruta[a]);
  const frutaValues = frutas.map(f => byFruta[f]);
  const frutaColorsBg = frutas.map(f => {
    const fc = FRUTA_COLORS[f];
    return fc ? fc.color + '99' : '#64748b99';
  });
  const frutaColorsBorder = frutas.map(f => {
    const fc = FRUTA_COLORS[f];
    return fc ? fc.color : '#64748b';
  });
  const frutaLabels = frutas.map(f => {
    const fc = FRUTA_COLORS[f];
    return fc ? fc.emoji + ' ' + f.charAt(0) + f.slice(1).toLowerCase() : f;
  });

  createChart('chartRecFruta', {
    type: 'doughnut',
    data: {
      labels: frutaLabels,
      datasets: [{
        data: frutaValues,
        backgroundColor: frutaColorsBg,
        borderColor: frutaColorsBorder,
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: { color: '#64748b', font: { size: 11 }, padding: 12, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = frutaValues.reduce((s, v) => s + v, 0);
              const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${fmt(ctx.raw)} kg (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

/* ── Helpers ────────────────────────────────────────────── */
function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-recepcion'); if (c) loadData(c); }
