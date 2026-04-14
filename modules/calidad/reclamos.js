/* ════════════════════════════════════════════════════════
   RECLAMOS DE CALIDAD - Dashboard con 4 Charts + Tabla
   ════════════════════════════════════════════════════════ */
import { createChart, getColors, getDefaultOptions, getTextColor, getGridColor } from '../../assets/js/utils/chart-helpers.js';
import { fmt } from '../../assets/js/utils/formatters.js';

/* ── Static data: 26 reclamos ── */
const RECLAMOS = [
  { id:'RC-001', fecha:'2024-12-05', campana:'2024-2025', cultivo:'Arandano',    cliente:"Nature's Touch",  destino:'Canada',   planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-002', fecha:'2024-12-18', campana:'2024-2025', cultivo:'Arandano',    cliente:'Legumes Plus',    destino:'Francia',  planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-003', fecha:'2025-01-10', campana:'2024-2025', cultivo:'Mango Kent',  cliente:'HG Foods',        destino:'USA',      planta:'PRC',          area:'Acondicionado',  motivo:'Defectos Calidad',          estatus:'PROCEDE' },
  { id:'RC-004', fecha:'2025-01-22', campana:'2024-2025', cultivo:'Mango Kent',  cliente:"Nature's Touch",  destino:'Canada',   planta:'PRC',          area:'Empaque',        motivo:'Mal Cubicaje',              estatus:'NO PROCEDE' },
  { id:'RC-005', fecha:'2025-02-03', campana:'2024-2025', cultivo:'Fresa',       cliente:'Greenyard',       destino:'Belgica',  planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-006', fecha:'2025-02-14', campana:'2024-2025', cultivo:'Palta',       cliente:'HG Foods',        destino:'USA',      planta:'Agroempaques', area:'Despacho',       motivo:'Temperatura Transito',       estatus:'PROCEDE' },
  { id:'RC-007', fecha:'2025-03-01', campana:'2024-2025', cultivo:'Arandano',    cliente:'Sante',           destino:'Holanda',  planta:'PRC',          area:'Acondicionado',  motivo:'Color No Uniforme',          estatus:'NO PROCEDE' },
  { id:'RC-008', fecha:'2025-03-15', campana:'2024-2025', cultivo:'Mango Kent',  cliente:'Legumes Plus',    destino:'Francia',  planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-009', fecha:'2025-04-02', campana:'2024-2025', cultivo:'Fresa',       cliente:"Nature's Touch",  destino:'Canada',   planta:'PRC',          area:'Acondicionado',  motivo:'Defectos Calidad',          estatus:'PROCEDE' },
  { id:'RC-010', fecha:'2025-05-10', campana:'2024-2025', cultivo:'Arandano',    cliente:'Greenyard',       destino:'Belgica',  planta:'Agroempaques', area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-011', fecha:'2025-06-08', campana:'2025-2026', cultivo:'Mango Kent',  cliente:'HG Foods',        destino:'USA',      planta:'PRC',          area:'Acondicionado',  motivo:'Brix Bajo Especificacion',   estatus:'PROCEDE' },
  { id:'RC-012', fecha:'2025-07-12', campana:'2025-2026', cultivo:'Fresa',       cliente:'Sante',           destino:'Holanda',  planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-013', fecha:'2025-08-05', campana:'2025-2026', cultivo:'Palta',       cliente:'Legumes Plus',    destino:'Francia',  planta:'Agroempaques', area:'Despacho',       motivo:'Empaque Danado',             estatus:'NO PROCEDE' },
  { id:'RC-014', fecha:'2025-08-20', campana:'2025-2026', cultivo:'Arandano',    cliente:"Nature's Touch",  destino:'Canada',   planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-015', fecha:'2025-09-14', campana:'2025-2026', cultivo:'Mango Kent',  cliente:'Greenyard',       destino:'Belgica',  planta:'PRC',          area:'Abastecimiento', motivo:'Mal Cubicaje',              estatus:'NO PROCEDE' },
  { id:'RC-016', fecha:'2025-10-02', campana:'2025-2026', cultivo:'Fresa',       cliente:'HG Foods',        destino:'USA',      planta:'PRC',          area:'Acondicionado',  motivo:'Defectos Calidad',          estatus:'PROCEDE' },
  { id:'RC-017', fecha:'2025-10-28', campana:'2025-2026', cultivo:'Arandano',    cliente:'Sante',           destino:'Holanda',  planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-018', fecha:'2025-11-15', campana:'2025-2026', cultivo:'Palta',       cliente:"Nature's Touch",  destino:'Canada',   planta:'Agroempaques', area:'Despacho',       motivo:'Temperatura Transito',       estatus:'PROCEDE' },
  { id:'RC-019', fecha:'2025-12-03', campana:'2025-2026', cultivo:'Mango Kent',  cliente:'Legumes Plus',    destino:'Francia',  planta:'PRC',          area:'Acondicionado',  motivo:'Defectos Calidad',          estatus:'PROCEDE' },
  { id:'RC-020', fecha:'2025-12-20', campana:'2025-2026', cultivo:'Fresa',       cliente:'HG Foods',        destino:'USA',      planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-021', fecha:'2026-01-08', campana:'2025-2026', cultivo:'Arandano',    cliente:'Greenyard',       destino:'Belgica',  planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-022', fecha:'2026-01-25', campana:'2025-2026', cultivo:'Mango Kent',  cliente:"Nature's Touch",  destino:'Canada',   planta:'PRC',          area:'Abastecimiento', motivo:'Mal Cubicaje',              estatus:'NO PROCEDE' },
  { id:'RC-023', fecha:'2026-02-10', campana:'2025-2026', cultivo:'Palta',       cliente:'Sante',           destino:'Holanda',  planta:'Agroempaques', area:'Acondicionado',  motivo:'Color No Uniforme',          estatus:'NO PROCEDE' },
  { id:'RC-024', fecha:'2026-02-28', campana:'2025-2026', cultivo:'Fresa',       cliente:'Legumes Plus',    destino:'Francia',  planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-025', fecha:'2026-03-12', campana:'2025-2026', cultivo:'Arandano',    cliente:'HG Foods',        destino:'USA',      planta:'PRC',          area:'Empaque',        motivo:'Material Extrano Plastico', estatus:'PROCEDE' },
  { id:'RC-026', fecha:'2026-03-28', campana:'2025-2026', cultivo:'Mango Kent',  cliente:'Greenyard',       destino:'Belgica',  planta:'PRC',          area:'Acondicionado',  motivo:'Defectos Calidad',          estatus:'NO PROCEDE' }
];

/* ── Helpers ── */
function countBy(arr, key) {
  const map = {};
  arr.forEach(r => { map[r[key]] = (map[r[key]] || 0) + 1; });
  return map;
}

function estatusBadge(est) {
  return est === 'PROCEDE'
    ? '<span class="badge badge-danger">PROCEDE</span>'
    : '<span class="badge badge-verde">NO PROCEDE</span>';
}

function areaBadge(area) {
  const map = {
    Empaque:        'badge-azul',
    Acondicionado:  'badge-purple',
    Despacho:       'badge-amber',
    Abastecimiento: 'badge-cyan'
  };
  return `<span class="badge ${map[area] || 'badge-muted'}">${area}</span>`;
}

function formatFecha(dateStr) {
  if (!dateStr) return '-';
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

/* ── Chart 1: Distribucion por Motivo (doughnut) ── */
function buildChartMotivo() {
  const motivos = countBy(RECLAMOS, 'motivo');
  const labels = Object.keys(motivos);
  const data = Object.values(motivos);
  const palette = ['#dc2626', '#ea580c', '#d97706', '#f59e0b', '#16a34a', '#0891b2', '#2563eb', '#7c3aed'];

  createChart('rcChartMotivo', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: palette.slice(0, labels.length),
        borderWidth: 2,
        borderColor: 'var(--surface)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '55%',
      plugins: {
        legend: {
          display: true,
          position: 'right',
          labels: { color: getTextColor(), font: { size: 11, family: 'Plus Jakarta Sans' }, padding: 10, boxWidth: 12 }
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ` ${ctx.label}: ${ctx.parsed} (${((ctx.parsed / RECLAMOS.length) * 100).toFixed(1)}%)`
          }
        }
      }
    }
  });
}

/* ── Chart 2: Top Clientes (horizontal stacked bar) ── */
function buildChartClientes() {
  const clientes = [...new Set(RECLAMOS.map(r => r.cliente))];
  const procede = clientes.map(c => RECLAMOS.filter(r => r.cliente === c && r.estatus === 'PROCEDE').length);
  const noProcede = clientes.map(c => RECLAMOS.filter(r => r.cliente === c && r.estatus === 'NO PROCEDE').length);

  const textColor = getTextColor();
  const gridColor = getGridColor();

  createChart('rcChartClientes', {
    type: 'bar',
    data: {
      labels: clientes,
      datasets: [
        { label: 'Procede', data: procede, backgroundColor: '#dc2626', borderRadius: 4, barThickness: 18 },
        { label: 'No Procede', data: noProcede, backgroundColor: '#16a34a', borderRadius: 4, barThickness: 18 }
      ]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: textColor, font: { size: 11, family: 'Plus Jakarta Sans' }, boxWidth: 12, padding: 12 }
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          padding: 12,
          cornerRadius: 10
        }
      },
      scales: {
        x: {
          stacked: true,
          ticks: { color: textColor, font: { size: 11 }, stepSize: 1 },
          grid: { color: gridColor }
        },
        y: {
          stacked: true,
          ticks: { color: textColor, font: { size: 11 } },
          grid: { display: false }
        }
      }
    }
  });
}

/* ── Chart 3: Reclamos por Cultivo (grouped bar) ── */
function buildChartCultivo() {
  const cultivos = [...new Set(RECLAMOS.map(r => r.cultivo))];
  const procede = cultivos.map(c => RECLAMOS.filter(r => r.cultivo === c && r.estatus === 'PROCEDE').length);
  const noProcede = cultivos.map(c => RECLAMOS.filter(r => r.cultivo === c && r.estatus === 'NO PROCEDE').length);

  const textColor = getTextColor();
  const gridColor = getGridColor();

  createChart('rcChartCultivo', {
    type: 'bar',
    data: {
      labels: cultivos,
      datasets: [
        { label: 'Procede', data: procede, backgroundColor: 'rgba(220,38,38,0.75)', borderColor: '#dc2626', borderWidth: 1, borderRadius: 6 },
        { label: 'No Procede', data: noProcede, backgroundColor: 'rgba(22,163,74,0.75)', borderColor: '#16a34a', borderWidth: 1, borderRadius: 6 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: { color: textColor, font: { size: 11, family: 'Plus Jakarta Sans' }, boxWidth: 12, padding: 12 }
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          padding: 12,
          cornerRadius: 10
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 } },
          grid: { display: false }
        },
        y: {
          ticks: { color: textColor, font: { size: 11 }, stepSize: 1 },
          grid: { color: gridColor },
          beginAtZero: true
        }
      }
    }
  });
}

