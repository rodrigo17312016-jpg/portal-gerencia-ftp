/* ════════════════════════════════════════════════════════
   HEALTH CHECK MULTI-SEDE - dashboard tiempo real
   ════════════════════════════════════════════════════════
   Muestra estado de cada sede + auditoria de cambios de sede.
   Auto-refresh cada 60s.
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';

let refreshTimer = null;

export async function init(container) {
  await Promise.all([loadHealth(container), loadAudit(container)]);

  const btn = container.querySelector('#health-refresh-btn');
  if (btn) btn.addEventListener('click', () => {
    Promise.all([loadHealth(container), loadAudit(container)]);
  });

  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => {
    const c = document.getElementById('panel-sedes-health');
    if (c) loadHealth(c);
  }, 60000);
}

export function onShow() {
  const c = document.getElementById('panel-sedes-health');
  if (c) Promise.all([loadHealth(c), loadAudit(c)]);
  if (!refreshTimer) {
    refreshTimer = setInterval(() => {
      const cc = document.getElementById('panel-sedes-health');
      if (cc) loadHealth(cc);
    }, 60000);
  }
}

export function onHide() {
  if (refreshTimer) { clearInterval(refreshTimer); refreshTimer = null; }
}

export async function refresh() {
  const c = document.getElementById('panel-sedes-health');
  if (c) await Promise.all([loadHealth(c), loadAudit(c)]);
}

async function loadHealth(container) {
  const { data, error } = await supabase.rpc('sedes_health_status');

  const refreshBadge = container.querySelector('#health-last-refresh');
  if (refreshBadge) refreshBadge.textContent = 'Actualizado: ' + new Date().toLocaleTimeString('es-PE', {hour:'2-digit', minute:'2-digit', second:'2-digit'});

  if (error) {
    console.error('[sedes-health]', error);
    setKPI(container, 'health-kpi-activas', '—');
    setKPI(container, 'health-kpi-lentas', '—');
    setKPI(container, 'health-kpi-inactivas', '—');
    setKPI(container, 'health-kpi-total-hoy', '—');
    container.querySelector('#health-cards').innerHTML = `
      <div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">
        Error cargando estado: ${escapeHtml(error.message)}
      </div>`;
    return;
  }

  const sedes = data || [];

  // KPIs agregados
  const activas = sedes.filter(s => s.estado === 'activa').length;
  const lentas = sedes.filter(s => s.estado === 'lenta').length;
  const inactivas = sedes.filter(s => s.estado === 'inactiva' || s.estado === 'sin-datos').length;
  const totalHoy = sedes.reduce((s, x) => s + (x.filas_hoy_produccion || 0) + (x.filas_hoy_empaque || 0), 0);

  setKPI(container, 'health-kpi-activas', String(activas));
  setKPI(container, 'health-kpi-lentas', String(lentas));
  setKPI(container, 'health-kpi-inactivas', String(inactivas));
  setKPI(container, 'health-kpi-total-hoy', String(totalHoy));

  // Cards por sede
  const cardsHtml = sedes.map(s => renderSedeCard(s)).join('');
  const cardsEl = container.querySelector('#health-cards');
  if (cardsEl) cardsEl.innerHTML = cardsHtml || '<div class="card" style="grid-column:1/-1;text-align:center;padding:40px;color:var(--muted)">Sin sedes visibles</div>';
}

function renderSedeCard(s) {
  const estadoBadge = renderEstado(s.estado);
  const tipoBadge = s.tipo === 'maquila'
    ? '<span style="font-size:9px;font-weight:800;letter-spacing:0.5px;background:rgba(234,88,12,0.12);color:#ea580c;padding:2px 6px;border-radius:4px;text-transform:uppercase">MAQUILA</span>'
    : '<span style="font-size:9px;font-weight:800;letter-spacing:0.5px;background:rgba(14,124,58,0.12);color:#0e7c3a;padding:2px 6px;border-radius:4px;text-transform:uppercase">PROPIA</span>';

  return `
    <div class="card" style="border-left:4px solid ${escapeHtml(s.color)};padding:16px 18px">
      <div style="display:flex;align-items:flex-start;justify-content:space-between;margin-bottom:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <span style="font-size:24px">${escapeHtml(s.icono)}</span>
          <div>
            <div style="font-size:14.5px;font-weight:800;color:var(--texto);line-height:1.2">${escapeHtml(s.name)}</div>
            <div style="display:flex;gap:6px;align-items:center;margin-top:4px">${tipoBadge} ${estadoBadge}</div>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px 14px">
        ${renderRow('🏭', 'Producción', s.ultimo_produccion, s.horas_ult_produccion, s.filas_hoy_produccion)}
        ${renderRow('📦', 'Empaque', s.ultimo_empaque, s.horas_ult_empaque, s.filas_hoy_empaque)}
        ${renderRow('👥', 'Personal', s.ultimo_personal, s.horas_ult_personal, null)}
      </div>
    </div>
  `;
}

function renderRow(icon, label, ultimo, horas, hoy) {
  const colorH = horas == null ? 'var(--muted)' : (horas < 4 ? 'var(--verde)' : (horas < 12 ? 'var(--amber)' : 'var(--danger)'));
  const ultimoTxt = ultimo ? formatHora(ultimo) : 'Nunca';
  const horasTxt = horas == null ? '—' : (horas < 1 ? '<1h' : (horas < 24 ? `${horas.toFixed(1)}h` : `${(horas/24).toFixed(1)}d`));

  return `
    <div style="background:var(--surface3);padding:10px 12px;border-radius:8px">
      <div style="display:flex;align-items:center;gap:6px;font-size:10.5px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:0.4px;margin-bottom:4px">
        <span aria-hidden="true">${icon}</span> ${escapeHtml(label)}
      </div>
      <div style="font-size:13px;font-weight:700;color:var(--texto)">${escapeHtml(ultimoTxt)}</div>
      <div style="font-size:11px;font-weight:600;color:${colorH};margin-top:2px">
        Hace ${escapeHtml(horasTxt)}${hoy != null ? ` · ${hoy} hoy` : ''}
      </div>
    </div>
  `;
}

function renderEstado(estado) {
  const map = {
    'activa':    { color: '#0e7c3a', label: 'ACTIVA',     bg: 'rgba(14,124,58,0.14)' },
    'lenta':     { color: '#d97706', label: 'LENTA',      bg: 'rgba(217,119,6,0.14)' },
    'inactiva':  { color: '#be123c', label: 'INACTIVA',   bg: 'rgba(190,18,60,0.14)' },
    'sin-datos': { color: '#64748b', label: 'SIN DATOS',  bg: 'rgba(100,116,139,0.14)' }
  };
  const cfg = map[estado] || map['sin-datos'];
  return `<span style="font-size:9.5px;font-weight:800;letter-spacing:0.6px;background:${cfg.bg};color:${cfg.color};padding:2px 7px;border-radius:4px">${cfg.label}</span>`;
}

async function loadAudit(container) {
  const tbody = container.querySelector('#health-audit-tbl tbody');
  if (!tbody) return;

  const { data, error } = await supabase
    .from('audit_log')
    .select('occurred_at, user_email, user_role, old_data, new_data')
    .eq('table_name', '_session_sede')
    .eq('operation', 'SEDE_CHANGE')
    .order('occurred_at', { ascending: false })
    .limit(20);

  if (error) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Error: ${escapeHtml(error.message)}</td></tr>`;
    return;
  }

  if (!data || data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Sin cambios de sede registrados aún</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(r => {
    const de = r.old_data?.codigo || '—';
    const a = r.new_data?.codigo || '—';
    return `<tr>
      <td>${escapeHtml(formatDateTime(r.occurred_at))}</td>
      <td style="font-weight:600">${escapeHtml(r.user_email || '—')}</td>
      <td><span class="badge badge-azul" style="font-size:10px">${escapeHtml(r.user_role || '—')}</span></td>
      <td><code style="font-size:11px">${escapeHtml(de)}</code></td>
      <td><code style="font-size:11px;color:var(--verde);font-weight:700">${escapeHtml(a)}</code></td>
    </tr>`;
  }).join('');
}

function setKPI(container, id, value) {
  const el = container.querySelector('#' + id);
  if (el) el.textContent = String(value);
}

function formatHora(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-PE', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short', timeZone: 'America/Lima' });
  } catch (_) { return '—'; }
}

function formatDateTime(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'America/Lima' });
  } catch (_) { return '—'; }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
