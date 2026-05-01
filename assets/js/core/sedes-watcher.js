/* ════════════════════════════════════════════════════════
   SEDES WATCHER (BONUS 3) - Alertas cross-sede
   ════════════════════════════════════════════════════════
   Background daemon que cada N minutos consulta sedes_health_status
   y dispara toast/notification si detecta sedes inactivas.

   - Solo se inicia si el usuario es admin (ve mas de 1 sede)
   - Throttle: no re-alerta una sede mas de 1 vez cada 4 horas
   - Persiste alertas vistas en sessionStorage (no spam entre tabs)
   ════════════════════════════════════════════════════════ */

import { supabase } from '../config/supabase.js';
import { getSedes } from '../config/sedes.js';

const CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const ALERT_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4h
const STORAGE_KEY = 'ftp_sede_alerts_seen';
const HORAS_LENTA_THRESHOLD = 12;
const HORAS_INACTIVA_THRESHOLD = 48;

let _timer = null;
let _started = false;

function getSeenAlerts() {
  try {
    return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || '{}');
  } catch (_) { return {}; }
}

function markSeen(key) {
  try {
    const map = getSeenAlerts();
    map[key] = Date.now();
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch (_) {}
}

function shouldAlert(key) {
  const map = getSeenAlerts();
  const last = map[key] || 0;
  return (Date.now() - last) > ALERT_COOLDOWN_MS;
}

async function checkSedes() {
  try {
    const { data, error } = await supabase.rpc('sedes_health_status');
    if (error || !Array.isArray(data)) return;

    // Solo alertar si hay mas de 1 sede visible (admin / multi-sede)
    if (data.length <= 1) return;

    data.forEach(s => {
      const ultMax = Math.max(
        s.horas_ult_produccion || 0,
        s.horas_ult_empaque || 0
      );
      // Inactiva (>48h sin nada) - alerta critica
      if (s.estado === 'inactiva' || (s.estado === 'sin-datos' && s.tipo === 'propia')) {
        const key = `inactiva-${s.code}-${new Date().toISOString().slice(0,10)}`;
        if (shouldAlert(key)) {
          showToast({
            level: 'critical',
            icon: s.icono,
            title: `⚠ ${s.name} sin actividad`,
            message: s.estado === 'sin-datos'
              ? 'Esta planta no tiene registros de producción todavía.'
              : `Última actividad hace más de ${HORAS_INACTIVA_THRESHOLD}h.`,
            color: s.color,
            actionPanelId: 'sedes-health'
          });
          markSeen(key);
        }
      }
      // Lenta (>12h sin registrar) - solo alertar si fue activa antes
      else if (s.estado === 'lenta' && ultMax > HORAS_LENTA_THRESHOLD && ultMax < HORAS_INACTIVA_THRESHOLD) {
        const key = `lenta-${s.code}-${Math.floor(Date.now() / (4*3600*1000))}`;
        if (shouldAlert(key)) {
          showToast({
            level: 'warning',
            icon: s.icono,
            title: `${s.name}: ritmo lento`,
            message: `Sin registros hace ${ultMax.toFixed(1)}h. Verificar.`,
            color: s.color,
            actionPanelId: 'sedes-health'
          });
          markSeen(key);
        }
      }
    });
  } catch (err) {
    console.warn('[sedes-watcher] check fallo:', err.message);
  }
}

function showToast({ level, icon, title, message, color, actionPanelId }) {
  // Container singleton
  let container = document.getElementById('sedes-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sedes-toast-container';
    container.style.cssText = 'position:fixed;top:80px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:10px;max-width:360px;pointer-events:none';
    document.body.appendChild(container);
  }

  const accent = color || (level === 'critical' ? '#be123c' : '#d97706');
  const toast = document.createElement('div');
  toast.style.cssText = `
    background: var(--surface, white);
    border: 1px solid var(--border, #e2e8f0);
    border-left: 4px solid ${accent};
    border-radius: 10px;
    padding: 14px 16px;
    box-shadow: 0 12px 30px rgba(15,23,42,0.18), 0 2px 6px rgba(15,23,42,0.06);
    display: flex;
    gap: 12px;
    align-items: flex-start;
    pointer-events: auto;
    transform: translateX(400px);
    transition: transform 0.32s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s;
    opacity: 0;
    cursor: pointer;
  `;

  const escape = (s) => String(s == null ? '' : s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

  toast.innerHTML = `
    <span style="font-size:24px;line-height:1" aria-hidden="true">${escape(icon || '⚠')}</span>
    <div style="flex:1;min-width:0">
      <div style="font-size:13px;font-weight:800;color:var(--texto, #0f172a);line-height:1.3;margin-bottom:4px">${escape(title)}</div>
      <div style="font-size:12px;color:var(--muted, #64748b);line-height:1.4">${escape(message)}</div>
      <div style="font-size:10.5px;color:${accent};font-weight:700;margin-top:6px;letter-spacing:0.4px;text-transform:uppercase">Click para ver detalles →</div>
    </div>
    <button aria-label="Cerrar" style="background:none;border:0;color:var(--muted, #64748b);font-size:18px;cursor:pointer;padding:0;line-height:1;flex-shrink:0">×</button>
  `;

  // Animar entrada
  container.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.transform = 'translateX(0)';
    toast.style.opacity = '1';
  });

  const close = () => {
    toast.style.transform = 'translateX(400px)';
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  };

  // Click en el toast → abrir panel sedes-health
  toast.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    if (actionPanelId) {
      const item = document.querySelector(`.nav-item[data-panel="${actionPanelId}"]`);
      if (item) item.click();
    }
    close();
  });

  // Click en X
  toast.querySelector('button').addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  // Auto-cerrar después de 12s
  setTimeout(close, 12000);
}

export async function startSedesWatcher() {
  if (_started) return;

  // Solo arrancar si el usuario ve >1 sede
  try {
    const sedes = await getSedes();
    if (sedes.length <= 1) return;
  } catch (_) { return; }

  _started = true;

  // Primer check despues de 30s para no impactar boot
  setTimeout(checkSedes, 30000);
  // Loop
  if (_timer) clearInterval(_timer);
  _timer = setInterval(checkSedes, CHECK_INTERVAL_MS);
}

export function stopSedesWatcher() {
  if (_timer) clearInterval(_timer);
  _timer = null;
  _started = false;
}
