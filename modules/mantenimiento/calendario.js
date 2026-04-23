/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - CALENDARIO
   Vista mensual combinada de rutinas + ordenes
   ════════════════════════════════════════════════════════ */

import { fmt, fmtDate } from '../../assets/js/utils/formatters.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';
import { getMantData } from './data-mock.js';

let state = {
  year: 0,
  month: 0,       // 0-11
  vista: 'mes',   // 'mes' | 'semana'
  filterTipo: 'todos',
  dayDetail: null
};

// Colores por tipo
const TIPO_COLOR = {
  preventivo:  '#16a34a',  // verde
  correctivo:  '#e11d48',  // rose
  predictivo:  '#7c3aed',  // purple
  lubricacion: '#d97706'   // amber
};

const TIPO_ICON = {
  preventivo:  '🗓️',
  correctivo:  '🔨',
  predictivo:  '📡',
  lubricacion: '🛢️'
};

// ════════════════════════════════════════════════════════
// INIT / REFRESH
// ════════════════════════════════════════════════════════
export async function init(container) {
  const now = new Date();
  state.year = now.getFullYear();
  state.month = now.getMonth();

  wireHeader(container);
  wireFilters(container);
  wireDetail(container);

  render(container);
}

export function refresh() {
  const c = document.getElementById('panel-calendario-mant');
  if (c) render(c);
}

// ════════════════════════════════════════════════════════
// WIRING
// ════════════════════════════════════════════════════════
function wireHeader(container) {
  container.querySelector('#cal-prev')?.addEventListener('click', () => {
    state.month--;
    if (state.month < 0) { state.month = 11; state.year--; }
    render(container);
  });
  container.querySelector('#cal-next')?.addEventListener('click', () => {
    state.month++;
    if (state.month > 11) { state.month = 0; state.year++; }
    render(container);
  });
  container.querySelector('#cal-hoy')?.addEventListener('click', () => {
    const n = new Date();
    state.year = n.getFullYear();
    state.month = n.getMonth();
    render(container);
  });
  container.querySelector('#cal-filtros-btn')?.addEventListener('click', () => {
    alert('Filtros avanzados: pendiente de implementar.');
  });

  // Vista
  container.querySelectorAll('#cal-vista .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('#cal-vista .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.vista = chip.dataset.vista;
      render(container);
    });
  });
}

function wireFilters(container) {
  container.querySelectorAll('#cal-filter-tipo .filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      container.querySelectorAll('#cal-filter-tipo .filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      state.filterTipo = chip.dataset.tipo;
      render(container);
    });
  });
}

function wireDetail(container) {
  container.querySelector('#cal-detail-close')?.addEventListener('click', () => closeDetail(container));
  container.querySelector('.cal-detail-backdrop')?.addEventListener('click', () => closeDetail(container));
}

// ════════════════════════════════════════════════════════
// EVENTOS
// ════════════════════════════════════════════════════════
function buildEvents() {
  const data = getMantData();
  const eventos = [];

  // Rutinas preventivas - usan proxima fecha
  (data.rutinas || []).forEach(r => {
    eventos.push({
      id: r.id,
      fecha: r.proxima,
      tipo: 'preventivo',
      titulo: r.equipoNombre,
      descripcion: r.descripcion,
      area: r.area,
      frecuencia: r.frecuencia,
      duracion: r.duracion,
      estado: r.estado === 'vencida' ? 'pendiente' : r.estado === 'proxima' ? 'pendiente' : 'pendiente',
      tecnico: null
    });
  });

  // Lubricacion (si existe en data)
  (data.lubricacion || []).forEach(l => {
    eventos.push({
      id: l.id,
      fecha: l.proximaFecha,
      tipo: 'lubricacion',
      titulo: l.equipoNombre,
      descripcion: `${l.puntoLubricacion} · ${l.lubricante}`,
      area: l.area,
      frecuencia: l.frecuencia,
      cantidad: `${l.cantidad} ${l.unidad}`,
      estado: l.estado === 'vencido' || l.estado === 'proximo' ? 'pendiente' : 'pendiente',
      tecnico: null
    });
  });

  // Ordenes de trabajo
  (data.ordenes || []).forEach(o => {
    let tipo = o.tipo;
    // Mapeo estado a calendario: abierta/pausada -> pendiente; ejecucion -> proceso; completada -> completado
    const estado = o.estado === 'completada' ? 'completado' :
                   o.estado === 'ejecucion' ? 'proceso' : 'pendiente';
    eventos.push({
      id: o.codigo,
      fecha: o.fecha,
      tipo,
      titulo: o.equipo,
      descripcion: o.descripcion,
      area: o.area,
      prioridad: o.prioridad,
      estado,
      tecnico: o.tecnico,
      codigo: o.codigo
    });
  });

  return eventos;
}

