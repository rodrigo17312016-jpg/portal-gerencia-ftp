/* ════════════════════════════════════════════════════════
   PROYECCIONES - Ejecutivo v4
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct } from '../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

let histData = [];
let activeFilters = { hist: '30' };
let refreshInterval = null;

const FRUTA_COLORS = {
  'MANGO':    '#f59e0b',
  'ARANDANO': '#6366f1',
  'GRANADA':  '#be123c',
  'FRESA':    '#e11d48',
  'PALTA':    '#0e7c3a',
  'PIÑA':     '#eab308'
};

export async function init(container) {
  container.querySelectorAll('.filter-chip[data-pfilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.pfilter;
      container.querySelectorAll(`.filter-chip[data-pfilter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      loadData(container);
    });
  });

  const refreshBtn = container.querySelector('#proyRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => refreshBtn.style.transform = '', 700);
    loadData(container);
  });

  await loadData(container);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (document.getElementById('panel-proyecciones')) loadData(container);
    else destroy();
  }, 300000);
}

async function loadData(container) {
  try {
    const dias = +activeFilters.hist;
    const since = new Date(); since.setDate(since.getDate() - dias);

    const { data } = await supabase.from('registro_produccion')
      .select('fecha, fruta, consumo_kg, pt_aprox_kg')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha');

    histData = data || [];

    const lastEl = container.querySelector('#proyLastUpdate');
    if (lastEl) {
      const now = new Date();
      lastEl.textContent = `Base ${dias}d · Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error proyecciones:', err);
    histData = [];
  }

  render(container);
}

function render(container) {
  if (!histData.length) {
    setVal(container, 'proySemanal', '— kg');
    setVal(container, 'proyMensual', '— kg');
    setVal(container, 'proyTendencia', '—');
    setVal(container, 'proyPromedio', '— kg/dia');
    return;
  }

  // Agregar por fecha (sumando PT y MP)
  const byFecha = {};
  histData.forEach(r => {
    if (!byFecha[r.fecha]) byFecha[r.fecha] = { pt: 0, mp: 0 };
    byFecha[r.fecha].pt += +(r.pt_aprox_kg || 0);
    byFecha[r.fecha].mp += +(r.consumo_kg || 0);
  });
  const fechas = Object.keys(byFecha).sort();
  const valores = fechas.map(f => byFecha[f].pt);
  const diasDatos = fechas.length;

  const promedio = valores.reduce((s, v) => s + v, 0) / Math.max(diasDatos, 1);
  const semanal = promedio * 7;
  const mensual = promedio * 30;

  // Tendencia
  const mitad = Math.floor(diasDatos / 2);
  const promPrimera = valores.slice(0, mitad).reduce((s, v) => s + v, 0) / Math.max(mitad, 1);
  const promSegunda = valores.slice(mitad).reduce((s, v) => s + v, 0) / Math.max(diasDatos - mitad, 1);
  const tendenciaPct = promPrimera > 0 ? ((promSegunda - promPrimera) / promPrimera * 100) : 0;

  let tendLabel, tendColor, tendSub;
  if (tendenciaPct > 2) {
    tendLabel = `↑ +${tendenciaPct.toFixed(1)}%`;
    tendColor = 'var(--verde)';
    tendSub = 'Tendencia al alza';
  } else if (tendenciaPct < -2) {
    tendLabel = `↓ ${tendenciaPct.toFixed(1)}%`;
    tendColor = 'var(--naranja)';
    tendSub = 'Tendencia a la baja';
  } else {
    tendLabel = '→ Estable';
    tendColor = 'var(--azul)';
    tendSub = 'Variacion <2%';
  }

  setVal(container, 'proySemanal', fmt(semanal) + ' kg');
  setVal(container, 'proySemanalSub', `${(semanal/1000).toFixed(1)} TN proyectadas`);
  setVal(container, 'proyMensual', fmt(mensual) + ' kg');
  setVal(container, 'proyMensualSub', `${(mensual/1000).toFixed(1)} TN proyectadas`);
  setVal(container, 'proyTendencia', tendLabel);
  const tendEl = container.querySelector('#proyTendencia');
  if (tendEl) tendEl.style.color = tendColor;
  setVal(container, 'proyTendenciaSub', tendSub);
  setVal(container, 'proyPromedio', fmt(promedio, 0) + ' kg/dia');
  setVal(container, 'proyPromedioSub', `Base: ${diasDatos} dias`);

  buildChart(fechas, valores, promedio, tendenciaPct);
  buildFrutasTable(container);
}

function buildChart(fechas, valores, promedio, tendenciaPct) {
  const labels = fechas.map(f => {
    const d = new Date(f + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { day: '2-digit', month: 'numeric' });
  });
  const proyLabels = [];
  const proyValues = [];
  const lastDate = new Date(fechas[fechas.length - 1] + 'T00:00:00');
  for (let i = 1; i <= 7; i++) {
    const nd = new Date(lastDate); nd.setDate(lastDate.getDate() + i);
    proyLabels.push(nd.toLocaleDateString('es-PE', { day: '2-digit', month: 'numeric' }));
    proyValues.push(Math.round(promedio * (1 + tendenciaPct / 100 * i / 7)));
  }

  const allLabels = [...labels, ...proyLabels];
  const realData = [...valores, ...Array(7).fill(null)];
  const proyData = [...Array(valores.length - 1).fill(null), valores[valores.length - 1], ...proyValues];

  createChart('chartProyTendencia', {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        { label: '✓ Real', data: realData, borderColor: '#0e7c3a', backgroundColor: 'rgba(14,124,58,0.15)', fill: true, tension: 0.3, pointRadius: 4, pointBackgroundColor: '#0e7c3a', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 },
        { label: '🔮 Proyeccion', data: proyData, borderColor: '#6d28d9', backgroundColor: 'rgba(109,40,217,0.08)', borderDash: [8, 4], fill: false, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#6d28d9', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 }
      ]
    },
    options: {
      ...getDefaultOptions('line'),
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 12, weight: '600' } } } }
    }
  });
}

function buildFrutasTable(container) {
  const tbody = container.querySelector('#proyTablaFrutas');
  if (!tbody) return;

  const byF = {};
  histData.forEach(r => {
    const f = (r.fruta || 'OTRO').toUpperCase();
    if (!byF[f]) byF[f] = { mp: 0, pt: 0, fechas: new Set() };
    byF[f].mp += +(r.consumo_kg || 0);
    byF[f].pt += +(r.pt_aprox_kg || 0);
    byF[f].fechas.add(r.fecha);
  });

  const sorted = Object.entries(byF).sort((a, b) => b[1].pt - a[1].pt);
  setVal(container, 'proyCountLabel', sorted.length + ' frutas');

  if (!sorted.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin datos historicos</td></tr>';
    return;
  }

  tbody.innerHTML = sorted.map(([f, v]) => {
    const color = FRUTA_COLORS[f] || '#64748b';
    const rend = v.mp > 0 ? (v.pt / v.mp * 100) : 0;
    const diasActivos = v.fechas.size;
    const promDia = diasActivos > 0 ? (v.pt / diasActivos) : 0;
    const proySem = promDia * 7;
    const proyMes = promDia * 30;

    return `<tr>
      <td style="font-weight:700;color:${color}">${f}</td>
      <td style="font-family:monospace;color:var(--naranja)">${fmt(v.mp)}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--verde)">${fmt(v.pt)}</td>
      <td style="font-weight:700;color:${rend >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${rend.toFixed(1)}%</td>
      <td style="font-family:monospace;color:var(--muted)">${fmt(promDia, 0)} kg</td>
      <td style="font-family:monospace;font-weight:700;color:var(--purple)">${fmt(proySem)}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--azul)">${fmt(proyMes)}</td>
    </tr>`;
  }).join('');
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-proyecciones'); if (c) loadData(c); }
export function destroy() { if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; } }
