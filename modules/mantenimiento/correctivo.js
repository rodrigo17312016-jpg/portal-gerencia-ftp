/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - CORRECTIVO
   Reparaciones tras falla, analisis causa raiz
   ════════════════════════════════════════════════════════ */

import { fmt, fmtSoles, fmtDate } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml, escapeAttr } from '../../assets/js/utils/dom-helpers.js';
import { createExportButton } from '../../assets/js/utils/export-helpers.js';
import { getMantData, saveMantData } from './data-mock.js';
import { addDemoBanner } from '../../assets/js/utils/demo-banner.js';

let charts = [];
let refreshTimer = null;
let filterEstado = 'all';
let filterPrioridad = 'all';

// Mapa de palabras clave -> 6M
const CAUSA_KEYWORDS = {
  mano: ['operador', 'tecnico', 'manual', 'error'],
  metodo: ['atasco', 'procedimiento', 'operacion', 'parada', 'sobrecarga'],
  maquinaria: ['rodamiento', 'vibracion', 'ruido', 'mecanico', 'eje', 'transmision', 'motor'],
  material: ['refrigerante', 'aceite', 'correa', 'cadena', 'fuga'],
  medio: ['sobrecalent', 'temperatura', 'humedad', 'corrosion', 'polvo'],
  medicion: ['sensor', 'lectura', 'erratica', 'calibracion', 'instrumento']
};

const CAUSA_LABELS = {
  mano: 'Mano de Obra',
  metodo: 'Metodo',
  maquinaria: 'Maquinaria',
  material: 'Material',
  medio: 'Medio Ambiente',
  medicion: 'Medicion'
};

const CAUSA_COLORS = {
  mano: 'azul',
  metodo: 'verde',
  maquinaria: 'naranja',
  material: 'purple',
  medio: 'cyan',
  medicion: 'amber'
};

export async function init(container) {
  addDemoBanner(container);
  // Filtros estado
  container.querySelectorAll('[data-cm-estado]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-cm-estado]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterEstado = chip.dataset.cmEstado;
      renderTabla(container);
    });
  });

  // Filtros prioridad
  container.querySelectorAll('[data-cm-prioridad]').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('[data-cm-prioridad]').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      filterPrioridad = chip.dataset.cmPrioridad;
      renderTabla(container);
    });
  });

  // Modal
  const modal = container.querySelector('#cm-modal-backdrop');
  container.querySelector('#btn-reportar-falla')?.addEventListener('click', () => openModal(container));
  container.querySelector('#cm-modal-close')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#cm-modal-cancel')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#cm-modal-save')?.addEventListener('click', () => saveFalla(container));
  modal?.addEventListener('click', (e) => { if (e.target === modal) closeModal(container); });

  injectExportButton(container);

  await loadAll(container);

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const c = document.getElementById('panel-correctivo') || document.querySelector('.active-panel');
    if (c) loadAll(c);
  }, 60000);
}

