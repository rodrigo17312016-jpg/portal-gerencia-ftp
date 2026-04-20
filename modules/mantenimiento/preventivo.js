/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - PREVENTIVO
   Plan anual de rutinas preventivas
   ════════════════════════════════════════════════════════ */

import { fmt, fmtPct, fmtDate } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { getMantData, saveMantData } from './data-mock.js';

let charts = [];
let refreshTimer = null;
let filterFreq = 'all';
let filterEstado = 'all';
let currentRutina = null;

const FREQ_COLORS = {
  diaria: 'cyan',
  semanal: 'azul',
  mensual: 'verde',
  trimestral: 'amber',
  semestral: 'naranja',
  anual: 'purple'
};

const FREQ_LABELS = {
  diaria: 'Diaria',
  semanal: 'Semanal',
  mensual: 'Mensual',
  trimestral: 'Trimestral',
  semestral: 'Semestral',
  anual: 'Anual'
};

const DIAS_SIGUIENTE = {
  diaria: 1,
  semanal: 7,
  mensual: 30,
  trimestral: 90,
  semestral: 180,
  anual: 365
};

export async function init(container) {
  // Filtros frecuencia
  container.querySelectorAll('[data-pm-freq]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-pm-freq]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterFreq = chip.dataset.pmFreq;
      renderTabla(container);
    });
  });

  // Filtros estado
  container.querySelectorAll('[data-pm-estado]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-pm-estado]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterEstado = chip.dataset.pmEstado;
      renderTabla(container);
    });
  });

  // Botones modal
  const modal = container.querySelector('#pm-modal-backdrop');
  container.querySelector('#pm-modal-close')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#pm-modal-cancel')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#pm-modal-save')?.addEventListener('click', () => saveRutina(container));
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) closeModal(container);
  });

  // Boton nueva rutina
  container.querySelector('#btn-nueva-rutina')?.addEventListener('click', () => {
    alert('Funcionalidad de creacion de rutinas en construccion. Por ahora cada equipo tiene rutinas generadas automaticamente.');
  });

  await loadAll(container);

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const c = document.getElementById('panel-preventivo') || document.querySelector('.active-panel');
    if (c) loadAll(c);
  }, 60000);
}

export function refresh() {
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];
  const c = document.getElementById('panel-preventivo') || document.querySelector('.active-panel');
  if (c) loadAll(c);
}

async function loadAll(container) {
  const data = getMantData();
  const rutinas = data.rutinas || [];

  // KPIs
  const total = rutinas.length;
  const vencidas = rutinas.filter(r => r.estado === 'vencida').length;
  const proximas = rutinas.filter(r => r.estado === 'proxima').length;
  const cumpl = total > 0 ? ((total - vencidas) / total * 100) : 100;

  setText(container, 'pm-kpi-total', fmt(total));
  setText(container, 'pm-kpi-vencidas', fmt(vencidas));
  setText(container, 'pm-kpi-proximas', fmt(proximas));
  setText(container, 'pm-kpi-cumpl', fmtPct(cumpl));

  // Destruir charts
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];

  renderChartFrecuencia(container, rutinas);
  renderChartEstado(container, rutinas);
  renderTabla(container);
}

