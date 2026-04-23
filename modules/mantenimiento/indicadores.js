/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - INDICADORES KPI
   Panel integral de performance con gauges, radar, pareto e insights
   ════════════════════════════════════════════════════════ */

import { fmt, fmtPct } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';
import { getMantData } from './data-mock.js';

let charts = [];

export async function init(container) {
  const sel = container.querySelector('#periodo-select');
  if (sel) sel.addEventListener('change', () => loadAll(container));
  loadAll(container);
}

export function refresh() {
  charts.forEach(c => { try { c.destroy(); } catch(_){} });
  charts = [];
  const c = document.getElementById('panel-indicadores');
  if (c) loadAll(c);
}

function loadAll(container) {
  const data = getMantData();
  const kpis = data.kpis || {};

  // Gauges
  renderGauge(container, 'gauge-mttr', kpis.mttr || 0, 'horas', kpis.mttr <= 4 ? 'ok' : kpis.mttr <= 5 ? 'warn' : 'alert', { max: 8, invert: true });
  renderGauge(container, 'gauge-mtbf', kpis.mtbf || 0, 'horas', kpis.mtbf >= 500 ? 'ok' : kpis.mtbf >= 400 ? 'warn' : 'alert', { max: 800 });
  renderGauge(container, 'gauge-oee', kpis.oee || 0, '%', kpis.oee >= 85 ? 'ok' : kpis.oee >= 75 ? 'warn' : 'alert', { max: 100 });
  renderGauge(container, 'gauge-disp', kpis.disponibilidad || 0, '%', kpis.disponibilidad >= 95 ? 'ok' : kpis.disponibilidad >= 90 ? 'warn' : 'alert', { max: 100 });
  renderGauge(container, 'gauge-pm-cumpl', kpis.pmCumplimiento || 0, '%', kpis.pmCumplimiento >= 90 ? 'ok' : 'warn', { max: 100 });

  // Valores centrales
  setText(container, 'gauge-mttr-val', (kpis.mttr || 0).toFixed(1));
  setText(container, 'gauge-mtbf-val', fmt(kpis.mtbf || 0));
  setText(container, 'gauge-oee-val', (kpis.oee || 0).toFixed(1));
  setText(container, 'gauge-disp-val', (kpis.disponibilidad || 0).toFixed(1));
  setText(container, 'gauge-pm-cumpl-val', (kpis.pmCumplimiento || 0).toFixed(1));

  // Trends
  const t = data.tendencia || {};
  renderTrend(container, 'mttr-trend', t.mttr, true);   // menor es mejor
  renderTrend(container, 'mtbf-trend', t.mtbf, false);  // mayor es mejor
  renderTrend(container, 'oee-trend', [85, 85.5, 86, 86.5, 87, kpis.oee || 87], false);
  renderTrend(container, 'disp-trend', t.disponibilidad, false);

  // Charts
  renderChartMttrMtbf(container, data);
  renderChartDisp(container, data);
  renderChartRadar(container, data);
  renderChartRatio(container, data);
  renderChartPareto(container, data);

  // PM stats
  renderPmStats(container, data);

  // Insights
  renderInsights(container, data);
}

