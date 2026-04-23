/* ════════════════════════════════════════════════════════
   AREA DE RECEPCION - Version Ejecutiva v4
   Control de ingreso de materia prima (usa registro_produccion)
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today, fmtDateLong } from '../../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../../assets/js/utils/dom-helpers.js';

let allData = [];
let activeFilters = { rango: '7', fruta: 'TODAS' };
let refreshInterval = null;

const FRUTA_COLORS = {
  'MANGO':    { color: '#f59e0b', emoji: '🥭' },
  'ARANDANO': { color: '#6366f1', emoji: '🫐' },
  'GRANADA':  { color: '#be123c', emoji: '🍎' },
  'FRESA':    { color: '#e11d48', emoji: '🍓' },
  'PALTA':    { color: '#0e7c3a', emoji: '🥑' },
  'PIÑA':     { color: '#eab308', emoji: '🍍' }
};

export async function init(container) {
  // Filtros
  container.querySelectorAll('.filter-chip[data-rfilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.rfilter;
      container.querySelectorAll(`.filter-chip[data-rfilter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      if (type === 'rango') loadData(container);
      else renderFiltered(container);
    });
  });

  // Refresh button
  const refreshBtn = container.querySelector('#recRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => refreshBtn.style.transform = '', 700);
    loadData(container);
  });

  await loadData(container);

  // Auto-refresh 2 min
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (document.getElementById('panel-recepcion')) loadData(container);
    else destroy();
  }, 120000);
}

// ─── Load data ───
async function loadData(container) {
  const dias = +activeFilters.rango;
  try {
    const since = new Date();
    since.setDate(since.getDate() - dias);
    const sinceISO = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const { data } = await supabase
      .from('registro_produccion')
      .select('fecha, hora, turno, fruta, linea, proyectado_tn, consumo_kg, pt_aprox_kg, rendimiento, merma_kg, supervisor, personas')
      .gte('fecha', sinceISO)
      .order('fecha', { ascending: false })
      .order('hora', { ascending: false });

    allData = data || [];

    const lastEl = container.querySelector('#recLastUpdate');
    if (lastEl) {
      const now = new Date();
      lastEl.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error recepcion:', err);
    allData = [];
  }

  renderFiltered(container);
}

// ─── Apply filter ───
function renderFiltered(container) {
  let filtered = [...allData];

  if (activeFilters.fruta !== 'TODAS') {
    filtered = filtered.filter(r => (r.fruta || '').toUpperCase() === activeFilters.fruta);
  }

  const hoy = today();
  const hoyRecs = filtered.filter(r => r.fecha === hoy);

  updateKPIs(container, hoyRecs, filtered);
  buildTopFrutas(container, filtered);
  buildTable(container, filtered);
  updateCharts(container, filtered);

  // Update labels
  const dias = activeFilters.rango;
  const lbl = container.querySelector('#recTableLabel');
  if (lbl) lbl.textContent = `Ultimos ${dias} dias`;
}

// ─── KPIs ───
function updateKPIs(container, hoyRecs, rangeRecs) {
  // MP hoy
  const mpHoyKg = hoyRecs.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
  const tnHoy = mpHoyKg / 1000;
  setVal(container, 'recKpiTN', tnHoy.toFixed(1) + ' TN');

  // Proyectado hoy
  const proyTN = hoyRecs.length > 0 ? +(hoyRecs[0].proyectado_tn || 0) : 0;
  const metaTN = proyTN || 20;
  const pctTN = Math.min(100, Math.round(tnHoy / metaTN * 100));
  const barTN = container.querySelector('#recProgressTN');
  if (barTN) barTN.style.width = pctTN + '%';
  setVal(container, 'recKpiTNMeta', proyTN > 0 ? `Proyectado: ${proyTN} TN · ${pctTN}% cumplido` : `Meta estimada: ${metaTN} TN · ${pctTN}%`);

  // Avance proyeccion
  setVal(container, 'recKpiAvance', pctTN + '%');
  const barAvance = container.querySelector('#recProgressAvance');
  if (barAvance) barAvance.style.width = pctTN + '%';
  setVal(container, 'recKpiAvanceSub', pctTN >= 90 ? '▲ Meta cumplida' : pctTN >= 50 ? 'En ruta' : 'Cumplimiento bajo');

  // Merma total
  const mermaKg = hoyRecs.reduce((s, r) => s + (+(r.merma_kg || 0)), 0);
  setVal(container, 'recKpiMerma', fmt(mermaKg) + ' kg');
  const mermaPct = mpHoyKg > 0 ? (mermaKg / mpHoyKg * 100) : 0;
  setVal(container, 'recKpiMermaPct', mermaPct > 0 ? mermaPct.toFixed(1) + '% del ingreso' : '— % del ingreso');

  // Frutas unicas (del rango)
  const frutasUnicas = [...new Set(rangeRecs.map(r => r.fruta).filter(Boolean))].length;
  setVal(container, 'recKpiFrutas', frutasUnicas.toString());
  const frutasHoy = [...new Set(hoyRecs.map(r => r.fruta).filter(Boolean))].length;
  setVal(container, 'recKpiFrutasSub', frutasHoy > 0 ? `${frutasHoy} activas hoy` : 'Variedades procesadas');

  // Lineas activas
  const lineasUnicas = [...new Set(hoyRecs.map(r => r.linea).filter(Boolean))].length;
  setVal(container, 'recKpiLineas', lineasUnicas.toString());
  const totalLineas = [...new Set(rangeRecs.map(r => r.linea).filter(Boolean))].length;
  setVal(container, 'recKpiLineasSub', lineasUnicas > 0 ? `${lineasUnicas} activas hoy · ${totalLineas} en rango` : 'Sin lineas activas');

  // MP acumulada (rango)
  const tnCampana = rangeRecs.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0) / 1000;
  setVal(container, 'recKpiCampana', fmt(tnCampana, 1) + ' TN');
  setVal(container, 'recKpiCampanaSub', `Ultimos ${activeFilters.rango} dias`);
}

// ─── Top Frutas ───
function buildTopFrutas(container, recs) {
  const el = container.querySelector('#recTopFrutas');
  if (!el) return;

  const byF = {};
  recs.forEach(r => {
    const f = (r.fruta || 'OTRO').toUpperCase();
    if (!byF[f]) byF[f] = { mp: 0, pt: 0, merma: 0, count: 0 };
    byF[f].mp += +(r.consumo_kg || 0);
    byF[f].pt += +(r.pt_aprox_kg || 0);
    byF[f].merma += +(r.merma_kg || 0);
    byF[f].count++;
  });

  const sortedFrutas = Object.entries(byF).sort((a, b) => b[1].mp - a[1].mp).slice(0, 6);

  if (!sortedFrutas.length) { el.innerHTML = ''; return; }

  const totalMp = sortedFrutas.reduce((s, [_, v]) => s + v.mp, 0);

  el.innerHTML = `
    <div class="card" style="padding:14px 18px">
      <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Top Frutas del Rango</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px">
        ${sortedFrutas.map(([f, v]) => {
          const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
          const pct = totalMp > 0 ? (v.mp / totalMp * 100).toFixed(1) : 0;
          const rendPct = v.mp > 0 ? (v.pt / v.mp * 100).toFixed(1) : 0;
          return `<div style="padding:12px 14px;border-radius:10px;border-left:3px solid ${fc.color};background:var(--surface3)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
              <div style="font-weight:700;font-size:13px;color:var(--texto)">${fc.emoji} ${escapeHtml(f)}</div>
              <div style="font-size:18px;font-weight:900;color:${fc.color}">${pct}%</div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0">
              <span style="color:var(--muted)">MP</span>
              <span style="font-weight:800;color:${fc.color}">${(v.mp/1000).toFixed(1)} TN</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0">
              <span style="color:var(--muted)">PT</span>
              <span style="font-weight:700">${(v.pt/1000).toFixed(1)} TN</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin:2px 0">
              <span style="color:var(--muted)">Rend</span>
              <span style="font-weight:700;color:${rendPct >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${rendPct}%</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted);margin-top:4px">
              <span>${v.count} registros</span>
              <span>Merma: ${fmt(v.merma)} kg</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Table ───
function buildTable(container, recs) {
  const tbody = container.querySelector('#recLiveBody');
  const tfoot = container.querySelector('#recLiveFoot');
  if (!tbody) return;

  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin ingresos para este filtro</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  // Agrupar por fecha + fruta + turno + linea (un registro típico ya es hora)
  tbody.innerHTML = recs.slice(0, 60).map(r => {
    const fruta = (r.fruta || '').toUpperCase();
    const fc = FRUTA_COLORS[fruta] || { color: '#64748b', emoji: '🍇' };
    const rend = r.rendimiento || (r.consumo_kg > 0 ? (r.pt_aprox_kg / r.consumo_kg * 100) : 0);
    const isDia = (r.turno || '').toUpperCase().includes('DIA');
    const fechaDate = new Date(r.fecha + 'T00:00:00');
    const fechaLabel = fechaDate.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' });

    return `<tr>
      <td style="font-size:11.5px;font-family:monospace">${fechaLabel}</td>
      <td style="font-size:12px;font-weight:600">${fc.emoji} ${escapeHtml(r.fruta || '—')}</td>
      <td><span style="color:${isDia ? 'var(--amber)' : 'var(--azul)'};font-weight:700;font-size:11px">${isDia ? '☀️ DIA' : '🌙 NOCHE'}</span></td>
      <td style="font-size:12px">${escapeHtml(r.linea || '—')}</td>
      <td style="font-family:monospace;font-weight:600;color:var(--muted)">${r.proyectado_tn ? fmt(r.proyectado_tn) + ' TN' : '—'}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--naranja)">${fmt(r.consumo_kg)}</td>
      <td style="font-family:monospace;font-weight:600">${fmt(r.pt_aprox_kg)}</td>
      <td style="font-weight:700;color:${+rend >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${fmt(rend, 1)}%</td>
      <td style="font-family:monospace;color:var(--rose)">${fmt(r.merma_kg)}</td>
      <td style="font-size:11px;color:var(--muted)">${escapeHtml(r.supervisor || '—')}</td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totalMp = recs.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
    const totalPt = recs.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
    const totalMerma = recs.reduce((s, r) => s + (+(r.merma_kg || 0)), 0);
    const avgRend = totalMp > 0 ? (totalPt / totalMp * 100) : 0;
    const shown = Math.min(60, recs.length);

    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--naranja-bg);border-top:2px solid var(--naranja)">
      <td colspan="5" style="color:var(--naranja)">🚚 TOTAL (${recs.length} registros · mostrando ${shown})</td>
      <td style="font-family:monospace;color:var(--naranja)">${fmt(totalMp)}</td>
      <td style="font-family:monospace;color:var(--naranja)">${fmt(totalPt)}</td>
      <td style="color:${avgRend >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${avgRend.toFixed(1)}%</td>
      <td style="font-family:monospace;color:var(--rose)">${fmt(totalMerma)}</td>
      <td></td>
    </tr>`;
  }
}

// ─── Charts ───
function updateCharts(container, recs) {
  if (!recs.length) {
    ['chartRecSemana', 'chartRecFruta'].forEach(id => {
      const c = document.getElementById(id);
      if (c && c._chart) { c._chart.destroy(); c._chart = null; }
    });
    return;
  }

  // Chart 1: MP por dia (dual axis: kg + acumulado)
  const dias = +activeFilters.rango;
  const dates = [];
  for (let i = dias - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  }
  const kgPorDia = dates.map(f => recs.filter(r => r.fecha === f).reduce((s, r) => s + (+(r.consumo_kg || 0)), 0));
  const ptPorDia = dates.map(f => recs.filter(r => r.fecha === f).reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0));
  const labels = dates.map(f => {
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
        { label: 'MP Ingresada (kg)', data: kgPorDia, backgroundColor: 'rgba(234,88,12,0.7)', borderColor: '#ea580c', borderWidth: 2, borderRadius: 6, yAxisID: 'y' },
        { label: 'PT Aprox (kg)', data: ptPorDia, backgroundColor: 'rgba(14,124,58,0.65)', borderColor: '#0e7c3a', borderWidth: 2, borderRadius: 6, yAxisID: 'y' },
        { label: 'Acumulado MP', data: acumData, type: 'line', borderColor: '#1e40af', backgroundColor: 'rgba(30,64,175,0.08)', fill: false, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#1e40af', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } },
      scales: {
        y:  { position: 'left',  title: { display: true, text: 'Kg/dia', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'Acumulado', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x:  { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(15,23,42,0.04)' } }
      }
    }
  });

  // Chart 2: Distribucion por Fruta (doughnut)
  const byFruta = {};
  recs.forEach(r => {
    const f = (r.fruta || 'OTROS').toUpperCase();
    byFruta[f] = (byFruta[f] || 0) + (+(r.consumo_kg || 0));
  });

  const frutas = Object.keys(byFruta).sort((a, b) => byFruta[b] - byFruta[a]);
  const frutaValues = frutas.map(f => byFruta[f]);
  const frutaBgs = frutas.map(f => (FRUTA_COLORS[f]?.color || '#64748b'));
  const frutaLabels = frutas.map(f => {
    const fc = FRUTA_COLORS[f];
    return fc ? `${fc.emoji} ${f}` : f;
  });

  createChart('chartRecFruta', {
    type: 'doughnut',
    data: {
      labels: frutaLabels,
      datasets: [{
        data: frutaValues,
        backgroundColor: frutaBgs,
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#64748b', font: { size: 11, weight: '600' }, padding: 10, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = frutaValues.reduce((s, v) => s + v, 0);
              const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${(ctx.raw/1000).toFixed(1)} TN (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

// ─── Helpers ───
function setVal(c, id, v) {
  const el = c.querySelector('#' + id);
  if (el) el.textContent = v;
}

export function refresh() {
  const c = document.getElementById('panel-recepcion');
  if (c) loadData(c);
}

export function destroy() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
}
