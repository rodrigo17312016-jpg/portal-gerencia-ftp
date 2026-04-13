/* ================================================================
   AREA DE EMPAQUE - Version Completa
   Empaque y sellado de producto congelado
   ================================================================ */

import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../../assets/js/utils/chart-helpers.js';

let empData = [];
let activeFilters = { turno: 'DIA', fruta: 'TODAS' };

export async function init(container) {
  const dateInput = container.querySelector('#empFilterDate');
  if (dateInput) {
    dateInput.value = today();
    dateInput.addEventListener('change', () => loadData(container));
  }

  container.querySelectorAll('.filter-chip[data-filter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.filter;
      container.querySelectorAll(`.filter-chip[data-filter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      renderFiltered(container);
    });
  });

  const selFruta = container.querySelector('#empFilterFruta');
  if (selFruta) selFruta.addEventListener('change', () => { activeFilters.fruta = selFruta.value; renderFiltered(container); });

  await loadData(container);
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
  } catch { empData = []; }
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
    filtered = filtered.filter(r => (r.fruta || r.producto || '').toUpperCase().includes(activeFilters.fruta));
  }
  updateKPIs(container, filtered);
  buildTable(container, filtered);
  updateCharts(container, filtered);
}

/* ── KPIs ──────────────────────────────────────────────── */
function updateKPIs(container, recs) {
  // Cajas producidas
  const totalCajas = recs.reduce((s, r) => s + (r.cajas || r.num_cajas || 0), 0);
  setVal(container, 'empKpiCajas', fmt(totalCajas));

  // Horas efectivas (horas unicas con registros)
  const horasUnicas = [...new Set(recs.map(r => r.hora?.slice(0, 5)).filter(Boolean))];
  const hrsEfectivas = horasUnicas.length;
  setVal(container, 'empKpiHrsEfectivas', hrsEfectivas + ' hrs');

  // Cajas/hora
  const cajasHr = hrsEfectivas > 0 ? Math.round(totalCajas / hrsEfectivas) : 0;
  setVal(container, 'empKpiCajasHr', fmt(cajasHr) + ' cj/hr');

  // Kg empacados
  const totalKg = recs.reduce((s, r) => s + (r.peso_neto || r.kg_pt || 0), 0);
  setVal(container, 'empKpiKg', fmt(totalKg) + ' kg');
  setVal(container, 'empKpiKgTn', (totalKg / 1000).toFixed(1) + ' TN');

  // Operarios (maximo registrado o suma si hay campo)
  const operarios = recs.reduce((max, r) => {
    const op = r.operarios || r.num_operarios || r.personal || 0;
    return op > max ? op : max;
  }, 0);
  setVal(container, 'empKpiOperarios', operarios + ' op.');

  // CJ/HR por operario
  const cjHrOp = (cajasHr > 0 && operarios > 0) ? (cajasHr / operarios).toFixed(1) : '0';
  setVal(container, 'empKpiCjHrOp', cjHrOp + ' cj/hr*op');

  // Progress bar (meta estimada de 500 cajas/turno)
  const meta = 500;
  const pctCajas = Math.min(100, Math.round(totalCajas / meta * 100));
  const barCajas = container.querySelector('#empProgressCajas');
  if (barCajas) barCajas.style.width = pctCajas + '%';
  setVal(container, 'empKpiCajasMeta', `Meta: ${meta} cj \u00B7 ${pctCajas}%`);
}

/* ── Tabla ─────────────────────────────────────────────── */
function buildTable(container, recs) {
  const tbody = container.querySelector('#empLiveBody');
  const tfoot = container.querySelector('#empLiveFoot');
  if (!tbody) return;

  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted)">Sin registros de empaque</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = recs.map(r => {
    const cajas = r.cajas || r.num_cajas || 0;
    const kgPT = r.peso_neto || r.kg_pt || 0;
    const operarios = r.operarios || r.num_operarios || r.personal || 0;
    const cjHr = cajas; // each row = 1 hour typically
    return `<tr>
      <td style="font-family:monospace;font-size:12px">${r.hora?.slice(0, 5) || '--'}</td>
      <td style="font-size:12px;font-weight:600">${r.fruta || r.producto || '--'}</td>
      <td style="font-size:12px">${r.presentacion || r.tipo || '--'}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--verde)">${fmt(cajas)}</td>
      <td style="font-family:monospace;font-weight:600">${fmt(kgPT)}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--naranja)">${fmt(cjHr)}</td>
      <td style="text-align:center">${operarios || '--'}</td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totalCajas = recs.reduce((s, r) => s + (r.cajas || r.num_cajas || 0), 0);
    const totalKg = recs.reduce((s, r) => s + (r.peso_neto || r.kg_pt || 0), 0);
    const hrsEfectivas = [...new Set(recs.map(r => r.hora?.slice(0, 5)).filter(Boolean))].length;
    const cajasHr = hrsEfectivas > 0 ? Math.round(totalCajas / hrsEfectivas) : 0;
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--verde-bg);border-top:2px solid var(--verde)">
      <td style="color:var(--verde)">TOTAL (${hrsEfectivas} hrs)</td>
      <td></td><td></td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totalCajas)}</td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totalKg)}</td>
      <td style="font-family:monospace;color:var(--naranja)">${fmt(cajasHr)}</td>
      <td></td>
    </tr>`;
  }
}

/* ── Charts ────────────────────────────────────────────── */
function updateCharts(container, recs) {
  if (!recs.length) return;
  const colors = getColors();

  // Agrupar por hora
  const horasMap = {};
  recs.forEach(r => {
    const h = r.hora?.slice(0, 5) || '??';
    if (!horasMap[h]) horasMap[h] = { cajas: 0, kg: 0, operarios: 0 };
    horasMap[h].cajas += r.cajas || r.num_cajas || 0;
    horasMap[h].kg += r.peso_neto || r.kg_pt || 0;
    horasMap[h].operarios = Math.max(horasMap[h].operarios, r.operarios || r.num_operarios || r.personal || 0);
  });
  const horas = Object.keys(horasMap).sort();
  const cajasH = horas.map(h => horasMap[h].cajas);
  const operariosH = horas.map(h => horasMap[h].operarios);

  // Chart 1: Cajas por Hora (bar)
  createChart('chartEmpCajas', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [
        { label: 'Cajas', data: cajasH, backgroundColor: colors.verde.bg, borderColor: colors.verde.border, borderWidth: 2, borderRadius: 6 },
        { label: 'Kg PT', data: horas.map(h => horasMap[h].kg), type: 'line', borderColor: colors.naranja.border, backgroundColor: colors.naranja.bg, fill: false, tension: 0.3, pointRadius: 5, pointBackgroundColor: colors.naranja.border, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'Cajas', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y1: { position: 'right', title: { display: true, text: 'Kg', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });

  // Chart 2: Productividad CJ/HR*OP (line)
  const productividad = horas.map(h => {
    const op = horasMap[h].operarios;
    return op > 0 ? +(horasMap[h].cajas / op).toFixed(1) : 0;
  });

  createChart('chartEmpProductividad', {
    type: 'line',
    data: {
      labels: horas,
      datasets: [
        { label: 'CJ/HR por Operario', data: productividad, borderColor: colors.purple.border, backgroundColor: colors.purple.bg, fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: colors.purple.border },
        { label: 'Operarios', data: operariosH, type: 'bar', backgroundColor: colors.amber.bg, borderColor: colors.amber.border, borderWidth: 2, borderRadius: 4, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'CJ/HR*OP', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y1: { position: 'right', title: { display: true, text: 'Operarios', color: '#64748b' }, ticks: { color: '#64748b', stepSize: 1 }, grid: { display: false } },
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });
}

/* ── Helpers ────────────────────────────────────────────── */
function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-empaque'); if (c) loadData(c); }
