/* ════════════════════════════════════════════════════════
   COMPARATIVO TURNOS - Version Ejecutiva v4
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct } from '../../assets/js/utils/formatters.js';
import { createChart, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

let allData = [];
let activeFilters = { rango: '14', metrica: 'pt' };
let refreshInterval = null;

const METRICA_MAP = {
  pt:   { field: 'pt_aprox_kg', label: 'PT kg',          unidad: 'kg' },
  mp:   { field: 'consumo_kg',  label: 'MP Consumo kg',  unidad: 'kg' },
  rend: { field: 'rendimiento', label: 'Rendimiento %',  unidad: '%'  }
};

export async function init(container) {
  // Filtros
  container.querySelectorAll('.filter-chip[data-cfilter]').forEach(chip => {
    chip.addEventListener('click', () => {
      const type = chip.dataset.cfilter;
      container.querySelectorAll(`.filter-chip[data-cfilter="${type}"]`).forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeFilters[type] = chip.dataset.value;
      if (type === 'rango') loadData(container);
      else render(container);
    });
  });

  const refreshBtn = container.querySelector('#compRefreshBtn');
  if (refreshBtn) refreshBtn.addEventListener('click', () => {
    refreshBtn.style.transform = 'rotate(360deg)';
    refreshBtn.style.transition = 'transform 0.6s ease';
    setTimeout(() => refreshBtn.style.transform = '', 700);
    loadData(container);
  });

  await loadData(container);

  if (refreshInterval) clearInterval(refreshInterval);
  refreshInterval = setInterval(() => {
    if (document.getElementById('panel-comparativo')) loadData(container);
    else destroy();
  }, 180000);
}

async function loadData(container) {
  const dias = +activeFilters.rango;
  try {
    const since = new Date();
    since.setDate(since.getDate() - dias);
    const sinceISO = since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });

    const { data } = await supabase.from('registro_produccion')
      .select('fecha, pt_aprox_kg, consumo_kg, rendimiento, turno')
      .gte('fecha', sinceISO)
      .order('fecha');

    allData = data || [];

    const lastEl = container.querySelector('#compLastUpdate');
    if (lastEl) {
      const now = new Date();
      lastEl.textContent = `Actualizado ${now.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}`;
    }
  } catch (err) {
    console.error('Error comparativo:', err);
    allData = [];
  }

  render(container);
}

function render(container) {
  const recs = allData;
  const metricaCfg = METRICA_MAP[activeFilters.metrica];
  const field = metricaCfg.field;
  const isDia = r => (r.turno || '').toUpperCase().includes('DIA');

  const diaRecs = recs.filter(isDia);
  const nocheRecs = recs.filter(r => !isDia(r));

  let totalDia, totalNoche, avgDia, avgNoche;
  if (activeFilters.metrica === 'rend') {
    const diaMp = diaRecs.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
    const diaPt = diaRecs.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
    const nocheMp = nocheRecs.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
    const nochePt = nocheRecs.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
    totalDia = diaMp > 0 ? (diaPt / diaMp * 100) : 0;
    totalNoche = nocheMp > 0 ? (nochePt / nocheMp * 100) : 0;
    avgDia = totalDia; avgNoche = totalNoche;
  } else {
    totalDia = diaRecs.reduce((s, r) => s + (+(r[field] || 0)), 0);
    totalNoche = nocheRecs.reduce((s, r) => s + (+(r[field] || 0)), 0);
    const fechasDia = [...new Set(diaRecs.map(r => r.fecha))].length || 1;
    const fechasNoche = [...new Set(nocheRecs.map(r => r.fecha))].length || 1;
    avgDia = totalDia / fechasDia;
    avgNoche = totalNoche / fechasNoche;
  }

  // KPIs
  const kpiFmt = (v) => activeFilters.metrica === 'rend' ? fmtPct(v) : fmt(v) + ' ' + metricaCfg.unidad;
  setVal(container, 'compDia', kpiFmt(totalDia));
  setVal(container, 'compNoche', kpiFmt(totalNoche));
  setVal(container, 'compDiaSub', activeFilters.metrica === 'rend' ? `${diaRecs.length} registros` : `Promedio: ${fmt(avgDia, 0)} ${metricaCfg.unidad}/dia`);
  setVal(container, 'compNocheSub', activeFilters.metrica === 'rend' ? `${nocheRecs.length} registros` : `Promedio: ${fmt(avgNoche, 0)} ${metricaCfg.unidad}/dia`);

  const diff = totalDia > 0 ? ((totalDia - totalNoche) / totalDia * 100) : 0;
  const diffEl = container.querySelector('#compDiff');
  if (diffEl) {
    diffEl.textContent = fmtPct(Math.abs(diff));
    diffEl.style.color = diff > 0 ? 'var(--amber)' : diff < 0 ? 'var(--azul)' : 'var(--muted)';
  }
  setVal(container, 'compDiffSub', diff > 0 ? `Dia ${Math.abs(diff).toFixed(1)}% mayor` : diff < 0 ? `Noche ${Math.abs(diff).toFixed(1)}% mayor` : 'Iguales');

  const mejor = avgDia >= avgNoche ? 'DIA' : 'NOCHE';
  const mejorEmoji = mejor === 'DIA' ? '☀️' : '🌙';
  setVal(container, 'compMejor', mejorEmoji + ' ' + mejor);
  setVal(container, 'compMejorSub', 'Promedio: ' + kpiFmt(mejor === 'DIA' ? avgDia : avgNoche));
  const mejorEl = container.querySelector('#compMejor');
  if (mejorEl) mejorEl.style.color = mejor === 'DIA' ? 'var(--amber)' : 'var(--azul)';

  // Update range label
  setVal(container, 'compRangeLabel', activeFilters.rango + ' dias');

  buildChart(recs, field);
  buildDonut(totalDia, totalNoche);
  buildTable(container, recs, field);
}

function buildChart(recs, field) {
  const isDia = r => (r.turno || '').toUpperCase().includes('DIA');
  const fechas = [...new Set(recs.map(r => r.fecha))].sort();

  let diaPorFecha, nochePorFecha;
  if (activeFilters.metrica === 'rend') {
    diaPorFecha = fechas.map(f => {
      const diaF = recs.filter(r => r.fecha === f && isDia(r));
      const mp = diaF.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
      const pt = diaF.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
      return mp > 0 ? +(pt/mp*100).toFixed(1) : 0;
    });
    nochePorFecha = fechas.map(f => {
      const nocheF = recs.filter(r => r.fecha === f && !isDia(r));
      const mp = nocheF.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
      const pt = nocheF.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
      return mp > 0 ? +(pt/mp*100).toFixed(1) : 0;
    });
  } else {
    diaPorFecha = fechas.map(f => recs.filter(r => r.fecha === f && isDia(r)).reduce((s, r) => s + (+(r[field] || 0)), 0));
    nochePorFecha = fechas.map(f => recs.filter(r => r.fecha === f && !isDia(r)).reduce((s, r) => s + (+(r[field] || 0)), 0));
  }

  const labels = fechas.map(f => {
    const d = new Date(f + 'T00:00:00');
    return d.toLocaleDateString('es-PE', { weekday: 'short', day: 'numeric', month: 'numeric' });
  });

  createChart('chartCompTurnos', {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: '☀️ Dia',   data: diaPorFecha,   backgroundColor: 'rgba(180,83,9,0.6)', borderColor: '#b45309', borderWidth: 2, borderRadius: 6 },
        { label: '🌙 Noche', data: nochePorFecha, backgroundColor: 'rgba(30,64,175,0.6)', borderColor: '#1e40af', borderWidth: 2, borderRadius: 6 }
      ]
    },
    options: {
      ...getDefaultOptions('bar'),
      plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11, weight: '600' } } } }
    }
  });
}

function buildDonut(totalDia, totalNoche) {
  createChart('chartCompDonut', {
    type: 'doughnut',
    data: {
      labels: ['☀️ Turno Dia', '🌙 Turno Noche'],
      datasets: [{
        data: [totalDia, totalNoche],
        backgroundColor: ['#b45309', '#1e40af'],
        borderColor: '#fff',
        borderWidth: 3,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: {
          position: 'right',
          labels: { color: '#64748b', font: { size: 12, weight: '600' }, padding: 14, usePointStyle: true, pointStyle: 'circle' }
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const total = totalDia + totalNoche;
              const pct = total > 0 ? (ctx.raw / total * 100).toFixed(1) : 0;
              return ` ${ctx.label}: ${fmt(ctx.raw, 0)} (${pct}%)`;
            }
          }
        }
      }
    }
  });
}

function buildTable(container, recs, field) {
  const tbody = container.querySelector('#compTabla');
  const tfoot = container.querySelector('#compFoot');
  if (!tbody) return;
  const isDia = r => (r.turno || '').toUpperCase().includes('DIA');
  const fechas = [...new Set(recs.map(r => r.fecha))].sort().reverse();

  if (!fechas.length) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:40px;color:var(--muted);font-style:italic">Sin datos en el rango</td></tr>';
    if (tfoot) tfoot.innerHTML = '';
    return;
  }

  tbody.innerHTML = fechas.map(f => {
    const diaF = recs.filter(r => r.fecha === f && isDia(r));
    const nocheF = recs.filter(r => r.fecha === f && !isDia(r));

    let ptD, ptN;
    if (activeFilters.metrica === 'rend') {
      const mp = diaF.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
      const pt = diaF.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
      ptD = mp > 0 ? +(pt/mp*100) : 0;
      const mpN = nocheF.reduce((s, r) => s + (+(r.consumo_kg || 0)), 0);
      const ptNT = nocheF.reduce((s, r) => s + (+(r.pt_aprox_kg || 0)), 0);
      ptN = mpN > 0 ? +(ptNT/mpN*100) : 0;
    } else {
      ptD = diaF.reduce((s, r) => s + (+(r[field] || 0)), 0);
      ptN = nocheF.reduce((s, r) => s + (+(r[field] || 0)), 0);
    }

    const total = ptD + ptN;
    const diff = ptD > 0 ? ((ptD - ptN) / ptD * 100) : 0;
    const mejor = ptD >= ptN ? 'DIA' : 'NOCHE';
    const fechaDate = new Date(f + 'T00:00:00');
    const fechaLabel = fechaDate.toLocaleDateString('es-PE', { weekday: 'short', day: '2-digit', month: '2-digit' });
    const unidad = METRICA_MAP[activeFilters.metrica].unidad;
    const fmtVal = (v) => activeFilters.metrica === 'rend' ? v.toFixed(1) + '%' : fmt(v);

    return `<tr>
      <td style="font-size:11.5px;font-family:monospace">${fechaLabel}</td>
      <td style="font-family:monospace;color:var(--amber);font-weight:700">${fmtVal(ptD)}</td>
      <td style="font-family:monospace;color:var(--azul);font-weight:700">${fmtVal(ptN)}</td>
      <td style="font-family:monospace;font-weight:800">${activeFilters.metrica === 'rend' ? '—' : fmt(total)}</td>
      <td style="font-weight:700;color:${diff > 0 ? 'var(--amber)' : diff < 0 ? 'var(--azul)' : 'var(--muted)'}">${Math.abs(diff).toFixed(1)}%</td>
      <td><span class="tun-status-badge" style="background:${mejor === 'DIA' ? 'var(--amber-bg)' : 'var(--azul-bg)'};color:${mejor === 'DIA' ? 'var(--amber)' : 'var(--azul)'};border:1px solid ${mejor === 'DIA' ? 'rgba(180,83,9,0.2)' : 'rgba(30,64,175,0.2)'};padding:3px 8px;font-size:9.5px">${mejor === 'DIA' ? '☀️' : '🌙'} ${mejor}</span></td>
    </tr>`;
  }).join('');

  if (tfoot) {
    const totDia = fechas.reduce((s, f) => s + recs.filter(r => r.fecha === f && isDia(r)).reduce((ss, r) => ss + (+(r[field] || 0)), 0), 0);
    const totNoche = fechas.reduce((s, f) => s + recs.filter(r => r.fecha === f && !isDia(r)).reduce((ss, r) => ss + (+(r[field] || 0)), 0), 0);
    const fmtTot = (v) => activeFilters.metrica === 'rend' ? '—' : fmt(v);
    tfoot.innerHTML = `<tr style="font-weight:800;background:var(--azul-bg);border-top:2px solid var(--azul)">
      <td style="color:var(--azul)">TOTAL (${fechas.length} dias)</td>
      <td style="font-family:monospace;color:var(--amber)">${fmtTot(totDia)}</td>
      <td style="font-family:monospace;color:var(--azul)">${fmtTot(totNoche)}</td>
      <td style="font-family:monospace">${fmtTot(totDia + totNoche)}</td>
      <td colspan="2"></td>
    </tr>`;
  }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-comparativo'); if (c) loadData(c); }
export function destroy() { if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; } }
