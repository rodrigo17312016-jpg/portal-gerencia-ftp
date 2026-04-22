/* ════════════════════════════════════════════════════════
   RRHH - Panel Resumen Ejecutivo (portal.html)
   Lee localStorage.rrhh_employees y localStorage.rrhh_loans
   ════════════════════════════════════════════════════════ */

import { createChart, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';

// Duplicado de modules/rrhh/config.js — mantener sincronizado
const CFG_RRHH = {
  essaludGeneral: 0.09,
  essaludAgrario: 0.06,
  agrario: { gratifPct: 0.1666, ctsPct: 0.0972, diasLaborales: 6 }
};

const AREAS = ['Producción', 'Calidad', 'Almacén', 'Mantenimiento', 'Administración', 'Sanidad'];
const AREA_COLORS = ['#22c55e', '#f97316', '#2563eb', '#8b5cf6', '#ec4899', '#14b8a6'];

let storageListener = null;

export async function init(container) {
  renderAll(container);

  if (storageListener) window.removeEventListener('storage', storageListener);
  storageListener = (e) => {
    if (e.key === 'rrhh_employees' || e.key === 'rrhh_loans') {
      const c = document.getElementById('panel-rrhh');
      if (c) renderAll(c);
    }
  };
  window.addEventListener('storage', storageListener);
}

export function refresh() {
  const c = document.getElementById('panel-rrhh');
  if (c) renderAll(c);
}

function loadLS(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}

function fmtSoles(n) {
  return 'S/ ' + (n || 0).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function setVal(c, id, v) {
  const el = c.querySelector('#' + id);
  if (el) el.textContent = v;
}

function renderAll(container) {
  const employees = loadLS('rrhh_employees');
  const loans = loadLS('rrhh_loans');
  const activos = employees.filter(e => e.estado === 'ACTIVO');

  renderKPIs(container, activos);
  renderCharts(container, activos);
  renderResumenTabla(container, activos, loans);
  renderQuickLinks(container, activos, loans);

  const now = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  setVal(container, 'rrhhLastUpdate', 'Actualizado ' + now);
}

function calcSemanalAgrario(sueldo) {
  const jornal = sueldo / 30;
  const basico = jornal * CFG_RRHH.agrario.diasLaborales;
  const dominical = jornal;
  const base = basico + dominical;
  const gratif = base * CFG_RRHH.agrario.gratifPct;
  const bonoGratif = gratif * CFG_RRHH.essaludAgrario;
  const cts = base * CFG_RRHH.agrario.ctsPct;
  return basico + dominical + gratif + bonoGratif + cts;
}

function renderKPIs(c, activos) {
  const total = activos.length;
  const agrarios = activos.filter(e => e.regimen === 'AGRARIO');
  const generales = activos.filter(e => e.regimen === 'GENERAL');
  const p1 = activos.filter(e => e.planta === 'PLANTA HUAURA').length;
  const p2 = activos.filter(e => e.planta === 'PLANTA PIURA').length;

  const mensualGen = generales.reduce((s, e) => s + (+e.sueldoBasico || 0), 0);
  const semAgr = agrarios.reduce((s, e) => s + calcSemanalAgrario(+e.sueldoBasico || 0), 0);
  const essalud = activos.reduce((s, e) => {
    const tasa = e.regimen === 'AGRARIO' ? CFG_RRHH.essaludAgrario : CFG_RRHH.essaludGeneral;
    return s + ((+e.sueldoBasico || 0) * tasa);
  }, 0);

  setVal(c, 'rrhhEmps', total);
  setVal(c, 'rrhhEmpsSub', total ? `${agrarios.length} agrarios / ${generales.length} general` : 'Sin empleados registrados');
  setVal(c, 'rrhhHuaura', p1);
  setVal(c, 'rrhhHuauraSub', total ? `${((p1 / total) * 100).toFixed(0)}% del total` : '—');
  setVal(c, 'rrhhPiura', p2);
  setVal(c, 'rrhhPiuraSub', total ? `${((p2 / total) * 100).toFixed(0)}% del total` : '—');
  setVal(c, 'rrhhMensual', fmtSoles(mensualGen));
  setVal(c, 'rrhhMensualSub', `${generales.length} empleados — pago fin de mes`);
  setVal(c, 'rrhhSemanal', fmtSoles(semAgr));
  setVal(c, 'rrhhSemanalSub', `${agrarios.length} trabajadores — pago sábado`);
  setVal(c, 'rrhhEssalud', fmtSoles(essalud));
}

function renderCharts(c, activos) {
  const total = activos.length;
  const areaData = AREAS.map(a => activos.filter(e => e.area === a).length);
  const agrarios = activos.filter(e => e.regimen === 'AGRARIO').length;
  const generales = total - agrarios;

  const areasWrap = c.querySelector('#rrhhAreasWrap');
  const regWrap = c.querySelector('#rrhhRegimenWrap');

  if (total === 0) {
    if (areasWrap) areasWrap.innerHTML = '<div class="rrhh-chart-empty"><div class="rrhh-chart-empty-icon">📊</div><div>Cargue empleados para ver el gráfico</div></div>';
    if (regWrap) regWrap.innerHTML = '<div class="rrhh-chart-empty"><div class="rrhh-chart-empty-icon">📈</div><div>Sin datos disponibles</div></div>';
    return;
  }

  if (areasWrap && !areasWrap.querySelector('canvas')) areasWrap.innerHTML = '<canvas id="chartRrhhAreas"></canvas>';
  if (regWrap && !regWrap.querySelector('canvas')) regWrap.innerHTML = '<canvas id="chartRrhhRegimen"></canvas>';

  const tc = getTextColor();

  createChart('chartRrhhAreas', {
    type: 'bar',
    data: {
      labels: AREAS,
      datasets: [{
        label: 'Empleados',
        data: areaData,
        backgroundColor: AREA_COLORS.map(col => col + 'B3'),
        borderColor: AREA_COLORS,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: { legend: { display: false }, tooltip: { enabled: true } }
    }
  });

  createChart('chartRrhhRegimen', {
    type: 'doughnut',
    data: {
      labels: ['Agrario', 'General'],
      datasets: [{
        data: [agrarios, generales],
        backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(37,99,235,0.8)'],
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'bottom',
          labels: { color: tc, padding: 14, font: { size: 12, weight: '600' }, usePointStyle: true }
        }
      }
    }
  });
}

function renderResumenTabla(c, activos, loans) {
  const total = activos.length;
  const onp = activos.filter(e => e.sistPensiones === 'ONP').length;
  const afp = total - onp;
  const dia = activos.filter(e => e.turno === 'DIA').length;
  const noche = activos.filter(e => e.turno === 'NOCHE').length;
  const agr = activos.filter(e => e.regimen === 'AGRARIO').length;
  const gen = activos.filter(e => e.regimen === 'GENERAL').length;
  const loansAct = loans.filter(l => l.estado === 'ACTIVO');
  const montoPend = loansAct.reduce((s, l) => s + (+l.saldoPendiente || 0), 0);

  const rows = [
    { lbl: '🏦 ONP', val: onp, base: total },
    { lbl: '💼 AFP', val: afp, base: total },
    { lbl: '☀ Turno Día', val: dia, base: total },
    { lbl: '🌙 Turno Noche', val: noche, base: total },
    { lbl: '🌾 Régimen Agrario', val: agr, base: total },
    { lbl: '🏢 Régimen General', val: gen, base: total },
    { lbl: '💳 Préstamos Activos', val: loansAct.length, extra: 'Saldo: ' + fmtSoles(montoPend) }
  ];

  const tbody = c.querySelector('#rrhhResumenTabla');
  if (!tbody) return;

  tbody.innerHTML = rows.map(r => {
    const prop = (r.base && r.base > 0)
      ? `<span style="color:var(--verde,#22c55e);font-weight:700">${((r.val / r.base) * 100).toFixed(0)}%</span>`
      : (r.extra ? `<span style="color:var(--muted)">${r.extra}</span>` : '—');
    return `<tr>
      <td style="font-weight:600">${r.lbl}</td>
      <td style="font-family:monospace;font-weight:700">${r.val}</td>
      <td>${prop}</td>
    </tr>`;
  }).join('');
}

function renderQuickLinks(c, activos, loans) {
  setVal(c, 'rrhhQLEmps', `${activos.length} activos`);
  const loansAct = loans.filter(l => l.estado === 'ACTIVO').length;
  setVal(c, 'rrhhQLLoans', `${loansAct} activos`);
}