function setText(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

// ════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════
function renderChartFrecuencia(container, rutinas) {
  const canvas = container.querySelector('#pm-chart-frecuencia');
  if (!canvas) return;
  const col = getColors();

  const orden = ['diaria', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual'];
  const conteo = {};
  orden.forEach(f => { conteo[f] = 0; });
  rutinas.forEach(r => { if (conteo[r.frecuencia] !== undefined) conteo[r.frecuencia]++; });

  const labels = orden.map(f => FREQ_LABELS[f]);
  const values = orden.map(f => conteo[f]);
  const palette = orden.map(f => {
    const c = col[FREQ_COLORS[f]] || col.azul;
    return c.border;
  });

  const ch = createChart('pm-chart-frecuencia', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Rutinas',
        data: values,
        backgroundColor: palette.map(c => c + '30'),
        borderColor: palette,
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: (ctx) => fmt(ctx.parsed.y) + ' rutinas' }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartEstado(container, rutinas) {
  const canvas = container.querySelector('#pm-chart-estado');
  if (!canvas) return;
  const col = getColors();

  const e = { programada: 0, proxima: 0, vencida: 0 };
  rutinas.forEach(r => { if (e[r.estado] !== undefined) e[r.estado]++; });

  const ch = createChart('pm-chart-estado', {
    type: 'doughnut',
    data: {
      labels: ['Programada', 'Proxima', 'Vencida'],
      datasets: [{
        data: [e.programada, e.proxima, e.vencida],
        backgroundColor: [col.verde.border, col.amber.border, col.rose.border],
        borderWidth: 3,
        borderColor: 'var(--surface)'
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: true, position: 'right', labels: { color: getTextColor(), font: { size: 12 }, padding: 10 } },
        tooltip: getDefaultOptions().plugins.tooltip
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// TABLA
// ════════════════════════════════════════════════════════
function renderTabla(container) {
  const tbody = container.querySelector('#pm-tbody');
  const subtitle = container.querySelector('#pm-count-subtitle');
  if (!tbody) return;

  const data = getMantData();
  let rutinas = (data.rutinas || []).slice();

  if (filterFreq !== 'all') rutinas = rutinas.filter(r => r.frecuencia === filterFreq);
  if (filterEstado !== 'all') rutinas = rutinas.filter(r => r.estado === filterEstado);

  // Orden: vencidas primero, luego proximas, luego programadas
  const ord = { vencida: 0, proxima: 1, programada: 2 };
  rutinas.sort((a, b) => {
    const dif = (ord[a.estado] ?? 9) - (ord[b.estado] ?? 9);
    if (dif !== 0) return dif;
    return a.diasRestantes - b.diasRestantes;
  });

  if (subtitle) subtitle.textContent = `Mostrando ${rutinas.length} rutinas`;

  if (!rutinas.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px">Sin rutinas en este filtro</td></tr>';
    return;
  }

  tbody.innerHTML = rutinas.map(r => {
    const freqColor = FREQ_COLORS[r.frecuencia] || 'azul';
    const freqBadge = `<span class="badge badge-${freqColor}">${FREQ_LABELS[r.frecuencia] || r.frecuencia}</span>`;

    const estadoBadge = {
      'vencida': '<span class="badge badge-rose">Vencida</span>',
      'proxima': '<span class="badge badge-amber">Proxima</span>',
      'programada': '<span class="badge badge-verde">Programada</span>'
    }[r.estado] || r.estado;

    return `<tr>
      <td><strong>${r.id}</strong></td>
      <td>${r.equipo}<br><span style="font-size:11px;color:var(--muted)">${r.equipoNombre}</span></td>
      <td>${r.area}</td>
      <td>${freqBadge}</td>
      <td style="font-size:12px">${r.descripcion}</td>
      <td style="text-align:center">${r.duracion}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.ultima)}</td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(r.proxima)}</td>
      <td>${estadoBadge}</td>
      <td style="text-align:center">
        <button class="pm-btn-ejecutar" data-exec="${r.id}">▶ Ejecutar</button>
      </td>
    </tr>`;
  }).join('');

  // Wire botones
  tbody.querySelectorAll('[data-exec]').forEach(btn => {
    btn.addEventListener('click', () => openModal(container, btn.dataset.exec));
  });
}

// ════════════════════════════════════════════════════════
// MODAL EJECUTAR
// ════════════════════════════════════════════════════════
function openModal(container, rutinaId) {
  const data = getMantData();
  const r = (data.rutinas || []).find(x => x.id === rutinaId);
  if (!r) return;
  currentRutina = r;

  setText(container, 'pm-modal-id', r.id);
  setText(container, 'pm-modal-freq', FREQ_LABELS[r.frecuencia] || r.frecuencia);
  setText(container, 'pm-modal-dur', r.duracion + ' h');
  setText(container, 'pm-modal-sub', `${r.equipo} - ${r.equipoNombre}`);

  // Checklist dinamico segun frecuencia
  const checklist = getChecklist(r.frecuencia);
  const list = container.querySelector('#pm-modal-checklist');
  if (list) {
    list.innerHTML = checklist.map((t, i) => `
      <div class="pm-check-item" data-chk="${i}">
        <input type="checkbox" id="chk-${i}">
        <label for="chk-${i}">${t}</label>
      </div>
    `).join('');

    list.querySelectorAll('.pm-check-item').forEach(item => {
      const chk = item.querySelector('input');
      chk.addEventListener('change', () => {
        item.classList.toggle('checked', chk.checked);
      });
    });
  }

  const obs = container.querySelector('#pm-modal-obs');
  if (obs) obs.value = '';

  container.querySelector('#pm-modal-backdrop')?.classList.add('open');
}

function closeModal(container) {
  container.querySelector('#pm-modal-backdrop')?.classList.remove('open');
  currentRutina = null;
}

function saveRutina(container) {
  if (!currentRutina) return;

  const data = getMantData();
  const idx = (data.rutinas || []).findIndex(r => r.id === currentRutina.id);
  if (idx === -1) return;

  const diasSig = DIAS_SIGUIENTE[currentRutina.frecuencia] || 30;
  const hoy = new Date();
  const prox = new Date();
  prox.setDate(hoy.getDate() + diasSig);

  data.rutinas[idx].ultima = hoy.toISOString().substring(0, 10);
  data.rutinas[idx].proxima = prox.toISOString().substring(0, 10);
  data.rutinas[idx].diasRestantes = diasSig;
  data.rutinas[idx].estado = 'programada';

  saveMantData(data);
  closeModal(container);
  loadAll(container);
}

function getChecklist(frecuencia) {
  const pool = {
    diaria: [
      'Inspeccion visual de fugas',
      'Verificacion de niveles de lubricante',
      'Revision de indicadores en panel',
      'Limpieza de sensores',
      'Registro de parametros operativos'
    ],
    semanal: [
      'Limpieza profunda del equipo',
      'Revision de puntos de holgura',
      'Ajuste de tensiones de correas',
      'Inspeccion visual de rodamientos',
      'Verificacion de fijaciones',
      'Lubricacion de puntos semanales'
    ],
    mensual: [
      'Lubricacion general de puntos programados',
      'Inspeccion termografica basica',
      'Verificacion de sensores y transmisores',
      'Limpieza de filtros de aire',
      'Revision de conexiones electricas',
      'Prueba de paradas de emergencia',
      'Registro en bitacora de mantenimiento'
    ],
    trimestral: [
      'Cambio de filtros de aceite',
      'Calibracion de instrumentacion',
      'Analisis de vibraciones en motores',
      'Inspeccion de alineacion',
      'Revision de aislamiento electrico',
      'Limpieza intercambiadores',
      'Test de valvulas de seguridad'
    ],
    semestral: [
      'Cambio de aceite del reductor',
      'Inspeccion interna (apertura controlada)',
      'Reaprieto de conexiones electricas',
      'Megado de motores',
      'Balanceo dinamico',
      'Revision de sistema hidraulico',
      'Certificacion instrumentos criticos'
    ],
    anual: [
      'Overhaul completo del equipo',
      'Cambio de rodamientos',
      'Inspeccion no destructiva (NDT)',
      'Mantenimiento mayor programado',
      'Revision estructural',
      'Renovacion de componentes criticos',
      'Actualizacion de documentacion tecnica',
      'Certificacion operativa anual'
    ]
  };
  return pool[frecuencia] || pool.mensual;
}