/* ── Chart 4: Tendencia Mensual (line) ── */
function buildChartTendencia() {
  /* Build monthly buckets from 12/2024 to 03/2026 */
  const months = [];
  const start = new Date(2024, 11, 1); // Dec 2024
  const end = new Date(2026, 2, 1);    // Mar 2026
  const d = new Date(start);
  while (d <= end) {
    months.push({ label: d.toLocaleDateString('es-PE', { month: 'short', year: '2-digit' }), year: d.getFullYear(), month: d.getMonth() });
    d.setMonth(d.getMonth() + 1);
  }

  const counts = months.map(m =>
    RECLAMOS.filter(r => {
      const rd = new Date(r.fecha);
      return rd.getFullYear() === m.year && rd.getMonth() === m.month;
    }).length
  );

  const textColor = getTextColor();
  const gridColor = getGridColor();

  createChart('rcChartTendencia', {
    type: 'line',
    data: {
      labels: months.map(m => m.label),
      datasets: [{
        label: 'Reclamos',
        data: counts,
        borderColor: '#dc2626',
        backgroundColor: 'rgba(220,38,38,0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#dc2626',
        pointBorderColor: '#fff',
        pointBorderWidth: 2,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ` ${ctx.parsed.y} reclamos`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 10 }, maxRotation: 45 },
          grid: { color: gridColor }
        },
        y: {
          ticks: { color: textColor, font: { size: 11 }, stepSize: 1 },
          grid: { color: gridColor },
          beginAtZero: true
        }
      }
    }
  });
}

