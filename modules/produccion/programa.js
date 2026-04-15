/* ════════════════════════════════════════════════════════
   PROGRAMA DE PRODUCCION - Ejecutivo v4
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

let weekData = [];
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
  const refreshBtn = container.querySelector('#progRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => refreshBtn.style.transform = '', 700);
    loadData(container);
  });

  await loadData(container);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (document.getElementById('panel-programa')) loadData(container);
    else destroy();
  }, 180000);
}

async function loadData(container) {
  try {
    const hoy = today();
    const d = new Date(hoy + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d); monday.setDate(d.getDate() + mondayOffset);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const fmtISO = dt => dt.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const startWeek = fmtISO(monday);
    const endWeek = fmtISO(sunday);

    const weekLbl = container.querySelector('#progWeekLabel');
    if (weekLbl) {
      weekLbl.textContent = `${monday.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })} - ${sunday.toLocaleDateString('es-PE', { day: 'numeric', month: 'short' })}`;
    }

    const { data } = await supabase.from('registro_produccion')
      .select('fecha, fruta, consumo_kg, pt_aprox_kg, rendimiento, turno, linea, proyectado_tn')
      .gte('fecha', startWeek)
      .lte('fecha', endWeek)
      .order('fecha');

    weekData = data || [];
    render(container, monday, sunday);
  } catch (err) {
    console.error('Error programa:', err);
    weekData = [];
    render(container);
  }
}

function render(container, monday, sunday) {
  const totalMP = weekData.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
  const totalPT = weekData.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
  const programado = weekData.reduce((s, r) => s + (+(r.proyectado_tn || 0)), 0) * 1000 || totalMP * 1.2;
  const cumplimiento = programado > 0 ? (totalMP / programado * 100) : 0;

  const hoy = new Date();
  const sundayD = sunday || hoy;
  const daysInWeek = Math.max(0, Math.ceil((sundayD - hoy) / 86400000));

  setVal(container, 'progProgramado', fmt(programado) + ' kg');
  setVal(container, 'progProgramadoSub', `${(programado/1000).toFixed(1)} TN proyectadas`);
  setVal(container, 'progEjecutado', fmt(totalPT) + ' kg');
  setVal(container, 'progEjecutadoSub', `MP consumida: ${fmt(totalMP)} kg`);
  setVal(container, 'progCumplimiento', fmtPct(cumplimiento));
  const bar = container.querySelector('#progProgressBar');
  if (bar) bar.style.width = Math.min(100, cumplimiento) + '%';
  setVal(container, 'progCumplimientoSub', cumplimiento >= 80 ? '▲ Meta casi lograda' : cumplimiento >= 50 ? 'En ruta' : 'Cumplimiento bajo');
  setVal(container, 'progDiasRest', daysInWeek.toString());
  setVal(container, 'progDiasSub', daysInWeek === 0 ? 'Ultimo dia' : daysInWeek === 1 ? '1 dia mas' : `${daysInWeek} dias mas`);
  setVal(container, 'progCountLabel', `${weekData.length} registros`);

  buildDiasChart(monday);
  buildFrutasChart();
  buildTable(container);
}

function buildDiasChart(monday) {
  if (!monday) return;
  const labels = [];
  const fechas = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i);
    labels.push(d.toLocaleDateString('es-PE', { weekday: 'short' }));
    fechas.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  }

  const mpPorDia = fechas.map(f => weekData.filter(r => r.fecha === f).reduce((s, r) => s + (+(r.consumo_kg || 0)), 0));
  const ptPorDia = fechas.map(f => weekData.filter(r => r.fecha === f).reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0));

  createChart('chartProgDias', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'MP (kg)', data: mpPorDia, backgroundColor: 'rgba(234,88,12,0.7)', borderColor: '#ea580c', borderWidth: 2, borderRadius: 6 },
        { label: 'PT (kg)', data: ptPorDia, backgroundColor: 'rgba(14,124,58,0.7)', borderColor: '#0e7c3a', borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } }
    }
  });
}

function buildFrutasChart() {
  const byF = {};
  weekData.forEach(r => {
    const f = (r.fruta || 'OTRO').toUpperCase();
    byF[f] = (byF[f] || 0) + (+(r.consumo_kg || 0));
  });
  const frutas = Object.keys(byF).sort((a, b) => byF[b] - byF[a]);
  if (!frutas.length) return;
  const values = frutas.map(f => byF[f]);
  const colors = frutas.map(f => FRUTA_COLORS[f] || '#64748b');

  createChart('chartProgFrutas', {
    type: 'doughnut',
    data: {
      labels: frutas,
      datasets: [{ data: values, backgroundColor: colors, borderColor: '#fff', borderWidth: 3, hoverOffset: 8 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '58%',
      plugins: {
        legend: { position: 'right', labels: { color: '#64748b', font: { size: 11, weight: '600' }, padding: 10, usePointStyle: true, pointStyle: 'circle' } },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = values.reduce((s, v) => s + v, 0);
              const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${(ctx.raw/1000).toFixed(1)} TN (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function buildTable(container) {
  const tbody = container.querySelector('#progTabla');
  const tfoot = container.querySelector('#progFoot');
  if (!tbody) return;

  if (!weekData.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin registros esta semana</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  const sorted = [...weekData].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') || (b.hora || '').localeCompare(a.hora || ''));

  tbody.innerHTML = sorted.slice(0, 60).map(r => {
    const fruta = (r.fruta || '').toUpperCase();
    const color = FRUTA_COLORS[fruta] || '#64748b';
    const rend = r.rendimiento || (r.consumo_kg > 0 ? (r.pt_aprox_kg / r.consumo_kg * 100) : 0);
    const isDia = (r.turno || '').toUpperCase().includes('DIA');
    const estadoEjec = r.pt_aprox_kg > 0;
    const fechaD = new Date(r.fecha + 'T00:00:00');
    const fechaLbl = fechaD.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit' });

    return `<tr>
      <td style="font-size:11.5px;font-family:monospace">${fechaLbl}</td>
      <td style="font-weight:600;color:${color}">${r.fruta || '—'}</td>
      <td><span style="color:${isDia ? 'var(--amber)' : 'var(--azul)'};font-weight:700;font-size:11px">${isDia ? '☀️ DIA' : '🌙 NOCHE'}</span></td>
      <td style="font-size:12px">${r.linea || '—'}</td>
      <td style="font-family:monospace;color:var(--naranja)">${fmt(r.consumo_kg)}</td>
      <td style="font-family:monospace;font-weight:700;color:var(--verde)">${fmt(r.pt_aprox_kg)}</td>
      <td style="font-weight:700;color:${+rend >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${fmt(rend, 1)}%</td>
      <td><span style="padding:3px 8px;border-radius:6px;font-size:10px;font-weight:700;background:${estadoEjec ? 'var(--verde-bg)' : 'var(--amber-bg)'};color:${estadoEjec ? 'var(--verde)' : 'var(--amber)'};border:1px solid ${estadoEjec ? 'rgba(14,124,58,0.2)' : 'rgba(180,83,9,0.2)'}">${estadoEjec ? '✓ Ejecutado' : '⏳ Pendiente'}</span></td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totMP = weekData.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
    const totPT = weekData.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
    const avgRend = totMP > 0 ? (totPT / totMP * 100) : 0;
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--verde-bg);border-top:2px solid var(--verde)">
      <td colspan="4" style="color:var(--verde)">📅 TOTAL SEMANA (${weekData.length} reg)</td>
      <td style="font-family:monospace;color:var(--naranja)">${fmt(totMP)}</td>
      <td style="font-family:monospace;color:var(--verde)">${fmt(totPT)}</td>
      <td style="color:${avgRend >= 50 ? 'var(--verde)' : 'var(--naranja)'}">${avgRend.toFixed(1)}%</td>
      <td></td>
    </tr>`;
  }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-programa'); if (c) loadData(c); }
export function destroy() { if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; } }
