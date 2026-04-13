/* Consumos Calidad */
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

export async function init(container) {
  setVal(container, 'cKpiTotal', 'S/ 12,450');
  setVal(container, 'cKpiProductos', '28');
  setVal(container, 'cKpiSemanas', '13');
  setVal(container, 'cKpiTop', 'Hipoclorito Na');

  const colors = getColors();
  createChart('cChartSemana', {
    type: 'bar',
    data: { labels: ['S8','S9','S10','S11','S12','S13'], datasets: [{ label: 'Consumo S/', data: [1800,2100,1950,2300,2050,2250], backgroundColor: colors.azul.bg, borderColor: colors.azul.border, borderWidth: 2, borderRadius: 6 }] },
    options: getDefaultOptions('bar')
  });
  createChart('cChartTop', {
    type: 'bar',
    data: { labels: ['Hipoclorito','Detergente','Guantes','Alcohol','Bolsas'], datasets: [{ label: 'Unidades', data: [450,320,280,190,150], backgroundColor: [colors.verde.bg, colors.naranja.bg, colors.azul.bg, colors.purple.bg, colors.amber.bg], borderColor: [colors.verde.border, colors.naranja.border, colors.azul.border, colors.purple.border, colors.amber.border], borderWidth: 2, borderRadius: 6 }] },
    options: { ...getDefaultOptions('bar'), indexAxis: 'y' }
  });
}
function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
