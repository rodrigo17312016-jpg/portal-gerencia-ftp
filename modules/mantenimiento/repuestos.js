/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - INVENTARIO DE REPUESTOS
   Control de stock, entradas/salidas, alertas
   ════════════════════════════════════════════════════════ */

import { fmt, fmtSoles } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions, getTextColor } from '../../assets/js/utils/chart-helpers.js';
import { getMantData, saveMantData } from './data-mock.js';

let charts = [];
let state = {
  filterEstado: 'todos',
  filterCategoria: 'todas',
  search: '',
  modalTipo: null, // 'entrada' | 'salida'
  modalCodigo: null
};

// ════════════════════════════════════════════════════════
// INIT / REFRESH
// ════════════════════════════════════════════════════════
export async function init(container) {
  wireHeader(container);
  wireFilters(container);
  wireModal(container);
  await loadAll(container);
}

export function refresh() {
  destroyCharts();
  const c = document.getElementById('panel-repuestos-mant');
  if (c) loadAll(c);
}

function destroyCharts() {
  charts.forEach(c => { try { c.destroy(); } catch (_) {} });
  charts = [];
}

// ════════════════════════════════════════════════════════
// WIRING
// ════════════════════════════════════════════════════════
function wireHeader(container) {
  container.querySelector('#btn-nuevo-repuesto')?.addEventListener('click', () => {
    alert('Alta de nuevo repuesto: pendiente de implementar.');
  });
  container.querySelector('#btn-entrada-stock')?.addEventListener('click', () => openModal(container, 'entrada'));
  container.querySelector('#btn-salida-stock')?.addEventListener('click', () => openModal(container, 'salida'));
  container.querySelector('#btn-export-rep')?.addEventListener('click', () => exportCsv());
}

function wireFilters(container) {
  // Estado
  container.querySelectorAll('#rep-filter-estado .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('#rep-filter-estado .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filterEstado = chip.dataset.estado;
      renderTable(container);
    });
  });
  // Search
  const inp = container.querySelector('#rep-search');
  if (inp) {
    inp.addEventListener('input', () => {
      state.search = inp.value.trim().toLowerCase();
      renderTable(container);
    });
  }
}

function wireModal(container) {
  container.querySelector('#rep-modal-close')?.addEventListener('click', () => closeModal(container));
  container.querySelector('.rep-modal-backdrop')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#rep-mov-cancel')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#rep-mov-confirm')?.addEventListener('click', () => confirmMovimiento(container));

  // Refresh stock display al cambiar select / cantidad
  container.querySelector('#rep-mov-select')?.addEventListener('change', () => updateModalStockPreview(container));
  container.querySelector('#rep-mov-cantidad')?.addEventListener('input', () => updateModalStockPreview(container));
}

// ════════════════════════════════════════════════════════
// LOAD
// ════════════════════════════════════════════════════════
async function loadAll(container) {
  const data = getMantData();
  const reps = data.repuestos || [];

  renderKpis(container, reps);
  renderCategoriaFilter(container, reps);
  renderChartCategorias(container, reps);
  renderChartValor(container, reps);
  renderAlertas(container, reps);
  renderTable(container);
}

// ════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════
function stockEstado(r) {
  if (r.stock < r.minimo) return 'critico';
  if (r.stock <= r.minimo * 1.5) return 'bajo';
  return 'ok';
}

function estadoBadge(est) {
  if (est === 'critico') return '<span class="badge badge-rose">Crítico</span>';
  if (est === 'bajo') return '<span class="badge badge-amber">Bajo</span>';
  return '<span class="badge badge-verde">OK</span>';
}