/* ── Render table ── */
function renderTable(data) {
  const tbody = document.getElementById('rcTabla');
  if (!tbody) return;

  tbody.innerHTML = data.map((r, i) => `<tr>
    <td style="font-weight:600;color:var(--muted)">${r.id}</td>
    <td>${formatFecha(r.fecha)}</td>
    <td>${r.campana}</td>
    <td style="font-weight:600">${r.cultivo}</td>
    <td>${r.cliente}</td>
    <td>${r.destino}</td>
    <td>${r.planta}</td>
    <td>${areaBadge(r.area)}</td>
    <td>${r.motivo}</td>
    <td>${estatusBadge(r.estatus)}</td>
  </tr>`).join('');
}

/* ── Resumen por Area ── */
function renderResumenArea() {
  const areas = countBy(RECLAMOS, 'area');
  const container = document.getElementById('rcResumenArea');
  if (!container) return;

  const iconMap = { Empaque: '📦', Acondicionado: '🔧', Despacho: '🚛', Abastecimiento: '📋' };
  const colorMap = { Empaque: 'var(--azul)', Acondicionado: 'var(--purple)', Despacho: 'var(--amber)', Abastecimiento: 'var(--cyan)' };

  container.innerHTML = Object.entries(areas)
    .sort((a, b) => b[1] - a[1])
    .map(([area, count]) => `
      <div class="kpi-card" style="border-top:3px solid ${colorMap[area] || 'var(--muted)'}">
        <div class="kpi-label">${iconMap[area] || '📋'} ${area}</div>
        <div class="kpi-value" style="color:${colorMap[area] || 'var(--muted)'}">${count}</div>
      </div>
    `).join('');
}

