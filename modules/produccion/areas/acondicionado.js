/* ════════════════════════════════════════════════════════
   AREA DE ACONDICIONADO - Version Ejecutiva v4
   Replica funcional del portal original con estilo ejecutivo
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today, fmtDateLong } from '../../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../../assets/js/utils/chart-helpers.js';

let prodData = [];
let persData = [];
let activeFilters = { turno: 'DIA', fruta: 'TODAS' };
let costoVisible = false;
let refreshInterval = null;

const FRUTA_COLORS = {
  'MANGO':    { color: '#f59e0b', emoji: '🥭' },
  'ARANDANO': { color: '#6366f1', emoji: '🫐' },
  'GRANADA':  { color: '#be123c', emoji: '🍎' },
  'FRESA':    { color: '#e11d48', emoji: '🍓' },
  'PALTA':    { color: '#0e7c3a', emoji: '🥑' },
  'PIÑA':     { color: '#eab308', emoji: '🍍' }
};

// Default cost per fruit (S/ per kg MP)
const DEFAULT_COSTS = { MANGO: 2.5, ARANDANO: 18, GRANADA: 4.5, FRESA: 8, PALTA: 5, 'PIÑA': 1.8 };

export async function init(container) {
  // Fecha inicial
  const dateInput = container.querySelector('#acoFilterDate');
  if (dateInput) {
    dateInput.value = today();
    dateInput.addEventListener('change', () => loadData(container));
  }

  // Filtros principales (turno)
  container.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.filter;
      container.querySelectorAll(`.filter-chip[data-filter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      renderFiltered(container);
    });
  });

  // Filtros de charts
  container.querySelectorAll('.filter-chip[data-cfilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.cfilter;
      container.querySelectorAll(`.filter-chip[data-cfilter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      updateCharts(container);
    });
  });

  // Selector de fruta
  const selFruta = container.querySelector('#acoFilterFruta');
  if (selFruta) selFruta.addEventListener('change', () => { activeFilters.fruta = selFruta.value; renderFiltered(container); });

  // Toggle costos
  const costoBtn = container.querySelector('#acoToggleCosto');
  if (costoBtn) costoBtn.addEventListener('click', () => toggleCostos(container));

  // Botón refresh manual
  const refreshBtn = container.querySelector('#acoRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => refreshBtn.style.transform = '', 700);
    loadData(container);
  });

  // Cargar datos iniciales
  await loadData(container);

  // Auto-refresh cada 2 min
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (document.getElementById('panel-acondicionado')) loadData(container);
    else clearInterval(refreshInterval);
  }, 120000);
}

// ─── Load data from Supabase ───
async function loadData(container) {
  const dateInput = container.querySelector('#acoFilterDate');
  const fecha = dateInput?.value || today();

  try {
    const [{ data: prod }, { data: pers }] = await Promise.all([
      supabase.from('registro_produccion').select('*').eq('fecha', fecha).order('hora'),
      supabase.from('registro_personal').select('*').eq('fecha', fecha)
    ]);
    prodData = prod || [];
    persData = pers || [];

    // Last update indicator
    const lastEl = container.querySelector('#acoLastUpdate');
    if (lastEl) {
      const now = new Date();
      lastEl.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error acondicionado:', err);
    prodData = [];
    persData = [];
  }

  renderFiltered(container);
}

// ─── Apply filters ───
function renderFiltered(container) {
  let filtered = [...prodData];

  if (activeFilters.turno !== 'AMBOS') {
    filtered = filtered.filter(r => {
      const t = (r.turno || '').toUpperCase();
      return activeFilters.turno === 'DIA' ? t.includes('DIA') : !t.includes('DIA');
    });
  }
  if (activeFilters.fruta !== 'TODAS') {
    filtered = filtered.filter(r => (r.fruta || '').toUpperCase() === activeFilters.fruta);
  }

  updateKPIs(container, filtered);
  buildAvanceFrutas(container, filtered);
  buildTable(container, filtered);
  updateCharts(container);

  // Update table date display
  const dateEl = container.querySelector('#acoTableDate');
  const dateInput = container.querySelector('#acoFilterDate');
  if (dateEl && dateInput) {
    const isToday = dateInput.value === today();
    dateEl.textContent = isToday ? 'Hoy' : fmtDateLong(dateInput.value);
  }
}

// ─── KPIs ───
function updateKPIs(container, recs) {
  const totalMP = recs.reduce((s, r) => s + (r.consumo_kg || 0), 0);
  const totalPT = recs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
  const rend = totalMP > 0 ? (totalPT / totalMP * 100) : 0;
  const kgHr = recs.length > 0 ? totalMP / recs.length : 0;

  // Personal: suma todos los registros de personal del día (tracking aparte)
  const totalPers = persData.reduce((s, r) => s + (r.num_personal || r.total_personal || 0), 0);

  // Total costo
  let totalCosto = 0;
  recs.forEach(r => {
    const f = (r.fruta || '').toUpperCase();
    const costoKg = r.costo_kg || DEFAULT_COSTS[f] || 2.5;
    totalCosto += (r.consumo_kg || 0) * costoKg;
  });
  const costoPromedio = totalMP > 0 ? (totalCosto / totalMP) : 0;

  setVal(container, 'acoKpiConsumo', fmt(totalMP) + ' kg');
  setVal(container, 'acoKpiPT', fmt(totalPT) + ' kg');
  setVal(container, 'acoKpiRend', fmtPct(rend));

  const rendEl = container.querySelector('#acoKpiRendDiff');
  if (rendEl) {
    rendEl.textContent = rend >= 50 ? '▲ ' + (rend - 50).toFixed(1) + '% sobre obj' : '▼ ' + (50 - rend).toFixed(1) + '% bajo obj';
    rendEl.style.color = rend >= 50 ? 'var(--verde)' : 'var(--naranja)';
  }

  setVal(container, 'acoKpiHrs', fmt(kgHr, 0) + ' kg/h');
  setVal(container, 'acoKpiPersonal', totalPers + ' op.');
  setVal(container, 'acoKpiPersonalSub', persData.length ? `${persData.length} registros` : 'Sin registros');
  setVal(container, 'acoKpiRegistros', recs.length.toString());
  setVal(container, 'acoKpiRegistrosSub', recs.length ? 'Horas registradas' : 'Sin datos');
  setVal(container, 'acoKpiCosto', 'S/ ' + fmt(costoPromedio, 2) + ' / kg');

  // Meta progreso
  const proyTN = recs.length > 0 ? recs[0]?.proyectado_tn : null;
  if (proyTN) {
    const pct = Math.round(totalMP / (proyTN * 1000) * 100);
    setVal(container, 'acoKpiMeta', `Proy: ${proyTN} TN · ${pct}% cumplido`);
    const bar = container.querySelector('#acoProgressBar');
    if (bar) bar.style.width = Math.min(100, pct) + '%';
  } else {
    setVal(container, 'acoKpiMeta', 'Sin proyeccion definida');
    const bar = container.querySelector('#acoProgressBar');
    if (bar) bar.style.width = '0%';
  }

  buildKpiFrutas(container, 'acoKpiConsumoFrutas', recs, 'consumo_kg');
  buildKpiFrutas(container, 'acoKpiPTFrutas', recs, 'pt_aprox_kg');
  buildKpiRendFrutas(container, 'acoKpiRendFrutas', recs);
}

// ─── KPI breakdown per fruit ───
function buildKpiFrutas(container, elId, recs, field) {
  const el = container.querySelector('#' + elId);
  if (!el) return;
  const byF = {};
  recs.forEach(r => {
    const f = (r.fruta || 'MANGO').toUpperCase();
    byF[f] = (byF[f] || 0) + (r[field] || 0);
  });
  if (!Object.keys(byF).length) { el.innerHTML = ''; return; }
  el.innerHTML = Object.entries(byF).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    return `<div style="display:flex;justify-content:space-between;font-size:10px;margin:2px 0"><span style="color:var(--muted)">${fc.emoji} ${f.charAt(0) + f.slice(1).toLowerCase()}</span><span style="font-weight:700;color:${fc.color}">${fmt(v)}</span></div>`;
  }).join('');
}

function buildKpiRendFrutas(container, elId, recs) {
  const el = container.querySelector('#' + elId);
  if (!el) return;
  const byF = {};
  recs.forEach(r => {
    const f = (r.fruta || 'MANGO').toUpperCase();
    if (!byF[f]) byF[f] = { mp: 0, pt: 0 };
    byF[f].mp += r.consumo_kg || 0;
    byF[f].pt += r.pt_aprox_kg || 0;
  });
  if (!Object.keys(byF).length) { el.innerHTML = ''; return; }
  el.innerHTML = Object.entries(byF).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    const r = v.mp > 0 ? (v.pt / v.mp * 100).toFixed(1) : 0;
    return `<div style="display:flex;justify-content:space-between;font-size:10px;margin:2px 0"><span style="color:var(--muted)">${fc.emoji} ${f.charAt(0) + f.slice(1).toLowerCase()}</span><span style="font-weight:700;color:${r >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${r}%</span></div>`;
  }).join('');
}

// ─── Avance Meta por Fruta ───
function buildAvanceFrutas(container, recs) {
  const el = container.querySelector('#acoAvanceFrutasContainer');
  if (!el) return;
  const byF = {};
  recs.forEach(r => {
    const f = (r.fruta || 'MANGO').toUpperCase();
    if (!byF[f]) byF[f] = { mp: 0, pt: 0, proy: r.proyectado_tn || 0 };
    byF[f].mp += r.consumo_kg || 0;
    byF[f].pt += r.pt_aprox_kg || 0;
    if (r.proyectado_tn) byF[f].proy = r.proyectado_tn;
  });

  if (!Object.keys(byF).length) { el.innerHTML = ''; return; }

  el.innerHTML = Object.entries(byF).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    const metaKg = v.proy * 1000 || 10000;
    const pct = Math.min(100, Math.round(v.mp / metaKg * 100));
    return `
      <div class="card" style="padding:12px 18px;margin-bottom:8px;border-left:4px solid ${fc.color};background:var(--surface)">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:7px">
          <div style="font-weight:700;font-size:13px;color:var(--texto)">${fc.emoji} <strong>${f}</strong> <span style="font-weight:500;color:var(--muted);font-size:11px">Proy: ${v.proy || '—'} TN</span></div>
          <div style="font-size:20px;font-weight:900;color:${fc.color}">${pct}%</div>
        </div>
        <div style="height:8px;background:var(--surface3);border-radius:4px;overflow:hidden;margin-bottom:4px"><div style="width:${pct}%;height:100%;background:${fc.color};transition:width .6s ease"></div></div>
        <div style="display:flex;justify-content:space-between;font-size:10.5px;color:var(--muted)"><span>${fmt(v.mp)} kg</span><span>Meta: ${fmt(metaKg)} kg</span></div>
      </div>`;
  }).join('');
}

// ─── Build Table ───
function buildTable(container, recs) {
  const tbody = container.querySelector('#acoLiveBody');
  const tfoot = container.querySelector('#acoLiveFoot');
  if (!tbody) return;

  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin registros para este filtro</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  const dia = recs.filter(r => (r.turno || '').toUpperCase().includes('DIA'));
  const noche = recs.filter(r => !(r.turno || '').toUpperCase().includes('DIA'));

  let rows = '';

  // Turno Día
  dia.forEach(r => rows += buildRow(r));
  if (dia.length) {
    const mp = dia.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const pt = dia.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    rows += `<tr style="background:rgba(251,191,36,0.08);font-weight:700">
      <td colspan="4" style="color:var(--amber)">☀️ SUBTOTAL DIA (${dia.length} hrs)</td>
      <td style="font-family:monospace">${fmt(mp)}</td>
      <td style="font-family:monospace">${fmt(pt)}</td>
      <td style="color:${mp > 0 && (pt/mp*100) >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${mp > 0 ? (pt / mp * 100).toFixed(1) : 0}%</td>
      <td colspan="2"></td>
      <td class="aco-costo-col" style="display:${costoVisible ? 'table-cell' : 'none'};font-family:monospace"></td>
    </tr>`;
  }

  // Turno Noche
  noche.forEach(r => rows += buildRow(r));
  if (noche.length) {
    const mp = noche.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const pt = noche.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    rows += `<tr style="background:rgba(30,64,175,0.08);font-weight:700">
      <td colspan="4" style="color:var(--azul)">🌙 SUBTOTAL NOCHE (${noche.length} hrs)</td>
      <td style="font-family:monospace">${fmt(mp)}</td>
      <td style="font-family:monospace">${fmt(pt)}</td>
      <td style="color:${mp > 0 && (pt/mp*100) >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${mp > 0 ? (pt / mp * 100).toFixed(1) : 0}%</td>
      <td colspan="2"></td>
      <td class="aco-costo-col" style="display:${costoVisible ? 'table-cell' : 'none'};font-family:monospace"></td>
    </tr>`;
  }

  tbody.innerHTML = rows;

  // Total general
  if (tfoot) {
    const totalMP = recs.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const totalPT = recs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    let totalCosto = 0;
    recs.forEach(r => {
      const f = (r.fruta || '').toUpperCase();
      const c = r.costo_kg || DEFAULT_COSTS[f] || 2.5;
      totalCosto += (r.consumo_kg || 0) * c;
    });
    const costoPromKg = totalMP > 0 ? totalCosto / totalMP : 0;

    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--verde-bg);border-top:2px solid var(--verde)">
      <td colspan="4" style="color:var(--verde)">🏭 TOTAL GENERAL (${recs.length} hrs)</td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totalMP)}</td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totalPT)}</td>
      <td style="color:var(--verde)">${totalMP > 0 ? (totalPT / totalMP * 100).toFixed(1) : 0}%</td>
      <td>${recs.reduce((s, r) => s + (r.personal || 0), 0) || '—'}</td>
      <td></td>
      <td class="aco-costo-col" style="display:${costoVisible ? 'table-cell' : 'none'};font-family:monospace;color:var(--verde)">S/ ${fmt(costoPromKg, 2)}</td>
    </tr>`;
  }
}

function buildRow(r) {
  const rend = r.consumo_kg > 0 ? (r.pt_aprox_kg / r.consumo_kg * 100).toFixed(1) : '—';
  const fruta = (r.fruta || '').toUpperCase();
  const fc = FRUTA_COLORS[fruta] || { emoji: '', color: '#64748b' };
  const isDia = (r.turno || '').toUpperCase().includes('DIA');
  const costoKg = r.costo_kg || DEFAULT_COSTS[fruta] || 2.5;

  return `<tr>
    <td style="font-family:monospace;font-size:12px;font-weight:600">${r.hora?.slice(0, 5) || '—'}</td>
    <td><span style="color:${isDia ? 'var(--amber)' : 'var(--azul)'};font-weight:700;font-size:11px">${isDia ? 'DIA' : 'NOCHE'}</span></td>
    <td style="font-size:12px;font-weight:600">${fc.emoji} ${r.fruta || '—'}</td>
    <td style="font-size:12px">${r.linea || 'L1'}</td>
    <td style="font-family:monospace;font-weight:600">${fmt(r.consumo_kg)}</td>
    <td style="font-family:monospace;font-weight:700">${fmt(r.pt_aprox_kg)}</td>
    <td style="font-weight:700;color:${parseFloat(rend) >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${rend}%</td>
    <td>${r.personal || '—'}</td>
    <td style="font-size:11px;color:var(--muted)">${r.supervisor || '—'}</td>
    <td class="aco-costo-col" style="display:${costoVisible ? 'table-cell' : 'none'};font-family:monospace;color:var(--cyan);font-weight:600">S/ ${fmt(costoKg, 2)}</td>
  </tr>`;
}

// ─── Toggle Costos ───
function toggleCostos(container) {
  costoVisible = !costoVisible;

  const iconEl = container.querySelector('#acoCostoIcon');
  const textEl = container.querySelector('#acoCostoText');
  const btn = container.querySelector('#acoToggleCosto');
  const costoCard = container.querySelector('.acoKpiCostoCard');
  const regCard = container.querySelector('.acoKpiRegCard');

  if (iconEl) iconEl.textContent = costoVisible ? '🔓' : '🔒';
  if (textEl) textEl.textContent = costoVisible ? 'Ocultar Costos' : 'Mostrar Costos';
  if (btn) {
    btn.style.background = costoVisible ? 'var(--cyan-bg)' : 'var(--surface3)';
    btn.style.color = costoVisible ? 'var(--cyan)' : 'var(--muted)';
    btn.style.borderColor = costoVisible ? 'rgba(14,116,144,0.25)' : 'var(--border)';
  }

  if (costoCard) costoCard.style.display = costoVisible ? 'block' : 'none';

  container.querySelectorAll('.aco-costo-col').forEach(el => {
    el.style.display = costoVisible ? 'table-cell' : 'none';
  });

  // Rebuild table to reflect column state
  renderFiltered(container);
}

// ─── Charts ───
function updateCharts(container) {
  let filtered = [...prodData];
  const cTurno = container.querySelector('.filter-chip[data-cfilter="turno"].active')?.dataset.value || 'AMBOS';
  const cFruta = container.querySelector('.filter-chip[data-cfilter="fruta"].active')?.dataset.value || 'TODAS';

  if (cTurno !== 'AMBOS') filtered = filtered.filter(r => {
    const t = (r.turno || '').toUpperCase();
    return cTurno === 'DIA' ? t.includes('DIA') : !t.includes('DIA');
  });
  if (cFruta !== 'TODAS') filtered = filtered.filter(r => (r.fruta || '').toUpperCase() === cFruta);

  if (!filtered.length) {
    ['chartAcoHora', 'chartAcoRend', 'chartAcoAcumulado'].forEach(id => {
      const c = document.getElementById(id);
      if (c && c._chart) { c._chart.destroy(); c._chart = null; }
    });
    buildTurnosChart();
    return;
  }

  const horas = [...new Set(filtered.map(r => r.hora?.slice(0, 5)))].sort();
  const mpH = horas.map(h => filtered.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.consumo_kg || 0), 0));
  const ptH = horas.map(h => filtered.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.pt_aprox_kg || 0), 0));
  const rendH = horas.map((_, i) => mpH[i] > 0 ? (ptH[i] / mpH[i] * 100) : 0);

  // Chart 1: Consumo vs PT por hora
  createChart('chartAcoHora', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [
        { label: 'Consumo MP (kg)', data: mpH, backgroundColor: 'rgba(234,88,12,0.7)', borderColor: '#ea580c', borderWidth: 2, borderRadius: 6 },
        { label: 'P. Terminado (kg)', data: ptH, backgroundColor: 'rgba(14,124,58,0.7)', borderColor: '#0e7c3a', borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } }
    }
  });

  // Chart 2: Rendimiento % por hora
  createChart('chartAcoRend', {
    type: 'line',
    data: {
      labels: horas,
      datasets: [
        { label: 'Rendimiento %', data: rendH, borderColor: '#0e7c3a', backgroundColor: 'rgba(14,124,58,0.1)', fill: true, tension: 0.35, pointRadius: 5, pointBackgroundColor: '#0e7c3a', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 },
        { label: 'Objetivo 50%', data: horas.map(() => 50), borderColor: '#be123c', borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      ...getDefaultOptions('line'),
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } }
    }
  });

  // Chart 3: Acumulado dual-axis
  let acum = 0;
  const acumData = mpH.map(v => { acum += v; return acum; });

  createChart('chartAcoAcumulado', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [
        { label: 'Consumo/Hora', data: mpH, backgroundColor: 'rgba(234,88,12,0.55)', borderColor: '#ea580c', borderWidth: 1, borderRadius: 4, yAxisID: 'y' },
        { label: 'Acumulado', data: acumData, type: 'line', borderColor: '#0e7c3a', backgroundColor: 'rgba(14,124,58,0.1)', fill: true, tension: 0.3, pointRadius: 4, borderWidth: 2.5, pointBackgroundColor: '#0e7c3a', pointBorderColor: '#fff', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } },
      scales: {
        y:  { position: 'left',  title: { display: true, text: 'Kg/hora', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'Acumulado', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x:  { ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } }
      }
    }
  });

  buildTurnosChart();
}

// ─── Turnos Chart (últimos 7 días) ───
async function buildTurnosChart() {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const { data } = await supabase.from('registro_produccion')
      .select('fecha, consumo_kg, turno')
      .gte('fecha', sinceISO)
      .order('fecha');

    if (!data?.length) return;

    const fechas = [...new Set(data.map(r => r.fecha))].sort();
    const diaD = fechas.map(f => data.filter(r => r.fecha === f && (r.turno || '').toUpperCase().includes('DIA')).reduce((s, r) => s + (r.consumo_kg || 0), 0));
    const nocheD = fechas.map(f => data.filter(r => r.fecha === f && !(r.turno || '').toUpperCase().includes('DIA')).reduce((s, r) => s + (r.consumo_kg || 0), 0));

    const labels = fechas.map(f => {
      const d = new Date(f + 'T00:00:00');
      return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'numeric' });
    });

    createChart('chartAcoTurnos', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: '☀️ Turno Dia',   data: diaD,   backgroundColor: 'rgba(251,191,36,0.7)', borderColor: '#b45309', borderWidth: 2, borderRadius: 6 },
          { label: '🌙 Turno Noche', data: nocheD, backgroundColor: 'rgba(30,64,175,0.65)', borderColor: '#1e40af', borderWidth: 2, borderRadius: 6 }
        ]
      },
      options: {
        ...getDefaultOptions('bar'),
        plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } }
      }
    });
  } catch (err) {
    console.error('Error turnos chart:', err);
  }
}

// ─── Helpers ───
function setVal(c, id, v) {
  const el = c.querySelector('#' + id);
  if (el) el.textContent = v;
}

export function refresh() {
  const c = document.getElementById('panel-acondicionado');
  if (c) loadData(c);
}

export function destroy() {
  if (refreshInterval) {
    clearInterval(refreshInterval);
    refreshInterval = null;
  }
}
