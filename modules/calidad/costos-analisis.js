/* ════════════════════════════════════════════════════════
   COSTOS DE ANALISIS - Gastos por Lab, Tipo y Cultivo
   ════════════════════════════════════════════════════════ */
import { fmt } from '../../assets/js/utils/formatters.js';

/* ── Static data: Labs ── */
const LABS = [
  { name: 'GROEN',   color: '#16a34a', muestras: 420, gasto: 25800 },
  { name: 'AGQ',     color: '#2563eb', muestras: 310, gasto: 22450 },
  { name: 'NSF',     color: '#7c3aed', muestras: 220, gasto: 15680 },
  { name: 'SGS',     color: '#d97706', muestras: 150, gasto: 10266 },
  { name: 'MERIEUX', color: '#e11d48', muestras: 80,  gasto: 6000  }
];

const TOTAL_GASTO = LABS.reduce((s, l) => s + l.gasto, 0);
const TOTAL_MUESTRAS = LABS.reduce((s, l) => s + l.muestras, 0);

/* ── Static data: Tipos de Analisis ── */
const TIPOS = [
  { tipo: 'Pesticidas',      gasto: 24500, color: '#dc2626' },
  { tipo: 'Pack 2',          gasto: 14200, color: '#ea580c' },
  { tipo: 'Metales Pesados', gasto: 12800, color: '#d97706' },
  { tipo: 'Glifosato',       gasto: 9500,  color: '#f59e0b' },
  { tipo: 'Cloratos',        gasto: 7200,  color: '#16a34a' },
  { tipo: 'Fosetil',         gasto: 5400,  color: '#0891b2' },
  { tipo: 'Pack 6',          gasto: 4096,  color: '#2563eb' },
  { tipo: 'Norovirus',       gasto: 2500,  color: '#7c3aed' }
];

/* ── Static data: Cultivos ── */
const CULTIVOS = [
  { cultivo: 'Mango',     emoji: '🥭', muestras: 380, gasto: 28500 },
  { cultivo: 'Fresa',     emoji: '🍓', muestras: 290, gasto: 19800 },
  { cultivo: 'Arandano',  emoji: '🫐', muestras: 240, gasto: 16200 },
  { cultivo: 'Palta',     emoji: '🥑', muestras: 150, gasto: 9400  },
  { cultivo: 'Granada',   emoji: '🍎', muestras: 80,  gasto: 4296  },
  { cultivo: 'Otros',     emoji: '📦', muestras: 40,  gasto: 2000  }
];

/* ── Render: Labs table ── */
function renderLabsTable() {
  const tbody = document.getElementById('caTablaLabs');
  const tfoot = document.getElementById('caTablaLabsFoot');
  if (!tbody) return;

  tbody.innerHTML = LABS.map(l => {
    const pct = ((l.gasto / TOTAL_GASTO) * 100).toFixed(1);
    const prom = (l.gasto / l.muestras).toFixed(2);
    return `<tr>
      <td style="font-weight:700">
        <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${l.color};margin-right:8px;vertical-align:middle"></span>
        ${l.name}
      </td>
      <td style="text-align:right">${fmt(l.muestras)}</td>
      <td style="text-align:right;font-weight:600">S/. ${fmt(l.gasto)}</td>
      <td style="text-align:right">${pct}%</td>
      <td style="text-align:right">S/. ${prom}</td>
    </tr>`;
  }).join('');

  const promTotal = (TOTAL_GASTO / TOTAL_MUESTRAS).toFixed(2);
  tfoot.innerHTML = `<tr style="font-weight:800;background:var(--surface2)">
    <td>TOTAL</td>
    <td style="text-align:right">${fmt(TOTAL_MUESTRAS)}</td>
    <td style="text-align:right">S/. ${fmt(TOTAL_GASTO)}</td>
    <td style="text-align:right">100%</td>
    <td style="text-align:right">S/. ${promTotal}</td>
  </tr>`;
}

/* ── Render: Tipos table ── */
function renderTiposTable() {
  const tbody = document.getElementById('caTablaTipos');
  if (!tbody) return;

  const totalTipos = TIPOS.reduce((s, t) => s + t.gasto, 0);

  tbody.innerHTML = TIPOS.map(t => {
    const pct = ((t.gasto / totalTipos) * 100).toFixed(1);
    return `<tr>
      <td style="font-weight:600">${t.tipo}</td>
      <td style="text-align:right;color:${t.color};font-weight:700">S/. ${fmt(t.gasto)}</td>
      <td style="text-align:right">${pct}%</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;height:8px;background:var(--surface2);border-radius:4px;overflow:hidden">
            <div style="width:${pct}%;height:100%;background:${t.color};border-radius:4px;transition:width .3s ease"></div>
          </div>
          <span style="font-size:11px;color:var(--muted);min-width:35px;text-align:right">${pct}%</span>
        </div>
      </td>
    </tr>`;
  }).join('');
}

/* ── Render: Cultivos table ── */
function renderCultivosTable() {
  const tbody = document.getElementById('caTablaCultivos');
  const tfoot = document.getElementById('caTablaCultivosFoot');
  if (!tbody) return;

  const totalCultivoGasto = CULTIVOS.reduce((s, c) => s + c.gasto, 0);
  const totalCultivoMuestras = CULTIVOS.reduce((s, c) => s + c.muestras, 0);

  const colores = ['#d97706', '#dc2626', '#2563eb', '#16a34a', '#e11d48', '#64748b'];

  tbody.innerHTML = CULTIVOS.map((c, i) => `<tr>
    <td style="font-weight:700">${c.emoji} ${c.cultivo}</td>
    <td style="text-align:right">${fmt(c.muestras)}</td>
    <td style="text-align:right">S/. ${fmt(c.gasto)}</td>
    <td style="text-align:right;font-weight:700;color:${colores[i] || '#64748b'}">S/. ${fmt(c.gasto)}</td>
  </tr>`).join('');

  tfoot.innerHTML = `<tr style="font-weight:800;background:var(--surface2)">
    <td>TOTAL</td>
    <td style="text-align:right">${fmt(totalCultivoMuestras)}</td>
    <td style="text-align:right">S/. ${fmt(totalCultivoGasto)}</td>
    <td style="text-align:right;font-weight:800;color:var(--amber)">S/. ${fmt(totalCultivoGasto)}</td>
  </tr>`;
}

/* ── CSV Export ── */
function bindExport() {
  const btn = document.getElementById('caExportCSV');
  if (!btn) return;

  btn.addEventListener('click', () => {
    let csv = 'Laboratorio,Muestras,Gasto,Porcentaje,Prom/Muestra\n';
    LABS.forEach(l => {
      const pct = ((l.gasto / TOTAL_GASTO) * 100).toFixed(1);
      const prom = (l.gasto / l.muestras).toFixed(2);
      csv += `${l.name},${l.muestras},${l.gasto},${pct}%,${prom}\n`;
    });
    csv += `TOTAL,${TOTAL_MUESTRAS},${TOTAL_GASTO},100%,${(TOTAL_GASTO / TOTAL_MUESTRAS).toFixed(2)}\n`;

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'costos_analisis_campana.csv';
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

/* ── Init ── */
export async function init(container) {
  renderLabsTable();
  renderTiposTable();
  renderCultivosTable();
  bindExport();
}