// ════════════════════════════════════════════════════════
// KPIs
// ════════════════════════════════════════════════════════
function renderKpis(container, reps) {
  const total = reps.length;
  const critico = reps.filter(r => stockEstado(r) === 'critico').length;
  const bajo = reps.filter(r => stockEstado(r) === 'bajo').length;
  const valor = reps.reduce((s, r) => s + (r.stock * r.precio), 0);

  setText(container, 'kpi-rep-total', fmt(total));
  setText(container, 'kpi-rep-critico', fmt(critico));
  setText(container, 'kpi-rep-bajo', fmt(bajo));
  setText(container, 'kpi-rep-valor', fmtSoles(valor, 0));
}

function setText(container, id, v) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = v;
}

// ════════════════════════════════════════════════════════
// FILTRO CATEGORIAS
// ════════════════════════════════════════════════════════
function renderCategoriaFilter(container, reps) {
  const wrap = container.querySelector('#rep-filter-cat');
  if (!wrap) return;
  const cats = [...new Set(reps.map(r => r.categoria))].sort();
  wrap.innerHTML = `<div class="filter-chip ${state.filterCategoria === 'todas' ? 'active' : ''}" data-cat="todas">Todas categorías</div>` +
    cats.map(c => `<div class="filter-chip ${state.filterCategoria === c ? 'active' : ''}" data-cat="${c}">${c}</div>`).join('');

  wrap.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      wrap.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filterCategoria = chip.dataset.cat;
      renderTable(container);
    });
  });
}

// ════════════════════════════════════════════════════════
// CHARTS
// ════════════════════════════════════════════════════════
function renderChartCategorias(container, reps) {
  destroyCharts();
  const col = getColors();
  const counts = {};
  reps.forEach(r => { counts[r.categoria] = (counts[r.categoria] || 0) + 1; });
  const labels = Object.keys(counts);
  const values = Object.values(counts);
  const palette = [col.verde.border, col.azul.border, col.cyan.border, col.purple.border, col.amber.border, col.rose.border, col.naranja.border, '#64748b', '#10b981', '#f59e0b'];

  const ch = createChart('chart-rep-categorias', {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data: values,
        backgroundColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 3,
        borderColor: 'var(--surface)'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '62%',
      plugins: {
        legend: { display: true, position: 'right', labels: { color: getTextColor(), font: { size: 11 }, padding: 8, boxWidth: 12 } },
        tooltip: getDefaultOptions().plugins.tooltip
      }
    }
  });
  if (ch) charts.push(ch);
}

function renderChartValor(container, reps) {
  const col = getColors();
  const mapa = {};
  reps.forEach(r => {
    const k = r.categoria;
    if (!mapa[k]) mapa[k] = 0;
    mapa[k] += r.stock * r.precio;
  });
  const entries = Object.entries(mapa).sort((a, b) => b[1] - a[1]);
  const labels = entries.map(e => e[0]);
  const values = entries.map(e => e[1]);
  const palette = [col.verde.border, col.azul.border, col.cyan.border, col.purple.border, col.amber.border, col.rose.border, col.naranja.border];

  const ch = createChart('chart-rep-valor', {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Valor S/',
        data: values,
        backgroundColor: labels.map((_, i) => palette[i % palette.length] + '40'),
        borderColor: labels.map((_, i) => palette[i % palette.length]),
        borderWidth: 2,
        borderRadius: 8
      }]
    },
    options: {
      ...getDefaultOptions('bar'),
      indexAxis: 'y',
      plugins: {
        legend: { display: false },
        tooltip: {
          ...getDefaultOptions().plugins.tooltip,
          callbacks: { label: ctx => 'S/ ' + fmt(ctx.parsed.x, 0) }
        }
      }
    }
  });
  if (ch) charts.push(ch);
}