function injectExportButton(container) {
  if (container.querySelector('.ftp-export-btn')) return;
  const reportarBtn = container.querySelector('#btn-reportar-falla');
  const target = reportarBtn?.parentElement
    || container.querySelector('.cm-header')
    || container.querySelector('.card-header');
  if (!target) return;

  const btn = createExportButton({
    getData: () => {
      const data = getMantData();
      let ots = (data.ordenes || []).filter(o => o.tipo === 'correctivo');
      if (filterEstado !== 'all') ots = ots.filter(o => o.estado === filterEstado);
      if (filterPrioridad !== 'all') ots = ots.filter(o => o.prioridad === filterPrioridad);
      ots.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      return ots.map(o => ({
        codigo: o.codigo,
        fecha: o.fecha,
        equipo_codigo: o.equipoCodigo,
        equipo: o.equipo,
        area: o.area,
        descripcion: o.descripcion,
        tecnico: o.tecnico,
        prioridad: o.prioridad,
        estado: o.estado,
        causa_raiz: o.causaRaiz || clasificarCausa(o.descripcion),
        horas_estimadas: o.horasEstimadas,
        horas_reales: o.horasReales != null ? Number(o.horasReales).toFixed(2) : '',
        costo_estimado: o.costoEstimado,
        costo_real: o.costoReal != null ? Number(o.costoReal).toFixed(2) : ''
      }));
    },
    filename: 'correctivo',
    sheetName: 'Correctivo',
    columns: [
      { key: 'codigo', label: 'OT' },
      { key: 'fecha', label: 'Fecha' },
      { key: 'equipo_codigo', label: 'Equipo Cod.' },
      { key: 'equipo', label: 'Equipo' },
      { key: 'area', label: 'Area' },
      { key: 'descripcion', label: 'Descripcion' },
      { key: 'tecnico', label: 'Tecnico' },
      { key: 'prioridad', label: 'Prioridad' },
      { key: 'estado', label: 'Estado' },
      { key: 'causa_raiz', label: 'Causa Raiz' },
      { key: 'horas_estimadas', label: 'Horas Est.' },
      { key: 'horas_reales', label: 'Horas Real' },
      { key: 'costo_estimado', label: 'Costo Est.' },
      { key: 'costo_real', label: 'Costo Real' }
    ]
  });

  if (reportarBtn) reportarBtn.parentNode.insertBefore(btn, reportarBtn);
  else target.appendChild(btn);
}

export function refresh() {
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];
  const c = document.getElementById('panel-correctivo') || document.querySelector('.active-panel');
  if (c) loadAll(c);
}

async function loadAll(container) {
  const data = getMantData();
  const correctivas = (data.ordenes || []).filter(o => o.tipo === 'correctivo');

  // KPIs
  const total = correctivas.length;
  const completadas = correctivas.filter(o => o.estado === 'completada');
  const mttr = completadas.length > 0
    ? completadas.reduce((s, o) => s + (o.horasReales || o.horasEstimadas || 0), 0) / completadas.length
    : 0;

  // Costo del mes (ultimas 30 dias)
  const hoy = new Date();
  const hace30 = new Date(); hace30.setDate(hoy.getDate() - 30);
  const costoMes = correctivas
    .filter(o => new Date(o.fecha) >= hace30)
    .reduce((s, o) => s + (o.costoReal || o.costoEstimado || 0), 0);

  // Equipos recurrentes (>2 fallas)
  const porEquipo = {};
  correctivas.forEach(o => {
    porEquipo[o.equipoCodigo] = (porEquipo[o.equipoCodigo] || 0) + 1;
  });
  const recurrentes = Object.values(porEquipo).filter(v => v > 2).length;

  setText(container, 'cm-kpi-total', fmt(total));
  setText(container, 'cm-kpi-mttr', mttr.toFixed(1) + ' h');
  setText(container, 'cm-kpi-costo', fmtSoles(costoMes, 0));
  setText(container, 'cm-kpi-recurrentes', fmt(recurrentes));

  // Charts
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];

  renderChartTop(container, correctivas, porEquipo, data);
  renderChartMttr(container, data);

  // Causa raiz 6M
  renderCausaRaiz(container, correctivas);

  // Tabla
  renderTabla(container);
}