/* ── Populate filter dropdowns ── */
function populateFilters() {
  const unique = (key) => [...new Set(RECLAMOS.map(r => r[key]))].sort();

  const addOptions = (selectId, values) => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    values.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = v;
      sel.appendChild(opt);
    });
  };

  addOptions('rcFilterCultivo', unique('cultivo'));
  addOptions('rcFilterCliente', unique('cliente'));
  addOptions('rcFilterArea', unique('area'));
}

/* ── Filter logic ── */
function getFilteredData() {
  let data = [...RECLAMOS];

  const campana  = document.getElementById('rcFilterCampana')?.value;
  const cultivo  = document.getElementById('rcFilterCultivo')?.value;
  const cliente  = document.getElementById('rcFilterCliente')?.value;
  const area     = document.getElementById('rcFilterArea')?.value;
  const estatus  = document.getElementById('rcFilterEstatus')?.value;
  const buscar   = document.getElementById('rcFilterBuscar')?.value?.toLowerCase() || '';

  if (campana)  data = data.filter(r => r.campana === campana);
  if (cultivo)  data = data.filter(r => r.cultivo === cultivo);
  if (cliente)  data = data.filter(r => r.cliente === cliente);
  if (area)     data = data.filter(r => r.area === area);
  if (estatus)  data = data.filter(r => r.estatus === estatus);
  if (buscar)   data = data.filter(r => Object.values(r).some(v => String(v).toLowerCase().includes(buscar)));

  return data;
}

function applyFilters() {
  const data = getFilteredData();
  renderTable(data);
  renderFilterChips();
}

function renderFilterChips() {
  const container = document.getElementById('rcFilterChips');
  if (!container) return;

  const filters = [
    { id: 'rcFilterCampana', label: 'Campana' },
    { id: 'rcFilterCultivo', label: 'Cultivo' },
    { id: 'rcFilterCliente', label: 'Cliente' },
    { id: 'rcFilterArea', label: 'Area' },
    { id: 'rcFilterEstatus', label: 'Estatus' }
  ];

  const chips = filters
    .filter(f => document.getElementById(f.id)?.value)
    .map(f => {
      const val = document.getElementById(f.id).value;
      return `<span class="badge badge-azul" style="cursor:pointer;padding:4px 10px" data-filter="${f.id}" title="Click para limpiar">${f.label}: ${val} &times;</span>`;
    });

  container.innerHTML = chips.join('');

  container.querySelectorAll('.badge').forEach(chip => {
    chip.addEventListener('click', () => {
      const filterId = chip.dataset.filter;
      const sel = document.getElementById(filterId);
      if (sel) sel.value = '';
      applyFilters();
    });
  });
}

function bindFilters() {
  ['rcFilterCampana', 'rcFilterCultivo', 'rcFilterCliente', 'rcFilterArea', 'rcFilterEstatus'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', applyFilters);
  });

  const buscar = document.getElementById('rcFilterBuscar');
  if (buscar) {
    let timer;
    buscar.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(applyFilters, 300);
    });
  }
}

/* ── Init ── */
export async function init(container) {
  populateFilters();
  buildChartMotivo();
  buildChartClientes();
  buildChartCultivo();
  buildChartTendencia();
  renderTable(RECLAMOS);
  renderResumenArea();
  bindFilters();
}
