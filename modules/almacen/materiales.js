/* Materiales - Inventario de suministros */
import { createExportButton } from '../../assets/js/utils/export-helpers.js';

const MATERIALES = [
  { id: 1, nombre: 'Bolsas PE 10kg', und: 'UND', stock: 12500, consumo: 8000, estado: 'ok' },
  { id: 2, nombre: 'Cajas carton corrugado', und: 'UND', stock: 3200, consumo: 4500, estado: 'bajo' },
  { id: 3, nombre: 'Etiquetas adhesivas', und: 'UND', stock: 45000, consumo: 15000, estado: 'ok' },
  { id: 4, nombre: 'Cinta embalaje', und: 'UND', stock: 180, consumo: 300, estado: 'bajo' },
  { id: 5, nombre: 'Guantes nitrilo L', und: 'UND', stock: 50, consumo: 500, estado: 'critico' },
  { id: 6, nombre: 'Mandiles descartables', und: 'UND', stock: 200, consumo: 600, estado: 'bajo' },
  { id: 7, nombre: 'Hipoclorito de sodio', und: 'LT', stock: 350, consumo: 200, estado: 'ok' },
  { id: 8, nombre: 'Detergente industrial', und: 'KG', stock: 80, consumo: 120, estado: 'bajo' },
  { id: 9, nombre: 'Alcohol gel', und: 'LT', stock: 15, consumo: 60, estado: 'critico' },
  { id: 10, nombre: 'Film stretch', und: 'UND', stock: 45, consumo: 30, estado: 'ok' },
  { id: 11, nombre: 'Bandejas aluminio', und: 'UND', stock: 8000, consumo: 5000, estado: 'ok' },
  { id: 12, nombre: 'Bolsas vacio 5kg', und: 'UND', stock: 2000, consumo: 3000, estado: 'bajo' },
];

let currentFilter = 'all';

export async function init(container) {
  const critico = MATERIALES.filter(m => m.estado === 'critico').length;
  const bajo = MATERIALES.filter(m => m.estado === 'bajo').length;
  const ok = MATERIALES.filter(m => m.estado === 'ok').length;

  setVal(container, 'matTotal', MATERIALES.length.toString());
  setVal(container, 'matCritico', critico.toString());
  setVal(container, 'matBajo', bajo.toString());
  setVal(container, 'matOk', ok.toString());

  renderTable(container, MATERIALES);

  // Filters
  container.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      const f = chip.dataset.filter;
      currentFilter = f;
      const filtered = f === 'all' ? MATERIALES : MATERIALES.filter(m => m.estado === f);
      renderTable(container, filtered);
    });
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
      const data = currentFilter === 'all' ? MATERIALES : MATERIALES.filter(m => m.estado === currentFilter);
      return data.map(m => {
        const dias = m.consumo > 0 ? Math.round(m.stock / m.consumo * 30) : 999;
        return {
          id: m.id,
          nombre: m.nombre,
          unidad: m.und,
          stock: m.stock,
          consumo_mensual: m.consumo,
          dias_restantes: dias,
          estado: m.estado
        };
      });
    },
    filename: 'materiales',
    sheetName: 'Materiales',
    columns: [
      { key: 'id', label: 'ID' },
      { key: 'nombre', label: 'Material' },
      { key: 'unidad', label: 'Unidad' },
      { key: 'stock', label: 'Stock' },
      { key: 'consumo_mensual', label: 'Consumo Mensual' },
      { key: 'dias_restantes', label: 'Dias Restantes' },
      { key: 'estado', label: 'Estado' }
    ]
  });
  target.appendChild(btn);
}

function renderTable(container, data) {
  const tbody = container.querySelector('#matTabla');
  if (!tbody) return;
  tbody.innerHTML = data.map((m, i) => {
    const dias = m.consumo > 0 ? Math.round(m.stock / m.consumo * 30) : 999;
    const badgeClass = m.estado === 'critico' ? 'danger' : m.estado === 'bajo' ? 'warn' : 'verde';
    const badgeLabel = m.estado === 'critico' ? '🚨 Critico' : m.estado === 'bajo' ? '⚠ Bajo' : '✓ OK';
    return `<tr>
      <td>${m.id}</td><td style="font-weight:600">${m.nombre}</td><td>${m.und}</td>
      <td style="font-family:monospace;font-weight:700">${m.stock.toLocaleString()}</td>
      <td style="font-family:monospace">${m.consumo.toLocaleString()}</td>
      <td style="font-weight:700;color:var(--${badgeClass})">${dias} dias</td>
      <td><span class="badge badge-${badgeClass}">${badgeLabel}</span></td>
    </tr>`;
  }).join('');
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