function setText(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

// ════════════════════════════════════════════════════════
// CLASIFICACION 6M
// ════════════════════════════════════════════════════════
function clasificarCausa(descripcion) {
  if (!descripcion) return 'maquinaria';
  const d = descripcion.toLowerCase();
  for (const [causa, keywords] of Object.entries(CAUSA_KEYWORDS)) {
    for (const kw of keywords) {
      if (d.includes(kw)) return causa;
    }
  }
  return 'maquinaria';
}

// ════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════
function renderChartTop(container, correctivas, porEquipo, data) {
  const canvas = container.querySelector('#cm-chart-top');
  if (!canvas) return;
  const col = getColors();

  // Ordenar y tomar top 10
  const arr = Object.entries(porEquipo).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const equipos = data.equipos || [];
  const labels = arr.map(([cod]) => {
    const e = equipos.find(x => x.codigo === cod);
    return (e?.nombre?.slice(0, 22)) || cod;
  });
  const values = arr.map(([, v]) => v);

  if (!arr.length) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = getTextColor();
    ctx.font = '14px Plus Jakarta Sans';
    ctx.textAlign = 'center';
    ctx.fillText('Sin datos correctivos', canvas.width / 2, canvas.height / 2);
    return;
  }

  const ch = createChart('cm-chart-top', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Fallas',
        data: values,
        backgroundColor: col.rose.bg,
        borderColor: col.rose.border,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: (ctx) => fmt(ctx.parsed.x) + ' fallas' }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartMttr(container, data) {
  const canvas = container.querySelector('#cm-chart-mttr');
  if (!canvas) return;
  const col = getColors();
  const t = data.tendencia || { meses: [], mttr: [] };

  const ch = createChart('cm-chart-mttr', {
    type: 'line',
    data: {
      labels: t.meses,
      datasets: [{
        label: 'MTTR (h)',
        data: t.mttr,
        borderColor: col.rose.border,
        backgroundColor: col.rose.bg,
        borderWidth: 3, tension: 0.4, fill: true,
        pointRadius: 5, pointHoverRadius: 8,
        pointBackgroundColor: col.rose.border
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: (ctx) => ctx.parsed.y.toFixed(1) + ' h' }
        }
      },
      scales: {
        x: { ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' }, beginAtZero: true }
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// CAUSA RAIZ 6M
// ════════════════════════════════════════════════════════
function renderCausaRaiz(container, correctivas) {
  const conteo = { mano: 0, metodo: 0, maquinaria: 0, material: 0, medio: 0, medicion: 0 };

  correctivas.forEach(o => {
    const c = o.causaRaiz || clasificarCausa(o.descripcion);
    if (conteo[c] !== undefined) conteo[c]++;
  });

  Object.entries(conteo).forEach(([k, v]) => {
    const el = container.querySelector(`[data-cr="${k}"]`);
    if (el) el.textContent = v;
  });
}

// ════════════════════════════════════════════════════════
// TABLA
// ════════════════════════════════════════════════════════
function renderTabla(container) {
  const tbody = container.querySelector('#cm-tbody');
  const subtitle = container.querySelector('#cm-count-subtitle');
  if (!tbody) return;

  const data = getMantData();
  let ots = (data.ordenes || []).filter(o => o.tipo === 'correctivo');

  if (filterEstado !== 'all') ots = ots.filter(o => o.estado === filterEstado);
  if (filterPrioridad !== 'all') ots = ots.filter(o => o.prioridad === filterPrioridad);

  ots.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  if (subtitle) subtitle.textContent = `Mostrando ${ots.length} OT correctivas`;

  if (!ots.length) {
    tbody.innerHTML = '<tr><td colspan="10" style="text-align:center;color:var(--muted);padding:24px">Sin OT correctivas en este filtro</td></tr>';
    return;
  }

  tbody.innerHTML = ots.map(o => {
    const prBadge = {
      alta: '<span class="badge badge-rose">Alta</span>',
      media: '<span class="badge badge-amber">Media</span>',
      baja: '<span class="badge badge-verde">Baja</span>'
    }[o.prioridad] || '-';

    const esBadge = {
      abierta: '<span class="badge badge-azul">Abierta</span>',
      ejecucion: '<span class="badge badge-amber">Ejecucion</span>',
      completada: '<span class="badge badge-verde">Completada</span>',
      pausada: '<span class="badge badge-rose">Pausada</span>'
    }[o.estado] || escapeHtml(o.estado);

    const causa = o.causaRaiz || clasificarCausa(o.descripcion);
    const causaColor = CAUSA_COLORS[causa] || 'azul';
    const causaBadge = `<span class="badge badge-${causaColor}">${CAUSA_LABELS[causa]}</span>`;

    const horas = o.horasReales != null ? o.horasReales.toFixed(1) : o.horasEstimadas.toFixed(1);
    const costo = o.costoReal != null ? o.costoReal : o.costoEstimado;

    return `<tr>
      <td><strong>${escapeHtml(o.codigo)}</strong></td>
      <td style="white-space:nowrap;font-size:12px">${fmtDate(o.fecha)}</td>
      <td>${escapeHtml(o.equipoCodigo)}<br><span style="font-size:11px;color:var(--muted)">${escapeHtml((o.equipo || '').replace(o.equipoCodigo + ' ', ''))}</span></td>
      <td style="font-size:12px">${escapeHtml(o.descripcion)}</td>
      <td style="font-size:12px">${escapeHtml(o.tecnico)}</td>
      <td style="text-align:center">${horas}</td>
      <td style="text-align:right">${fmt(costo, 0)}</td>
      <td>${causaBadge}</td>
      <td>${prBadge}</td>
      <td>${esBadge}</td>
    </tr>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// MODAL REPORTAR FALLA
// ════════════════════════════════════════════════════════
function openModal(container) {
  const data = getMantData();
  const equipos = data.equipos || [];

  const sel = container.querySelector('#cm-f-equipo');
  if (sel) {
    sel.innerHTML = '<option value="">-- Seleccionar equipo --</option>' +
      equipos.map(e => `<option value="${escapeAttr(e.codigo)}">${escapeHtml(e.codigo)} - ${escapeHtml(e.nombre)}</option>`).join('');
  }
  const desc = container.querySelector('#cm-f-descripcion');
  if (desc) desc.value = '';

  container.querySelector('#cm-modal-backdrop')?.classList.add('open');
}

function closeModal(container) {
  container.querySelector('#cm-modal-backdrop')?.classList.remove('open');
}

function saveFalla(container) {
  const equipoCod = container.querySelector('#cm-f-equipo')?.value;
  const descripcion = container.querySelector('#cm-f-descripcion')?.value?.trim();
  const prioridad = container.querySelector('#cm-f-prioridad')?.value || 'media';
  const causaRaiz = container.querySelector('#cm-f-causa')?.value || 'maquinaria';

  if (!equipoCod) { alert('Selecciona un equipo'); return; }
  if (!descripcion) { alert('Describe la falla'); return; }

  const data = getMantData();
  const equipo = (data.equipos || []).find(e => e.codigo === equipoCod);
  if (!equipo) return;

  // Calcular siguiente codigo
  const existing = (data.ordenes || []).map(o => parseInt((o.codigo || '').replace('OT-', '')) || 0);
  const maxNum = existing.length ? Math.max(...existing) : 2000;
  const codigo = 'OT-' + (maxNum + 1);

  const hoy = new Date();
  const tecnicos = data.tecnicos || [];
  const tecnico = tecnicos[Math.floor(Math.random() * tecnicos.length)] || { nombre: 'Por asignar', id: 'T000' };

  const horasEst = prioridad === 'alta' ? 4 : prioridad === 'media' ? 3 : 2;
  const costoEst = prioridad === 'alta' ? 1800 : prioridad === 'media' ? 900 : 450;

  const nueva = {
    codigo,
    equipo: equipo.codigo + ' ' + equipo.nombre,
    equipoCodigo: equipo.codigo,
    area: equipo.area,
    tipo: 'correctivo',
    prioridad,
    estado: 'abierta',
    tecnico: tecnico.nombre,
    tecnicoId: tecnico.id,
    descripcion,
    fecha: hoy.toISOString().substring(0, 10),
    horasEstimadas: horasEst,
    horasReales: null,
    costoEstimado: costoEst,
    costoReal: null,
    causaRaiz
  };

  data.ordenes = [nueva, ...(data.ordenes || [])];
  saveMantData(data);

  closeModal(container);
  loadAll(container);

  setTimeout(() => {
    alert(`OT ${codigo} creada exitosamente. Prioridad: ${prioridad.toUpperCase()}`);
  }, 100);
}