function filterEvents(eventos) {
  if (state.filterTipo === 'todos') return eventos;
  return eventos.filter(e => e.tipo === state.filterTipo);
}

function eventsOfDay(eventos, year, month, day) {
  const pad = (n) => String(n).padStart(2, '0');
  const target = `${year}-${pad(month + 1)}-${pad(day)}`;
  return eventos.filter(e => e.fecha === target);
}

// ════════════════════════════════════════════════════════
// RENDER PRINCIPAL
// ════════════════════════════════════════════════════════
function render(container) {
  const mesLabel = new Date(state.year, state.month, 1)
    .toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
  const lbl = container.querySelector('#cal-mes-label');
  if (lbl) lbl.textContent = mesLabel;

  const eventos = filterEvents(buildEvents());

  renderKpis(container, eventos);

  if (state.vista === 'mes') renderGridMes(container, eventos);
  else renderGridSemana(container, eventos);

  renderTimeline(container, eventos);
}

// ════════════════════════════════════════════════════════
// KPIs (eventos del mes actual)
// ════════════════════════════════════════════════════════
function renderKpis(container, eventos) {
  const mesEvs = eventos.filter(e => {
    if (!e.fecha) return false;
    const d = new Date(e.fecha + 'T00:00:00');
    return d.getFullYear() === state.year && d.getMonth() === state.month;
  });
  const total = mesEvs.length;
  const pend = mesEvs.filter(e => e.estado === 'pendiente').length;
  const proc = mesEvs.filter(e => e.estado === 'proceso').length;
  const comp = mesEvs.filter(e => e.estado === 'completado').length;
  setText(container, 'kpi-cal-total', fmt(total));
  setText(container, 'kpi-cal-pendientes', fmt(pend));
  setText(container, 'kpi-cal-proceso', fmt(proc));
  setText(container, 'kpi-cal-completados', fmt(comp));
}

function setText(container, id, v) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = v;
}

