/* ════════════════════════════════════════════════════════
   LABORATORIO MICROBIOLOGIA - Semaforo de Stock
   ════════════════════════════════════════════════════════ */
import { createChart, getColors, getDefaultOptions, getTextColor, getGridColor } from '../../assets/js/utils/chart-helpers.js';
import { fmt } from '../../assets/js/utils/formatters.js';

/* ── Static data: 30 microbiological products ── */
const LM_DATA = [
  { id:1,  name:'Placas Petrifilm Aerobios',     unit:'UND', stock:45,   monthly:60,   days:2,   totalConsumo:720,  status:'CRITICO' },
  { id:2,  name:'Placas Petrifilm E.Coli',        unit:'UND', stock:30,   monthly:40,   days:3,   totalConsumo:480,  status:'CRITICO' },
  { id:3,  name:'Placas Petrifilm Mohos',          unit:'UND', stock:25,   monthly:35,   days:4,   totalConsumo:420,  status:'CRITICO' },
  { id:4,  name:'Placas Petrifilm Staph',          unit:'UND', stock:20,   monthly:25,   days:5,   totalConsumo:300,  status:'CRITICO' },
  { id:5,  name:'Bolsas Stomacher',                unit:'UND', stock:100,  monthly:120,  days:6,   totalConsumo:1440, status:'CRITICO' },
  { id:6,  name:'Agua Peptonada Tamponada',        unit:'KG',  stock:2.5,  monthly:1.8,  days:7,   totalConsumo:21.6, status:'BAJO' },
  { id:7,  name:'Caldo Lauril Sulfato',            unit:'LT',  stock:3,    monthly:2.5,  days:8,   totalConsumo:30,   status:'BAJO' },
  { id:8,  name:'Agar PCA',                        unit:'KG',  stock:1.8,  monthly:1.2,  days:9,   totalConsumo:14.4, status:'BAJO' },
  { id:9,  name:'Reactivo Oxidasa',                unit:'UND', stock:15,   monthly:12,   days:10,  totalConsumo:144,  status:'BAJO' },
  { id:10, name:'Reactivo Kovacs',                 unit:'LT',  stock:0.5,  monthly:0.4,  days:11,  totalConsumo:4.8,  status:'BAJO' },
  { id:11, name:'Hisopos Esteriles',               unit:'UND', stock:200,  monthly:130,  days:12,  totalConsumo:1560, status:'BAJO' },
  { id:12, name:'Alcohol Etilico 96',              unit:'LT',  stock:15,   monthly:8,    days:13,  totalConsumo:96,   status:'BAJO' },
  { id:13, name:'Placas Rodac',                    unit:'UND', stock:50,   monthly:30,   days:14,  totalConsumo:360,  status:'BAJO' },
  { id:14, name:'Agar Sabouraud',                  unit:'KG',  stock:2,    monthly:0.9,  days:15,  totalConsumo:10.8, status:'MODERADO' },
  { id:15, name:'Agar MacConkey',                  unit:'KG',  stock:1.5,  monthly:0.7,  days:16,  totalConsumo:8.4,  status:'MODERADO' },
  { id:16, name:'Caldo BHI',                       unit:'LT',  stock:4,    monthly:1.8,  days:18,  totalConsumo:21.6, status:'MODERADO' },
  { id:17, name:'Alcohol Isopropilico',            unit:'LT',  stock:10,   monthly:4,    days:20,  totalConsumo:48,   status:'MODERADO' },
  { id:18, name:'Guantes Nitrilo S',               unit:'UND', stock:500,  monthly:200,  days:22,  totalConsumo:2400, status:'MODERADO' },
  { id:19, name:'Guantes Nitrilo M',               unit:'UND', stock:500,  monthly:180,  days:25,  totalConsumo:2160, status:'MODERADO' },
  { id:20, name:'Pipetas Pasteur',                 unit:'UND', stock:300,  monthly:100,  days:28,  totalConsumo:1200, status:'MODERADO' },
  { id:21, name:'Tubos Ensayo 16mm',               unit:'UND', stock:150,  monthly:50,   days:30,  totalConsumo:600,  status:'MODERADO' },
  { id:22, name:'Agua Destilada',                  unit:'LT',  stock:50,   monthly:12,   days:35,  totalConsumo:144,  status:'OK' },
  { id:23, name:'Mechero Bunsen Gas',              unit:'UND', stock:8,    monthly:1,    days:40,  totalConsumo:12,   status:'OK' },
  { id:24, name:'Papel pH Indicador',              unit:'UND', stock:120,  monthly:25,   days:45,  totalConsumo:300,  status:'OK' },
  { id:25, name:'Hipoclorito Sodio',               unit:'LT',  stock:20,   monthly:3,    days:50,  totalConsumo:36,   status:'OK' },
  { id:26, name:'Mascarillas N95',                 unit:'UND', stock:200,  monthly:30,   days:55,  totalConsumo:360,  status:'OK' },
  { id:27, name:'Gorros Descartables',             unit:'UND', stock:500,  monthly:80,   days:60,  totalConsumo:960,  status:'OK' },
  { id:28, name:'Mandiles Descartables',           unit:'UND', stock:100,  monthly:15,   days:65,  totalConsumo:180,  status:'OK' },
  { id:29, name:'Cinta Autoclave',                 unit:'UND', stock:30,   monthly:3,    days:70,  totalConsumo:36,   status:'OK' },
  { id:30, name:'Bolsas Autoclave',                unit:'UND', stock:200,  monthly:20,   days:75,  totalConsumo:240,  status:'OK' }
];

/* ── Color by status ── */
function statusColor(status) {
  switch (status) {
    case 'CRITICO':  return '#dc2626';
    case 'BAJO':     return '#d97706';
    case 'MODERADO': return '#f59e0b';
    case 'OK':       return '#16a34a';
    default:         return '#64748b';
  }
}

