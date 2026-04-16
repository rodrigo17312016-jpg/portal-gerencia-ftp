/* ════════════════════════════════════════════════════════
   RESUMEN EJECUTIVO - Dashboard principal de gerencia
   9 secciones con datos reales de Supabase
   ════════════════════════════════════════════════════════ */

import { supabase, supabaseCalidad } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct, fmtSoles, today, currentTurno } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

// ── Module state ──
let charts = [];
let refreshTimer = null;
const TEMP_THRESHOLD = -15;

// ── Exec-style chart palette ──
const EXEC_COLORS = [
  '#0e7c3a', '#1e40af', '#ea580c', '#b45309', '#6d28d9', '#be123c',
  '#0891b2', '#16a34a', '#d97706', '#7c3aed'
];

// ════════════════════════════════════════════════════════
// PUBLIC API
// ════════════════════════════════════════════════════════

export async function init(container) {
  // Turno badge
  const turnoEl = container.querySelector('#resumen-turno');
  if (turnoEl) {
    const turno = currentTurno();
    turnoEl.textContent = turno === 'DIA' ? '☀️ Turno Dia' : '🌙 Turno Noche';
  }

  // Wire nav chips
  container.querySelectorAll('.filter-chip[data-scroll]').forEach(chip => {
    chip.addEventListener('click', () => {
      const target = container.querySelector('#' + chip.dataset.scroll);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Load everything
  await Promise.all([
    loadKPIs(container),
    loadCharts(container)
  ]);

  // Auto-refresh every 2 min
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const c = document.getElementById('panel-resumen');
    if (c) {
      loadKPIs(c);
      // Charts don't need to refresh as often
    }
  }, 120000);
}

export function refresh() {
  // Destroy all charts
  charts.forEach(c => { try { if (c) c.destroy(); } catch (_) { /* noop */ } });
  charts = [];
  window.__activeCharts = [];

  const container = document.getElementById('panel-resumen');
  if (container) {
    Promise.all([loadKPIs(container), loadCharts(container)]);
  }
}

// ════════════════════════════════════════════════════════
// KPIs
// ════════════════════════════════════════════════════════

async function loadKPIs(container) {
  const hoy = today();

  // 3 parallel queries
  const [prodResult, tempResult, empaqueResult] = await Promise.allSettled([
    // 1. Produccion hoy
    supabase
      .from('registro_produccion')
      .select('id, consumo_kg, pt_aprox_kg, fruta')
      .eq('fecha', hoy),

    // 2. Temperaturas hoy
    supabaseCalidad
      .from('registros_temperatura')
      .select('id, temperatura')
      .gte('created_at', hoy + 'T00:00:00'),

    // 3. Empaque acumulado (TN exportadas)
    supabase
      .from('registro_empaque_congelado')
      .select('cajas, peso_neto_kg')
  ]);

  // --- KPI 1 & 2: Produccion hoy + Lotes activos ---
  if (prodResult.status === 'fulfilled' && prodResult.value.data) {
    const prod = prodResult.value.data;
    const totalPT = prod.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    setKPI(container, 'kpi-produccion-hoy', fmt(totalPT) + ' kg');
    setKPI(container, 'kpi-lotes-activos', String(prod.length));
  } else {
    setKPI(container, 'kpi-produccion-hoy', '0 kg');
    setKPI(container, 'kpi-lotes-activos', '0');
  }

  // --- KPI 3 & 4: Registros temp + Alertas ---
  if (tempResult.status === 'fulfilled' && tempResult.value.data) {
    const temps = tempResult.value.data;
    setKPI(container, 'kpi-registros-temp', String(temps.length));
    const alertas = temps.filter(r => (r.temperatura || -99) > TEMP_THRESHOLD).length;
    setKPI(container, 'kpi-alertas-activas', String(alertas));
  } else {
    setKPI(container, 'kpi-registros-temp', '0');
    setKPI(container, 'kpi-alertas-activas', '0');
  }

  // --- KPI 5: TN exportadas ---
  if (empaqueResult.status === 'fulfilled' && empaqueResult.value.data) {
    const emp = empaqueResult.value.data;
    const totalKg = emp.reduce((s, r) => s + (r.peso_neto_kg || 0), 0);
    const tn = totalKg / 1000;
    setKPI(container, 'kpi-tn-exportadas', fmt(tn, 1) + ' TN');
  } else {
    setKPI(container, 'kpi-tn-exportadas', '0 TN');
  }
}

// ════════════════════════════════════════════════════════
// CHARTS & SECTIONS
// ════════════════════════════════════════════════════════

async function loadCharts(container) {
  // 5 parallel data queries
  const [prodResult, empaqueResult, consumosResult, alertasResult, tempsResult] = await Promise.allSettled([
    // 1. Produccion campana 2026
    supabase
      .from('registro_produccion')
      .select('fecha, fruta, consumo_kg, pt_aprox_kg')
      .gte('fecha', '2026-01-01')
      .order('fecha', { ascending: true }),

    // 2. Empaque congelado (exportacion + camara)
    supabase
      .from('registro_empaque_congelado')
      .select('cliente, destino, cajas, peso_neto_kg, fruta, tipo_empaque, fecha')
      .order('fecha', { ascending: true }),

    // 3. Consumos insumos (laboratorio + consumo + costos)
    supabaseCalidad
      .from('consumos_insumos')
      .select('*'),

    // 4. Alertas temperatura (ultimas 6 fuera de rango)
    supabaseCalidad
      .from('registros_temperatura')
      .select('area, temperatura, created_at')
      .gt('temperatura', TEMP_THRESHOLD)
      .order('created_at', { ascending: false })
      .limit(6),

    // 5. Temperaturas hoy (para tabla por area)
    supabaseCalidad
      .from('registros_temperatura')
      .select('area, temperatura, created_at')
      .gte('created_at', today() + 'T00:00:00')
      .order('created_at', { ascending: false })
  ]);

  const prodData = prodResult.status === 'fulfilled' ? (prodResult.value.data || []) : [];
  const empaqueData = empaqueResult.status === 'fulfilled' ? (empaqueResult.value.data || []) : [];
  const consumosData = consumosResult.status === 'fulfilled' ? (consumosResult.value.data || []) : [];
  const alertasData = alertasResult.status === 'fulfilled' ? (alertasResult.value.data || []) : [];
  const tempsData = tempsResult.status === 'fulfilled' ? (tempsResult.value.data || []) : [];

  // Render each section in try/catch so one failure doesn't break others
  try { renderSecProduccion(container, prodData); } catch (e) { console.error('Error renderSecProduccion:', e); }
  try { renderSecExportacion(container, empaqueData); } catch (e) { console.error('Error renderSecExportacion:', e); }
  try { renderSecLaboratorio(container, consumosData); } catch (e) { console.error('Error renderSecLaboratorio:', e); }
  try { renderSecCertificaciones(container); } catch (e) { console.error('Error renderSecCertificaciones:', e); }
  try { renderSecConsumo(container, consumosData); } catch (e) { console.error('Error renderSecConsumo:', e); }
  try { renderTblAlertasTemp(container, alertasData); } catch (e) { console.error('Error renderTblAlertasTemp:', e); }
  try { renderSecCamara(container, empaqueData); } catch (e) { console.error('Error renderSecCamara:', e); }
  try { renderSecCostos(container, consumosData); } catch (e) { console.error('Error renderSecCostos:', e); }
  try { renderTblTempAreas(container, tempsData); } catch (e) { console.error('Error renderTblTempAreas:', e); }

  window.__activeCharts = charts;
}

// ════════════════════════════════════════════════════════
// 1. PRODUCCION - CAMPANA 2026
// ════════════════════════════════════════════════════════

function renderSecProduccion(container, data) {
  if (!data.length) {
    setKPI(container, 'mini-prod-mango', 'Mango: Sin datos');
    setKPI(container, 'mini-prod-arandano', 'Arandano: Sin datos');
    setKPI(container, 'mini-prod-granada', 'Granada: Sin datos');
    return;
  }

  // Group by fruta
  const byFruta = {};
  data.forEach(r => {
    const f = (r.fruta || 'otros').toLowerCase();
    if (!byFruta[f]) byFruta[f] = { pt: 0, mp: 0 };
    byFruta[f].pt += (r.pt_aprox_kg || 0);
    byFruta[f].mp += (r.consumo_kg || 0);
  });

  // Mini KPIs
  const mango = byFruta['mango'] || { pt: 0 };
  const arandano = byFruta['arandano'] || byFruta['arándano'] || { pt: 0 };
  const granada = byFruta['granada'] || { pt: 0 };
  setKPI(container, 'mini-prod-mango', 'Mango: ' + fmt(mango.pt / 1000, 1) + ' TN');
  setKPI(container, 'mini-prod-arandano', 'Arandano: ' + fmt(arandano.pt / 1000, 1) + ' TN');
  setKPI(container, 'mini-prod-granada', 'Granada: ' + fmt(granada.pt / 1000, 1) + ' TN');

  // Chart: bar (TN) + line (Rend %)
  const labels = Object.keys(byFruta).map(f => capitalize(f));
  const tnData = Object.values(byFruta).map(v => +(v.pt / 1000).toFixed(2));
  const rendData = Object.values(byFruta).map(v => v.mp > 0 ? +((v.pt / v.mp) * 100).toFixed(1) : 0);

  const colors = getColors();
  const chart = createChart('chart-prod-campana', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'TN Producidas',
          data: tnData,
          backgroundColor: EXEC_COLORS.slice(0, labels.length).map(c => c + '33'),
          borderColor: EXEC_COLORS.slice(0, labels.length),
          borderWidth: 2,
          borderRadius: 8,
          yAxisID: 'y',
          order: 2
        },
        {
          label: 'Rendimiento %',
          data: rendData,
          type: 'line',
          borderColor: colors.naranja.border,
          backgroundColor: colors.naranja.bg,
          fill: false,
          tension: 0.4,
          pointRadius: 5,
          pointBackgroundColor: colors.naranja.border,
          yAxisID: 'y1',
          order: 1
        }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: {
        ...getDefaultOptions('bar').plugins,
        legend: { display: true, labels: { color: colors.verde.border, font: { size: 11 } } }
      },
      scales: {
        x: getDefaultOptions('bar').scales.x,
        y: {
          ...getDefaultOptions('bar').scales.y,
          title: { display: true, text: 'TN', color: colors.verde.border, font: { size: 11 } }
        },
        y1: {
          position: 'right',
          beginAtZero: true,
          grid: { drawOnChartArea: false },
          ticks: { color: colors.naranja.border, font: { size: 11 }, callback: v => v + '%' },
          title: { display: true, text: 'Rend %', color: colors.naranja.border, font: { size: 11 } }
        }
      }
    }
  });
  if (chart) charts.push(chart);
}