// ════════════════════════════════════════════════════════
// GRID MES
// ════════════════════════════════════════════════════════
function renderGridMes(container, eventos) {
  const grid = container.querySelector('#cal-grid');
  if (!grid) return;

  const year = state.year;
  const month = state.month;
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Lunes = 0 ... Domingo = 6
  const startDow = (first.getDay() + 6) % 7;

  const totalCells = Math.ceil((daysInMonth + startDow) / 7) * 7;
  const hoy = new Date();
  const hoyY = hoy.getFullYear(), hoyM = hoy.getMonth(), hoyD = hoy.getDate();

  let html = '';
  for (let i = 0; i < totalCells; i++) {
    const dayNum = i - startDow + 1;
    const inMonth = dayNum >= 1 && dayNum <= daysInMonth;

    let y = year, m = month, d = dayNum;
    if (!inMonth) {
      if (dayNum < 1) {
        const prev = new Date(year, month, 0);
        y = prev.getFullYear(); m = prev.getMonth();
        d = prev.getDate() + dayNum;
      } else {
        const next = new Date(year, month + 1, 1);
        y = next.getFullYear(); m = next.getMonth();
        d = dayNum - daysInMonth;
      }
    }

    const isHoy = y === hoyY && m === hoyM && d === hoyD;
    const dayEvs = eventsOfDay(eventos, y, m, d);
    const extra = dayEvs.length > 3 ? dayEvs.length - 3 : 0;
    const showEvs = dayEvs.slice(0, 3);

    const evHtml = showEvs.map(e => {
      const color = TIPO_COLOR[e.tipo] || '#64748b';
      const icon = TIPO_ICON[e.tipo] || '•';
      return `<div class="cal-day-ev" style="border-left-color:${color}" title="${escapeHtml(e.titulo)} - ${escapeHtml(e.descripcion || '')}">${icon} ${escapeHtml(truncate(e.titulo, 22))}</div>`;
    }).join('');

    const moreHtml = extra > 0 ? `<div class="cal-day-more">+ ${extra} más</div>` : '';

    html += `<div class="cal-day ${inMonth ? '' : 'otro-mes'} ${isHoy ? 'hoy' : ''}" data-day="${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}">
      <span class="cal-day-num">${d}</span>
      ${evHtml}
      ${moreHtml}
    </div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day').forEach(cell => {
    cell.addEventListener('click', () => openDetail(container, cell.dataset.day, eventos));
  });
}

// ════════════════════════════════════════════════════════
// GRID SEMANA (vista compacta - semana que contiene el dia 15)
// ════════════════════════════════════════════════════════
function renderGridSemana(container, eventos) {
  const grid = container.querySelector('#cal-grid');
  if (!grid) return;

  // Semana que contiene hoy si el mes es el actual, o el dia 1
  const today = new Date();
  let base;
  if (today.getFullYear() === state.year && today.getMonth() === state.month) {
    base = new Date(state.year, state.month, today.getDate());
  } else {
    base = new Date(state.year, state.month, 1);
  }
  // Lunes de la semana
  const dow = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - dow);

  const hoy = new Date();
  const hoyY = hoy.getFullYear(), hoyM = hoy.getMonth(), hoyD = hoy.getDate();

  let html = '';
  for (let i = 0; i < 7; i++) {
    const cur = new Date(base);
    cur.setDate(base.getDate() + i);
    const y = cur.getFullYear(), m = cur.getMonth(), d = cur.getDate();
    const isHoy = y === hoyY && m === hoyM && d === hoyD;
    const inMonth = m === state.month;

    const dayEvs = eventsOfDay(eventos, y, m, d);
    const extra = dayEvs.length > 8 ? dayEvs.length - 8 : 0;
    const showEvs = dayEvs.slice(0, 8);

    const evHtml = showEvs.map(e => {
      const color = TIPO_COLOR[e.tipo] || '#64748b';
      const icon = TIPO_ICON[e.tipo] || '•';
      return `<div class="cal-day-ev" style="border-left-color:${color}" title="${escapeHtml(e.titulo)}">${icon} ${escapeHtml(truncate(e.titulo, 26))}</div>`;
    }).join('');

    const moreHtml = extra > 0 ? `<div class="cal-day-more">+ ${extra} más</div>` : '';

    html += `<div class="cal-day ${inMonth ? '' : 'otro-mes'} ${isHoy ? 'hoy' : ''}" style="min-height:240px" data-day="${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}">
      <span class="cal-day-num">${d}</span>
      ${evHtml}
      ${moreHtml}
    </div>`;
  }

  grid.innerHTML = html;

  grid.querySelectorAll('.cal-day').forEach(cell => {
    cell.addEventListener('click', () => openDetail(container, cell.dataset.day, eventos));
  });
}

// ════════════════════════════════════════════════════════
// TIMELINE LATERAL - PROXIMOS 7 DIAS
// ════════════════════════════════════════════════════════
function renderTimeline(container, eventos) {
  const wrap = container.querySelector('#cal-timeline');
  if (!wrap) return;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fin = new Date(hoy);
  fin.setDate(fin.getDate() + 7);

  const prox = eventos
    .filter(e => {
      if (!e.fecha) return false;
      const d = new Date(e.fecha + 'T00:00:00');
      return d >= hoy && d <= fin;
    })
    .sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
    .slice(0, 15);

  if (!prox.length) {
    wrap.innerHTML = `<div class="empty-state" style="text-align:center;color:var(--muted);padding:24px">Sin eventos próximos</div>`;
    return;
  }

  wrap.innerHTML = prox.map(e => {
    const d = new Date(e.fecha + 'T00:00:00');
    const mes = d.toLocaleDateString('es-PE', { month: 'short' }).replace('.', '');
    const color = TIPO_COLOR[e.tipo] || '#64748b';
    const icon = TIPO_ICON[e.tipo] || '•';
    return `<div class="cal-tl-item" style="border-left-color:${color}">
      <div class="cal-tl-date">
        <div class="cal-tl-dia">${d.getDate()}</div>
        <div class="cal-tl-mes">${mes}</div>
      </div>
      <div class="cal-tl-body">
        <div class="cal-tl-title">${icon} ${escapeHtml(e.titulo)}</div>
        <div class="cal-tl-meta">${escapeHtml(e.area || '—')} · ${capitalize(escapeHtml(e.tipo))}</div>
      </div>
    </div>`;
  }).join('');
}

// ════════════════════════════════════════════════════════
// DETAIL - PANEL LATERAL
// ════════════════════════════════════════════════════════
function openDetail(container, fecha, eventos) {
  state.dayDetail = fecha;
  const [y, m, d] = fecha.split('-').map(Number);
  const evs = eventsOfDay(eventos, y, m - 1, d);

  const title = container.querySelector('#cal-detail-title');
  const sub = container.querySelector('#cal-detail-sub');
  const body = container.querySelector('#cal-detail-body');

  const dateObj = new Date(y, m - 1, d);
  if (title) title.textContent = dateObj.toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' });
  if (sub) sub.textContent = `${evs.length} evento${evs.length === 1 ? '' : 's'}`;

  if (body) {
    if (!evs.length) {
      body.innerHTML = `<div class="empty-state" style="text-align:center;color:var(--muted);padding:20px">Sin eventos programados</div>`;
    } else {
      body.innerHTML = evs.map(e => {
        const color = TIPO_COLOR[e.tipo] || '#64748b';
        const icon = TIPO_ICON[e.tipo] || '•';
        const estadoBadge = {
          'pendiente': '<span class="badge badge-amber">Pendiente</span>',
          'proceso': '<span class="badge badge-cyan">En Proceso</span>',
          'completado': '<span class="badge badge-verde">Completado</span>'
        }[e.estado] || '';
        const prioBadge = e.prioridad ? {
          'alta': '<span class="badge badge-rose">Prioridad Alta</span>',
          'media': '<span class="badge badge-amber">Prioridad Media</span>',
          'baja': '<span class="badge badge-verde">Prioridad Baja</span>'
        }[e.prioridad] || '' : '';
        const codigo = e.codigo ? `<span class="badge badge-azul">${escapeHtml(e.codigo)}</span>` : '';
        const tec = e.tecnico ? `<span class="badge badge-purple">👷 ${escapeHtml(e.tecnico)}</span>` : '';
        const area = e.area ? `<span class="badge badge-cyan">${escapeHtml(e.area)}</span>` : '';
        const cantidad = e.cantidad ? `<span class="badge badge-amber">${escapeHtml(e.cantidad)}</span>` : '';
        const freq = e.frecuencia ? `<span class="badge badge-naranja">${escapeHtml(e.frecuencia)}</span>` : '';

        return `<div class="cal-ev-row" style="border-left-color:${color}">
          <div class="cal-ev-icon">${icon}</div>
          <div class="cal-ev-body">
            <div class="cal-ev-title">${escapeHtml(e.titulo)}</div>
            <div class="cal-ev-desc">${escapeHtml(e.descripcion || '—')}</div>
            <div class="cal-ev-meta">
              ${codigo}
              ${area}
              ${estadoBadge}
              ${prioBadge}
              ${freq}
              ${cantidad}
              ${tec}
            </div>
          </div>
        </div>`;
      }).join('');
    }
  }

  const panel = container.querySelector('#cal-detail-panel');
  if (panel) panel.style.display = 'flex';
}

function closeDetail(container) {
  const panel = container.querySelector('#cal-detail-panel');
  if (panel) panel.style.display = 'none';
  state.dayDetail = null;
}

// ════════════════════════════════════════════════════════
// UTILS
// ════════════════════════════════════════════════════════
function truncate(s, n) {
  if (!s) return '';
  return s.length > n ? s.substring(0, n - 1) + '…' : s;
}

function capitalize(s) {
  if (!s) return '';
  return s[0].toUpperCase() + s.slice(1);
}
