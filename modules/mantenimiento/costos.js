/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - ANALISIS DE COSTOS
   Panel presupuestal, gasto y oportunidades de ahorro
   ════════════════════════════════════════════════════════ */

import { fmt, fmtSoles, fmtPct } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';
import { getMantData } from './data-mock.js';
import { addDemoBanner } from '../../assets/js/utils/demo-banner.js';

let charts = [];

export async function init(container) {
  addDemoBanner(container);
  const sel = container.querySelector('#costo-periodo');
  if (sel) sel.addEventListener('change', () => loadAll(container));

  const btn = container.querySelector('#btn-exportar');
  if (btn) btn.addEventListener('click', () => exportarReporte());

  loadAll(container);
}

export function refresh() {
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];
  const c = document.getElementById('panel-costos');
  if (c) loadAll(c);
}

function loadAll(container) {
  const data = getMantData();
  const costos = data.costos || {};
  const ordenes = data.ordenes || [];
  const kpis = data.kpis || {};

  // KPIs
  const presupuesto = costos.presupuestoMes || kpis.presupuestoMes || 0;
  const gasto = costos.gastoMes || kpis.costoMes || 0;
  const variacion = presupuesto > 0 ? ((presupuesto - gasto) / presupuesto * 100) : 0;

  setText(container, 'kpi-presupuesto', fmtSoles(presupuesto, 0));
  setText(container, 'kpi-gasto', fmtSoles(gasto, 0));
  setText(container, 'kpi-gasto-sub', `${((gasto / Math.max(1, presupuesto)) * 100).toFixed(1)}% del presupuesto`);

  const varEl = container.querySelector('#kpi-variacion');
  const varIconEl = container.querySelector('#kpi-var-icon');
  const varSubEl = container.querySelector('#kpi-variacion-sub');
  if (varEl) {
    if (variacion >= 0) {
      varEl.textContent = '+' + variacion.toFixed(1) + '%';
      varEl.classList.remove('var-negativa');
      varEl.classList.add('var-positiva');
      if (varIconEl) { varIconEl.style.background = 'rgba(22,163,74,.12)'; varIconEl.style.color = 'var(--verde)'; varIconEl.textContent = '✓'; }
      if (varSubEl) varSubEl.textContent = 'Ahorro vs presupuesto';
    } else {
      varEl.textContent = variacion.toFixed(1) + '%';
      varEl.classList.remove('var-positiva');
      varEl.classList.add('var-negativa');
      if (varIconEl) { varIconEl.style.background = 'rgba(225,29,72,.12)'; varIconEl.style.color = 'var(--rose)'; varIconEl.textContent = '⚠'; }
      if (varSubEl) varSubEl.textContent = 'Sobre-ejecución';
    }
  }

  // Costo promedio por OT
  const completadas = ordenes.filter(o => o.estado === 'completada' && o.costoReal);
  const costoPromedioOt = completadas.length > 0
    ? completadas.reduce((s, o) => s + o.costoReal, 0) / completadas.length
    : 0;
  setText(container, 'kpi-costo-ot', fmtSoles(costoPromedioOt, 0));

  // Badge variacion
  const badgeEl = container.querySelector('#presup-variacion-badge');
  if (badgeEl) {
    const cls = variacion >= 0 ? 'positiva' : 'negativa';
    const icon = variacion >= 0 ? '✓' : '⚠';
    badgeEl.innerHTML = `<span class="badge-var ${cls}">${icon} ${variacion >= 0 ? '+' : ''}${variacion.toFixed(1)}%</span>`;
  }

  // Charts
  renderChartPresupGasto(container, data);
  renderChartCostoArea(container, data);
  renderChartCostoTipo(container, data);
  renderChartEvolucion(container, data);

  // Top 10 equipos
  renderTopEquipos(container, data);

  // Oportunidades
  renderOportunidades(container, data);
}