function setText(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

// ════════════════════════════════════════════════════════
// GAUGES (Chart.js doughnut)
// ════════════════════════════════════════════════════════
function renderGauge(container, canvasId, value, unit, status, opts = {}) {
  const canvas = container.querySelector('#' + canvasId);
  if (!canvas) return;
  const col = getColors();

  const max = opts.max || 100;
  const pct = Math.min(100, Math.max(0, (value / max) * 100));

  const colorMap = {
    ok: col.verde.border,
    warn: col.amber.border,
    alert: col.rose.border
  };
  const color = colorMap[status] || col.azul.border;

  const ch = createChart(canvasId, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [pct, 100 - pct],
        backgroundColor: [color, 'rgba(148,163,184,0.15)'],
        borderWidth: 0,
        circumference: 270,
        rotation: 225
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '80%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderTrend(container, id, arr, inverted) {
  const el = container.querySelector('#' + id);
  if (!el || !Array.isArray(arr) || arr.length < 2) { if (el) el.textContent = ''; return; }
  const first = arr[0];
  const last = arr[arr.length - 1];
  const delta = last - first;
  const pctChange = first !== 0 ? ((delta / first) * 100) : 0;
  const isBetter = inverted ? delta < 0 : delta > 0;
  const icon = delta === 0 ? '→' : (delta > 0 ? '▲' : '▼');
  const cls = isBetter ? 'trend-up' : 'trend-down';
  const sign = delta > 0 ? '+' : '';
  el.innerHTML = `<span class="${cls}">${icon} ${sign}${pctChange.toFixed(1)}% vs 6m</span>`;
}

// ════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════
function renderChartMttrMtbf(container, data) {
  const canvas = container.querySelector('#chart-mttr-mtbf');
  if (!canvas) return;
  const col = getColors();
  const t = data.tendencia || { meses: [], mttr: [], mtbf: [] };

  const ch = createChart('chart-mttr-mtbf', {
    type: 'line',
    data: {
      labels: t.meses,
      datasets: [
        { label: 'MTTR (h)', data: t.mttr, borderColor: col.rose.border, backgroundColor: col.rose.bg, borderWidth: 3, tension: 0.4, fill: true, pointRadius: 5, pointHoverRadius: 8, yAxisID: 'y' },
        { label: 'MTBF (h)', data: t.mtbf, borderColor: col.verde.border, backgroundColor: col.verde.bg, borderWidth: 3, tension: 0.4, fill: false, pointRadius: 5, pointHoverRadius: 8, yAxisID: 'y1' }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: getDefaultOptions().plugins.tooltip
      },
      scales: {
        x: { ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { position: 'left', ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' }, title: { display: true, text: 'MTTR (h)', color: col.rose.border, font: { size: 11 } } },
        y1: { position: 'right', ticks: { color: getTextColor() }, grid: { drawOnChartArea: false }, title: { display: true, text: 'MTBF (h)', color: col.verde.border, font: { size: 11 } } }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartDisp(container, data) {
  const canvas = container.querySelector('#chart-disp');
  if (!canvas) return;
  const col = getColors();
  const t = data.tendencia || { meses: [], disponibilidad: [] };
  const meta = t.meses.map(() => 95);

  const ch = createChart('chart-disp', {
    type: 'line',
    data: {
      labels: t.meses,
      datasets: [
        { label: 'Disponibilidad %', data: t.disponibilidad, borderColor: col.azul.border, backgroundColor: col.azul.bg, borderWidth: 3, tension: 0.4, fill: true, pointRadius: 5, pointHoverRadius: 8 },
        { label: 'Meta 95%', data: meta, borderColor: col.rose.border, borderWidth: 2, borderDash: [6, 4], pointRadius: 0, fill: false }
      ]
    },
    options: {
      ...getDefaultOptions('line'),
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: getDefaultOptions().plugins.tooltip
      },
      scales: {
        x: { ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' } },
        y: { ticks: { color: getTextColor(), callback: v => v + '%' }, grid: { color: 'rgba(0,0,0,0.04)' }, suggestedMin: 90, suggestedMax: 100 }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartRadar(container, data) {
  const canvas = container.querySelector('#chart-radar');
  if (!canvas) return;
  const col = getColors();

  const equipos = data.equipos || [];
  const ordenes = data.ordenes || [];
  const costos = data.costos?.porArea || {};

  // Agregados por area
  const areas = [...new Set(equipos.map(e => e.area))].slice(0, 6);
  const metrics = areas.map(a => {
    const eqArea = equipos.filter(e => e.area === a);
    const otArea = ordenes.filter(o => o.area === a);
    const operativos = eqArea.filter(e => e.estado === 'operativo').length / Math.max(1, eqArea.length) * 100;
    const pmRatio = otArea.filter(o => o.tipo === 'preventivo').length / Math.max(1, otArea.length) * 100;
    const costo = costos[a] || 0;
    const maxCosto = Math.max(...Object.values(costos), 1);
    const bajoCosto = 100 - (costo / maxCosto * 100);
    const mttr = 100 - Math.min(100, (otArea.length * 5)); // inverso: menos OT = mejor
    const mtbf = Math.min(100, operativos + 5);
    return [mttr, mtbf, operativos, pmRatio, bajoCosto];
  });

  // Dataset por area
  const palette = [col.verde.border, col.azul.border, col.naranja.border, col.purple.border, col.cyan.border, col.rose.border];
  const datasets = areas.slice(0, 4).map((a, i) => ({
    label: a,
    data: metrics[i],
    borderColor: palette[i],
    backgroundColor: palette[i] + '33',
    borderWidth: 2,
    pointRadius: 3
  }));

  const ch = createChart('chart-radar', {
    type: 'radar',
    data: {
      labels: ['MTTR', 'MTBF', 'Disponib.', 'Cumpl. PM', 'Bajo Costo'],
      datasets
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 }, boxWidth: 12 } },
        tooltip: getDefaultOptions().plugins.tooltip
      },
      scales: {
        r: {
          beginAtZero: true, max: 100,
          ticks: { color: getTextColor(), stepSize: 20, backdropColor: 'transparent' },
          grid: { color: 'rgba(0,0,0,0.08)' },
          angleLines: { color: 'rgba(0,0,0,0.08)' },
          pointLabels: { color: getTextColor(), font: { size: 11, weight: '600' } }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartRatio(container, data) {
  const canvas = container.querySelector('#chart-ratio-tipo');
  if (!canvas) return;
  const col = getColors();
  const meses = data.costos?.porMes?.meses || [];
  const porMes = data.costos?.porMes || {};

  // Simular cantidades OT por tipo por mes (basado en presupuesto)
  const totales = meses.map((_, i) => (porMes.preventivo?.[i] || 0) + (porMes.correctivo?.[i] || 0) + (porMes.predictivo?.[i] || 0));
  const prev = meses.map((_, i) => Math.round(((porMes.preventivo?.[i] || 0) / Math.max(1, totales[i])) * 30));
  const corr = meses.map((_, i) => Math.round(((porMes.correctivo?.[i] || 0) / Math.max(1, totales[i])) * 30));
  const pred = meses.map((_, i) => Math.round(((porMes.predictivo?.[i] || 0) / Math.max(1, totales[i])) * 30));

  const ch = createChart('chart-ratio-tipo', {
    type: 'bar',
    data: {
      labels: meses,
      datasets: [
        { label: 'Preventivo', data: prev, backgroundColor: col.verde.border, borderRadius: 6, stack: 't' },
        { label: 'Correctivo', data: corr, backgroundColor: col.rose.border, borderRadius: 6, stack: 't' },
        { label: 'Predictivo', data: pred, backgroundColor: col.purple.border, borderRadius: 6, stack: 't' }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: getDefaultOptions().plugins.tooltip
      },
      scales: {
        x: { stacked: true, ticks: { color: getTextColor() }, grid: { display: false } },
        y: { stacked: true, ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' }, title: { display: true, text: 'OT (cantidad)', color: getTextColor() } }
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartPareto(container, data) {
  const canvas = container.querySelector('#chart-pareto');
  if (!canvas) return;
  const col = getColors();

  // Contar OT correctivas por equipo
  const correctivas = (data.ordenes || []).filter(o => o.tipo === 'correctivo');
  const count = {};
  correctivas.forEach(o => {
    const key = o.equipoCodigo || o.equipo;
    count[key] = (count[key] || 0) + 1;
  });

  const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const total = correctivas.length || 1;
  const labels = ranked.map(([k]) => k);
  const values = ranked.map(([, v]) => v);

  // Acumulado %
  let acum = 0;
  const acumulado = values.map(v => {
    acum += v;
    return +(acum / total * 100).toFixed(1);
  });

  const ch = createChart('chart-pareto', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { type: 'bar', label: 'OT Correctivas', data: values, backgroundColor: col.rose.border + 'cc', borderColor: col.rose.border, borderWidth: 2, borderRadius: 6, yAxisID: 'y' },
        { type: 'line', label: '% Acumulado', data: acumulado, borderColor: col.azul.border, backgroundColor: col.azul.bg, borderWidth: 3, tension: 0.3, pointRadius: 5, pointHoverRadius: 8, yAxisID: 'y1', fill: false }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: getTextColor(), font: { size: 11 } } },
        tooltip: getDefaultOptions().plugins.tooltip,
        annotation: {}
      },
      scales: {
        x: { ticks: { color: getTextColor(), font: { size: 10 } }, grid: { display: false } },
        y: { position: 'left', ticks: { color: getTextColor() }, grid: { color: 'rgba(0,0,0,0.04)' }, title: { display: true, text: 'N° OT', color: col.rose.border } },
        y1: { position: 'right', ticks: { color: getTextColor(), callback: v => v + '%' }, grid: { drawOnChartArea: false }, title: { display: true, text: '% Acumulado', color: col.azul.border }, suggestedMin: 0, suggestedMax: 100 }
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// PM CUMPLIMIENTO STATS
// ════════════════════════════════════════════════════════
function renderPmStats(container, data) {
  const rutinas = data.rutinas || [];
  const programadas = rutinas.length;
  const vencidas = rutinas.filter(r => r.estado === 'vencida').length;
  const proximas = rutinas.filter(r => r.estado === 'proxima').length;
  const ejecutadas = Math.round(programadas * (data.kpis?.pmCumplimiento || 0) / 100);

  setText(container, 'pm-stat-prog', fmt(programadas));
  setText(container, 'pm-stat-ejec', fmt(ejecutadas));
  setText(container, 'pm-stat-venc', fmt(vencidas));
  setText(container, 'pm-stat-prox', fmt(proximas));
}

// ════════════════════════════════════════════════════════
// INSIGHTS
// ════════════════════════════════════════════════════════
function renderInsights(container, data) {
  const grid = container.querySelector('#insights-container');
  if (!grid) return;

  const insights = [];
  const t = data.tendencia || {};
  const kpis = data.kpis || {};

  // 1. MTBF mejora
  if (t.mtbf?.length >= 2) {
    const first = t.mtbf[0];
    const last = t.mtbf[t.mtbf.length - 1];
    const delta = ((last - first) / first * 100);
    if (delta > 10) {
      insights.push({
        type: 'ok', icon: '📈',
        title: `MTBF mejoró ${delta.toFixed(0)}% en 6 meses`,
        desc: `Tiempo medio entre fallas subió de ${first}h a ${last}h. La política preventiva está rindiendo frutos.`
      });
    } else if (delta < -5) {
      insights.push({
        type: 'alert', icon: '📉',
        title: `MTBF cayó ${Math.abs(delta).toFixed(0)}% en 6 meses`,
        desc: `La confiabilidad de equipos se degradó. Revisar calidad del mantenimiento preventivo.`
      });
    }
  }

  // 2. MTTR
  if (t.mttr?.length >= 2) {
    const first = t.mttr[0];
    const last = t.mttr[t.mttr.length - 1];
    const delta = ((last - first) / first * 100);
    if (delta < -15) {
      insights.push({
        type: 'ok', icon: '⚡',
        title: `MTTR bajó ${Math.abs(delta).toFixed(0)}% en 6 meses`,
        desc: `Las reparaciones son ${Math.abs(delta).toFixed(0)}% más rápidas. Buen trabajo del equipo técnico.`
      });
    }
  }

  // 3. Pareto
  const correctivas = (data.ordenes || []).filter(o => o.tipo === 'correctivo');
  const count = {};
  correctivas.forEach(o => { const k = o.equipoCodigo || o.equipo; count[k] = (count[k] || 0) + 1; });
  const ranked = Object.entries(count).sort((a, b) => b[1] - a[1]);
  if (ranked.length >= 3) {
    const top3 = ranked.slice(0, 3).reduce((s, [, v]) => s + v, 0);
    const total = correctivas.length;
    const top3Pct = (top3 / total * 100).toFixed(0);
    insights.push({
      type: 'warn', icon: '🎯',
      title: `${top3Pct}% de fallas en 3 equipos`,
      desc: `Top: ${escapeHtml(ranked.slice(0, 3).map(r => r[0]).join(', '))}. Enfocar análisis de causa raíz aquí.`
    });
  }

  // 4. OEE
  if (kpis.oee) {
    if (kpis.oee >= 85) {
      insights.push({
        type: 'ok', icon: '🏆',
        title: `OEE de ${kpis.oee.toFixed(1)}% - Clase mundial`,
        desc: `El indicador supera el benchmark de industria (85%). Sostener el programa actual.`
      });
    } else if (kpis.oee < 70) {
      insights.push({
        type: 'alert', icon: '⚠️',
        title: `OEE bajo: ${kpis.oee.toFixed(1)}%`,
        desc: `Muy por debajo de la meta. Revisar pérdidas de disponibilidad, performance y calidad.`
      });
    }
  }

  // 5. Ratio preventivo/correctivo
  if (kpis.ratioPrevCorr) {
    if (kpis.ratioPrevCorr >= 2.5) {
      insights.push({
        type: 'ok', icon: '✅',
        title: `Ratio Prev/Corr = ${kpis.ratioPrevCorr.toFixed(1)}`,
        desc: `Muy por encima del 2:1 recomendado. La cultura preventiva está instalada.`
      });
    } else if (kpis.ratioPrevCorr < 1.5) {
      insights.push({
        type: 'warn', icon: '🔨',
        title: `Ratio Prev/Corr = ${kpis.ratioPrevCorr.toFixed(1)}`,
        desc: `Demasiadas OT correctivas. Incrementar cobertura del plan preventivo.`
      });
    }
  }

  if (!insights.length) {
    insights.push({ type: 'ok', icon: '💡', title: 'Sin alertas relevantes', desc: 'Los indicadores se mantienen dentro de rangos esperados.' });
  }

  grid.innerHTML = insights.slice(0, 4).map(i => `
    <div class="insight-card ${i.type}">
      <div class="insight-icon">${i.icon}</div>
      <div>
        <div class="insight-title">${i.title}</div>
        <div class="insight-desc">${i.desc}</div>
      </div>
    </div>
  `).join('');
}
