/* ================================================================
   TUNELES IQF - Panel Completo
   Monitoreo de ciclos de congelamiento IQF · 3 tuneles estaticos
   ================================================================ */

import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../../assets/js/utils/chart-helpers.js';

let allData = [];
const META_CICLOS = 12; // meta diaria de ciclos
const CAPACIDAD_CICLO_KG = 1500; // kg estimados por ciclo

export async function init(container) {
  await loadData(container);
}

async function loadData(container) {
  const hoy = today();
  try {
    const since = new Date();
    since.setDate(since.getDate() - 7);
    const { data } = await supabase
      .from('registro_tuneles')
      .select('*')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });
    allData = data || [];
  } catch { allData = []; }

  const todayRecs = allData.filter(r => r.fecha === hoy);
  updateKPIs(container, todayRecs);
  updateTunnelCards(container, todayRecs);
  buildTable(container, todayRecs);
  updateCharts(container);
}

/* ── KPIs ──────────────────────────────────────────────── */
function updateKPIs(container, recs) {
  // Ciclos hoy
  const ciclos = recs.length;
  setVal(container, 'tunKpiCiclos', ciclos.toString());
  const pctCiclos = Math.min(100, Math.round(ciclos / META_CICLOS * 100));
  const barCiclos = container.querySelector('#tunProgressCiclos');
  if (barCiclos) barCiclos.style.width = pctCiclos + '%';
  setVal(container, 'tunKpiCiclosMeta', `Meta: ${META_CICLOS} ciclos · ${pctCiclos}%`);

  // Temp promedio
  const temps = recs.map(r => r.temp_final ?? r.temperatura).filter(v => v != null && !isNaN(v));
  const tempProm = temps.length > 0 ? temps.reduce((s, v) => s + v, 0) / temps.length : 0;
  setVal(container, 'tunKpiTemp', tempProm !== 0 ? tempProm.toFixed(1) + '\u00B0C' : '--\u00B0C');

  // Kg congelados
  const kgTotal = recs.reduce((s, r) => s + (r.kg_congelado || r.kg_aprox || r.peso || 0), 0);
  setVal(container, 'tunKpiKg', fmt(kgTotal) + ' kg');
  setVal(container, 'tunKpiKgTn', (kgTotal / 1000).toFixed(1) + ' TN');

  // Eficiencia
  const capacidadMax = ciclos * CAPACIDAD_CICLO_KG || 1;
  const eficiencia = kgTotal > 0 ? (kgTotal / capacidadMax * 100) : 0;
  setVal(container, 'tunKpiEficiencia', fmtPct(eficiencia));
  const barEfi = container.querySelector('#tunProgressEfi');
  if (barEfi) barEfi.style.width = Math.min(100, eficiencia) + '%';

  // Coches en proceso
  const enProceso = recs.filter(r => {
    const est = (r.estado || '').toUpperCase();
    return est === 'PROCESO' || est === 'EN PROCESO' || est === 'CONGELANDO';
  });
  const cochesActivos = enProceso.reduce((s, r) => s + (r.coches || r.num_coches || 0), 0);
  setVal(container, 'tunKpiCoches', cochesActivos.toString());

  // Tiempo ciclo promedio
  const duraciones = recs.map(r => calcDuracion(r.hora_inicio, r.hora_fin)).filter(v => v > 0);
  const tCiclo = duraciones.length > 0 ? Math.round(duraciones.reduce((s, v) => s + v, 0) / duraciones.length) : 0;
  setVal(container, 'tunKpiTCiclo', tCiclo > 0 ? tCiclo + ' min' : '-- min');
}

function calcDuracion(inicio, fin) {
  if (!inicio || !fin) return 0;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 1440; // cruza medianoche
  return diff;
}

/* ── Tarjetas de Estado por Tunel ────────────────────── */
function updateTunnelCards(container, recs) {
  for (let i = 1; i <= 3; i++) {
    const tunelRecs = recs.filter(r => {
      const t = (r.tunel || r.numero_tunel || '').toString();
      return t === String(i) || t === 'Tunel ' + i || t === 'T' + i;
    });

    // Buscar si hay alguno en proceso
    const enProceso = tunelRecs.find(r => {
      const est = (r.estado || '').toUpperCase();
      return est === 'PROCESO' || est === 'EN PROCESO' || est === 'CONGELANDO';
    });

    const statusEl = container.querySelector('#tunStatus' + i);
    const tempEl = container.querySelector('#tunTemp' + i);
    const cochesEl = container.querySelector('#tunCoches' + i);
    const frutaEl = container.querySelector('#tunFruta' + i);

    if (enProceso) {
      if (statusEl) { statusEl.textContent = 'CONGELANDO'; statusEl.className = 'badge badge-naranja'; }
      if (tempEl) tempEl.textContent = (enProceso.temp_ingreso ?? enProceso.temperatura ?? '--') + '\u00B0C';
      if (cochesEl) cochesEl.textContent = (enProceso.coches || enProceso.num_coches || 0).toString();
      if (frutaEl) frutaEl.textContent = enProceso.fruta || '--';
    } else {
      if (statusEl) { statusEl.textContent = 'DISPONIBLE'; statusEl.className = 'badge badge-verde'; }
      const last = tunelRecs[0];
      if (tempEl) tempEl.textContent = last ? (last.temp_final ?? last.temperatura ?? '--') + '\u00B0C' : '--\u00B0C';
      if (cochesEl) cochesEl.textContent = '0';
      if (frutaEl) frutaEl.textContent = last?.fruta || '--';
    }
  }
}