function statusBadge(status) {
  const map = {
    CRITICO:  'badge-danger',
    BAJO:     'badge-warn',
    MODERADO: 'badge-amber',
    OK:       'badge-verde'
  };
  const icons = { CRITICO: '🚨', BAJO: '⚠', MODERADO: '◐', OK: '✓' };
  return `<span class="badge ${map[status] || 'badge-muted'}">${icons[status] || ''} ${status}</span>`;
}

function unitBadge(unit) {
  const cls = unit === 'UND' ? 'badge-azul' : unit === 'KG' ? 'badge-purple' : 'badge-cyan';
  return `<span class="badge ${cls}">${unit}</span>`;
}

/* ── Chart ref ── */
let semaforoChart = null;
let currentUnit = 'ALL';
let currentEstado = 'ALL';

/* ── Build horizontal bar chart ── */
function buildSemaforoChart(filter) {
  const data = filter === 'ALL' ? [...LM_DATA] : LM_DATA.filter(p => p.unit === filter);
  data.sort((a, b) => a.days - b.days);

  const textColor = getTextColor();
  const gridColor = getGridColor();

  semaforoChart = createChart('lmChartSemaforo', {
    type: 'bar',
    data: {
      labels: data.map(p => p.name),
      datasets: [{
        label: 'Dias de Stock',
        data: data.map(p => p.days),
        backgroundColor: data.map(p => statusColor(p.status)),
        borderColor: data.map(p => statusColor(p.status)),
        borderWidth: 1,
        borderRadius: 4,
        barThickness: 14
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
          bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
          padding: 12,
          cornerRadius: 10,
          callbacks: {
            label: ctx => ` ${ctx.parsed.x} dias de stock`
          }
        },
        datalabels: {
          anchor: 'end',
          align: 'end',
          color: textColor,
          font: { size: 10, weight: '600', family: 'Plus Jakarta Sans' },
          formatter: v => v + 'd'
        }
      },
      scales: {
        x: {
          ticks: { color: textColor, font: { size: 11 }, callback: v => v + 'd' },
          grid: { color: gridColor },
          title: { display: true, text: 'Dias de Stock Disponibles', color: textColor, font: { size: 12 } }
        },
        y: {
          ticks: { color: textColor, font: { size: 10 }, crossAlign: 'far' },
          grid: { display: false }
        }
      }
    }
  });
}

/* ── Build table ── */
function buildTable(unitFilter, estadoFilter) {
  let data = [...LM_DATA];
  if (unitFilter !== 'ALL') data = data.filter(p => p.unit === unitFilter);
  if (estadoFilter !== 'ALL') data = data.filter(p => p.status === estadoFilter);
  data.sort((a, b) => a.days - b.days);

  const tbody = document.getElementById('lmTabla');
  if (!tbody) return;

  tbody.innerHTML = data.map((p, i) => {
    const maxDays = 80;
    const barW = Math.min(100, (p.days / maxDays) * 100);
    return `<tr>
      <td>${i + 1}</td>
      <td style="font-weight:600">${p.name}</td>
      <td>${unitBadge(p.unit)}</td>
      <td style="text-align:right">${fmt(p.stock, p.unit === 'KG' || p.unit === 'LT' ? 1 : 0)}</td>
      <td style="text-align:right">${fmt(p.monthly, p.unit === 'KG' || p.unit === 'LT' ? 1 : 0)}</td>
      <td style="min-width:120px">
        <div style="display:flex;align-items:center;gap:6px">
          <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden">
            <div style="width:${barW}%;height:100%;background:${statusColor(p.status)};border-radius:4px"></div>
          </div>
          <span style="color:${statusColor(p.status)};font-weight:700;font-size:13px;min-width:28px;text-align:right">${p.days}</span>
        </div>
      </td>
      <td style="text-align:right">${fmt(p.totalConsumo, p.unit === 'KG' || p.unit === 'LT' ? 1 : 0)}</td>
      <td>${statusBadge(p.status)}</td>
    </tr>`;
  }).join('');
}

/* ── Update KPIs ── */
function updateKPIs() {
  const critico = LM_DATA.filter(p => p.status === 'CRITICO').length;
  const bajo = LM_DATA.filter(p => p.status === 'BAJO').length;
  const ok = LM_DATA.filter(p => p.status === 'MODERADO' || p.status === 'OK').length;

  const el = id => document.getElementById(id);
  el('lmKpiTotal').textContent = LM_DATA.length;
  el('lmKpiCritico').textContent = critico;
  el('lmKpiBajo').textContent = bajo;
  el('lmKpiOk').textContent = ok;

  /* Unit counters */
  el('lmCountAll').textContent = LM_DATA.length;
  el('lmCountUND').textContent = LM_DATA.filter(p => p.unit === 'UND').length;
  el('lmCountKG').textContent = LM_DATA.filter(p => p.unit === 'KG').length;
  el('lmCountLT').textContent = LM_DATA.filter(p => p.unit === 'LT').length;
}

/* ── Bind filter buttons ── */
function bindFilters() {
  /* Unit filter buttons */
  document.querySelectorAll('.lm-unit-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lm-unit-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentUnit = btn.dataset.unit;
      buildSemaforoChart(currentUnit);
      buildTable(currentUnit, currentEstado);
    });
  });

  /* Estado filter buttons */
  document.querySelectorAll('.lm-estado-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.lm-estado-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentEstado = btn.dataset.estado;
      buildTable(currentUnit, currentEstado);
    });
  });
}

/* ── Init ── */
export async function init(container) {
  updateKPIs();
  buildSemaforoChart('ALL');
  buildTable('ALL', 'ALL');
  bindFilters();
}
