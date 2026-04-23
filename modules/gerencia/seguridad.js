/* ════════════════════════════════════════════════════════
   SEGURIDAD - 2FA / MFA + cambio de password
   Usa Supabase MFA nativo (TOTP)
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { updatePassword, getCurrentUser } from '../../assets/js/core/auth.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';
import { getPermissionState, requestPermission, notify, notifyInfo } from '../../assets/js/utils/notifications.js';
import { validatePassword, attachPasswordMeter } from '../../assets/js/utils/password-policy.js';

let currentFactorId = null;

export async function init(container) {
  // Email del usuario
  const user = getCurrentUser();
  const emailEl = container.querySelector('#secUserEmail');
  if (emailEl) emailEl.textContent = user?.username || user?.name || '';

  // 2FA
  wireTwoFactor(container);

  // Cambio password
  wirePasswordChange(container);

  // Notificaciones
  wireNotifications(container);

  // Cargar estado 2FA
  await refresh2FAStatus(container);
}

// ════════════════════════════════════════════════════════
// Notificaciones
// ════════════════════════════════════════════════════════

function updateNotifStatus(container) {
  const statusEl = container.querySelector('#secNotifStatus');
  const enableBtn = container.querySelector('#secNotifEnableBtn');
  if (!statusEl) return;
  const state = getPermissionState();
  if (state === 'unsupported') {
    statusEl.textContent = '⚠️ Tu navegador no soporta notificaciones';
    statusEl.style.color = 'var(--naranja)';
    if (enableBtn) enableBtn.style.display = 'none';
  } else if (state === 'granted') {
    statusEl.textContent = '✓ Notificaciones activadas';
    statusEl.style.color = 'var(--verde)';
    statusEl.style.background = 'var(--verde-bg)';
    if (enableBtn) enableBtn.style.display = 'none';
  } else if (state === 'denied') {
    statusEl.textContent = '✗ Notificaciones bloqueadas. Habilitalas desde la configuracion del navegador.';
    statusEl.style.color = 'var(--rojo)';
    if (enableBtn) enableBtn.style.display = 'none';
  } else {
    statusEl.textContent = 'Notificaciones no configuradas';
    statusEl.style.color = 'var(--muted)';
  }
}

function wireNotifications(container) {
  const enableBtn = container.querySelector('#secNotifEnableBtn');
  const testBtn = container.querySelector('#secNotifTestBtn');

  updateNotifStatus(container);

  enableBtn?.addEventListener('click', async () => {
    enableBtn.disabled = true;
    enableBtn.textContent = '⏳ Solicitando...';
    const state = await requestPermission();
    enableBtn.disabled = false;
    enableBtn.textContent = 'Activar notificaciones';
    updateNotifStatus(container);
    if (state === 'granted') {
      notifyInfo('Notificaciones activadas', 'Ahora recibiras alertas de temperatura y eventos criticos.');
    }
  });

  testBtn?.addEventListener('click', async () => {
    const state = getPermissionState();
    if (state !== 'granted') {
      const r = await requestPermission();
      if (r !== 'granted') { alert('Permiso no concedido'); return; }
      updateNotifStatus(container);
    }
    notifyInfo('Notificacion de prueba', 'Si ves esto, las notificaciones funcionan correctamente.', { tag: 'ftp-test' });
  });
}

// ════════════════════════════════════════════════════════
// 2FA / MFA
// ════════════════════════════════════════════════════════

async function refresh2FAStatus(container) {
  const statusEl = container.querySelector('#sec2faStatus');
  const enrollSec = container.querySelector('#sec2faEnrollSection');
  const qrSec = container.querySelector('#sec2faQrSection');
  const activeSec = container.querySelector('#sec2faActiveSection');

  if (!statusEl) return;

  // Ocultar todos
  if (enrollSec) enrollSec.style.display = 'none';
  if (qrSec) qrSec.style.display = 'none';
  if (activeSec) activeSec.style.display = 'none';

  try {
    const { data, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      statusEl.textContent = '⚠️ Error consultando factores MFA: ' + error.message;
      statusEl.style.color = 'var(--naranja)';
      return;
    }

    const totp = (data?.totp || []).filter(f => f.status === 'verified');
    if (totp.length > 0) {
      statusEl.innerHTML = '✓ Tienes <strong>' + totp.length + ' factor(es)</strong> TOTP activos';
      statusEl.style.color = 'var(--verde)';
      statusEl.style.background = 'var(--verde-bg)';
      if (activeSec) activeSec.style.display = 'block';
    } else {
      statusEl.textContent = 'No tienes 2FA configurado. Tu cuenta depende solo de la contrasena.';
      statusEl.style.color = 'var(--muted)';
      if (enrollSec) enrollSec.style.display = 'block';
    }
  } catch (err) {
    statusEl.textContent = '⚠️ ' + err.message;
    statusEl.style.color = 'var(--naranja)';
  }
}

function wireTwoFactor(container) {
  const enrollBtn = container.querySelector('#sec2faEnrollBtn');
  const cancelBtn = container.querySelector('#sec2faCancelBtn');
  const verifyBtn = container.querySelector('#sec2faVerifyBtn');
  const disableBtn = container.querySelector('#sec2faDisableBtn');
  const codeInput = container.querySelector('#sec2faCode');
  const msgEl = container.querySelector('#sec2faMsg');

  enrollBtn?.addEventListener('click', async () => {
    enrollBtn.disabled = true;
    enrollBtn.textContent = '⏳ Generando...';
    try {
      const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'FTP Portal TOTP' });
      if (error) { alert('Error: ' + error.message); return; }

      currentFactorId = data.id;
      const qrUrl = data.totp?.qr_code; // Formato: otpauth://... URI
      const secret = data.totp?.secret;

      // Mostrar QR
      const qrContainer = container.querySelector('#sec2faQrContainer');
      if (qrContainer) {
        // Usar qrcode externo (Google Charts API - no requiere lib)
        qrContainer.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl || '')}" alt="QR 2FA" style="display:block;width:200px;height:200px">`;
      }
      const secretEl = container.querySelector('#sec2faSecret');
      if (secretEl) secretEl.textContent = escapeHtml(secret || '');

      container.querySelector('#sec2faEnrollSection').style.display = 'none';
      container.querySelector('#sec2faQrSection').style.display = 'block';
      codeInput?.focus();
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      enrollBtn.disabled = false;
      enrollBtn.innerHTML = '🔐 Activar 2FA';
    }
  });

  cancelBtn?.addEventListener('click', async () => {
    if (currentFactorId) {
      try { await supabase.auth.mfa.unenroll({ factorId: currentFactorId }); } catch {}
      currentFactorId = null;
    }
    await refresh2FAStatus(container);
  });

  verifyBtn?.addEventListener('click', async () => {
    const code = codeInput?.value?.trim();
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
      if (msgEl) { msgEl.textContent = 'Ingresa un codigo de 6 digitos'; msgEl.style.color = 'var(--rojo)'; }
      return;
    }
    verifyBtn.disabled = true;
    verifyBtn.textContent = '⏳ Verificando...';
    try {
      // 1. challenge
      const { data: chData, error: chErr } = await supabase.auth.mfa.challenge({ factorId: currentFactorId });
      if (chErr) throw chErr;
      // 2. verify
      const { error } = await supabase.auth.mfa.verify({
        factorId: currentFactorId, challengeId: chData.id, code
      });
      if (error) throw error;
      if (msgEl) { msgEl.textContent = '✓ 2FA activado correctamente'; msgEl.style.color = 'var(--verde)'; }
      currentFactorId = null;
      setTimeout(() => refresh2FAStatus(container), 1500);
    } catch (err) {
      if (msgEl) { msgEl.textContent = 'Codigo incorrecto: ' + err.message; msgEl.style.color = 'var(--rojo)'; }
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.textContent = 'Verificar y activar';
    }
  });

  disableBtn?.addEventListener('click', async () => {
    if (!confirm('¿Desactivar 2FA? Tu cuenta volvera a usar solo contrasena.')) return;
    try {
      const { data } = await supabase.auth.mfa.listFactors();
      const factors = data?.totp || [];
      for (const f of factors) {
        await supabase.auth.mfa.unenroll({ factorId: f.id });
      }
      await refresh2FAStatus(container);
    } catch (err) {
      alert('Error: ' + err.message);
    }
  });
}

// ════════════════════════════════════════════════════════
// Cambio de password
// ════════════════════════════════════════════════════════

function wirePasswordChange(container) {
  const newInput = container.querySelector('#secPwdNew');
  const confirmInput = container.querySelector('#secPwdConfirm');
  const btn = container.querySelector('#secPwdUpdateBtn');
  const msg = container.querySelector('#secPwdMsg');

  // Agregar medidor de fortaleza en vivo
  if (newInput) {
    const meterDiv = document.createElement('div');
    meterDiv.id = 'secPwdMeter';
    newInput.parentNode.insertBefore(meterDiv, newInput.nextSibling);
    attachPasswordMeter(newInput, meterDiv);
  }

  btn?.addEventListener('click', async () => {
    msg.textContent = '';
    const p1 = newInput?.value || '';
    const p2 = confirmInput?.value || '';

    // Validacion completa de complejidad (ISO 27001)
    const validation = validatePassword(p1);
    if (!validation.valid) {
      msg.innerHTML = 'Contrasena debil: ' + validation.errors.map(e => escapeHtml(e)).join(', ');
      msg.style.color = 'var(--rojo)';
      return;
    }
    if (p1 !== p2) {
      msg.textContent = 'Las contrasenas no coinciden';
      msg.style.color = 'var(--rojo)';
      return;
    }
    btn.disabled = true;
    btn.textContent = '⏳ Actualizando...';
    try {
      const r = await updatePassword(p1);
      if (r.success) {
        msg.textContent = '✓ Contrasena actualizada correctamente';
        msg.style.color = 'var(--verde)';
        newInput.value = '';
        confirmInput.value = '';
      } else {
        msg.textContent = r.error;
        msg.style.color = 'var(--rojo)';
      }
    } catch (err) {
      msg.textContent = err.message;
      msg.style.color = 'var(--rojo)';
    } finally {
      btn.disabled = false;
      btn.textContent = 'Actualizar contrasena';
    }
  });
}
