/* ════════════════════════════════════════════════════════
   PRODUCCION DEL DIA - Version Completa
   Replica 100% del portal original
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct, today, fmtDateLong, currentTurno } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';

let prodData = [];
let persData = [];
let costoVisible = false;
let activeFilters = { turno: 'AMBOS', fruta: 'TODAS' };

const FRUTA_COLORS = {
  'MANGO': { color: '#f59e0b', emoji: '🥭' },
  'ARANDANO': { color: '#6366f1', emoji: '🫐' },
  'GRANADA': { color: '#dc2626', emoji: '🍎' },
  'FRESA': { color: '#e11d48', emoji: '🍓' },
  'PALTA': { color: '#16a34a', emoji: '🥑' },
  'PIÑA': { color: '#eab308', emoji: '🍍' }
};

export async function init(container) {
  const fechaEl = container.querySelector('#pdFechaHoy');
  if (fechaEl) fechaEl.textContent = fmtDateLong(today());

  // Toggle costos
  const costoBtn = container.querySelector('#pdToggleCosto');
  if (costoBtn) costoBtn.addEventListener('click', () => toggleCostos(container));

  // Filtros turno/fruta
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const filterType = chip.dataset.filter;
      const value = chip.dataset.value;
      // Deselect siblings
      container.querySelectorAll(`.filter-chip[data-filter="${filterType}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[filterType] = value;
      updateCharts(container);
    });
  });

  await loadData(container);
}

async function loadData(container) {
  const hoy = today();
  try {
    const [{ data: prod }, { data: pers }] = await Promise.all([
      supabase.from('registro_produccion').select('*').eq('fecha', hoy).order('hora'),
      supabase.from('registro_personal').select('*').eq('fecha', hoy)
    ]);
    prodData = prod || [];
    persData = pers || [];
  } catch (err) {
    console.error('Error cargando produccion-dia:', err);
    prodData = [];
    persData = [];
  }

  updateKPIs(container);
  buildAvanceFrutas(container);
  buildTable(container);
  buildCharts(container);
}

function updateKPIs(container) {
  const totalMP = prodData.reduce((s, r) => s + (r.consumo_kg || 0), 0);
  const totalPT = prodData.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
  const rend = totalMP > 0 ? (totalPT / totalMP * 100) : 0;
  const totalPers = persData.reduce((s, r) => s + (r.num_personal || r.total_personal || 0), 0);
  const kgHr = prodData.length > 0 ? totalMP / prodData.length : 0;

  setVal(container, 'pdConsumo', fmt(totalMP) + ' kg');
  setVal(container, 'pdPT', fmt(totalPT) + ' kg');
  setVal(container, 'pdRend', fmtPct(rend));
  setVal(container, 'pdRendMeta', rend >= 50 ? '▲ Sobre objetivo 50%' : '▼ ' + (50 - rend).toFixed(1) + '% bajo obj 50%');
  setVal(container, 'pdKgHr', fmt(kgHr, 0) + ' kg/h');
  setVal(container, 'pdPersonal', (totalPers || prodData[prodData.length-1]?.personal || 0) + ' op.');
  setVal(container, 'pdRegistros', prodData.length.toString());

  // Desglose por fruta en KPIs
  buildKpiFrutasInline(container, 'pdKpiConsumoFrutas', prodData, 'consumo_kg');
  buildKpiFrutasInline(container, 'pdKpiPTFrutas', prodData, 'pt_aprox_kg');
  buildKpiRendFrutas(container);

  // Proyeccion
  const proyTN = prodData.length > 0 ? prodData[0]?.proyectado_tn : null;
  if (proyTN) {
    setVal(container, 'pdConsumoMeta', `Proy: ${proyTN} TN · ${Math.round(totalMP / (proyTN * 1000) * 100)}% cumplido`);
  }
}

function buildKpiFrutasInline(container, elementId, recs, field) {
  const el = container.querySelector('#' + elementId);
  if (!el) return;
  const byFruta = {};
  recs.forEach(r => {
    const f = (r.fruta || 'MANGO').toUpperCase();
    byFruta[f] = (byFruta[f] || 0) + (r[field] || 0);
  });
  if (Object.keys(byFruta).length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = Object.entries(byFruta).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    const fLabel = escapeHtml(f.charAt(0) + f.slice(1).toLowerCase());
    return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;margin:2px 0">
      <span style="color:var(--muted)">${fc.emoji} ${fLabel}</span>
      <span style="font-weight:700;color:${fc.color}">${fmt(v)}</span>
    </div>`;
  }).join('');
}

function buildKpiRendFrutas(container) {
  const el = container.querySelector('#pdKpiRendFrutas');
  if (!el) return;
  const byFruta = {};
  prodData.forEach(r => {
    const f = (r.fruta || 'MANGO').toUpperCase();
    if (!byFruta[f]) byFruta[f] = { mp: 0, pt: 0 };
    byFruta[f].mp += r.consumo_kg || 0;
    byFruta[f].pt += r.pt_aprox_kg || 0;
  });
  if (Object.keys(byFruta).length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = Object.entries(byFruta).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    const rend = v.mp > 0 ? (v.pt / v.mp * 100).toFixed(1) : 0;
    const fLabel = escapeHtml(f.charAt(0) + f.slice(1).toLowerCase());
    return `<div style="display:flex;justify-content:space-between;align-items:center;font-size:10px;margin:2px 0">
      <span style="color:var(--muted)">${fc.emoji} ${fLabel}</span>
      <span style="font-weight:700;color:${rend >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${rend}%</span>
    </div>`;
  }).join('');
}

function buildAvanceFrutas(container) {
  const el = container.querySelector('#pdAvanceFrutasContainer');
  if (!el) return;
  const byFruta = {};
  prodData.forEach(r => {
    const f = (r.fruta || 'MANGO').toUpperCase();
    if (!byFruta[f]) byFruta[f] = { mp: 0, pt: 0, proy: r.proyectado_tn || 0 };
    byFruta[f].mp += r.consumo_kg || 0;
    byFruta[f].pt += r.pt_aprox_kg || 0;
    if (r.proyectado_tn) byFruta[f].proy = r.proyectado_tn;
  });
  if (Object.keys(byFruta).length === 0) { el.innerHTML = ''; return; }
  el.innerHTML = Object.entries(byFruta).map(([f, v]) => {
    const fc = FRUTA_COLORS[f] || { color: '#64748b', emoji: '🍇' };
    const metaKg = v.proy * 1000 || 10000;
    const pct = Math.min(100, Math.round(v.mp / metaKg * 100));
    const rend = v.mp > 0 ? (v.pt / v.mp * 100).toFixed(0) : 0;
    return `<div class="card" style="padding:12px 16px;margin-bottom:8px;border-left:4px solid ${fc.color}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <div style="font-weight:700;font-size:13px">${fc.emoji} <strong>${escapeHtml(f)}</strong> <span style="font-weight:400;color:var(--muted);font-size:11px">Proy: ${v.proy || '—'} TN</span></div>
        <div style="font-size:20px;font-weight:900;color:${fc.color}">${pct}%</div>
      </div>
      <div class="progress-bar" style="height:10px;margin-bottom:4px">
        <div class="progress-fill" style="width:${pct}%;background:${fc.color}"></div>
      </div>
      <div style="display:flex;justify-content:space-between;font-size:10px;color:var(--muted)">
        <span>${fmt(v.mp)} kg</span>
        <span>Meta: ${fmt(metaKg)} kg</span>
      </div>
    </div>`;
  }).join('');
}

function buildTable(container) {
  const tbody = container.querySelector('#pdLiveBody');
  const tfoot = container.querySelector('#pdLiveFoot');
  if (!tbody) return;

  if (prodData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">Sin registros hoy</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  // Group by turno
  const dia = prodData.filter(r => (r.turno || '').toUpperCase().includes('DIA'));
  const noche = prodData.filter(r => !(r.turno || '').toUpperCase().includes('DIA'));

  let rows = '';
  // Turno Dia rows
  dia.forEach(r => { rows += buildRow(r); });
  if (dia.length > 0) {
    const diaMP = dia.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const diaPT = dia.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    const diaRend = diaMP > 0 ? (diaPT / diaMP * 100).toFixed(1) : 0;
    rows += `<tr style="background:rgba(251,191,36,0.08);font-weight:700">
      <td colspan="4" style="color:var(--amber)">☀️ SUBTOTAL DIA (${dia.length} hrs)</td>
      <td style="font-family:monospace">${fmt(diaMP)}</td><td style="font-family:monospace">${fmt(diaPT)}</td>
      <td style="color:var(--verde)">${diaRend}%</td><td colspan="2"></td>
    </tr>`;
  }

  // Noche rows
  noche.forEach(r => { rows += buildRow(r); });
  if (noche.length > 0) {
    const nocheMP = noche.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const nochePT = noche.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    const nocheRend = nocheMP > 0 ? (nochePT / nocheMP * 100).toFixed(1) : 0;
    rows += `<tr style="background:rgba(59,130,246,0.08);font-weight:700">
      <td colspan="4" style="color:var(--azul)">🌙 SUBTOTAL NOCHE (${noche.length} hrs)</td>
      <td style="font-family:monospace">${fmt(nocheMP)}</td><td style="font-family:monospace">${fmt(nochePT)}</td>
      <td style="color:var(--verde)">${nocheRend}%</td><td colspan="2"></td>
    </tr>`;
  }

  tbody.innerHTML = rows;

  // Footer total
  if (tfoot) {
    const totalMP = prodData.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const totalPT = prodData.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    const totalRend = totalMP > 0 ? (totalPT / totalMP * 100).toFixed(1) : 0;
    const totalPers = prodData.reduce((s, r) => s + (r.personal || 0), 0);
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--verde-bg);border-top:2px solid var(--verde)">
      <td colspan="4" style="color:var(--verde)">🏭 TOTAL GENERAL (${prodData.length} hrs)</td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totalMP)}</td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totalPT)}</td>
      <td style="color:var(--verde)">${totalRend}%</td>
      <td>${totalPers}</td><td></td>
    </tr>`;
  }
}

function buildRow(r) {
  const rend = r.consumo_kg > 0 ? (r.pt_aprox_kg / r.consumo_kg * 100).toFixed(1) : '—';
  const fc = FRUTA_COLORS[(r.fruta || '').toUpperCase()] || { color: '#64748b', emoji: '' };
  const turnoColor = (r.turno || '').toUpperCase().includes('DIA') ? 'var(--amber)' : 'var(--azul)';
  const turnoLabel = (r.turno || '').toUpperCase().includes('DIA') ? 'DIA' : 'NOCHE';
  // Datos de DB -> escapar para prevenir XSS
  return `<tr>
    <td style="font-family:monospace;font-size:12px">${escapeHtml(r.hora?.slice(0, 5) || '—')}</td>
    <td><span style="color:${turnoColor};font-weight:700;font-size:11px">${turnoLabel}</span></td>
    <td style="font-size:12px">${fc.emoji} ${escapeHtml(r.fruta || '—')}</td>
    <td style="font-size:12px">${escapeHtml(r.linea || 'L1')}</td>
    <td style="font-family:monospace;font-weight:600">${fmt(r.consumo_kg)}</td>
    <td style="font-family:monospace;font-weight:700">${fmt(r.pt_aprox_kg)}</td>
    <td style="font-weight:700;color:${parseFloat(rend) >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${rend}%</td>
    <td>${escapeHtml(r.personal || '—')}</td>
    <td style="font-size:11px">${escapeHtml(r.supervisor || '—')}</td>
  </tr>`;
}

function buildCharts(container) {
  updateCharts(container);
}

function updateCharts(container) {
  // Filter data based on active filters
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

  if (filtered.length === 0) return;
  const colors = getColors();
  const horas = [...new Set(filtered.map(r => r.hora?.slice(0, 5)))].sort();

  // Chart 1: Consumo vs PT
  const mpPorHora = horas.map(h => filtered.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.consumo_kg || 0), 0));
  const ptPorHora = horas.map(h => filtered.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.pt_aprox_kg || 0), 0));

  createChart('chartPdHora', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [
        { label: 'Consumo MP (kg)', data: mpPorHora, backgroundColor: 'rgba(234,88,12,0.6)', borderColor: '#ea580c', borderWidth: 2, borderRadius: 6 },
        { label: 'Chunks IQF (kg)', data: ptPorHora, backgroundColor: 'rgba(22,163,74,0.6)', borderColor: '#16a34a', borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: { ...getDefaultOptions('bar'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } }
  });

  // Chart 2: Rendimiento %
  const rendPorHora = horas.map((h, i) => mpPorHora[i] > 0 ? (ptPorHora[i] / mpPorHora[i] * 100) : 0);
  const objetivo = horas.map(() => 50);

  createChart('chartPdRend', {
    type: 'line',
    data: {
      labels: horas,
      datasets: [
        { label: 'Rendimiento %', data: rendPorHora, borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.1)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#dc2626' },
        { label: 'Objetivo Rend. %', data: objetivo, borderColor: '#dc2626', borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: { ...getDefaultOptions('line'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } }
  });

  // Chart 3: Acumulado
  let acumMP = 0, acumPT = 0;
  const acumMPData = mpPorHora.map(v => { acumMP += v; return acumMP; });
  const acumPTData = ptPorHora.map(v => { acumPT += v; return acumPT; });

  createChart('chartPdAcumulado', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [
        { label: 'Consumo por Hora (kg)', data: mpPorHora, backgroundColor: 'rgba(234,88,12,0.5)', borderColor: '#ea580c', borderWidth: 1, borderRadius: 4, yAxisID: 'y' },
        { label: 'Acumulado (kg)', data: acumMPData, type: 'line', borderColor: '#16a34a', backgroundColor: 'rgba(22,163,74,0.1)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#16a34a', yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'Kg/hora', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y1: { position: 'right', title: { display: true, text: 'Acumulado (kg)', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });

  // Chart 4: Comparativo Turnos (semanal)
  buildTurnosChart(container);
}

async function buildTurnosChart(container) {
  try {
    const since = new Date(); since.setDate(since.getDate() - 7);
    const { data } = await supabase.from('registro_produccion')
      .select('fecha, consumo_kg, turno')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha');

    if (!data || data.length === 0) return;
    const fechas = [...new Set(data.map(r => r.fecha))].sort();
    const diaData = fechas.map(f => data.filter(r => r.fecha === f && (r.turno || '').toUpperCase().includes('DIA')).reduce((s, r) => s + (r.consumo_kg || 0), 0));
    const nocheData = fechas.map(f => data.filter(r => r.fecha === f && !(r.turno || '').toUpperCase().includes('DIA')).reduce((s, r) => s + (r.consumo_kg || 0), 0));

    const labels = fechas.map(f => {
      const d = new Date(f + 'T00:00:00');
      return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'numeric' });
    });

    createChart('chartPdTurnos', {
      type: 'bar',
      data: {
        labels,
        datasets: [
          { label: 'Turno Dia', data: diaData, backgroundColor: 'rgba(22,163,74,0.6)', borderColor: '#16a34a', borderWidth: 2, borderRadius: 6 },
          { label: 'Turno Noche', data: nocheData, backgroundColor: 'rgba(37,99,235,0.6)', borderColor: '#2563eb', borderWidth: 2, borderRadius: 6 }
        ]
      },
      options: { ...getDefaultOptions('bar'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } }
    });
  } catch (err) {
    console.warn('Error chart turnos:', err);
  }
}

function toggleCostos(container) {
  costoVisible = !costoVisible;
  container.querySelectorAll('.pd-costo-col').forEach(el => {
    el.style.display = costoVisible ? '' : 'none';
  });
  const btn = container.querySelector('#pdToggleCosto');
  if (btn) btn.textContent = costoVisible ? '🔓 Ocultar Costos' : '🔒 Mostrar Costos';
}

function setVal(container, id, val) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = val;
}

export function refresh() {
  const c = document.getElementById('panel-produccion-dia');
  if (c) loadData(c);
}