// ════════════════════════════════════════════════════════
// 2. EXPORTACION - CONTENEDORES FCL
// ════════════════════════════════════════════════════════

function renderSecExportacion(container, data) {
  if (!data.length) {
    setKPI(container, 'mini-exp-fcl', 'FCL: 0');
    setKPI(container, 'mini-exp-tn', 'TN: 0');
    setKPI(container, 'mini-exp-destinos', 'Destinos: 0');
    return;
  }

  // Total stats
  const totalKg = data.reduce((s, r) => s + (r.peso_neto_kg || 0), 0);
  const destinos = new Set(data.map(r => r.destino).filter(Boolean));
  const totalCajas = data.reduce((s, r) => s + (r.cajas || 0), 0);
  // Approximate FCL: 1 FCL ~ 20 TN
  const fclApprox = Math.floor(totalKg / 20000) || data.length;

  setKPI(container, 'mini-exp-fcl', 'FCL: ' + fmt(fclApprox));
  setKPI(container, 'mini-exp-tn', 'TN: ' + fmt(totalKg / 1000, 1));
  setKPI(container, 'mini-exp-destinos', 'Destinos: ' + destinos.size);

  // Group by cliente
  const byCliente = {};
  data.forEach(r => {
    const c = r.cliente || 'Sin cliente';
    if (!byCliente[c]) byCliente[c] = 0;
    byCliente[c] += (r.peso_neto_kg || 0) / 1000;
  });

  // Sort descending and take top 8
  const sorted = Object.entries(byCliente).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => +e[1].toFixed(2));

  const colors = getColors();
  const chart = createChart('chart-exportacion', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'TN Exportadas',
        data: values,
        backgroundColor: colors.azul.bg,
        borderColor: colors.azul.border,
        borderWidth: 2,
        borderRadius: 6
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      indexAxis: 'y',
      scales: {
        x: {
          ...getDefaultOptions('bar').scales.y,
          title: { display: true, text: 'TN', font: { size: 11 } }
        },
        y: {
          ...getDefaultOptions('bar').scales.x,
          ticks: { ...getDefaultOptions('bar').scales.x.ticks, font: { size: 10 } }
        }
      }
    }
  });
  if (chart) charts.push(chart);
}

