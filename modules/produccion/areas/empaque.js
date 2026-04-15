/* ════════════════════════════════════════════════════════
   AREA DE EMPAQUE CONGELADO - Version Ejecutiva v4
   Con filtros tipo + 4 charts + auto-refresh
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today, fmtDateLong } from '../../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../../assets/js/utils/chart-helpers.js';

let empData = [];
let activeFilters = { turno: 'DIA', fruta: 'TODAS', tipo: 'TODOS' };
let refreshInterval = null;

const FRUTA_COLORS = {
  'MANGO':    { color: '#f59e0b', emoji: '🥭' },
  'ARANDANO': { color: '#6366f1', emoji: '🫐' },
  'GRANADA':  { color: '#be123c', emoji: '🍎' },
  'FRESA':    { color: '#e11d48', emoji: '🍓' },
  'PALTA':    { color: '#0e7c3a', emoji: '🥑' },
  'PIÑA':     { color: '#eab308', emoji: '🍍' }
};

const TIPO_COLORS = {
  'IQF':         '#1e40af',
  'CONVENCIONAL': '#ea580c',
  'PULPA':       '#6d28d9'
};

const META_CAJAS = 500;

export async function init(container) {
  const dateInput = container.querySelector('#empFilterDate');
  if (dateInput) {
    dateInput.value = today();
    dateInput.addEventListener('change', () => loadData(container));
  }

  // Filtros chip (turno)
  container.querySelectorAll('.filter-chip[data-efilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.efilter;
      container.querySelectorAll(`.filter-chip[data-efilter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      renderFiltered(container);
    });
  });

  const selFruta = container.querySelector('#empFilterFruta');
  if (selFruta) selFruta.addEventListener('change', () => { activeFilters.fruta = selFruta.value; renderFiltered(container); });

  const selTipo = container.querySelector('#empFilterTipo');
  if (selTipo) selTipo.addEventListener('change', () => { activeFilters.tipo = selTipo.value; renderFiltered(container); });

  const refreshBtn = container.querySelector('#empRefreshBtn');
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
    if (document.getElementById('panel-empaque')) loadData(container);
    else destroy();
  }, 120000);
}

async function loadData(container) {
  const dateInput = container.querySelector('#empFilterDate');
  const fecha = dateInput?.value || today();

  try {
    const { data } = await supabase
      .from('registro_empaque_congelado')
      .select('*')
      .eq('fecha', fecha)
      .order('hora');
    empData = data || [];

    const lastEl = container.querySelector('#empLastUpdate');
    if (lastEl) {
      const now = new Date();
      lastEl.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error empaque:', err);
    empData = [];
  }

  renderFiltered(container);
}

function renderFiltered(container) {
  let filtered = [...empData];

  if (activeFilters.turno !== 'AMBOS') {
    filtered = filtered.filter(r => {
      const t = (r.turno || '').toUpperCase();
      if (activeFilters.turno === 'DIA') return t.includes('DIA') || t === 'D' || t === 'DIURNO';
      return !t.includes('DIA') && t !== 'D' && t !== 'DIURNO';
    });
  }
  if (activeFilters.fruta !== 'TODAS') {
    filtered = filtered.filter(r => (r.fruta || '').toUpperCase().includes(activeFilters.fruta));
  }
  if (activeFilters.tipo !== 'TODOS') {
    filtered = filtered.filter(r => (r.tipo || '').toUpperCase().includes(activeFilters.tipo));
  }

  updateKPIs(container, filtered);
  buildDesgloseFrutas(container, filtered);
  buildTable(container, filtered);
  updateCharts(container, filtered);

  // Table date
  const dateEl = container.querySelector('#empTableDate');
  const dateInput = container.querySelector('#empFilterDate');
  if (dateEl && dateInput) {
    const isToday = dateInput.value === today();
    dateEl.textContent = isToday ? 'Hoy' : fmtDateLong(dateInput.value);
  }
}

// ─── KPIs ───
function updateKPIs(container, recs) {
  const totalCajas = recs.reduce((s, r) => s + (+(r.cajas || 0)), 0);
  setVal(container, 'empKpiCajas', fmt(totalCajas));

  const pctCajas = Math.min(100, Math.round(totalCajas / META_CAJAS * 100));
  const barCajas = container.querySelector('#empProgressCajas');
  if (barCajas) barCajas.style.width = pctCajas + '%';
  setVal(container, 'empKpiCajasMeta', `Meta: ${META_CAJAS} cajas · ${pctCajas}%`);

  const horasUnicas = [...new Set(recs.map(r => normalizeHora(r.hora)).filter(Boolean))];
  const hrsEfectivas = horasUnicas.length;
  setVal(container, 'empKpiHrsEfectivas', hrsEfectivas + ' hrs');

  const cajasHr = hrsEfectivas > 0 ? Math.round(totalCajas / hrsEfectivas) : 0;
  setVal(container, 'empKpiCajasHr', fmt(cajasHr) + ' cj/hr');
  setVal(container, 'empKpiCajasHrSub', cajasHr >= 50 ? '▲ Ritmo productivo' : 'Promedio del turno');

  const totalKg = recs.reduce((s, r) => s + (+(r.kg_pt || 0)), 0);
  setVal(container, 'empKpiKg', fmt(totalKg) + ' kg');
  setVal(container, 'empKpiKgTn', (totalKg / 1000).toFixed(2) + ' TN');

  // Operarios: promedio ponderado
  const operariosProm = recs.length > 0
    ? Math.round(recs.reduce((s, r) => s + (r.operarios || 0), 0) / recs.length)
    : 0;
  setVal(container, 'empKpiOperarios', operariosProm + ' op.');
  setVal(container, 'empKpiOperariosSub', recs.length ? `${recs.length} registros` : 'Sin datos');

  // CJ/HR por operario: usa cj_hr_op pre-calculado si existe, sino calcula
  let cjHrOp;
  const precalc = recs.filter(r => r.cj_hr_op != null).map(r => +r.cj_hr_op);
  if (precalc.length > 0) {
    cjHrOp = (precalc.reduce((s, v) => s + v, 0) / precalc.length).toFixed(1);
  } else {
    cjHrOp = (cajasHr > 0 && operariosProm > 0) ? (cajasHr / operariosProm).toFixed(1) : '0';
  }
  setVal(container, 'empKpiCjHrOp', cjHrOp + ' cj/hr·op');
}

// ─── Desglose por Fruta ───
function buildDesgloseFrutas(container, recs) {
  const el = container.querySelector('#empDesgloseFrutas');
  if (!el) return;

  const byF = {};
  recs.forEach(r => {
    const f = (r.fruta || 'MANGO').toUpperCase();
    if (!byF[f]) byF[f] = { cajas: 0, kg: 0, count: 0 };
    byF[f].cajas += +(r.cajas || 0);
    byF[f].kg += +(r.kg_pt || 0);
    byF[f].count++;
  });

  if (!Object.keys(byF).length) { el.innerHTML = ''; return; }

  el.innerHTML = `
    <div class="card" style="padding:14px 18px">
      <div style="font-size:11px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">Desglose por Fruta</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px">
        ${Object.entries(byF).map(([f, v]) => {
          const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
          return `<div style="padding:10px 14px;border-radius:10px;border-left:3px solid ${fc.color};background:var(--surface3)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
              <div style="font-weight:700;font-size:13px;color:var(--texto)">${fc.emoji} ${f}</div>
              <div style="font-size:11px;color:var(--muted)">${v.count} reg</div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px">
              <span style="color:var(--muted)">Cajas</span><span style="font-weight:800;color:${fc.color}">${fmt(v.cajas)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;margin-top:2px">
              <span style="color:var(--muted)">KG PT</span><span style="font-weight:700">${fmt(v.kg)}</span>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
}

// ─── Table ───
function buildTable(container, recs) {
  const tbody = container.querySelector('#empLiveBody');
  const tfoot = container.querySelector('#empLiveFoot');
  if (!tbody) return;

  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="12" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin registros de empaque para este filtro</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  // Sort by hora
  const sorted = [...recs].sort((a, b) => normalizeHora(a.hora).localeCompare(normalizeHora(b.hora)));

  tbody.innerHTML = sorted.map(r => {
    const fruta = (r.fruta || '').toUpperCase();
    const fc = FRUTA_COLORS[fruta] || { color: '#64748b', emoji: '' };
    const tipo = (r.tipo || '').toUpperCase();
    const tipoColor = TIPO_COLORS[tipo] || '#64748b';
    const isDia = (r.turno || '').toUpperCase().includes('DIA');

    return `<tr>
      <td style="font-family:monospace;font-size:11.5px;font-weight:600">${r.hora || '—'}</td>
      <td><span style="color:${isDia ? 'var(--amber)' : 'var(--azul)'};font-weight:700;font-size:11px">${isDia ? '☀️ DIA' : '🌙 NOCHE'}</span></td>
      <td style="font-size:12px;font-weight:600">${fc.emoji} ${r.fruta || '—'}</td>
      <td><span style="font-size:10px;font-weight:700;padding:2px 8px;border-radius:6px;background:${tipoColor}15;color:${tipoColor};border:1px solid ${tipoColor}40">${r.tipo || '—'}</span></td>
      <td style="font-size:11px;color:var(--muted)">${r.corte || '—'}</td>
      <td style="font-family:monospace;font-size:11px">${r.kg_presentacion ? r.kg_presentacion + ' kg' : '—'}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--verde)">${fmt(r.cajas)}</td>
      <td style="font-family:monospace;font-weight:600">${fmt(r.kg_pt)}</td>
      <td style="font-family:monospace;color:var(--naranja);font-weight:600">${fmt(r.cj_hr)}</td>
      <td style="font-family:monospace;color:var(--cyan);font-weight:600">${r.cj_hr_op != null ? (+r.cj_hr_op).toFixed(2) : '—'}</td>
      <td style="text-align:center;font-weight:600">${r.operarios || '—'}</td>
      <td style="font-size:11px;color:var(--muted)">${r.cliente || '—'}</td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totalCajas = recs.reduce((s, r) => s + (+(r.cajas || 0)), 0);
    const totalKg = recs.reduce((s, r) => s + (+(r.kg_pt || 0)), 0);
    const horasEfectivas = [...new Set(recs.map(r => normalizeHora(r.hora)).filter(Boolean))].length;
    const cajasHr = horasEfectivas > 0 ? Math.round(totalCajas / horasEfectivas) : 0;
    const avgOp = recs.length > 0 ? Math.round(recs.reduce((s, r) => s + (r.operarios || 0), 0) / recs.length) : 0;

    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--verde-bg);border-top:2px solid var(--verde)">
      <td colspan="5" style="color:var(--verde)">📦 TOTAL (${horasEfectivas} hrs · ${recs.length} reg)</td>
      <td></td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totalCajas)}</td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totalKg)}</td>
      <td style="font-family:monospace;color:var(--naranja)">${fmt(cajasHr)} avg</td>
      <td></td>
      <td style="text-align:center;color:var(--amber)">${avgOp} avg</td>
      <td></td>
    </tr>`;
  }
}

// ─── Charts ───
function updateCharts(container, recs) {
  if (!recs.length) {
    ['chartEmpCajas', 'chartEmpProductividad', 'chartEmpFrutas', 'chartEmpTipos'].forEach(id => {
      const c = document.getElementById(id);
      if (c && c._chart) { c._chart.destroy(); c._chart = null; }
    });
    return;
  }

  // Agrupar por hora
  const horasMap = {};
  recs.forEach(r => {
    const h = normalizeHora(r.hora);
    if (!h) return;
    if (!horasMap[h]) horasMap[h] = { cajas: 0, kg: 0, operarios: 0, cjHrOp: 0, cjHrOpCount: 0 };
    horasMap[h].cajas += +(r.cajas || 0);
    horasMap[h].kg += +(r.kg_pt || 0);
    horasMap[h].operarios = Math.max(horasMap[h].operarios, r.operarios || 0);
    if (r.cj_hr_op != null) {
      horasMap[h].cjHrOp += +r.cj_hr_op;
      horasMap[h].cjHrOpCount++;
    }
  });
  const horas = Object.keys(horasMap).sort();
  const cajasH = horas.map(h => horasMap[h].cajas);
  const kgH = horas.map(h => horasMap[h].kg);
  const operariosH = horas.map(h => horasMap[h].operarios);
  const productividadH = horas.map(h => {
    if (horasMap[h].cjHrOpCount > 0) return +(horasMap[h].cjHrOp / horasMap[h].cjHrOpCount).toFixed(2);
    return horasMap[h].operarios > 0 ? +(horasMap[h].cajas / horasMap[h].operarios).toFixed(2) : 0;
  });

  // Chart 1: Cajas por Hora + KG PT
  createChart('chartEmpCajas', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [
        { label: 'Cajas', data: cajasH, backgroundColor: 'rgba(14,124,58,0.7)', borderColor: '#0e7c3a', borderWidth: 2, borderRadius: 6, yAxisID: 'y' },
        { label: 'KG PT', data: kgH, type: 'line', borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,0.1)', fill: false, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#ea580c', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } },
      scales: {
        y:  { position: 'left',  title: { display: true, text: 'Cajas', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'Kg PT', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x:  { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(15,23,42,0.04)' } }
      }
    }
  });

  // Chart 2: Productividad CJ/HR*OP + Operarios
  createChart('chartEmpProductividad', {
    type: 'line',
    data: {
      labels: horas,
      datasets: [
        { label: 'CJ/HR·OP', data: productividadH, borderColor: '#6d28d9', backgroundColor: 'rgba(109,40,217,0.12)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#6d28d9', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 },
        { label: 'Operarios', data: operariosH, type: 'bar', backgroundColor: 'rgba(180,83,9,0.5)', borderColor: '#b45309', borderWidth: 1, borderRadius: 4, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } },
      scales: {
        y:  { position: 'left',  title: { display: true, text: 'CJ/HR·OP', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'Operarios', color: '#64748b' }, ticks: { color: '#64748b', stepSize: 1 }, grid: { display: false } },
        x:  { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(15,23,42,0.04)' } }
      }
    }
  });

  // Chart 3: Distribucion por Fruta (doughnut)
  const byFruta = {};
  recs.forEach(r => {
    const f = (r.fruta || 'OTRO').toUpperCase();
    byFruta[f] = (byFruta[f] || 0) + (+(r.cajas || 0));
  });
  const frutaLabels = Object.keys(byFruta);
  const frutaData = Object.values(byFruta);
  const frutaBgs = frutaLabels.map(f => (FRUTA_COLORS[f]?.color || '#64748b'));

  createChart('chartEmpFrutas', {
    type: 'doughnut',
    data: {
      labels: frutaLabels,
      datasets: [{ data: frutaData, backgroundColor: frutaBgs, borderColor: '#fff', borderWidth: 3 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: '#64748b', font: { size: 11, weight: '600' }, padding: 8 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${fmt(ctx.parsed)} cajas` } }
      },
      cutout: '55%'
    }
  });

  // Chart 4: Distribucion Tipos (bar)
  const byTipo = {};
  recs.forEach(r => {
    const t = (r.tipo || 'OTRO').toUpperCase();
    if (!byTipo[t]) byTipo[t] = { cajas: 0, kg: 0 };
    byTipo[t].cajas += +(r.cajas || 0);
    byTipo[t].kg += +(r.kg_pt || 0);
  });
  const tipoLabels = Object.keys(byTipo);
  const tipoCajas = tipoLabels.map(t => byTipo[t].cajas);
  const tipoKg = tipoLabels.map(t => byTipo[t].kg);
  const tipoBgs = tipoLabels.map(t => (TIPO_COLORS[t] || '#64748b') + 'B3');
  const tipoBorders = tipoLabels.map(t => TIPO_COLORS[t] || '#64748b');

  createChart('chartEmpTipos', {
    type: 'bar',
    data: {
      labels: tipoLabels,
      datasets: [
        { label: 'Cajas', data: tipoCajas, backgroundColor: tipoBgs, borderColor: tipoBorders, borderWidth: 2, borderRadius: 6 },
        { label: 'KG PT', data: tipoKg, type: 'line', borderColor: '#0e7c3a', backgroundColor: 'rgba(14,124,58,0.08)', fill: false, tension: 0.3, pointRadius: 6, pointBackgroundColor: '#0e7c3a', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } },
      scales: {
        y:  { position: 'left',  title: { display: true, text: 'Cajas', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'KG PT', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x:  { ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } }
      }
    }
  });
}

// ─── Helpers ───
function normalizeHora(h) {
  if (!h) return '';
  // "14:00-15:00" → "14:00"
  return h.split('-')[0].trim().slice(0, 5);
}

function setVal(c, id, v) {
  const el = c.querySelector('#' + id);
  if (el) el.textContent = v;
}

export function refresh() {
  const c = document.getElementById('panel-empaque');
  if (c) loadData(c);
}

export function destroy() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
}