function setText(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

// ════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════
function renderChartPresupGasto(container, data) {
  const canvas = container.querySelector('#chart-presup-gasto');
  if (!canvas) return;
  const col = getColors();
  const porMes = data.costos?.porMes || { meses: [], preventivo: [], correctivo: [], predictivo: [] };

  const gastos = porMes.meses.map((_, i) => (porMes.preventivo[i] || 0) + (porMes.correctivo[i] || 0) + (porMes.predictivo[i] || 0));
  const presupuesto = data.costos?.presupuestoMes || 45000;
  const presupArr = porMes.meses.map(() => presupuesto);

  const ch = createChart('chart-presup-gasto', {
    type: 'bar',
    data: {
      labels: porMes.meses,
      datasets: [
        { label: 'Presupuesto', data: presupArr, backgroundColor: col.azul.border + '33', borderColor: col.azul.border, borderWidth: 2, borderRadius: 6, borderDash: [6, 4] },
        { label: 'Gasto Real', data: gastos, backgroundColor: col.naranja.border + 'cc', borderColor: col.naranja.border, borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: S/ ${fmt(ctx.parsed.y, 0)}` }
        }
      },
      scales: {
        x: { ticks: { color: getTextColor() }, grid: { display: false } },
        y: { ticks: { color: getTextColor(), callback: v => 'S/ ' + fmt(v, 0) }, grid: { color: 'rgba(0,0,0,0.04)' } }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartCostoArea(container, data) {
  const canvas = container.querySelector('#chart-costo-area');
  if (!canvas) return;
  const col = getColors();
  const porArea = data.costos?.porArea || {};
  const entries = Object.entries(porArea).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(([a]) => a);
  const values = entries.map(([, v]) => v);
  const palette = [col.verde.border, col.naranja.border, col.azul.border, col.cyan.border, col.purple.border, col.amber.border, col.rose.border];

  const ch = createChart('chart-costo-area', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Costo S/',
        data: values,
        backgroundColor: labels.map((_, i) => palette[i % palette.length] + '55'),
        borderColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 2, borderRadius: 8
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: (ctx) => 'S/ ' + fmt(ctx.parsed.x, 0) }
        }
      },
      scales: {
        x: { ticks: { color: getTextColor(), callback: v => 'S/ ' + fmt(v / 1000, 0) + 'k' }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { ticks: { color: getTextColor() }, grid: { display: false } }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartCostoTipo(container, data) {
  const canvas = container.querySelector('#chart-costo-tipo');
  if (!canvas) return;
  const col = getColors();
  const porMes = data.costos?.porMes || {};
  const totPrev = (porMes.preventivo || []).reduce((s, v) => s + v, 0);
  const totCorr = (porMes.correctivo || []).reduce((s, v) => s + v, 0);
  const totPred = (porMes.predictivo || []).reduce((s, v) => s + v, 0);

  const ch = createChart('chart-costo-tipo', {
    type: 'doughnut',
    data: {
      labels: ['Preventivo', 'Correctivo', 'Predictivo'],
      datasets: [{
        data: [totPrev, totCorr, totPred],
        backgroundColor: [col.verde.border, col.rose.border, col.purple.border],
        borderColor: 'var(--surface)', borderWidth: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: {
        legend: { display: true, position: 'right', labels: { color: getTextColor(), font: { size: 12 }, padding: 10 } },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.label}: S/ ${fmt(ctx.parsed, 0)}` }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartEvolucion(container, data) {
  const canvas = container.querySelector('#chart-costo-evolucion');
  if (!canvas) return;
  const col = getColors();
  const porMes = data.costos?.porMes || { meses: [], preventivo: [], correctivo: [], predictivo: [] };

  const ch = createChart('chart-costo-evolucion', {
    type: 'line',
    data: {
      labels: porMes.meses,
      datasets: [
        { label: 'Preventivo', data: porMes.preventivo, borderColor: col.verde.border, backgroundColor: col.verde.border + '55', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3 },
        { label: 'Correctivo', data: porMes.correctivo, borderColor: col.rose.border, backgroundColor: col.rose.border + '55', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3 },
        { label: 'Predictivo', data: porMes.predictivo, borderColor: col.purple.border, backgroundColor: col.purple.border + '55', borderWidth: 2, tension: 0.4, fill: true, pointRadius: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: (ctx) => `${ctx.dataset.label}: S/ ${fmt(ctx.parsed.y, 0)}` }
        }
      },
      scales: {
        x: { ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { stacked: true, ticks: { color: getTextColor(), callback: v => 'S/ ' + fmt(v / 1000, 0) + 'k' }, grid: { color: 'rgba(0,0,0,0.04)' } }
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// TOP EQUIPOS
// ════════════════════════════════════════════════════════
function renderTopEquipos(container, data) {
  const tbody = container.querySelector('#tbl-top-equipos');
  if (!tbody) return;

  const ordenes = (data.ordenes || []).filter(o => o.costoReal);
  const equipos = data.equipos || [];

  // Agregar por equipo
  const agg = {};
  ordenes.forEach(o => {
    const key = o.equipoCodigo || o.equipo;
    if (!agg[key]) agg[key] = { codigo: key, area: o.area, otCount: 0, costoTotal: 0, prev: 0, corr: 0, pred: 0 };
    agg[key].otCount++;
    agg[key].costoTotal += o.costoReal;
    if (o.tipo === 'preventivo') agg[key].prev += o.costoReal;
    else if (o.tipo === 'correctivo') agg[key].corr += o.costoReal;
    else if (o.tipo === 'predictivo') agg[key].pred += o.costoReal;
  });

  const totalGlobal = Object.values(agg).reduce((s, e) => s + e.costoTotal, 0);
  const ranked = Object.values(agg).sort((a, b) => b.costoTotal - a.costoTotal).slice(0, 10);

  if (!ranked.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:32px">Sin datos de costos por equipo</td></tr>';
    return;
  }

  tbody.innerHTML = ranked.map((e, i) => {
    const eq = equipos.find(q => q.codigo === e.codigo);
    const nombre = eq?.nombre || e.codigo;
    const horas = eq?.horasUso || 1;
    const costoHora = e.costoTotal / horas;
    const pct = (e.costoTotal / Math.max(1, totalGlobal) * 100);

    const prevPct = e.costoTotal ? (e.prev / e.costoTotal * 100) : 0;
    const corrPct = e.costoTotal ? (e.corr / e.costoTotal * 100) : 0;
    const predPct = e.costoTotal ? (e.pred / e.costoTotal * 100) : 0;

    const medallaColor = i === 0 ? '#ffb400' : i === 1 ? '#94a3b8' : i === 2 ? '#cd7f32' : 'var(--muted)';
    const medalla = i < 3 ? `<strong style="color:${medallaColor};font-size:16px">${['🥇','🥈','🥉'][i]} ${i+1}</strong>` : `<strong>#${i+1}</strong>`;

    return `<tr>
      <td>${medalla}</td>
      <td><strong>${escapeHtml(e.codigo)}</strong><br><small style="color:var(--muted)">${escapeHtml(nombre)}</small></td>
      <td>${escapeHtml(e.area || '-')}</td>
      <td>${e.otCount}</td>
      <td><strong>${fmtSoles(e.costoTotal, 0)}</strong></td>
      <td>${fmtSoles(costoHora, 2)}</td>
      <td><span class="badge badge-azul">${pct.toFixed(1)}%</span></td>
      <td>
        <div class="mini-dist" title="P:${prevPct.toFixed(0)}% C:${corrPct.toFixed(0)}% Pr:${predPct.toFixed(0)}%">
          <div class="mini-dist-seg prev" style="width:${prevPct}%"></div>
          <div class="mini-dist-seg corr" style="width:${corrPct}%"></div>
          <div class="mini-dist-seg pred" style="width:${predPct}%"></div>
        </div>
      </td>
    </tr>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// OPORTUNIDADES DE AHORRO
// ════════════════════════════════════════════════════════
function renderOportunidades(container, data) {
  const grid = container.querySelector('#oportunidades-grid');
  if (!grid) return;

  const oportunidades = [];
  const ordenes = (data.ordenes || []).filter(o => o.costoReal);
  const equipos = data.equipos || [];

  // Equipos con costo correctivo > 40% del total del equipo
  const agg = {};
  ordenes.forEach(o => {
    const key = o.equipoCodigo || o.equipo;
    if (!agg[key]) agg[key] = { codigo: key, total: 0, corr: 0, otCount: 0 };
    agg[key].total += o.costoReal;
    agg[key].otCount++;
    if (o.tipo === 'correctivo') agg[key].corr += o.costoReal;
  });

  const equiposConRatioAlto = Object.values(agg)
    .filter(e => e.total > 1000 && (e.corr / e.total) > 0.4)
    .sort((a, b) => b.corr - a.corr)
    .slice(0, 2);

  equiposConRatioAlto.forEach(e => {
    const eq = equipos.find(q => q.codigo === e.codigo);
    const pct = (e.corr / e.total * 100).toFixed(0);
    const ahorro = Math.round(e.corr * 0.35);
    oportunidades.push({
      type: 'high', icon: '🔨',
      title: `${escapeHtml(e.codigo)}: ${pct}% costo correctivo`,
      desc: `${escapeHtml(eq?.nombre || e.codigo)} acumula ${fmtSoles(e.corr, 0)} en OT correctivas. Considerar reemplazo o overhaul programado.`,
      ahorro: `Ahorro potencial: ${fmtSoles(ahorro, 0)}/año`
    });
  });

  // Area con mayor costo
  const porArea = data.costos?.porArea || {};
  const areaTop = Object.entries(porArea).sort((a, b) => b[1] - a[1])[0];
  if (areaTop) {
    const totalArea = Object.values(porArea).reduce((s, v) => s + v, 0);
    const pctArea = (areaTop[1] / totalArea * 100).toFixed(0);
    if (pctArea > 25) {
      oportunidades.push({
        type: 'medium', icon: '🏭',
        title: `Área ${escapeHtml(areaTop[0])} concentra ${pctArea}% del gasto`,
        desc: `Revisar rutinas preventivas y plan de criticidad. Auditoría de procesos recomendada.`,
        ahorro: `Ahorro potencial: ${fmtSoles(areaTop[1] * 0.15, 0)}`
      });
    }
  }

  // Ratio correctivo global
  const porMes = data.costos?.porMes || {};
  const totCorr = (porMes.correctivo || []).reduce((s, v) => s + v, 0);
  const totPrev = (porMes.preventivo || []).reduce((s, v) => s + v, 0);
  if (totCorr > 0 && totPrev > 0) {
    const ratio = totCorr / totPrev;
    if (ratio > 0.5) {
      oportunidades.push({
        type: 'medium', icon: '⚖️',
        title: `Ratio Correctivo/Preventivo: ${(ratio * 100).toFixed(0)}%`,
        desc: `El correctivo representa demasiado del presupuesto. Incrementar el plan preventivo podría reducir fallas inesperadas.`,
        ahorro: `Ahorro potencial: ${fmtSoles(totCorr * 0.25, 0)}`
      });
    }
  }

  // Eficiencia preventivo
  const kpis = data.kpis || {};
  if (kpis.pmCumplimiento >= 90) {
    oportunidades.push({
      type: 'info', icon: '✅',
      title: `Cumplimiento PM: ${kpis.pmCumplimiento.toFixed(1)}%`,
      desc: `Excelente adherencia al plan preventivo. Sostener la disciplina para mantener los costos correctivos bajos.`,
      ahorro: 'Mantener política actual'
    });
  }

  // Rellenar hasta 4
  while (oportunidades.length < 3) {
    oportunidades.push({
      type: 'info', icon: '💡',
      title: 'Análisis de tendencia estable',
      desc: 'Los costos se mantienen dentro de rangos operacionales esperados para el sector.',
      ahorro: ''
    });
  }

  grid.innerHTML = oportunidades.slice(0, 4).map(o => `
    <div class="oport-card ${o.type}">
      <div class="oport-icon">${o.icon}</div>
      <div>
        <div class="oport-title">${o.title}</div>
        <div class="oport-desc">${o.desc}</div>
        ${o.ahorro ? `<div class="oport-ahorro">💰 ${o.ahorro}</div>` : ''}
      </div>
    </div>
  `).join('');
}

// ════════════════════════════════════════════════════════
// EXPORTAR
// ════════════════════════════════════════════════════════
function exportarReporte() {
  const data = getMantData();
  const costos = data.costos || {};
  const porMes = costos.porMes || {};

  // CSV simple
  let csv = 'Mes,Preventivo,Correctivo,Predictivo,Total\n';
  (porMes.meses || []).forEach((m, i) => {
    const p = porMes.preventivo[i] || 0;
    const c = porMes.correctivo[i] || 0;
    const pr = porMes.predictivo[i] || 0;
    csv += `${m},${p},${c},${pr},${p + c + pr}\n`;
  });

  csv += '\nArea,Costo\n';
  Object.entries(costos.porArea || {}).forEach(([a, v]) => {
    csv += `${a},${v}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `reporte_costos_mantenimiento_${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);

  const fb = document.createElement('div');
  fb.textContent = '📥 Reporte CSV descargado';
  fb.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--verde);color:white;padding:12px 18px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.2);z-index:9999;font-weight:600';
  document.body.appendChild(fb);
  setTimeout(() => fb.remove(), 2600);
}