// ════════════════════════════════════════════════════════
// 3. LABORATORIO - STOCK MICROBIOLOGIA
// ════════════════════════════════════════════════════════

function renderSecLaboratorio(container, consumos) {
  if (!consumos.length) {
    setKPI(container, 'mini-lab-critico', 'Critico: Sin datos');
    setKPI(container, 'mini-lab-bajo', 'Bajo: Sin datos');
    setKPI(container, 'mini-lab-ok', 'OK: Sin datos');
    showNoData(container, 'chart-lab-stock');
    return;
  }

  // Classify by stock field or quantity remaining
  let critico = 0, bajo = 0, ok = 0;
  try {
    consumos.forEach(r => {
      const stock = r.stock_actual ?? r.cantidad ?? 0;
      if (stock <= 5) critico++;
      else if (stock <= 20) bajo++;
      else ok++;
    });
  } catch (_) {
    // If columns don't exist, use length-based fallback
    ok = consumos.length;
  }

  setKPI(container, 'mini-lab-critico', 'Critico: ' + critico);
  setKPI(container, 'mini-lab-bajo', 'Bajo: ' + bajo);
  setKPI(container, 'mini-lab-ok', 'OK: ' + ok);

  const colors = getColors();
  const chart = createChart('chart-lab-stock', {
    type: 'doughnut',
    data: {
      labels: ['Critico', 'Bajo', 'OK'],
      datasets: [{
        data: [critico, bajo, ok],
        backgroundColor: [colors.rose.border, colors.amber.border, colors.verde.border],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, padding: 16 } }
      }
    }
  });
  if (chart) charts.push(chart);
}