// ════════════════════════════════════════════════════════
// ALERTAS
// ════════════════════════════════════════════════════════
function renderAlertas(container, reps) {
  const wrap = container.querySelector('#rep-alertas-list');
  if (!wrap) return;

  const alertas = reps
    .filter(r => stockEstado(r) !== 'ok')
    .sort((a, b) => (a.stock - a.minimo) - (b.stock - b.minimo));

  if (!alertas.length) {
    wrap.innerHTML = `<div class="empty-state" style="padding:20px;text-align:center;color:var(--muted)">✅ Todos los repuestos tienen stock adecuado</div>`;
    return;
  }

  wrap.innerHTML = alertas.map(r => {
    const est = stockEstado(r);
    const clase = est === 'bajo' ? 'bajo' : '';
    return `<div class="rep-alerta-item ${clase}">
      <div class="rep-alerta-info">
        <div class="rep-alerta-title">${r.codigo} — ${r.nombre}</div>
        <div class="rep-alerta-meta">${r.categoria} · Ubicación ${r.ubicacion} · Stock <span class="rep-stock-label">${r.stock} ${r.unidad}</span> / Mín ${r.minimo} ${r.unidad}</div>
      </div>
      <button class="btn btn-primary btn-sm" data-generar-oc="${r.codigo}">Generar Orden de Compra</button>
    </div>`;
  }).join('');

  wrap.querySelectorAll('[data-generar-oc]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cod = btn.dataset.generarOc;
      alert('Se generaría una Orden de Compra para: ' + cod + '\n(Flujo pendiente: integrar con módulo Compras)');
    });
  });
}

