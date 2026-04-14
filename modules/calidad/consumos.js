/* ════════════════════════════════════════════════════════
   CONSUMO CALIDAD - Datos reales de Supabase
   Tabla: consumos_insumos (proyecto calidad)
   ════════════════════════════════════════════════════════ */

import { supabaseCalidad } from '../../assets/js/config/supabase.js';
import { fmt } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

let allData = [];

export async function init(container) {
  // Filtros
  ['cFiltroSubgrupo', 'cFiltroCentro', 'cFiltroSemana'].forEach(id => {
    const el = container.querySelector('#' + id);
    if (el) el.addEventListener('change', () => renderAll(container));
  });

  await loadData(container);
}

async function loadData(container) {
  try {
    const { data, error } = await supabaseCalidad
      .from('consumos_insumos')
      .select('semana, centro_costo, subgrupo, producto, unidad, cantidad')
      .order('semana', { ascending: true });

    if (error) throw error;
    allData = data || [];

    // Populate filter dropdowns
    populateFilters(container);
    renderAll(container);
  } catch (err) {
    console.error('Error consumos:', err);
  }
}

function populateFilters(container) {
  const subgrupos = [...new Set(allData.map(r => r.subgrupo).filter(Boolean))].sort();
  const centros = [...new Set(allData.map(r => r.centro_costo).filter(Boolean))].sort();
  const semanas = [...new Set(allData.map(r => r.semana).filter(Boolean))].sort();

  const subEl = container.querySelector('#cFiltroSubgrupo');
  if (subEl) subEl.innerHTML = '<option value="">Todos los subgrupos</option>' + subgrupos.map(s => `<option value="${s}">${s}</option>`).join('');

  const cenEl = container.querySelector('#cFiltroCentro');
  if (cenEl) cenEl.innerHTML = '<option value="">Todos los centros</option>' + centros.map(c => `<option value="${c}">${c}</option>`).join('');

  const semEl = container.querySelector('#cFiltroSemana');
  if (semEl) semEl.innerHTML = '<option value="">Todas las semanas</option>' + semanas.map(s => `<option value="${s}">Sem ${s}</option>`).join('');
}

function getFiltered(container) {
  let data = [...allData];
  const sub = container.querySelector('#cFiltroSubgrupo')?.value;
  const cen = container.querySelector('#cFiltroCentro')?.value;
  const sem = container.querySelector('#cFiltroSemana')?.value;
  if (sub) data = data.filter(r => r.subgrupo === sub);
  if (cen) data = data.filter(r => r.centro_costo === cen);
  if (sem) data = data.filter(r => String(r.semana) === sem);
  return data;
}

function renderAll(container) {
  const data = getFiltered(container);
  updateKPIs(container, data);
  buildCharts(container, data);
  buildTable(container, data);
}

function updateKPIs(container, data) {
  const total = data.reduce((s, r) => s + (r.cantidad || 0), 0);
  const productos = new Set(data.map(r => r.producto)).size;
  const semanas = new Set(data.map(r => r.semana)).size;
  const semanasArr = [...new Set(data.map(r => r.semana))].sort();

  setVal(container, 'cKpiTotal', fmt(total, 2));
  setVal(container, 'cKpiProductos', productos.toString());
  setVal(container, 'cKpiSemanas', semanas.toString());
  setVal(container, 'cKpiSemanasRange', semanasArr.length > 0 ? `sem ${semanasArr[0]} → ${semanasArr[semanasArr.length - 1]}` : '—');

  // Top producto
  const byProd = {};
  data.forEach(r => { byProd[r.producto] = (byProd[r.producto] || 0) + (r.cantidad || 0); });
  const sorted = Object.entries(byProd).sort((a, b) => b[1] - a[1]);
  if (sorted.length > 0) {
    setVal(container, 'cKpiTop', sorted[0][0]?.substring(0, 30) + (sorted[0][0]?.length > 30 ? '...' : ''));
    setVal(container, 'cKpiTopQty', fmt(sorted[0][1]) + ' ' + (data.find(r => r.producto === sorted[0][0])?.unidad || 'und'));
  }
}

