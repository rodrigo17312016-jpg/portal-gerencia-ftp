/* Stock General */
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';
import { createExportButton } from '../../assets/js/utils/export-helpers.js';

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

  injectExportButton(container);
}

function injectExportButton(container) {
  if (container.querySelector('.ftp-export-btn')) return;
  const target = container.querySelector('.card-header')
    || container.querySelector('h2')?.parentElement;
  if (!target) return;

  const btn = createExportButton({
    getData: () => {
      // Extraer filas de la tabla renderizada (tbody > tr)
      const rows = Array.from(container.querySelectorAll('.data-table tbody tr'));
      return rows.map(tr => {
        const cells = tr.querySelectorAll('td');
        if (cells.length < 8) return null;
        return {
          producto: cells[0].textContent.trim(),
          planta: cells[1].textContent.trim(),
          presentacion: cells[2].textContent.trim(),
          tipo: cells[3].textContent.trim(),
          cliente: cells[4].textContent.trim(),
          cajas: cells[5].textContent.trim(),
          kg: cells[6].textContent.trim(),
          fcl: cells[7].textContent.trim()
        };
      }).filter(Boolean);
    },
    filename: 'stock-general',
    sheetName: 'Stock',
    columns: [
      { key: 'producto', label: 'Producto' },
      { key: 'planta', label: 'Planta' },
      { key: 'presentacion', label: 'Presentacion' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'cliente', label: 'Cliente' },
      { key: 'cajas', label: 'Cajas' },
      { key: 'kg', label: 'Kg' },
      { key: 'fcl', label: 'FCL' }
    ]
  });
  target.appendChild(btn);
}
