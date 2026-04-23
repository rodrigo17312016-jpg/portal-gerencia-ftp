/* ════════════════════════════════════════════════════════
   TUNELES IQF - Version Ejecutiva v4
   Con timer en vivo + auto-refresh + filtros
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today, fmtDateLong } from '../../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../../assets/js/utils/chart-helpers.js';

let allData = [];
let activeFilters = { tunel: 'TODOS', estado: 'TODOS' };
let refreshInterval = null;
let timerInterval = null;
let activeProcesos = {}; // { tunel: { inicio: Date, record: {} } }

const META_CICLOS = 12;
const CAPACIDAD_CICLO_KG = 1500;
const CICLO_EST_MIN = 180; // 3 horas estimado por ciclo

const TUNEL_COLORS = {
  '1': { main: '#1e40af', bg: 'rgba(30,64,175,0.08)' },
  '2': { main: '#0e7490', bg: 'rgba(14,116,144,0.08)' },
  '3': { main: '#6d28d9', bg: 'rgba(109,40,217,0.08)' }
};

// ─── Derive real status from record ───
function isEnProceso(r) {
  const est = (r.estado || '').toUpperCase();
  if (est === 'COMPLETADO' || est === 'TERMINADO' || est === 'FINALIZADO') return false;
  // Si tiene hora_fin, ya terminó
  if (r.hora_fin) return false;
  // Si tiene estado explicito de proceso
  if (est.includes('PROCESO') || est === 'CONGELANDO') return true;
  // Si tiene hora_inicio pero no fin, está en proceso
  if (r.hora_inicio && !r.hora_fin) return true;
  return false;
}

function getEstadoLabel(r) {
  if (isEnProceso(r)) return 'CONGELANDO';
  if (r.hora_fin) return 'COMPLETADO';
  return (r.estado || 'PENDIENTE').toUpperCase();
}

export async function init(container) {
  // Fecha inicial
  const dateInput = container.querySelector('#tunFilterDate');
  if (dateInput) {
    dateInput.value = today();
    dateInput.addEventListener('change', () => loadData(container));
  }

  // Filtros
  container.querySelectorAll('.filter-chip[data-tfilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.tfilter;
      container.querySelectorAll(`.filter-chip[data-tfilter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      renderFiltered(container);
    });
  });

  // Refresh manual
  const refreshBtn = container.querySelector('#tunRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => refreshBtn.style.transform = '', 700);
    loadData(container);
  });

  await loadData(container);

  // Auto-refresh cada 2 min
  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (document.getElementById('panel-tuneles')) loadData(container);
    else destroy();
  }, 120000);

  // Timer tick cada segundo para ciclos activos
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => updateTimers(container), 1000);
}

// ─── Load data ───
async function loadData(container) {
  const dateInput = container.querySelector('#tunFilterDate');
  const fecha = dateInput?.value || today();

  try {
    const since = new Date(fecha + 'T00:00:00');
    since.setDate(since.getDate() - 7);
    const sinceISO = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const { data } = await supabase.from('registro_tuneles')
      .select('*')
      .gte('fecha', sinceISO)
      .order('fecha', { ascending: false })
      .order('hora_inicio', { ascending: false });

    allData = data || [];

    const lastEl = container.querySelector('#tunLastUpdate');
    if (lastEl) {
      const now = new Date();
      lastEl.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error tuneles:', err);
    allData = [];
  }

  renderFiltered(container);
}

// ─── Apply filters ───
function renderFiltered(container) {
  const dateInput = container.querySelector('#tunFilterDate');
  const fecha = dateInput?.value || today();
  const dayRecs = allData.filter(r => r.fecha === fecha);

  // Apply filter for table
  let tableRecs = [...dayRecs];
  if (activeFilters.tunel !== 'TODOS') {
    tableRecs = tableRecs.filter(r => String(r.tunel || r.numero_tunel) === activeFilters.tunel);
  }
  if (activeFilters.estado !== 'TODOS') {
    tableRecs = tableRecs.filter(r => {
      if (activeFilters.estado === 'PROCESO') return isEnProceso(r);
      if (activeFilters.estado === 'COMPLETADO') return !isEnProceso(r);
      return true;
    });
  }

  // KPIs y cards siempre usan todos los datos del día
  updateKPIs(container, dayRecs);
  updateTunnelCards(container, dayRecs);
  buildTable(container, tableRecs);
  updateCharts(container, dayRecs);

  // Update table date
  const dateEl = container.querySelector('#tunTableDate');
  if (dateEl && dateInput) {
    const isToday = dateInput.value === today();
    dateEl.textContent = isToday ? 'Hoy' : fmtDateLong(dateInput.value);
  }
}

// ─── KPIs ───
function updateKPIs(container, recs) {
  const ciclos = recs.length;
  setVal(container, 'tunKpiCiclos', ciclos.toString());
  const pctCiclos = Math.min(100, Math.round(ciclos / META_CICLOS * 100));
  const barCiclos = container.querySelector('#tunProgressCiclos');
  if (barCiclos) barCiclos.style.width = pctCiclos + '%';
  setVal(container, 'tunKpiCiclosMeta', `Meta: ${META_CICLOS} ciclos · ${pctCiclos}%`);

  // Temp promedio
  const temps = recs.map(r => r.temp_final ?? r.temperatura).filter(v => v != null && !isNaN(v));
  const tempProm = temps.length > 0 ? temps.reduce((s, v) => s + v, 0) / temps.length : null;
  setVal(container, 'tunKpiTemp', tempProm != null ? tempProm.toFixed(1) + ' °C' : '-- °C');
  setVal(container, 'tunKpiTempSub', tempProm != null && tempProm <= -18 ? '✓ Dentro de rango' : 'Referencia: ≤ -18°C');

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

  // Coches activos
  const enProceso = recs.filter(isEnProceso);
  const cochesActivos = enProceso.reduce((s, r) => s + (r.coches || r.num_coches || 0), 0);
  setVal(container, 'tunKpiCoches', cochesActivos.toString());
  setVal(container, 'tunKpiCochesSub', enProceso.length ? `${enProceso.length} tunel(es) activo(s)` : 'Sin procesos activos');

  // Tiempo ciclo promedio
  const duraciones = recs.map(r => calcDuracion(r.hora_inicio, r.hora_fin)).filter(v => v > 0);
  const tCiclo = duraciones.length > 0 ? Math.round(duraciones.reduce((s, v) => s + v, 0) / duraciones.length) : 0;
  setVal(container, 'tunKpiTCiclo', tCiclo > 0 ? tCiclo + ' min' : '-- min');
}

// ─── Tunnel Cards ───
function updateTunnelCards(container, recs) {
  activeProcesos = {};

  for (let i = 1; i <= 3; i++) {
    const tunelRecs = recs.filter(r => {
      const t = String(r.tunel || r.numero_tunel || '').replace(/\D/g, '');
      return t === String(i);
    });

    const enProceso = tunelRecs.find(isEnProceso);
    // Para el "ultimo" preferir los completados (ordenados por fecha desc)
    const lastCompleted = tunelRecs.find(r => !isEnProceso(r));

    const card = container.querySelector('#tunCard' + i);
    const statusEl = container.querySelector('#tunStatus' + i);
    const tempEl = container.querySelector('#tunTemp' + i);
    const cochesEl = container.querySelector('#tunCoches' + i);
    const frutaEl = container.querySelector('#tunFruta' + i);
    const ultEl = container.querySelector('#tunUlt' + i);
    const timerWrap = container.querySelector('#tunTimerWrap' + i);
    const inicioEl = container.querySelector('#tunInicio' + i);

    if (enProceso) {
      if (statusEl) { statusEl.textContent = '🔥 CONGELANDO'; statusEl.className = 'tun-status-badge tun-status-congelando'; }
      if (card) card.classList.add('tun-card-active');
      if (tempEl) tempEl.textContent = (enProceso.temp_ingreso ?? enProceso.temperatura ?? '--') + '°C';
      if (cochesEl) cochesEl.textContent = (enProceso.coches || enProceso.num_coches || 0).toString();
      if (frutaEl) frutaEl.textContent = enProceso.fruta || '—';
      if (ultEl) ultEl.textContent = 'En curso';
      if (timerWrap) timerWrap.style.display = 'flex';
      if (inicioEl) inicioEl.textContent = enProceso.hora_inicio?.slice(0, 5) || '--:--';

      // Registrar para timer
      const startTime = parseHoraToDate(enProceso.fecha, enProceso.hora_inicio);
      if (startTime) activeProcesos[i] = { inicio: startTime, record: enProceso };
    } else {
      if (statusEl) { statusEl.textContent = '● DISPONIBLE'; statusEl.className = 'tun-status-badge tun-status-disponible'; }
      if (card) card.classList.remove('tun-card-active');
      const last = lastCompleted || tunelRecs[0];
      if (tempEl) tempEl.textContent = last ? (last.temp_final ?? last.temperatura ?? '--') + '°C' : '--°C';
      if (cochesEl) cochesEl.textContent = '0';
      if (frutaEl) frutaEl.textContent = last?.fruta || '—';
      if (ultEl) ultEl.textContent = last ? `${last.hora_inicio?.slice(0, 5) || '--'} - ${last.hora_fin?.slice(0, 5) || '--'}` : 'Sin registros';
      if (timerWrap) timerWrap.style.display = 'none';
    }
  }

  // Trigger immediate timer update
  updateTimers(container);
}

// ─── Live Timer Update ───
function updateTimers(container) {
  Object.entries(activeProcesos).forEach(([i, { inicio }]) => {
    const timerEl = container.querySelector('#tunTimer' + i);
    if (!timerEl) return;
    const now = new Date();
    const diffMs = now - inicio;
    if (diffMs < 0) return;
    const totalSec = Math.floor(diffMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    timerEl.textContent = h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  });
}

// ─── Table ───
function buildTable(container, recs) {
  const tbody = container.querySelector('#tunLiveBody');
  const tfoot = container.querySelector('#tunLiveFoot');
  if (!tbody) return;

  if (!recs.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin ciclos para este filtro</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = recs.map(r => {
    const enProceso = isEnProceso(r);
    const estado = getEstadoLabel(r);
    let badgeStyle, estadoLabel;
    if (enProceso) {
      badgeStyle = 'background:rgba(234,88,12,0.1);color:var(--naranja);border:1px solid rgba(234,88,12,0.25)';
      estadoLabel = '🔥 CONGELANDO';
    } else {
      badgeStyle = 'background:var(--verde-bg);color:var(--verde);border:1px solid rgba(14,124,58,0.2)';
      estadoLabel = '✓ ' + estado;
    }

    const kgVal = r.kg_congelado || r.kg_aprox || r.peso || 0;
    const duracion = calcDuracion(r.hora_inicio, r.hora_fin);
    const tunelNum = String(r.tunel || r.numero_tunel || '').replace(/\D/g, '') || '--';
    const tunelColor = TUNEL_COLORS[tunelNum]?.main || '#64748b';
    const tempFinal = r.temp_final;
    const tempOk = tempFinal != null && tempFinal <= -18;

    return `<tr>
      <td style="font-weight:800;color:${tunelColor}">❄️ Tunel ${tunelNum}</td>
      <td style="font-size:12px;font-weight:600">${r.fruta || '—'}</td>
      <td style="font-family:monospace;font-weight:600;text-align:center">${r.coches || r.num_coches || '—'}</td>
      <td style="font-family:monospace;font-weight:700">${fmt(kgVal)}</td>
      <td style="font-family:monospace;color:var(--muted)">${r.hora_inicio?.slice(0, 5) || '—'}</td>
      <td style="font-family:monospace;color:var(--muted)">${r.hora_fin?.slice(0, 5) || '—'}</td>
      <td style="font-family:monospace;font-weight:600;color:var(--amber)">${duracion > 0 ? duracion + ' min' : '—'}</td>
      <td style="font-family:monospace;color:var(--naranja)">${r.temp_ingreso != null ? r.temp_ingreso + '°' : '—'}</td>
      <td style="font-family:monospace;color:${tempOk ? 'var(--verde)' : 'var(--azul)'};font-weight:700">${tempFinal != null ? tempFinal + '°' : '—'}</td>
      <td><span class="tun-status-badge" style="${badgeStyle};padding:3px 8px;font-size:9.5px">${estadoLabel}</span></td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totalKg = recs.reduce((s, r) => s + (r.kg_congelado || r.kg_aprox || r.peso || 0), 0);
    const totalCoches = recs.reduce((s, r) => s + (r.coches || r.num_coches || 0), 0);
    const completados = recs.filter(r => !isEnProceso(r)).length;
    const duraciones = recs.map(r => calcDuracion(r.hora_inicio, r.hora_fin)).filter(v => v > 0);
    const tProm = duraciones.length ? Math.round(duraciones.reduce((s, v) => s + v, 0) / duraciones.length) : 0;
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--azul-bg);border-top:2px solid var(--azul)">
      <td style="color:var(--azul)">TOTAL (${recs.length} ciclos)</td>
      <td></td>
      <td style="font-family:monospace;text-align:center;color:var(--azul)">${totalCoches}</td>
      <td style="font-family:monospace;color:var(--azul)">${fmt(totalKg)}</td>
      <td colspan="2"></td>
      <td style="color:var(--amber)">${tProm} min prom</td>
      <td colspan="2"></td>
      <td style="color:var(--verde)">${completados}/${recs.length} listos</td>
    </tr>`;
  }
}

// ─── Charts ───
function updateCharts(container, recs) {
  const tuneles = ['1', '2', '3'];

  const ciclosPorTunel = tuneles.map(t =>
    recs.filter(r => String(r.tunel || r.numero_tunel || '').replace(/\D/g, '') === t).length
  );
  const kgPorTunel = tuneles.map(t =>
    recs.filter(r => String(r.tunel || r.numero_tunel || '').replace(/\D/g, '') === t)
        .reduce((s, r) => s + (r.kg_congelado || r.kg_aprox || r.peso || 0), 0)
  );

  createChart('chartTunCiclos', {
    type: 'bar',
    data: {
      labels: ['Tunel 1', 'Tunel 2', 'Tunel 3'],
      datasets: [
        { label: 'Ciclos', data: ciclosPorTunel, backgroundColor: ['rgba(30,64,175,0.6)', 'rgba(14,116,144,0.6)', 'rgba(109,40,217,0.6)'], borderColor: ['#1e40af', '#0e7490', '#6d28d9'], borderWidth: 2, borderRadius: 6, yAxisID: 'y' },
        { label: 'Kg Congelados', data: kgPorTunel, type: 'line', borderColor: '#0e7c3a', backgroundColor: 'rgba(14,124,58,0.1)', fill: false, tension: 0.3, pointRadius: 6, pointBackgroundColor: '#0e7c3a', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } },
      scales: {
        y:  { position: 'left',  title: { display: true, text: 'Ciclos', color: '#64748b' }, ticks: { color: '#64748b', stepSize: 1 }, grid: { color: 'rgba(15,23,42,0.04)' } },
        y1: { position: 'right', title: { display: true, text: 'Kg',     color: '#64748b' }, ticks: { color: '#64748b' }, grid: { display: false } },
        x:  { ticks: { color: '#64748b' }, grid: { color: 'rgba(15,23,42,0.04)' } }
      }
    }
  });

  // Chart 2: Temperatura por Ciclo
  const completados = recs.filter(r => r.hora_inicio).sort((a, b) => (a.hora_inicio || '').localeCompare(b.hora_inicio || ''));
  const labels = completados.map((r, i) => r.hora_inicio?.slice(0, 5) || `C${i + 1}`);
  const tempIngreso = completados.map(r => r.temp_ingreso ?? null);
  const tempFinal = completados.map(r => r.temp_final ?? r.temperatura ?? null);

  createChart('chartTunTemp', {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: '🔥 T. Ingreso (°C)', data: tempIngreso, borderColor: '#ea580c', backgroundColor: 'rgba(234,88,12,0.1)', fill: false, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#ea580c', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 },
        { label: '❄️ T. Final (°C)',   data: tempFinal,   borderColor: '#1e40af', backgroundColor: 'rgba(30,64,175,0.15)', fill: true, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#1e40af', pointBorderColor: '#fff', pointBorderWidth: 2, borderWidth: 2.5 },
        { label: 'Limite -18°C',       data: labels.map(() => -18), borderColor: '#be123c', borderDash: [6, 4], fill: false, pointRadius: 0, borderWidth: 2 }
      ]
    },
    options: {
      ...getDefaultOptions('line'),
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } }
    }
  });
}

// ─── Helpers ───
function calcDuracion(inicio, fin) {
  if (!inicio || !fin) return 0;
  const [h1, m1] = inicio.split(':').map(Number);
  const [h2, m2] = fin.split(':').map(Number);
  let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
  if (diff < 0) diff += 1440;
  return diff;
}

function parseHoraToDate(fecha, hora) {
  if (!fecha || !hora) return null;
  try {
    // fecha YYYY-MM-DD, hora HH:MM:SS
    return new Date(`${fecha}T${hora.length === 5 ? hora + ':00' : hora}`);
  } catch { return null; }
}

function setVal(c, id, v) {
  const el = c.querySelector('#' + id);
  if (el) el.textContent = v;
}

export function refresh() {
  const c = document.getElementById('panel-tuneles');
  if (c) loadData(c);
}

export function destroy() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  if (timerInterval)   { clearInterval(timerInterval);   timerInterval = null; }
  activeProcesos = {};
}

// Lifecycle: pausar timers cuando el panel se oculta (ahorra CPU)
export function onHide() {
  if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  if (timerInterval)   { clearInterval(timerInterval);   timerInterval = null; }
}

// Reanudar al volver a mostrar
export function onShow() {
  const container = document.getElementById('panel-tuneles');
  if (!container) return;
  if (!refreshInterval) {
    refreshInterval = setInterval(() => {
      if (document.getElementById('panel-tuneles')) loadData(container);
    }, 120000);
  }
  if (!timerInterval) {
    timerInterval = setInterval(() => updateTimers(container), 1000);
  }
  loadData(container); // refresh inmediato
}