function buildCharts(container, data) {
  const colors = getColors();

  // Chart 1: Consumo por semana
  const bySemana = {};
  data.forEach(r => { bySemana[r.semana] = (bySemana[r.semana] || 0) + (r.cantidad || 0); });
  const semLabels = Object.keys(bySemana).sort().map(s => 'Sem ' + s);
  const semValues = Object.keys(bySemana).sort().map(s => bySemana[s]);

  createChart('cChartSemana', {
    type: 'bar',
    data: {
      labels: semLabels,
      datasets: [{ label: 'Consumo', data: semValues, backgroundColor: colors.azul.bg, borderColor: colors.azul.border, borderWidth: 2, borderRadius: 6 }]
    },
    options: getDefaultOptions('bar')
  });

  // Chart 2: Top 5 insumos (horizontal bar)
  const byProd = {};
  data.forEach(r => { byProd[r.producto] = (byProd[r.producto] || 0) + (r.cantidad || 0); });
  const top5 = Object.entries(byProd).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topColors = [colors.azul, colors.verde, colors.naranja, colors.purple, colors.cyan];

  createChart('cChartTop', {
    type: 'bar',
    data: {
      labels: top5.map(([n]) => n.length > 25 ? n.substring(0, 25) + '...' : n),
      datasets: [{
        label: 'Cantidad',
        data: top5.map(([, v]) => v),
        backgroundColor: top5.map((_, i) => topColors[i]?.bg || colors.azul.bg),
        borderColor: top5.map((_, i) => topColors[i]?.border || colors.azul.border),
        borderWidth: 2, borderRadius: 6
      }]
    },
    options: { ...getDefaultOptions('bar'), indexAxis: 'y' }
  });

  // Chart 3: Consumo por centro de costo
  const byCentro = {};
  data.forEach(r => {
    const key = r.centro_costo || 'Sin centro';
    if (!byCentro[key]) byCentro[key] = {};
    const sub = r.subgrupo || 'Otros';
    byCentro[key][sub] = (byCentro[key][sub] || 0) + (r.cantidad || 0);
  });

  const centroLabels = Object.keys(byCentro).sort();
  const allSubgrupos = [...new Set(data.map(r => r.subgrupo || 'Otros'))].sort();
  const subColors = [colors.azul, colors.verde, colors.purple, colors.naranja, colors.cyan, colors.amber, colors.rose];

  createChart('cChartCentro', {
    type: 'bar',
    data: {
      labels: centroLabels,
      datasets: allSubgrupos.map((sub, i) => ({
        label: sub,
        data: centroLabels.map(c => byCentro[c]?.[sub] || 0),
        backgroundColor: subColors[i % subColors.length]?.bg || colors.azul.bg,
        borderColor: subColors[i % subColors.length]?.border || colors.azul.border,
        borderWidth: 1, borderRadius: 4
      }))
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: { legend: { display: true, position: 'top', labels: { color: '#64748b', font: { size: 10 }, boxWidth: 12 } } },
      scales: { x: { stacked: true, ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(0,0,0,0.05)' } }, y: { stacked: true, ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } } }
    }
  });
}

function buildTable(container, data) {
  const tbody = container.querySelector('#cTabla');
  const countEl = container.querySelector('#cRowCount');
  if (!tbody) return;

  if (countEl) countEl.textContent = data.length + ' registros';

  if (data.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted)">Sin datos</td></tr>';
    return;
  }

  tbody.innerHTML = data.slice(0, 100).map(r => `<tr>
    <td style="font-family:monospace;font-size:12px">Sem ${r.semana}</td>
    <td style="font-size:12px">${r.centro_costo || '—'}</td>
    <td style="font-size:12px">${r.subgrupo || '—'}</td>
    <td style="font-size:12px;font-weight:600">${r.producto || '—'}</td>
    <td style="font-size:12px">${r.unidad || '—'}</td>
    <td style="font-family:monospace;font-weight:700">${fmt(r.cantidad, 2)}</td>
  </tr>`).join('');
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-consumos-calidad'); if (c) loadData(c); }