// ════════════════════════════════════════════════════════
// TABLA
// ════════════════════════════════════════════════════════
function renderTable(container) {
  const tbody = container.querySelector('#rep-tbody');
  if (!tbody) return;
  const data = getMantData();
  let reps = data.repuestos || [];

  if (state.filterEstado !== 'todos') {
    reps = reps.filter(r => stockEstado(r) === state.filterEstado);
  }
  if (state.filterCategoria !== 'todas') {
    reps = reps.filter(r => r.categoria === state.filterCategoria);
  }
  if (state.search) {
    const q = state.search;
    reps = reps.filter(r => r.codigo.toLowerCase().includes(q) || r.nombre.toLowerCase().includes(q));
  }

  if (!reps.length) {
    tbody.innerHTML = `<tr><td colspan="11" style="text-align:center;color:var(--muted);padding:24px">No hay repuestos con los filtros aplicados</td></tr>`;
    return;
  }

  tbody.innerHTML = reps.map(r => {
    const est = stockEstado(r);
    const valor = r.stock * r.precio;
    return `<tr>
      <td><strong>${r.codigo}</strong></td>
      <td>${r.nombre}</td>
      <td>${r.categoria}</td>
      <td style="text-align:right"><strong style="color:${est === 'critico' ? 'var(--danger)' : est === 'bajo' ? 'var(--warn)' : 'var(--texto)'}">${fmt(r.stock)}</strong></td>
      <td style="text-align:right;color:var(--muted)">${fmt(r.minimo)}</td>
      <td>${r.unidad}</td>
      <td style="text-align:right">${fmtSoles(r.precio, 2)}</td>
      <td style="text-align:right"><strong>${fmtSoles(valor, 2)}</strong></td>
      <td><code style="font-size:11px;background:var(--surface2);padding:2px 6px;border-radius:4px">${r.ubicacion}</code></td>
      <td>${estadoBadge(est)}</td>
      <td style="white-space:nowrap">
        <button class="rep-accion-btn entrada" data-row-entrada="${r.codigo}" title="Entrada de stock">📥 Entrada</button>
        <button class="rep-accion-btn salida" data-row-salida="${r.codigo}" title="Salida de stock">📤 Salida</button>
      </td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('[data-row-entrada]').forEach(b => {
    b.addEventListener('click', () => openModal(container, 'entrada', b.dataset.rowEntrada));
  });
  tbody.querySelectorAll('[data-row-salida]').forEach(b => {
    b.addEventListener('click', () => openModal(container, 'salida', b.dataset.rowSalida));
  });
}

// ════════════════════════════════════════════════════════
// MODAL ENTRADA / SALIDA
// ════════════════════════════════════════════════════════
function openModal(container, tipo, codigo = null) {
  state.modalTipo = tipo;
  state.modalCodigo = codigo;

  const modal = container.querySelector('#rep-modal');
  const title = container.querySelector('#rep-modal-title');
  const select = container.querySelector('#rep-mov-select');
  const cantInp = container.querySelector('#rep-mov-cantidad');
  const motivoInp = container.querySelector('#rep-mov-motivo');

  if (title) title.textContent = (tipo === 'entrada' ? '📥 Entrada de Stock' : '📤 Salida de Stock');

  const data = getMantData();
  const reps = data.repuestos || [];
  if (select) {
    select.innerHTML = reps.map(r => `<option value="${r.codigo}" ${codigo === r.codigo ? 'selected' : ''}>${r.codigo} - ${r.nombre} (stock: ${r.stock} ${r.unidad})</option>`).join('');
  }
  if (cantInp) cantInp.value = 1;
  if (motivoInp) motivoInp.value = '';

  updateModalStockPreview(container);
  if (modal) modal.style.display = 'flex';
}

function closeModal(container) {
  const modal = container.querySelector('#rep-modal');
  if (modal) modal.style.display = 'none';
  state.modalTipo = null;
  state.modalCodigo = null;
}

function updateModalStockPreview(container) {
  const data = getMantData();
  const codigo = container.querySelector('#rep-mov-select')?.value;
  const cantidad = parseInt(container.querySelector('#rep-mov-cantidad')?.value || '0', 10) || 0;
  const rep = (data.repuestos || []).find(r => r.codigo === codigo);
  if (!rep) return;

  const actualEl = container.querySelector('#rep-mov-stock-actual');
  const nuevoEl = container.querySelector('#rep-mov-stock-nuevo');
  if (actualEl) actualEl.textContent = `${rep.stock} ${rep.unidad}`;

  let nuevo = rep.stock;
  if (state.modalTipo === 'entrada') nuevo = rep.stock + cantidad;
  else if (state.modalTipo === 'salida') nuevo = Math.max(0, rep.stock - cantidad);

  if (nuevoEl) {
    nuevoEl.textContent = `${nuevo} ${rep.unidad}`;
    nuevoEl.style.color = nuevo < rep.minimo ? 'var(--danger)' : nuevo <= rep.minimo * 1.5 ? 'var(--warn)' : 'var(--texto)';
  }
}

function confirmMovimiento(container) {
  const codigo = container.querySelector('#rep-mov-select')?.value;
  const cantidad = parseInt(container.querySelector('#rep-mov-cantidad')?.value || '0', 10) || 0;
  if (!codigo || cantidad <= 0) {
    alert('Debe seleccionar un repuesto y una cantidad mayor a 0.');
    return;
  }

  const data = getMantData();
  const rep = (data.repuestos || []).find(r => r.codigo === codigo);
  if (!rep) return;

  if (state.modalTipo === 'entrada') {
    rep.stock += cantidad;
  } else if (state.modalTipo === 'salida') {
    if (cantidad > rep.stock) {
      if (!confirm(`La salida (${cantidad}) supera el stock actual (${rep.stock}). ¿Continuar de todos modos?`)) return;
    }
    rep.stock = Math.max(0, rep.stock - cantidad);
  }

  saveMantData(data);
  closeModal(container);
  loadAll(container);
}

// ════════════════════════════════════════════════════════
// EXPORT CSV
// ════════════════════════════════════════════════════════
function exportCsv() {
  const data = getMantData();
  const reps = data.repuestos || [];
  const head = ['Codigo', 'Nombre', 'Categoria', 'Stock', 'Minimo', 'Unidad', 'Precio', 'Valor', 'Ubicacion', 'Estado'];
  const rows = reps.map(r => {
    const valor = r.stock * r.precio;
    return [r.codigo, r.nombre, r.categoria, r.stock, r.minimo, r.unidad, r.precio.toFixed(2), valor.toFixed(2), r.ubicacion, stockEstado(r)];
  });
  const csv = [head, ...rows].map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `repuestos_${new Date().toISOString().substring(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 0);
}
