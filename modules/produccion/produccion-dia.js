/* ════════════════════════════════════════════════════════
   PRODUCCION DEL DIA - Datos en tiempo real
   ════════════════════════════════════════════════════════ */

import { supabase } from '/assets/js/config/supabase.js';
import { fmt, fmtPct, today, fmtDateLong } from '/assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '/assets/js/utils/chart-helpers.js';

export async function init(container) {
  const fechaEl = container.querySelector('#pdFechaHoy');
  if (fechaEl) fechaEl.textContent = fmtDateLong(today());
  await loadData(container);
}

async function loadData(container) {
  const hoy = today();
  try {
    const [{ data: prodData }, { data: persData }] = await Promise.all([
      supabase.from('registro_produccion').select('*').eq('fecha', hoy).order('hora'),
      supabase.from('registro_personal').select('*').eq('fecha', hoy)
    ]);

    const recs = prodData || [];
    const pers = persData || [];
    const totalMP = recs.reduce((s, r) => s + (r.consumo_mp || 0), 0);
    const totalPT = recs.reduce((s, r) => s + (r.producto_terminado || 0), 0);
    const rend = totalMP > 0 ? (totalPT / totalMP * 100) : 0;
    const totalPers = pers.reduce((s, r) => s + (r.num_personal || 0), 0);
    const kgHr = recs.length > 0 ? totalPT / recs.length : 0;

    setVal(container, 'pdConsumo', fmt(totalMP));
    setVal(container, 'pdPT', fmt(totalPT));
    setVal(container, 'pdRend', fmtPct(rend));
    setVal(container, 'pdKgHr', fmt(kgHr, 0));
    setVal(container, 'pdPersonal', fmt(totalPers));
    setVal(container, 'pdRegistros', recs.length.toString());

    buildCharts(container, recs);
    buildTable(container, recs);
  } catch (err) {
    console.error('Error produccion-dia:', err);
    setVal(container, 'pdConsumo', 'Error');
  }
}

function buildCharts(container, recs) {
  if (recs.length === 0) return;
  const colors = getColors();
  const horas = [...new Set(recs.map(r => r.hora?.slice(0, 5)))].sort();
  const mpPorHora = horas.map(h => recs.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.consumo_mp || 0), 0));
  const ptPorHora = horas.map(h => recs.filter(r => r.hora?.startsWith(h)).reduce((s, r) => s + (r.producto_terminado || 0), 0));
  const rendPorHora = horas.map((h, i) => mpPorHora[i] > 0 ? (ptPorHora[i] / mpPorHora[i] * 100).toFixed(1) : 0);

  createChart('chartPdHora', {
    type: 'bar',
    data: {
      labels: horas,
      datasets: [
        { label: 'Consumo MP', data: mpPorHora, backgroundColor: colors.naranja.bg, borderColor: colors.naranja.border, borderWidth: 2, borderRadius: 6 },
        { label: 'P. Terminado', data: ptPorHora, backgroundColor: colors.verde.bg, borderColor: colors.verde.border, borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: { ...getDefaultOptions('bar'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } }
  });

  createChart('chartPdRend', {
    type: 'line',
    data: {
      labels: horas,
      datasets: [{ label: 'Rendimiento %', data: rendPorHora, borderColor: colors.verde.border, backgroundColor: colors.verde.bg, fill: true, tension: 0.4, pointRadius: 4 }]
    },
    options: getDefaultOptions('line')
  });
}

function buildTable(container, recs) {
  const tbody = container.querySelector('#pdTabla');
  if (!tbody) return;
  if (recs.length === 0) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Sin registros hoy</td></tr>';
    return;
  }
  tbody.innerHTML = recs.map(r => {
    const rend = r.consumo_mp > 0 ? (r.producto_terminado / r.consumo_mp * 100).toFixed(1) : '-';
    return `<tr>
      <td style="font-family:monospace">${r.hora?.slice(0, 5) || '—'}</td>
      <td>${r.fruta || '—'}</td><td>${r.linea || '—'}</td>
      <td style="font-family:monospace">${fmt(r.consumo_mp)}</td>
      <td style="font-family:monospace;font-weight:700">${fmt(r.producto_terminado)}</td>
      <td style="color:var(--verde);font-weight:600">${rend}%</td>
      <td>${r.personal || '—'}</td><td><span class="badge badge-${r.turno === 'DIA' ? 'amber' : 'azul'}">${r.turno || '—'}</span></td>
    </tr>`;
  }).join('');
}

function setVal(container, id, val) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = val;
}

export function refresh() {
  const c = document.getElementById('panel-produccion-dia');
  if (c) loadData(c);
}
