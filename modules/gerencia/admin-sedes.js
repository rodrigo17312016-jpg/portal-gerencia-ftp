/* ════════════════════════════════════════════════════════
   ADMIN SEDES - CRUD plantas + asignacion de usuarios
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { invalidateSedesCache, getSedes } from '../../assets/js/config/sedes.js';

let _sedes = [];
let _users = [];

export async function init(container) {
  await loadAll(container);

  const btnSync = container.querySelector('#btn-sync-calidad');
  if (btnSync) btnSync.addEventListener('click', () => syncToCalidad(btnSync));
}

export function refresh() {
  const c = document.getElementById('panel-admin-sedes');
  if (c) loadAll(c);
}

export function onShow() { refresh(); }

async function loadAll(container) {
  const [sedesRes, usersRes] = await Promise.all([
    supabase.from('Plant').select('id, code, name, tipo, color, icono, activa, principal, scale_factor, ubicacion, empresa').order('principal', {ascending: false}),
    supabase.rpc('admin_list_usuarios_sedes')
  ]);

  if (sedesRes.error) {
    console.error('[admin-sedes] error sedes:', sedesRes.error);
    container.querySelector('#admin-sedes-tbl tbody').innerHTML =
      `<tr><td colspan="9" style="text-align:center;color:var(--danger);padding:20px">Error: ${escapeHtml(sedesRes.error.message)}</td></tr>`;
  } else {
    _sedes = sedesRes.data || [];
    renderSedesTable(container);
  }

  if (usersRes.error) {
    console.error('[admin-sedes] error users:', usersRes.error);
    container.querySelector('#admin-users-tbl tbody').innerHTML =
      `<tr><td colspan="5" style="text-align:center;color:var(--danger);padding:20px">Error: ${escapeHtml(usersRes.error.message)}<br><small>(¿Eres admin?)</small></td></tr>`;
  } else {
    _users = usersRes.data || [];
    renderUsersTable(container);
  }
}

function renderSedesTable(container) {
  const tbody = container.querySelector('#admin-sedes-tbl tbody');
  if (!tbody) return;

  tbody.innerHTML = _sedes.map(s => {
    const tipoColor = s.tipo === 'maquila' ? '#ea580c' : '#0e7c3a';
    return `
      <tr data-code="${escapeHtml(s.code)}">
        <td><code style="font-weight:800;color:${escapeHtml(s.color)}">${escapeHtml(s.code)}</code></td>
        <td><input type="text" class="sede-edit" data-field="name" value="${escapeHtml(s.name)}" style="background:transparent;border:1px solid transparent;padding:4px 8px;width:160px;border-radius:4px;font:inherit;color:var(--texto)"></td>
        <td><span style="font-size:10px;font-weight:800;letter-spacing:0.5px;color:${tipoColor};text-transform:uppercase">${escapeHtml(s.tipo)}</span></td>
        <td><input type="color" class="sede-edit" data-field="color" value="${escapeHtml(s.color)}" style="width:40px;height:28px;border:1px solid var(--border);border-radius:4px;cursor:pointer"></td>
        <td><input type="text" class="sede-edit" data-field="icono" value="${escapeHtml(s.icono)}" maxlength="3" style="width:42px;text-align:center;background:transparent;border:1px solid transparent;padding:4px;border-radius:4px;font:inherit;color:var(--texto);font-size:18px"></td>
        <td><input type="text" class="sede-edit" data-field="ubicacion" value="${escapeHtml(s.ubicacion || '')}" placeholder="—" style="background:transparent;border:1px solid transparent;padding:4px 8px;width:140px;border-radius:4px;font:inherit;color:var(--texto)"></td>
        <td><input type="number" class="sede-edit" data-field="scale_factor" value="${s.scale_factor || 1}" step="0.01" min="0" max="10" style="width:60px;background:transparent;border:1px solid transparent;padding:4px;border-radius:4px;font:inherit;color:var(--texto);text-align:right"></td>
        <td><label style="display:inline-flex;align-items:center;gap:6px;cursor:pointer">
          <input type="checkbox" class="sede-edit" data-field="activa" ${s.activa ? 'checked' : ''} style="cursor:pointer">
        </label></td>
        <td><button class="sede-save-btn" data-code="${escapeHtml(s.code)}" style="display:none;padding:4px 10px;background:var(--verde);color:white;border:0;border-radius:5px;cursor:pointer;font-weight:700;font-size:11px">Guardar</button></td>
      </tr>
    `;
  }).join('');

  // Cablear inputs
  tbody.querySelectorAll('.sede-edit').forEach(inp => {
    inp.addEventListener('focus', () => inp.style.border = '1.5px solid var(--azul, #2563eb)');
    inp.addEventListener('blur', () => inp.style.border = '1px solid transparent');
    inp.addEventListener('input', () => {
      const row = inp.closest('tr');
      if (row) row.querySelector('.sede-save-btn').style.display = 'inline-block';
    });
    inp.addEventListener('change', () => {
      const row = inp.closest('tr');
      if (row) row.querySelector('.sede-save-btn').style.display = 'inline-block';
    });
  });

  tbody.querySelectorAll('.sede-save-btn').forEach(btn => {
    btn.addEventListener('click', () => saveSede(btn.dataset.code, btn));
  });
}

async function saveSede(code, btn) {
  const row = btn.closest('tr');
  if (!row) return;

  const payload = { p_code: code };
  row.querySelectorAll('.sede-edit').forEach(inp => {
    const f = inp.dataset.field;
    let v = inp.type === 'checkbox' ? inp.checked : inp.value;
    if (inp.type === 'number') v = parseFloat(v);
    payload['p_' + f] = v;
  });

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const { error } = await supabase.rpc('admin_update_sede', payload);

  if (error) {
    btn.textContent = 'Error';
    btn.style.background = 'var(--danger)';
    console.error('[admin-sedes] save error:', error);
    setTimeout(() => { btn.textContent = 'Guardar'; btn.style.background = 'var(--verde)'; btn.disabled = false; }, 2000);
  } else {
    btn.textContent = '✓ Listo';
    setTimeout(() => { btn.style.display = 'none'; btn.textContent = 'Guardar'; btn.disabled = false; }, 1500);
    // Invalidar cache de sedes para que el selector vea los cambios
    invalidateSedesCache();
  }
}

function renderUsersTable(container) {
  const tbody = container.querySelector('#admin-users-tbl tbody');
  if (!tbody) return;

  if (!_users.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:20px">Sin usuarios</td></tr>';
    return;
  }

  tbody.innerHTML = _users.map(u => {
    const lastLogin = u.last_sign_in ? formatDateTime(u.last_sign_in) : 'Nunca';
    const isAdmin = u.role === 'admin';
    const sedesChips = _sedes.filter(s => s.activa).map(s => {
      const granted = u.sedes_codes && u.sedes_codes.includes(s.code);
      const opacity = isAdmin ? '0.45' : '1';
      const bg = granted ? s.color + '22' : 'transparent';
      const border = granted ? s.color : 'var(--border)';
      const cursor = isAdmin ? 'not-allowed' : 'pointer';
      return `<button class="sede-chip" data-user-id="${escapeHtml(u.user_id)}" data-code="${escapeHtml(s.code)}" data-granted="${granted ? '1' : '0'}"
        style="display:inline-flex;align-items:center;gap:5px;padding:4px 9px;background:${bg};border:1.5px solid ${border};border-radius:14px;cursor:${cursor};font-size:11px;font-weight:700;color:${granted ? s.color : 'var(--muted)'};opacity:${opacity};margin:2px"
        ${isAdmin ? 'disabled title="Admin ya tiene acceso a todo"' : ''}>
        ${escapeHtml(s.icono)} ${escapeHtml(s.code)}
      </button>`;
    }).join('');

    const accesoText = isAdmin
      ? '<span style="color:var(--verde);font-weight:700;font-size:11px">TODAS (admin)</span>'
      : (u.sedes_count > 0
          ? `<span style="font-weight:700">${u.sedes_count} sede${u.sedes_count > 1 ? 's' : ''}</span>`
          : '<span style="color:var(--amber);font-size:11px">TODAS (sin restricción)</span>');

    return `<tr>
      <td style="font-weight:600">${escapeHtml(u.email)}</td>
      <td><span class="badge ${isAdmin ? 'badge-verde' : 'badge-azul'}">${escapeHtml(u.role || '—')}</span></td>
      <td style="font-size:11px;color:var(--muted)">${escapeHtml(lastLogin)}</td>
      <td>${sedesChips}</td>
      <td>${accesoText}</td>
    </tr>`;
  }).join('');

  // Cablear chips
  tbody.querySelectorAll('.sede-chip:not([disabled])').forEach(chip => {
    chip.addEventListener('click', async () => {
      const userId = chip.dataset.userId;
      const code = chip.dataset.code;
      const granted = chip.dataset.granted === '1';

      chip.disabled = true;
      const original = chip.innerHTML;
      chip.innerHTML = '...';

      const { error } = granted
        ? await supabase.rpc('admin_revoke_sede', { p_user_id: userId, p_plant_code: code })
        : await supabase.rpc('admin_grant_sede', { p_user_id: userId, p_plant_code: code, p_is_default: false });

      if (error) {
        chip.innerHTML = original;
        chip.disabled = false;
        alert('Error: ' + error.message);
      } else {
        // Recargar tabla
        const c = document.getElementById('panel-admin-sedes');
        if (c) loadAll(c);
      }
    });
  });
}

async function syncToCalidad(btn) {
  btn.disabled = true;
  const original = btn.textContent;
  btn.textContent = 'Sincronizando...';

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      alert('Necesitas estar autenticado');
      btn.textContent = original;
      btn.disabled = false;
      return;
    }
    const url = 'https://rslzosmeteyzxmgfkppe.supabase.co/functions/v1/sync-plant-to-sedes';
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
        'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJzbHpvc21ldGV5enhtZ2ZrcHBlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0OTc5NTgsImV4cCI6MjA5MDA3Mzk1OH0.XwitsLRWq10UsYshg_m2ViZh4BnV48zkJCK-JsRa9cs'
      },
      body: JSON.stringify({})
    });
    const j = await r.json();
    if (r.ok) {
      btn.textContent = `✓ Sincronizadas ${j.synced} sedes`;
    } else {
      btn.textContent = '✗ Error';
      console.error('[sync]', j);
      alert('Error sync: ' + (j.error || r.statusText));
    }
  } catch (err) {
    btn.textContent = '✗ Error red';
    alert('Error: ' + err.message);
  } finally {
    setTimeout(() => { btn.textContent = original; btn.disabled = false; }, 3000);
  }
}

function formatDateTime(iso) {
  try {
    return new Date(iso).toLocaleString('es-PE', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit', timeZone:'America/Lima' });
  } catch (_) { return '—'; }
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
