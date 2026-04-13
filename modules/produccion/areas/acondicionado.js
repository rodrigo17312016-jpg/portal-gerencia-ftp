/* ════════════════════════════════════════════════════════
   AREA DE ACONDICIONADO - Version Completa
   Misma logica que produccion-dia con estilo de area
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today, fmtDateLong } from '../../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../../assets/js/utils/chart-helpers.js';

let prodData = [];
let activeFilters = { turno: 'DIA', fruta: 'TODAS' };
const FRUTA_COLORS = { 'MANGO': { color: '#f59e0b', emoji: '🥭' }, 'ARANDANO': { color: '#6366f1', emoji: '🫐' }, 'GRANADA': { color: '#dc2626', emoji: '🍎' }, 'FRESA': { color: '#e11d48', emoji: '🍓' }, 'PALTA': { color: '#16a34a', emoji: '🥑' }, 'PIÑA': { color: '#eab308', emoji: '🍍' } };

export async function init(container) {
  const dateInput = container.querySelector('#acoFilterDate');
  if (dateInput) { dateInput.value = today(); dateInput.addEventListener('change', () => loadData(container)); }

  container.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.filter;
      container.querySelectorAll(`.filter-chip[data-filter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      renderFiltered(container);
    });
  });

  container.querySelectorAll('.filter-chip[data-cfilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.cfilter;
      container.querySelectorAll(`.filter-chip[data-cfilter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      updateCharts(container);
    });
  });

  const selFruta = container.querySelector('#acoFilterFruta');
  if (selFruta) selFruta.addEventListener('change', () => { activeFilters.fruta = selFruta.value; renderFiltered(container); });

  await loadData(container);
}

async function loadData(container) {
  const dateInput = container.querySelector('#acoFilterDate');
  const fecha = dateInput?.value || today();
  try {
    const { data } = await supabase.from('registro_produccion').select('*').eq('fecha', fecha).order('hora');
    prodData = data || [];
  } catch { prodData = []; }
  renderFiltered(container);
}

function renderFiltered(container) {
  let filtered = [...prodData];
  if (activeFilters.turno !== 'AMBOS') {
    filtered = filtered.filter(r => { const t = (r.turno || '').toUpperCase(); return activeFilters.turno === 'DIA' ? t.includes('DIA') : !t.includes('DIA'); });
  }
  if (activeFilters.fruta !== 'TODAS') {
    filtered = filtered.filter(r => (r.fruta || '').toUpperCase() === activeFilters.fruta);
  }
  updateKPIs(container, filtered);
  buildAvanceFrutas(container, filtered);
  buildTable(container, filtered);
  updateCharts(container);
}

function updateKPIs(container, recs) {
  const totalMP = recs.reduce((s, r) => s + (r.consumo_mp || 0), 0);
  const totalPT = recs.reduce((s, r) => s + (r.producto_terminado || 0), 0);
  const rend = totalMP > 0 ? (totalPT / totalMP * 100) : 0;
  const kgHr = recs.length > 0 ? totalMP / recs.length : 0;
  const lastPers = recs.length > 0 ? recs[recs.length - 1]?.personal || 0 : 0;

  setVal(container, 'acoKpiConsumo', fmt(totalMP) + ' kg');
  setVal(container, 'acoKpiPT', fmt(totalPT) + ' kg');
  setVal(container, 'acoKpiRend', fmtPct(rend));
  setVal(container, 'acoKpiRendDiff', rend >= 50 ? '▲ ' + (rend - 50).toFixed(1) + '% vs Obj 50%' : '▼ ' + (50 - rend).toFixed(1) + '% vs Obj 50%');
  const rendEl = container.querySelector('#acoKpiRendDiff');
  if (rendEl) rendEl.style.color = rend >= 50 ? 'var(--verde)' : 'var(--naranja)';
  setVal(container, 'acoKpiHrs', fmt(kgHr, 0) + ' kg/h');
  setVal(container, 'acoKpiPersonal', lastPers + ' op.');
  setVal(container, 'acoKpiRegistros', recs.length.toString());

  const proyTN = recs.length > 0 ? recs[0]?.proyectado_tn : null;
  if (proyTN) {
    const pct = Math.round(totalMP / (proyTN * 1000) * 100);
    setVal(container, 'acoKpiMeta', `Proy: ${proyTN} TN · ${pct}% cumplido`);
    const bar = container.querySelector('#acoProgressBar');
    if (bar) bar.style.width = Math.min(100, pct) + '%';
  }

  buildKpiFrutas(container, 'acoKpiConsumoFrutas', recs, 'consumo_mp');
  buildKpiFrutas(container, 'acoKpiPTFrutas', recs, 'producto_terminado');
  buildKpiRendFrutas(container, 'acoKpiRendFrutas', recs);
}

function buildKpiFrutas(container, elId, recs, field) {
  const el = container.querySelector('#' + elId); if (!el) return;
  const byF = {};
  recs.forEach(r => { const f = (r.fruta || 'MANGO').toUpperCase(); byF[f] = (byF[f] || 0) + (r[field] || 0); });
  if (!Object.keys(byF).length) { el.innerHTML = ''; return; }
  el.innerHTML = Object.entries(byF).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    return `<div style="display:flex;justify-content:space-between;font-size:10px;margin:2px 0"><span style="color:var(--muted)">${fc.emoji} ${f.charAt(0) + f.slice(1).toLowerCase()}</span><span style="font-weight:700;color:${fc.color}">${fmt(v)}</span></div>`;
  }).join('');
}

function buildKpiRendFrutas(container, elId, recs) {
  const el = container.querySelector('#' + elId); if (!el) return;
  const byF = {};
  recs.forEach(r => { const f = (r.fruta || 'MANGO').toUpperCase(); if (!byF[f]) byF[f] = { mp: 0, pt: 0 }; byF[f].mp += r.consumo_mp || 0; byF[f].pt += r.producto_terminado || 0; });
  if (!Object.keys(byF).length) { el.innerHTML = ''; return; }
  el.innerHTML = Object.entries(byF).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    const r = v.mp > 0 ? (v.pt / v.mp * 100).toFixed(1) : 0;
    return `<div style="display:flex;justify-content:space-between;font-size:10px;margin:2px 0"><span style="color:var(--muted)">${fc.emoji} ${f.charAt(0) + f.slice(1).toLowerCase()}</span><span style="font-weight:700;color:${r >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${r}%</span></div>`;
  }).join('');
}

function buildAvanceFrutas(container, recs) {
  const el = container.querySelector('#acoAvanceFrutasContainer'); if (!el) return;
  const byF = {};
  recs.forEach(r => { const f = (r.fruta || 'MANGO').toUpperCase(); if (!byF[f]) byF[f] = { mp: 0, pt: 0, proy: r.proyectado_tn || 0 }; byF[f].mp += r.consumo_mp || 0; byF[f].pt += r.producto_terminado || 0; if (r.proyectado_tn) byF[f].proy = r.proyectado_tn; });
  if (!Object.keys(byF).length) { el.innerHTML = ''; return; }
  el.innerHTML = Object.entries(byF).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    const metaKg = v.proy * 1000 || 10000;
    const pct = Math.min(100, Math.round(v.mp / metaKg * 100));
    return `<div class="card" style="padding:12px 16px;margin-bottom:8px;border-left:4px solid ${fc.color}"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><div style="font-weight:700;font-size:13px">${fc.emoji} <strong>${f}</strong> <span style="font-weight:400;color:var(--muted);font-size:11px">Proy: ${v.proy || '—'} TN</span></div><div style="font-size:20px;font-weight:900;color:${fc.color}">${pct}%</div></div><div class="progress-bar" style="height:10px;margin-bottom:4px"><div class="progress-fill" style="width:${pct}%;background:${fc.color}"></div></div><div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)"><span>${fmt(v.mp)} kg</span><span>Meta: ${fmt(metaKg)} kg</span></div></div>`;
  }).join('');
}

function buildTable(container, recs) {
  const tbody = container.querySelector('#acoLiveBody');
  const tfoot = container.querySelector('#acoLiveFoot');
  if (!tbody) return;
  if (!recs.length) { tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">Sin registros</td></tr>'; if (tfoot) tfoot.innerHTML = ''; return; }

  const dia = recs.filter(r => (r.turno || '').toUpperCase().includes('DIA'));
  const noche = recs.filter(r => !(r.turno || '').toUpperCase().includes('DIA'));
  let rows = '';
  dia.forEach(r => { rows += buildRow(r); });
  if (dia.length) { const mp = dia.reduce((s, r) => s + (r.consumo_mp || 0), 0); const pt = dia.reduce((s, r) => s + (r.producto_terminado || 0), 0); rows += `<tr style="background:rgba(251,191,36,0.08);font-weight:700"><td colspan="4" style="color:var(--amber)">☀️ SUBTOTAL DIA (${dia.length} hrs)</td><td style="font-family:monospace">${fmt(mp)}</td><td style="font-family:monospace">${fmt(pt)}</td><td style="color:var(--verde)">${mp > 0 ? (pt / mp * 100).toFixed(1) : 0}%</td><td colspan="2"></td></tr>`; }
  noche.forEach(r => { rows += buildRow(r); });
  if (noche.length) { const mp = noche.reduce((s, r) => s + (r.consumo_mp || 0), 0); const pt = noche.reduce((s, r) => s + (r.producto_terminado || 0), 0); rows += `<tr style="background:rgba(59,130,246,0.08);font-weight:700"><td colspan="4" style="color:var(--azul)">🌙 SUBTOTAL NOCHE (${noche.length} hrs)</td><td style="font-family:monospace">${fmt(mp)}</td><td style="font-family:monospace">${fmt(pt)}</td><td style="color:var(--verde)">${mp > 0 ? (pt / mp * 100).toFixed(1) : 0}%</td><td colspan="2"></td></tr>`; }
  tbody.innerHTML = rows;

  if (tfoot) {
    const totalMP = recs.reduce((s, r) => s + (r.consumo_mp || 0), 0);
    const totalPT = recs.reduce((s, r) => s + (r.producto_terminado || 0), 0);
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--verde-bg);border-top:2px solid var(--verde)"><td colspan="4" style="color:var(--verde)">🏭 TOTAL GENERAL (${recs.length} hrs)</td><td style="font-family:monospace;color:var(--verde)">${fmt(totalMP)}</td><td style="font-family:monospace;color:var(--verde)">${fmt(totalPT)}</td><td style="color:var(--verde)">${totalMP > 0 ? (totalPT / totalMP * 100).toFixed(1) : 0}%</td><td>${recs.reduce((s, r) => s + (r.personal || 0), 0)}</td><td></td></tr>`;
  }
}

function buildRow(r) {
  const rend = r.consumo_mp > 0 ? (r.producto_terminado / r.consumo_mp * 100).toFixed(1) : '—';
  const fc = FRUTA_COLORS[(r.fruta || '').toUpperCase()] || { emoji: '' };
  const isDia = (r.turno || '').toUpperCase().includes('DIA');
  return `<tr><td style="font-family:monospace;font-size:12px">${r.hora?.slice(0, 5) || '—'}</td><td><span style="color:${isDia ? 'var(--amber)' : 'var(--azul)'};font-weight:700;font-size:11px">${isDia ? 'DIA' : 'NOCHE'}</span></td><td style="font-size:12px">${fc.emoji} ${r.fruta || '—'}</td><td style="font-size:12px">${r.linea || 'L1'}</td><td style="font-family:monospace;font-weight:600">${fmt(r.consumo_mp)}</td><td style="font-family:monospace;font-weight:700">${fmt(r.producto_terminado)}</td><td style="font-weight:700;color:${parseFloat(rend) >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${rend}%</td><td>${r.personal || '—'}</td><td style="font-size:11px">${r.supervisor || '—'}</td></tr>`;
}

function updateCharts(container) {
  let filtered = [...prodData];
  // Apply chart filters
  const cTurno = container.querySelector('.filter-chip[data-cfilter="turno"].active')?.dataset.value || 'AMBOS';
  const cFruta = container.querySelector('.filter-chip[data-cfilter="fruta"].active')?.dataset.value || 'TODAS';
  if (cTurno !== 'AMBOS') filtered = filtered.filter(r => { const t = (r.turno || '').toUpperCase(); return cTurno === 'DIA' ? t.includes('DIA') : !t.includes('DIA'); });
  if (cFruta !== 'TODAS') filtered = filtered.filter(r => (r.fruta || '').toUpperCase() === cFruta);
  if (!filtered.length) return;

  const horas = [...new Set(filtered.map(r => r.hora?.slice(0, 5)))].sort();
  const mpH = horas.map(h => filtered.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.consumo_mp || 0), 0));
  const ptH = horas.map(h => filtered.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.producto_terminado || 0), 0));
  const rendH = horas.map((_, i) => mpH[i] > 0 ? (ptH[i] / mpH[i] * 100) : 0);

  createChart('chartAcoHora', { type: 'bar', data: { labels: horas, datasets: [{ label: 'Consumo MP (kg)', data: mpH, backgroundColor: 'rgba(234,88,12,0.6)', borderColor: '#ea580c', borderWidth: 2, borderRadius: 6 }, { label: 'Chunks IQF (kg)', data: ptH, backgroundColor: 'rgba(22,163,74,0.6)', borderColor: '#16a34a', borderWidth: 2, borderRadius: 6 }] }, options: { ...getDefaultOptions('bar'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } } });

  createChart('chartAcoRend', { type: 'line', data: { labels: horas, datasets: [{ label: 'Rendimiento %', data: rendH, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.1)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#dc2626' }, { label: 'Objetivo %', data: horas.map(() => 50), borderColor: '#dc2626', borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 2 }] }, options: { ...getDefaultOptions('line'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } } });

  let acum = 0;
  const acumData = mpH.map(v => { acum += v; return acum; });
  createChart('chartAcoAcumulado', { type: 'bar', data: { labels: horas, datasets: [{ label: 'Consumo por Hora (kg)', data: mpH, backgroundColor: 'rgba(234,88,12,0.5)', borderColor: '#ea580c', borderWidth: 1, borderRadius: 4, yAxisID: 'y' }, { label: 'Acumulado (kg)', data: acumData, type: 'line', borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.1)', fill: true, tension: 0.3, pointRadius: 4, yAxisID: 'y1' }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } }, scales: { y: { position: 'left', title: { display: true, text: 'Kg/hora', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } }, y1: { position: 'right', title: { display: true, text: 'Acumulado', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } }, x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } } } } });

  buildTurnosChart();
}

async function buildTurnosChart() {
  try {
    const since = new Date(); since.setDate(since.getDate() - 7);
    const { data } = await supabase.from('registro_produccion').select('fecha, consumo_mp, turno').gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })).order('fecha');
    if (!data?.length) return;
    const fechas = [...new Set(data.map(r => r.fecha))].sort();
    const diaD = fechas.map(f => data.filter(r => r.fecha === f && (r.turno || '').toUpperCase().includes('DIA')).reduce((s, r) => s + (r.consumo_mp || 0), 0));
    const nocheD = fechas.map(f => data.filter(r => r.fecha === f && !(r.turno || '').toUpperCase().includes('DIA')).reduce((s, r) => s + (r.consumo_mp || 0), 0));
    const labels = fechas.map(f => { const d = new Date(f + 'T00:00:00'); return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'numeric' }); });
    createChart('chartAcoTurnos', { type: 'bar', data: { labels, datasets: [{ label: 'Turno Dia', data: diaD, backgroundColor: 'rgba(22,163,74,0.6)', borderColor: '#16a34a', borderWidth: 2, borderRadius: 6 }, { label: 'Turno Noche', data: nocheD, backgroundColor: 'rgba(37,99,235,0.6)', borderColor: '#2563eb', borderWidth: 2, borderRadius: 6 }] }, options: { ...getDefaultOptions('bar'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } } });
  } catch {}
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-acondicionado'); if (c) loadData(c); }
