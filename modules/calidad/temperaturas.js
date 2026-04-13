/* ════════════════════════════════════════════════════════
   TEMPERATURAS - Monitoreo en tiempo real
   ════════════════════════════════════════════════════════ */

import { fetchSupabase } from '../../assets/js/config/supabase.js';
import { today } from '../../assets/js/utils/formatters.js';
import { createChart } from '../../assets/js/utils/chart-helpers.js';

const AREAS = [
  'CAMARA DE MATERIA PRIMA','ACONDICIONADO','EMBANDEJADO','LAVADO DE BANDEJAS',
  'PRE ENFRIADO','EMPAQUE','TEMPERATURA PRODUCTO','CAMARA DE PRODUCTO TERMINADO','DESPACHO'
];

let tempData = [];

function estadoColor(e) {
  return e === 'OK' ? 'verde' : e === 'ALERTA' ? 'warn' : 'danger';
}

function estadoLabel(e) {
  return e === 'OK' ? '✓ Optimo' : e === 'ALERTA' ? '⚠ Alerta' : '🚨 Critico';
}

export async function init(container) {
  // Boton refresh
  const btn = container.querySelector('#btn-refresh-temp');
  if (btn) btn.addEventListener('click', () => loadTemperaturas(container));

  await loadTemperaturas(container);
}

async function loadTemperaturas(container) {
  const hoy = today();
  try {
    tempData = await fetchSupabase(
      `registros_temperatura?fecha=eq.${hoy}&order=hora.desc&limit=1000`
    );
  } catch {
    tempData = [];
  }
  renderCards(container);
  renderChart(container);
  renderTable(container);
}

function renderCards(container) {
  const grid = container.querySelector('#tempCards');
  if (!grid) return;

  const ultimas = {};
  tempData.forEach(r => { if (!ultimas[r.area]) ultimas[r.area] = r; });

  if (tempData.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;padding:24px">
      <div class="empty-state-icon">🌡️</div>
      <p class="empty-state-text">Sin registros de temperatura hoy</p>
    </div>`;
    return;
  }

  grid.innerHTML = AREAS.map(area => {
    const r = ultimas[area];
    const c = r ? estadoColor(r.estado) : 'muted';
    const tempColor = r ? `var(--${c === 'muted' ? 'muted' : c})` : 'var(--muted)';
    return `<div class="kpi-card" style="border-top:3px solid ${tempColor}">
      <div class="kpi-label" style="font-size:10px">${area}</div>
      <div class="kpi-value" style="color:${tempColor};font-size:24px">${r ? r.temperatura + '°C' : '—'}</div>
      <div style="font-size:11px;color:var(--muted);margin-top:4px">${r ? 'Ultima: ' + r.hora.slice(0, 5) : 'Sin datos hoy'}</div>
      ${r ? `<div style="margin-top:6px"><span class="badge badge-${estadoColor(r.estado)}">${estadoLabel(r.estado)}</span></div>` : ''}
    </div>`;
  }).join('');
}

function renderChart(container) {
  if (tempData.length === 0) return;

  // Colores por area (similar a la imagen del portal original)
  const AREA_COLORS = {
    'CAMARA DE MATERIA PRIMA': '#06b6d4',
    'ACONDICIONADO': '#6366f1',
    'EMBANDEJADO': '#f97316',
    'LAVADO DE BANDEJAS': '#a855f7',
    'PRE ENFRIADO': '#ef4444',
    'EMPAQUE': '#22c55e',
    'TEMPERATURA PRODUCTO': '#3b82f6',
    'CAMARA DE PRODUCTO TERMINADO': '#ec4899',
    'DESPACHO': '#eab308'
  };

  // Horas del dia (00:00 a 23:00)
  const allHours = [];
  for (let h = 0; h <= 23; h++) allHours.push(String(h).padStart(2, '0') + ':00');

  // Agrupar datos por area y hora
  const datasets = AREAS.map(area => {
    const areaData = tempData.filter(r => r.area === area);
    const dataByHour = allHours.map(hour => {
      const h = hour.slice(0, 2);
      const record = areaData.find(r => r.hora && r.hora.slice(0, 2) === h);
      return record ? record.temperatura : null;
    });

    return {
      label: area,
      data: dataByHour,
      borderColor: AREA_COLORS[area] || '#64748b',
      backgroundColor: 'transparent',
      borderWidth: 2,
      pointRadius: 2,
      pointHoverRadius: 5,
      tension: 0.3,
      spanGaps: true
    };
  }).filter(ds => ds.data.some(v => v !== null));

  createChart('chartTempHora', {
    type: 'line',
    data: { labels: allHours, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          display: true,
          position: 'top',
          labels: {
            color: '#64748b',
            font: { size: 10, family: 'Plus Jakarta Sans' },
            boxWidth: 12,
            padding: 8,
            usePointStyle: true
          }
        },
        tooltip: {
          backgroundColor: 'rgba(15,23,42,0.9)',
          titleFont: { size: 12 },
          bodyFont: { size: 11 },
          padding: 10,
          cornerRadius: 8,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y}°C`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0 },
          grid: { color: 'rgba(0,0,0,0.05)' }
        },
        y: {
          ticks: {
            color: '#64748b',
            font: { size: 10 },
            callback: (v) => v + '°C'
          },
          grid: { color: 'rgba(0,0,0,0.05)' }
        }
      }
    }
  });
}

function renderTable(container) {
  const tbody = container.querySelector('#tablaTemp');
  if (!tbody) return;

  if (tempData.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Sin registros hoy</td></tr>';
    return;
  }

  tbody.innerHTML = tempData.map(r => `<tr>
    <td style="font-family:monospace;font-size:13px">${r.hora.slice(0, 5)}</td>
    <td style="font-size:12px">${r.area}</td>
    <td style="font-weight:700;color:var(--${estadoColor(r.estado)})">${r.temperatura}°C</td>
    <td><span class="badge badge-${estadoColor(r.estado)}">${estadoLabel(r.estado)}</span></td>
    <td style="font-size:12px">${r.turno || '—'}</td>
    <td style="font-size:12px">${r.operario || '—'}</td>
    <td style="font-size:11px;color:var(--muted)">${r.observaciones || '—'}</td>
  </tr>`).join('');
}

export function refresh() {
  const container = document.getElementById('panel-temperaturas');
  if (container) loadTemperaturas(container);
}

// Exportar datos para uso en inspecciones
export function getTempData() { return tempData; }
export { AREAS, estadoColor, estadoLabel };
