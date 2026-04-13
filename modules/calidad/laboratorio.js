/* Laboratorio */
import { createChart, getColors } from '../../assets/js/utils/chart-helpers.js';

export async function init(container) {
  const colors = getColors();
  createChart('lmChartSemaforo', {
    type: 'doughnut',
    data: {
      labels: ['Critico', 'Bajo', 'OK'],
      datasets: [{ data: [4, 8, 18], backgroundColor: ['#dc2626', '#d97706', '#16a34a'], borderWidth: 2, borderColor: 'var(--surface)' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: '#64748b', font: { size: 12 } } } } }
  });
}
