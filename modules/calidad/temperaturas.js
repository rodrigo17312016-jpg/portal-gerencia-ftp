/* ════════════════════════════════════════════════════════
   TEMPERATURAS - Monitoreo en tiempo real
   ════════════════════════════════════════════════════════ */

import { fetchSupabase } from '/assets/js/config/supabase.js';
import { today } from '/assets/js/utils/formatters.js';

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
