/* Stock General */
import { createChart, getColors, getDefaultOptions } from '/assets/js/utils/chart-helpers.js';

export async function init(container) {
  const colors = getColors();

  createChart('chartStockProducto', {
    type: 'doughnut',
    data: {
      labels: ['Mango', 'Arandano', 'Fresa', 'Granada'],
      datasets: [{
        data: [128960, 20640, 112810, 9610],
        backgroundColor: ['#f59e0b', '#6366f1', '#e11d48', '#dc2626'],
        borderWidth: 2, borderColor: 'var(--surface)'
      }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 11 } } } } }
  });

  createChart('chartStockPlanta', {
    type: 'bar',
    data: {
      labels: ['FTP', 'AGROEMPAQUES', 'RANSA'],
      datasets: [{
        label: 'Kg',
        data: [159210, 63723, 49087],
        backgroundColor: [colors.verde.bg, colors.naranja.bg, colors.azul.bg],
        borderColor: [colors.verde.border, colors.naranja.border, colors.azul.border],
        borderWidth: 2, borderRadius: 8
      }]
    },
    options: getDefaultOptions('bar')
  });
}