// ════════════════════════════════════════════════════════
// 4. CERTIFICACIONES VIGENTES (static data)
// ════════════════════════════════════════════════════════

function renderSecCertificaciones(container) {
  const certData = { vigentes: 8, porVencer: 2, vencidas: 1 };

  setKPI(container, 'mini-cert-vigentes', 'Vigentes: ' + certData.vigentes);
  setKPI(container, 'mini-cert-vencer', 'Por vencer: ' + certData.porVencer);
  setKPI(container, 'mini-cert-vencidas', 'Vencidas: ' + certData.vencidas);

  const colors = getColors();
  const chart = createChart('chart-certificaciones', {
    type: 'doughnut',
    data: {
      labels: ['Vigentes', 'Por vencer', 'Vencidas'],
      datasets: [{
        data: [certData.vigentes, certData.porVencer, certData.vencidas],
        backgroundColor: [colors.verde.border, colors.amber.border, colors.rose.border],
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 11 }, padding: 16 } }
      }
    }
  });
  if (chart) charts.push(chart);
}

// ════════════════════════════════════════════════════════
// 5. CONSUMO CALIDAD - CAMPANA
// ════════════════════════════════════════════════════════

function renderSecConsumo(container, consumos) {
  if (!consumos.length) {
    setKPI(container, 'mini-cons-total', 'Total: Sin datos');
    setKPI(container, 'mini-cons-subgrupos', 'Subgrupos: 0');
    setKPI(container, 'mini-cons-centros', 'Centros: 0');
    showNoData(container, 'chart-consumo-calidad');
    return;
  }

  // Count unique subgrupos and centros
  const subgrupos = new Set();
  const centros = new Set();
  let totalCant = 0;

  consumos.forEach(r => {
    if (r.subgrupo) subgrupos.add(r.subgrupo);
    if (r.centro_costo) centros.add(r.centro_costo);
    totalCant += (r.cantidad || r.consumo || 0);
  });

  setKPI(container, 'mini-cons-total', 'Total: ' + fmt(totalCant));
  setKPI(container, 'mini-cons-subgrupos', 'Subgrupos: ' + subgrupos.size);
  setKPI(container, 'mini-cons-centros', 'Centros: ' + centros.size);

  // Group by month
  const byMonth = {};
  consumos.forEach(r => {
    const dateField = r.fecha || r.created_at || '';
    if (!dateField) return;
    const month = dateField.substring(0, 7); // YYYY-MM
    if (!byMonth[month]) byMonth[month] = 0;
    byMonth[month] += (r.cantidad || r.consumo || 0);
  });

  const sortedMonths = Object.keys(byMonth).sort();
  const monthLabels = sortedMonths.map(m => {
    const [y, mo] = m.split('-');
    const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    return names[parseInt(mo) - 1] + ' ' + y.slice(2);
  });
  const monthValues = sortedMonths.map(m => +byMonth[m].toFixed(2));

  const colors = getColors();
  const chart = createChart('chart-consumo-calidad', {
    type: 'line',
    data: {
      labels: monthLabels,
      datasets: [{
        label: 'Consumo',
        data: monthValues,
        borderColor: colors.purple.border,
        backgroundColor: colors.purple.bg,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: colors.purple.border
      }]
    },
    options: getDefaultOptions('line')
  });
  if (chart) charts.push(chart);
}

