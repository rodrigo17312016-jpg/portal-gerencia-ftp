/* ════════════════════════════════════════════════════════
   COSTOS DE PRODUCCION
   Date picker, currency toggle USD/PEN, 4 KPIs,
   4 charts (MOD/hora, donut composicion, $/Kg/hora, acumulado),
   table con footer totals
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtUSD, fmtSoles, today } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';

let charts = [];
let currency = 'USD';
let selectedDate = today();
const TC = 3.75; // Tipo de cambio default PEN/USD

export async function init(container) {
  // Date picker
  const datePicker = container.querySelector('#costoFechaPicker');
  if (datePicker) {
    datePicker.value = today();
    datePicker.addEventListener('change', () => {
      selectedDate = datePicker.value;
      loadData(container);
    });
  }

  // Currency toggle
  container.querySelectorAll('.filter-chip[data-moneda]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip[data-moneda]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      currency = chip.dataset.moneda;
      loadData(container);
    });
  });

  await loadData(container);
}

function fmtCurrency(n) {
  if (currency === 'PEN') return fmtSoles(n * TC);
  return fmtUSD(n);
}

async function loadData(container) {
  try {
    const since = new Date(selectedDate);
    since.setDate(since.getDate() - 14);
    const sinceStr = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const [{ data: prodData, error: e1 }, { data: costData, error: e2 }] = await Promise.all([
      supabase.from('registro_produccion')
        .select('fecha, hora, pt_aprox_kg, consumo_kg')
        .gte('fecha', sinceStr)
        .order('fecha')
        .order('hora'),
      supabase.from('config_costos')
        .select('*')
        .gte('fecha', sinceStr)
        .order('fecha')
    ]);

    if (e1) throw e1;
    if (e2) throw e2;

    const prod = prodData || [];
    const costs = costData || [];

    updateKPIs(container, prod, costs);
    buildCharts(container, prod, costs);
    buildTable(container, prod, costs);
  } catch (err) {
    console.error('Error costos:', err);
  }
}

function updateKPIs(container, prod, costs) {
  const todayRecs = prod.filter(r => r.fecha === selectedDate);
  const totalPT = todayRecs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
  const totalPers = todayRecs.reduce((s, r) => s + (r.personal || 0), 0);
  const avgPers = todayRecs.length > 0 ? Math.round(totalPers / todayRecs.length) : 0;
  const todayCost = costs.find(c => c.fecha === selectedDate);

  const costoKg = todayCost?.costo_kg_congelado || 0;
  const costoHH = todayCost?.costo_hora_hombre || 0;

  // Costo Total/Kg
  setVal(container, 'costoTotalKg', costoKg > 0 ? fmtCurrency(costoKg) : '—');

  // Change vs yesterday
  const changeEl = container.querySelector('#costoTotalKgChange');
  if (changeEl) {
    const yesterday = new Date(selectedDate + 'T00:00:00');
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('en-CA');
    const yesterdayCost = costs.find(c => c.fecha === yesterdayStr);
    if (yesterdayCost?.costo_kg_congelado && costoKg > 0) {
      const diff = ((costoKg - yesterdayCost.costo_kg_congelado) / yesterdayCost.costo_kg_congelado * 100);
      const isUp = diff > 0;
      // For cost, up is negative (more expensive)
      changeEl.textContent = `${isUp ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)}% vs dia ant.`;
      changeEl.className = `kpi-change ${isUp ? 'negative' : 'positive'}`;
    } else {
      changeEl.textContent = selectedDate;
      changeEl.style.color = 'var(--muted)';
    }
  }

  // Costo MOD/Kg
  setVal(container, 'costoMODKg', costoHH > 0 ? fmtCurrency(costoHH) : '—');
  const modMetaEl = container.querySelector('#costoMODMeta');
  if (modMetaEl && costoKg > 0 && costoHH > 0) {
    const modPct = (costoHH / costoKg * 100).toFixed(0);
    modMetaEl.textContent = `${modPct}% del costo total`;
  }

  // Personal
  setVal(container, 'costoPersonal', avgPers > 0 ? fmt(avgPers) + ' op.' : '—');
  const persMetaEl = container.querySelector('#costoPersonalMeta');
  if (persMetaEl && todayRecs.length > 0) {
    persMetaEl.textContent = `Prom. ${todayRecs.length} horas registradas`;
  }

  // PT Acumulado
  setVal(container, 'costoPTAcum', totalPT > 0 ? fmt(totalPT) + ' kg' : '—');
  const ptMetaEl = container.querySelector('#costoPTMeta');
  if (ptMetaEl && totalPT > 0) {
    ptMetaEl.textContent = `${fmt(totalPT / 1000, 1)} TN producidas`;
  }
}

function buildCharts(container, prod, costs) {
  const colors = getColors();
  const todayRecs = prod.filter(r => r.fecha === selectedDate);
  const todayCost = costs.find(c => c.fecha === selectedDate);

  // ── Chart 1: Costo MOD por Hora (bar) ──
  const fechas = [...new Set(prod.map(r => r.fecha))].sort().slice(-14);
  const modPorDia = fechas.map(f => {
    const c = costs.find(cc => cc.fecha === f);
    const val = c?.costo_hora_hombre || 0;
    return currency === 'PEN' ? +(val * TC).toFixed(2) : +val.toFixed(2);
  });

  const c1 = createChart('chartCostoMOD', {
    type: 'bar',
    data: {
      labels: fechas.map(f => f.slice(5)),
      datasets: [{
        label: `Costo MOD (${currency === 'PEN' ? 'S/' : '$'})`,
        data: modPorDia,
        backgroundColor: colors.naranja.bg,
        borderColor: colors.naranja.border,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: getDefaultOptions('bar')
  });

  // ── Chart 2: Composicion del Costo (doughnut) ──
  const costoMod = todayCost?.costo_hora_hombre || 0;
  const costoMat = todayCost?.costo_materiales || 0;
  const costoEnerg = todayCost?.costo_energia || 0;
  const costoOtros = todayCost?.costo_otros || 0;
  const costoTotal = costoMod + costoMat + costoEnerg + costoOtros;

  const donutData = [costoMod, costoMat, costoEnerg, costoOtros].map(v =>
    currency === 'PEN' ? +(v * TC).toFixed(2) : +v.toFixed(2)
  );

  // Update center value
  const donutCenter = container.querySelector('#costoDonutValue');
  if (donutCenter) {
    donutCenter.textContent = costoTotal > 0 ? fmtCurrency(costoTotal) : '—';
  }

  const c2 = createChart('chartCostoComp', {
    type: 'doughnut',
    data: {
      labels: ['MOD', 'Materiales', 'Energia', 'Otros'],
      datasets: [{
        data: donutData,
        backgroundColor: [colors.naranja.bg, colors.azul.bg, colors.amber.bg, colors.purple.bg],
        borderColor: [colors.naranja.border, colors.azul.border, colors.amber.border, colors.purple.border],
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: true, position: 'bottom', labels: { color: '#64748b', font: { size: 10 }, padding: 12 } },
        tooltip: {
          ...getDefaultOptions('bar').plugins.tooltip,
          callbacks: { label: ctx => `${ctx.label}: ${currency === 'PEN' ? 'S/ ' : '$ '}${ctx.parsed.toFixed(2)}` }
        }
      }
    }
  });

  // ── Chart 3: Costo/Kg por Hora (line) ──
  const costoPorDia = fechas.map(f => {
    const c = costs.find(cc => cc.fecha === f);
    const val = c?.costo_kg_congelado || 0;
    return currency === 'PEN' ? +(val * TC).toFixed(2) : +val.toFixed(2);
  });

  const c3 = createChart('chartCostoKg', {
    type: 'line',
    data: {
      labels: fechas.map(f => f.slice(5)),
      datasets: [{
        label: `${currency === 'PEN' ? 'S/' : '$'}/Kg`,
        data: costoPorDia,
        borderColor: colors.amber.border,
        backgroundColor: colors.amber.bg,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: colors.amber.border
      }]
    },
    options: getDefaultOptions('line')
  });

  // ── Chart 4: Costo Acumulado (area) ──
  let acum = 0;
  const acumData = fechas.map(f => {
    const dayRecs = prod.filter(r => r.fecha === f);
    const pt = dayRecs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    const c = costs.find(cc => cc.fecha === f);
    const costoDay = (c?.costo_kg_congelado || 0) * pt;
    acum += currency === 'PEN' ? costoDay * TC : costoDay;
    return +acum.toFixed(2);
  });

  const c4 = createChart('chartCostoAcum', {
    type: 'line',
    data: {
      labels: fechas.map(f => f.slice(5)),
      datasets: [{
        label: `Acumulado (${currency === 'PEN' ? 'S/' : '$'})`,
        data: acumData,
        borderColor: colors.verde.border,
        backgroundColor: colors.verde.bg,
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: colors.verde.border
      }]
    },
    options: getDefaultOptions('line')
  });

  charts = [c1, c2, c3, c4].filter(Boolean);
}

function buildTable(container, prod, costs) {
  const tbody = container.querySelector('#costoTabla');
  const tfoot = container.querySelector('#costoTfoot');
  const countBadge = container.querySelector('#costoRowCount');
  if (!tbody) return;

  const todayRecs = prod.filter(r => r.fecha === selectedDate);
  const todayCost = costs.find(c => c.fecha === selectedDate);

  if (todayRecs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Sin datos para esta fecha</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    if (countBadge) countBadge.textContent = '0 registros';
    return;
  }

  // Group by hora
  const byHora = {};
  todayRecs.forEach(r => {
    const hora = r.hora?.slice(0, 5) || '—';
    if (!byHora[hora]) byHora[hora] = { personal: 0, pt: 0, count: 0 };
    byHora[hora].personal += r.personal || 0;
    byHora[hora].pt += r.pt_aprox_kg || 0;
    byHora[hora].count++;
  });

  const horas = Object.keys(byHora).sort();
  if (countBadge) countBadge.textContent = `${horas.length} horas`;

  const costoHH = todayCost?.costo_hora_hombre || 0;
  const costoKg = todayCost?.costo_kg_congelado || 0;

  let sumPers = 0, sumPT = 0, sumCostoHH = 0, sumCostoMOD = 0;

  tbody.innerHTML = horas.map(h => {
    const d = byHora[h];
    const avgPers = d.count > 0 ? Math.round(d.personal / d.count) : 0;
    const costoHHHora = costoHH * avgPers;
    const costoMODHora = d.pt > 0 ? costoHHHora / d.pt : 0;
    const costoKgHora = costoKg;

    sumPers += avgPers;
    sumPT += d.pt;
    sumCostoHH += costoHHHora;
    sumCostoMOD += costoMODHora;

    return `<tr>
      <td style="font-family:monospace;font-size:12px;font-weight:600">${escapeHtml(h)}</td>
      <td>${fmt(avgPers)}</td>
      <td style="font-family:monospace;font-weight:700">${fmt(d.pt)}</td>
      <td>${costoHHHora > 0 ? fmtCurrency(costoHHHora) : '—'}</td>
      <td>${costoMODHora > 0 ? fmtCurrency(costoMODHora) : '—'}</td>
      <td style="font-weight:700;color:var(--amber)">${costoKgHora > 0 ? fmtCurrency(costoKgHora) : '—'}</td>
    </tr>`;
  }).join('');

  // Footer totals
  if (tfoot) {
    const avgPersTotal = horas.length > 0 ? Math.round(sumPers / horas.length) : 0;
    const costoKgTotal = costoKg;
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--amber-bg, rgba(217,119,6,0.08));border-top:2px solid var(--amber)">
      <td style="color:var(--amber)">TOTAL</td>
      <td>${fmt(avgPersTotal)} prom.</td>
      <td style="font-family:monospace;color:var(--amber)">${fmt(sumPT)}</td>
      <td>${sumCostoHH > 0 ? fmtCurrency(sumCostoHH) : '—'}</td>
      <td>${sumCostoMOD > 0 ? fmtCurrency(sumCostoMOD / horas.length) : '—'}</td>
      <td style="color:var(--amber);font-weight:900">${costoKgTotal > 0 ? fmtCurrency(costoKgTotal) : '—'}</td>
    </tr>`;
  }
}

function setVal(c, id, v) {
  const el = c.querySelector('#' + id);
  if (el) el.textContent = v;
}

export function refresh() {
  const c = document.getElementById('panel-costos');
  if (c) loadData(c);
}
