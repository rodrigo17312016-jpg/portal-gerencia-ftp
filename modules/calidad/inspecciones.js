/* ════════════════════════════════════════════════════════
   INSPECCIONES - Reporte de inspecciones de temperatura
   ════════════════════════════════════════════════════════ */

import { fetchSupabase } from '/assets/js/config/supabase.js';
import { today } from '/assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '/assets/js/utils/chart-helpers.js';

let tempData = [];

function estadoColor(e) {
  return e === 'OK' ? 'verde' : e === 'ALERTA' ? 'warn' : 'danger';
}

function estadoLabel(e) {
  return e === 'OK' ? '✓ Optimo' : e === 'ALERTA' ? '⚠ Alerta' : '🚨 Critico';
}

export async function init(container) {
  // Export button
  const btn = container.querySelector('#btn-export-insp');
  if (btn) btn.addEventListener('click', exportCSV);

  await loadData(container);
}

async function loadData(container) {
  const hoy = today();
  try {
    tempData = await fetchSupabase(
      `registros_temperatura?fecha=eq.${hoy}&order=hora.desc&limit=1000`
    );
  } catch {
    tempData = [];
  }

  updateKPIs(container);
  renderTable(container);
  renderChart(container);
}

function updateKPIs(container) {
  const total = tempData.length;
  const ok = tempData.filter(r => r.estado === 'OK').length;
  const warn = tempData.filter(r => r.estado === 'ALERTA').length;
  const crit = tempData.filter(r => r.estado === 'CRITICO').length;

  setVal(container, 'kpiInspTotal', total);
  setVal(container, 'kpiInspOk', ok);
  setVal(container, 'kpiInspWarn', warn);
  setVal(container, 'kpiInspCrit', crit);
}

function renderTable(container) {
  const tbody = container.querySelector('#tablaInspecciones');
  if (!tbody) return;

  if (tempData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Sin registros hoy</td></tr>';
    return;
  }

  tbody.innerHTML = tempData.map(r => `<tr>
    <td style="font-family:monospace;font-size:12px">${r.fecha}</td>
    <td style="font-family:monospace;font-size:12px">${r.hora.slice(0, 5)}</td>
    <td style="font-size:12px">${r.area}</td>
    <td style="font-weight:700;color:var(--${estadoColor(r.estado)})">${r.temperatura}°C</td>
    <td><span class="badge badge-${estadoColor(r.estado)}">${estadoLabel(r.estado)}</span></td>
    <td style="font-size:12px">${r.turno || '—'}</td>
    <td style="font-size:12px">${r.operario || '—'}</td>
  </tr>`).join('');
}

function renderChart(container) {
  if (tempData.length === 0) return;

  const inspPorPersona = {};
  tempData.forEach(r => { inspPorPersona[r.operario || 'Sin asignar'] = (inspPorPersona[r.operario || 'Sin asignar'] || 0) + 1; });

  const opts = getDefaultOptions('bar');
  opts.plugins.legend = { display: false };

  createChart('chartInspectores', {
    type: 'bar',
    data: {
      labels: Object.keys(inspPorPersona),
      datasets: [{
        label: 'Registros',
        data: Object.values(inspPorPersona),
        backgroundColor: 'rgba(22,163,74,0.6)',
        borderColor: '#16a34a',
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: opts
  });
}

function exportCSV() {
  const headers = ['fecha', 'hora', 'area', 'temperatura', 'estado', 'turno', 'operario', 'observaciones'];
  const rows = tempData.map(r => headers.map(h => `"${(r[h] || '').toString().replace(/"/g, '""')}"`).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `inspecciones_${today()}.csv`;
  a.click();
}

function setVal(container, id, val) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = val;
}

export function refresh() {
  const container = document.getElementById('panel-inspecciones');
  if (container) loadData(container);
}