// ════════════════════════════════════════════════════════
// 6. ALERTAS TEMPERATURA (tabla)
// ════════════════════════════════════════════════════════

function renderTblAlertasTemp(container, alertas) {
  const tbody = container.querySelector('#tbl-alertas-temp tbody');
  if (!tbody) return;

  if (!alertas.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Sin alertas recientes</td></tr>';
    return;
  }

  tbody.innerHTML = alertas.map(r => {
    const temp = r.temperatura ?? 0;
    const hora = r.created_at ? formatHora(r.created_at) : '—';
    const area = r.area || 'Sin area';
    const isDanger = temp > -10;
    const badgeClass = isDanger ? 'badge-rose' : 'badge-amber';
    const estado = isDanger ? 'CRITICO' : 'ALERTA';

    return `<tr>
      <td>${hora}</td>
      <td>${area}</td>
      <td style="font-weight:700;color:${isDanger ? 'var(--danger)' : 'var(--amber)'}">${temp.toFixed(1)} °C</td>
      <td><span class="badge ${badgeClass}">${estado}</span></td>
    </tr>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// 7. CAMARA PRODUCTO TERMINADO
// ════════════════════════════════════════════════════════

function renderSecCamara(container, empaque) {
  if (!empaque.length) {
    setKPI(container, 'mini-cam-posiciones', 'Posiciones: 0');
    setKPI(container, 'mini-cam-cajas', 'Cajas: 0');
    setKPI(container, 'mini-cam-tn', 'TN: 0');
    showNoData(container, 'chart-camara');
    return;
  }

  const totalCajas = empaque.reduce((s, r) => s + (r.cajas || 0), 0);
  const totalKg = empaque.reduce((s, r) => s + (r.peso_neto_kg || 0), 0);
  const posiciones = empaque.length;

  setKPI(container, 'mini-cam-posiciones', 'Posiciones: ' + fmt(posiciones));
  setKPI(container, 'mini-cam-cajas', 'Cajas: ' + fmt(totalCajas));
  setKPI(container, 'mini-cam-tn', 'TN: ' + fmt(totalKg / 1000, 1));

  // Group by fruta
  const byFruta = {};
  empaque.forEach(r => {
    const f = capitalize(r.fruta || 'otros');
    if (!byFruta[f]) byFruta[f] = 0;
    byFruta[f] += (r.cajas || 0);
  });

  const labels = Object.keys(byFruta);
  const values = Object.values(byFruta);
  const bgColors = labels.map((_, i) => EXEC_COLORS[i % EXEC_COLORS.length] + '44');
  const borderColors = labels.map((_, i) => EXEC_COLORS[i % EXEC_COLORS.length]);

  const chart = createChart('chart-camara', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Cajas',
        data: values,
        backgroundColor: bgColors,
        borderColor: borderColors,
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: getDefaultOptions('bar')
  });
  if (chart) charts.push(chart);
}

// ════════════════════════════════════════════════════════
// 8. COSTOS DE ANALISIS
// ════════════════════════════════════════════════════════

function renderSecCostos(container, consumos) {
  if (!consumos.length) {
    setKPI(container, 'mini-cost-total', 'Total: Sin datos');
    setKPI(container, 'mini-cost-labs', 'Labs: 0');
    showNoData(container, 'chart-costos');
    return;
  }

  // Try to extract cost data
  let totalCosto = 0;
  const byGroup = {};
  const labs = new Set();

  try {
    consumos.forEach(r => {
      const costo = r.costo_total || r.precio_unitario || 0;
      totalCosto += costo;

      const group = r.subgrupo || r.laboratorio || 'General';
      if (!byGroup[group]) byGroup[group] = 0;
      byGroup[group] += costo;

      if (r.laboratorio) labs.add(r.laboratorio);
    });
  } catch (_) {
    // Columns might not exist
    setKPI(container, 'mini-cost-total', 'Total: Sin datos');
    setKPI(container, 'mini-cost-labs', 'Labs: 0');
    showNoData(container, 'chart-costos');
    return;
  }

  setKPI(container, 'mini-cost-total', 'Total: ' + fmtSoles(totalCosto));
  setKPI(container, 'mini-cost-labs', 'Labs: ' + (labs.size || Object.keys(byGroup).length));

  // Doughnut by group
  const sorted = Object.entries(byGroup)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  if (!sorted.length) {
    showNoData(container, 'chart-costos');
    return;
  }

  const labels = sorted.map(e => e[0]);
  const values = sorted.map(e => +e[1].toFixed(2));
  const bgColors = labels.map((_, i) => EXEC_COLORS[i % EXEC_COLORS.length]);

  const chart = createChart('chart-costos', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: bgColors,
        borderWidth: 0,
        hoverOffset: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'bottom', labels: { font: { size: 10 }, padding: 12 } },
        tooltip: {
          callbacks: {
            label: ctx => ctx.label + ': ' + fmtSoles(ctx.raw)
          }
        }
      }
    }
  });
  if (chart) charts.push(chart);
}

// ════════════════════════════════════════════════════════
// 9. TEMPERATURAS POR AREA - HOY (tabla)
// ════════════════════════════════════════════════════════

function renderTblTempAreas(container, temps) {
  const tbody = container.querySelector('#tbl-temp-areas tbody');
  if (!tbody) return;

  if (!temps.length) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted)">Sin registros hoy</td></tr>';
    return;
  }

  // Latest record per area
  const latestByArea = {};
  temps.forEach(r => {
    const area = r.area || 'Sin area';
    if (!latestByArea[area]) {
      latestByArea[area] = r;
    }
    // Already sorted desc by created_at, so first occurrence is latest
  });

  const rows = Object.entries(latestByArea).map(([area, r]) => {
    const temp = r.temperatura ?? 0;
    const hora = r.created_at ? formatHora(r.created_at) : '—';
    const isOk = temp <= TEMP_THRESHOLD;
    const badgeClass = isOk ? 'badge-verde' : 'badge-rose';
    const estado = isOk ? 'OK' : 'ALERTA';
    const tempColor = isOk ? 'var(--verde)' : 'var(--danger)';

    return `<tr>
      <td style="font-weight:600">${area}</td>
      <td style="font-weight:700;color:${tempColor}">${temp.toFixed(1)} °C</td>
      <td>${hora}</td>
      <td><span class="badge ${badgeClass}">${estado}</span></td>
    </tr>`;
  });

  tbody.innerHTML = rows.join('');
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════

function setKPI(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = typeof value === 'number' ? String(value) : value;
}

function capitalize(str) {
  if (!str) return '';
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function formatHora(isoStr) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Lima' });
  } catch (_) {
    return '—';
  }
}

function showNoData(container, canvasId) {
  const canvas = container.querySelector('#' + canvasId);
  if (canvas) {
    const wrapper = canvas.parentElement;
    if (wrapper) {
      wrapper.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:200px;color:var(--muted);font-size:13px">Sin datos disponibles</div>';
    }
  }
}