/* ── Tabla ─────────────────────────────────────────────── */
function buildTable(container, recs) {
  const tbody = container.querySelector('#tunLiveBody');
  const tfoot = container.querySelector('#tunLiveFoot');
  if (!tbody) return;

  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:var(--muted)">Sin ciclos registrados hoy</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = recs.map(r => {
    const estado = (r.estado || 'PROCESO').toUpperCase();
    const badgeClass = estado === 'COMPLETADO' ? 'verde' : estado === 'CONGELANDO' || estado === 'EN PROCESO' || estado === 'PROCESO' ? 'naranja' : 'gris';
    const kgVal = r.kg_congelado || r.kg_aprox || r.peso || 0;
    const duracion = calcDuracion(r.hora_inicio, r.hora_fin);
    return `<tr>
      <td style="font-weight:700;color:var(--azul)">Tunel ${r.tunel || r.numero_tunel || '--'}</td>
      <td style="font-size:12px">${r.fruta || '--'}</td>
      <td style="font-family:monospace;font-weight:600;text-align:center">${r.coches || r.num_coches || '--'}</td>
      <td style="font-family:monospace;font-weight:700">${fmt(kgVal)}</td>
      <td style="font-family:monospace">${r.hora_inicio?.slice(0, 5) || '--'}</td>
      <td style="font-family:monospace">${r.hora_fin?.slice(0, 5) || '--'}</td>
      <td style="font-family:monospace;color:var(--cyan)">${r.temp_ingreso != null ? r.temp_ingreso + '\u00B0' : '--'}</td>
      <td style="font-family:monospace;color:var(--azul);font-weight:700">${r.temp_final != null ? r.temp_final + '\u00B0' : '--'}</td>
      <td><span class="badge badge-${badgeClass}">${estado}</span></td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totalKg = recs.reduce((s, r) => s + (r.kg_congelado || r.kg_aprox || r.peso || 0), 0);
    const totalCoches = recs.reduce((s, r) => s + (r.coches || r.num_coches || 0), 0);
    const completados = recs.filter(r => (r.estado || '').toUpperCase() === 'COMPLETADO').length;
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--azul-bg);border-top:2px solid var(--azul)">
      <td style="color:var(--azul)">TOTAL (${recs.length} ciclos)</td>
      <td></td>
      <td style="font-family:monospace;text-align:center">${totalCoches}</td>
      <td style="font-family:monospace;color:var(--azul)">${fmt(totalKg)}</td>
      <td colspan="4"></td>
      <td>${completados}/${recs.length} listos</td>
    </tr>`;
  }
}

/* ── Charts ────────────────────────────────────────────── */
function updateCharts(container) {
  const hoy = today();
  const todayRecs = allData.filter(r => r.fecha === hoy);
  const colors = getColors();

  // Chart 1: Ciclos por Tunel (bar)
  const tuneles = ['1', '2', '3'];
  const ciclosPorTunel = tuneles.map(t => {
    return todayRecs.filter(r => {
      const tv = (r.tunel || r.numero_tunel || '').toString();
      return tv === t || tv === 'Tunel ' + t || tv === 'T' + t;
    }).length;
  });
  const kgPorTunel = tuneles.map(t => {
    return todayRecs.filter(r => {
      const tv = (r.tunel || r.numero_tunel || '').toString();
      return tv === t || tv === 'Tunel ' + t || tv === 'T' + t;
    }).reduce((s, r) => s + (r.kg_congelado || r.kg_aprox || r.peso || 0), 0);
  });

  createChart('chartTunCiclos', {
    type: 'bar',
    data: {
      labels: ['Tunel 1', 'Tunel 2', 'Tunel 3'],
      datasets: [
        { label: 'Ciclos', data: ciclosPorTunel, backgroundColor: [colors.azul.bg, colors.cyan.bg, colors.purple.bg], borderColor: [colors.azul.border, colors.cyan.border, colors.purple.border], borderWidth: 2, borderRadius: 6, yAxisID: 'y' },
        { label: 'Kg Congelados', data: kgPorTunel, type: 'line', borderColor: colors.verde.border, backgroundColor: colors.verde.bg, fill: false, tension: 0.3, pointRadius: 6, pointBackgroundColor: colors.verde.border, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } },
      scales: {
        y: { position: 'left', title: { display: true, text: 'Ciclos', color: '#64748b' }, ticks: { color: '#64748b', stepSize: 1 }, grid: { color: 'rgba(0,0,0,0.05)' } },
        y1: { position: 'right', title: { display: true, text: 'Kg', color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x: { ticks: { color: '#64748b' }, grid: { color: 'rgba(0,0,0,0.05)' } }
      }
    }
  });

  // Chart 2: Temperatura por Ciclo (line)
  const completados = todayRecs.filter(r => r.hora_inicio).sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
  const labels = completados.map((r, i) => r.hora_inicio?.slice(0, 5) || `C${i + 1}`);
  const tempIngreso = completados.map(r => r.temp_ingreso ?? null);
  const tempFinal = completados.map(r => r.temp_final ?? r.temperatura ?? null);

  createChart('chartTunTemp', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Temp Ingreso (\u00B0C)', data: tempIngreso, borderColor: colors.naranja.border, backgroundColor: colors.naranja.bg, fill: false, tension: 0.3, pointRadius: 5, pointBackgroundColor: colors.naranja.border },
        { label: 'Temp Final (\u00B0C)', data: tempFinal, borderColor: colors.azul.border, backgroundColor: colors.azul.bg, fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: colors.azul.border },
        { label: 'Limite -18\u00B0C', data: labels.map(() => -18), borderColor: '#dc2626', borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: { ...getDefaultOptions('line'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } }
  });
}

/* ── Helpers ────────────────────────────────────────────── */
function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-tuneles'); if (c) loadData(c); }
