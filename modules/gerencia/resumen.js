/* ════════════════════════════════════════════════════════
   RESUMEN EJECUTIVO - Panel principal de gerencia
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { FRUTAS, TIMEZONE } from '../../assets/js/config/constants.js';
import { fmt, fmtPct, today, currentTurno } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

let charts = [];

export async function init(container) {
  // Turno actual
  const turnoEl = container.querySelector('#resumen-turno');
  if (turnoEl) {
    const turno = currentTurno();
    turnoEl.textContent = turno === 'DIA' ? '☀️ Turno Dia' : '🌙 Turno Noche';
  }

  // Cargar datos
  await Promise.all([
    loadKPIs(container),
    loadCharts(container)
  ]);
}

async function loadKPIs(container) {
  const hoy = today();

  try {
    // Produccion del dia
    const { data: prodData } = await supabase
      .from('registro_produccion')
      .select('consumo_mp, producto_terminado, personal')
      .eq('fecha', hoy);

    if (prodData && prodData.length > 0) {
      const totalPT = prodData.reduce((s, r) => s + (r.producto_terminado || 0), 0);
      const totalMP = prodData.reduce((s, r) => s + (r.consumo_mp || 0), 0);
      const totalPers = prodData.reduce((s, r) => s + (r.personal || 0), 0);
      const rend = totalMP > 0 ? (totalPT / totalMP * 100) : 0;

      setKPI(container, 'kpi-produccion-total', fmt(totalPT) + ' kg');
      setKPI(container, 'kpi-produccion-change', '▲ Producto terminado hoy');
      setKPI(container, 'kpi-rendimiento', fmtPct(rend));
      setKPI(container, 'kpi-rendimiento-change', fmt(totalMP) + ' kg MP consumida');
      setKPI(container, 'kpi-personal', fmt(totalPers));
      setKPI(container, 'kpi-personal-areas', 'Total personal hoy');
    } else {
      setKPI(container, 'kpi-produccion-total', '0 kg');
      setKPI(container, 'kpi-produccion-change', 'Sin datos para hoy');
      setKPI(container, 'kpi-rendimiento', '0%');
      setKPI(container, 'kpi-rendimiento-change', 'Sin datos');
      setKPI(container, 'kpi-personal', '0');
      setKPI(container, 'kpi-personal-areas', 'Sin datos');
    }

    // Temperaturas
    const { data: tempData } = await supabase
      .from('registros_temperatura')
      .select('temperatura, zona')
      .order('created_at', { ascending: false })
      .limit(10);

    if (tempData && tempData.length > 0) {
      const avgTemp = tempData.reduce((s, r) => s + (r.temperatura || 0), 0) / tempData.length;
      setKPI(container, 'kpi-temperaturas', avgTemp.toFixed(1) + ' °C');
      const alertas = tempData.filter(r => r.temperatura > -15).length;
      setKPI(container, 'kpi-temp-status', alertas > 0 ? `⚠️ ${alertas} alertas` : '✅ Normal');
    } else {
      setKPI(container, 'kpi-temperaturas', '— °C');
      setKPI(container, 'kpi-temp-status', 'Sin datos');
    }
  } catch (err) {
    console.error('Error cargando KPIs:', err);
    setKPI(container, 'kpi-produccion-total', 'Error');
    setKPI(container, 'kpi-produccion-change', 'Sin conexion');
  }
}

async function loadCharts(container) {
  const colors = getColors();

  // Chart: Produccion por fruta
  const frutaChart = createChart('chart-produccion-fruta', {
    type: 'bar',
    data: {
      labels: Object.values(FRUTAS).map(f => f.emoji + ' ' + f.label),
      datasets: [{
        label: 'Kg producidos',
        data: [0, 0, 0, 0, 0, 0],
        backgroundColor: [
          colors.amber.bg, colors.purple.bg, colors.rose.bg,
          colors.rose.bg, colors.verde.bg, colors.amber.bg
        ],
        borderColor: [
          colors.amber.border, colors.purple.border, colors.rose.border,
          colors.rose.border, colors.verde.border, colors.amber.border
        ],
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: getDefaultOptions('bar')
  });

  // Chart: Rendimiento diario
  const rendChart = createChart('chart-rendimiento-diario', {
    type: 'line',
    data: {
      labels: ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
      datasets: [{
        label: 'Rendimiento %',
        data: [0, 0, 0, 0, 0, 0, 0],
        borderColor: colors.verde.border,
        backgroundColor: colors.verde.bg,
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: colors.verde.border
      }]
    },
    options: getDefaultOptions('line')
  });

  charts = [frutaChart, rendChart].filter(Boolean);
  window.__activeCharts = charts;

  // Cargar datos reales
  try {
    const hoy = today();
    const { data } = await supabase
      .from('registro_produccion')
      .select('fruta, producto_terminado, consumo_mp, fecha')
      .gte('fecha', getWeekAgo());

    if (data && data.length > 0) {
      // Produccion por fruta
      const frutaKeys = Object.keys(FRUTAS);
      const frutaTotals = frutaKeys.map(key =>
        data.filter(r => (r.fruta || '').toLowerCase() === key)
          .reduce((s, r) => s + (r.producto_terminado || 0), 0)
      );

      if (frutaChart) {
        frutaChart.data.datasets[0].data = frutaTotals;
        frutaChart.update();
      }

      // Rendimiento por dia
      const dias = getLast7Days();
      const rendData = dias.map(dia => {
        const dayRecords = data.filter(r => r.fecha === dia);
        const mp = dayRecords.reduce((s, r) => s + (r.consumo_mp || 0), 0);
        const pt = dayRecords.reduce((s, r) => s + (r.producto_terminado || 0), 0);
        return mp > 0 ? (pt / mp * 100) : 0;
      });

      if (rendChart) {
        rendChart.data.labels = dias.map(d => {
          const dt = new Date(d + 'T00:00:00');
          return dt.toLocaleDateString('es-PE', { weekday: 'short' });
        });
        rendChart.data.datasets[0].data = rendData;
        rendChart.update();
      }
    }
  } catch (err) {
    console.error('Error cargando charts:', err);
  }
}

function setKPI(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = value;
}

function getWeekAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
}

function getLast7Days() {
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }));
  }
  return days;
}

export function refresh() {
  const container = document.getElementById('panel-resumen');
  if (container) loadKPIs(container);
}
