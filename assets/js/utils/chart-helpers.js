/* ════════════════════════════════════════════════════════
   CHART HELPERS - Chart.js Defaults & Utilities
   ════════════════════════════════════════════════════════ */

// Paleta de colores consistente
export const CHART_COLORS = {
  verde:   { bg: 'rgba(22,163,74,0.15)', border: '#16a34a' },
  naranja: { bg: 'rgba(234,88,12,0.15)', border: '#ea580c' },
  azul:    { bg: 'rgba(37,99,235,0.15)', border: '#2563eb' },
  cyan:    { bg: 'rgba(8,145,178,0.15)', border: '#0891b2' },
  purple:  { bg: 'rgba(124,58,237,0.15)', border: '#7c3aed' },
  amber:   { bg: 'rgba(217,119,6,0.15)', border: '#d97706' },
  rose:    { bg: 'rgba(225,29,72,0.15)', border: '#e11d48' }
};

// Paleta dark mode
export const CHART_COLORS_DARK = {
  verde:   { bg: 'rgba(34,197,94,0.2)', border: '#22c55e' },
  naranja: { bg: 'rgba(249,115,22,0.2)', border: '#f97316' },
  azul:    { bg: 'rgba(59,130,246,0.2)', border: '#3b82f6' },
  cyan:    { bg: 'rgba(34,211,238,0.2)', border: '#22d3ee' },
  purple:  { bg: 'rgba(167,139,250,0.2)', border: '#a78bfa' },
  amber:   { bg: 'rgba(251,191,36,0.2)', border: '#fbbf24' },
  rose:    { bg: 'rgba(251,113,133,0.2)', border: '#fb7185' }
};

// Obtener paleta segun tema
export function getColors() {
  return document.body.classList.contains('dark-mode') ? CHART_COLORS_DARK : CHART_COLORS;
}

// Color de texto segun tema
export function getTextColor() {
  return document.body.classList.contains('dark-mode') ? '#94a3b8' : '#64748b';
}

export function getGridColor() {
  return document.body.classList.contains('dark-mode') ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
}

// Configuracion base para Chart.js
export function getDefaultOptions(type = 'bar') {
  const textColor = getTextColor();
  const gridColor = getGridColor();

  const base = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false,
        labels: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 11 } }
      },
      tooltip: {
        backgroundColor: 'rgba(15,23,42,0.9)',
        titleFont: { family: 'Plus Jakarta Sans', size: 12, weight: '600' },
        bodyFont: { family: 'Plus Jakarta Sans', size: 11 },
        padding: 12,
        cornerRadius: 10,
        displayColors: true,
        boxPadding: 4
      }
    },
    scales: {}
  };

  if (type === 'bar' || type === 'line') {
    base.scales = {
      x: {
        ticks: { color: textColor, font: { size: 11 } },
        grid: { color: gridColor }
      },
      y: {
        ticks: { color: textColor, font: { size: 11 } },
        grid: { color: gridColor },
        beginAtZero: true
      }
    };
  }

  return base;
}

// Registry global de charts activos (para theme toggle y cleanup)
if (!window.__activeCharts) window.__activeCharts = new Set();

// Destruir chart existente y crear uno nuevo
export function createChart(canvasId, config) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return null;

  // Destruir chart anterior si existe (y des-registrarlo)
  const existing = Chart.getChart(canvas);
  if (existing) {
    window.__activeCharts.delete(existing);
    existing.destroy();
  }

  const chart = new Chart(canvas, config);
  window.__activeCharts.add(chart);
  return chart;
}

// Destruir todos los charts dentro de un elemento DOM (para cleanup de paneles)
export function destroyChartsIn(rootEl) {
  if (!rootEl) return 0;
  let count = 0;
  rootEl.querySelectorAll('canvas').forEach(canvas => {
    const chart = Chart.getChart(canvas);
    if (chart) {
      window.__activeCharts.delete(chart);
      chart.destroy();
      count++;
    }
  });
  return count;
}

// Actualizar colores de todos los charts al cambiar tema
// Si no se pasa array, usa el registry global
export function updateChartsTheme(charts) {
  const list = charts || Array.from(window.__activeCharts);
  const textColor = getTextColor();
  const gridColor = getGridColor();

  list.forEach(chart => {
    if (!chart) return;

    // Actualizar scales
    if (chart.options.scales) {
      Object.values(chart.options.scales).forEach(scale => {
        if (scale.ticks) scale.ticks.color = textColor;
        if (scale.grid) scale.grid.color = gridColor;
      });
    }

    // Actualizar legend
    if (chart.options.plugins?.legend?.labels) {
      chart.options.plugins.legend.labels.color = textColor;
    }

    chart.update('none');
  });
}
