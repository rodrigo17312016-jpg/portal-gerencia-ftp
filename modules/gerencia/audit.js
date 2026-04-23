/* ════════════════════════════════════════════════════════
   AUDIT LOG - Trazabilidad de cambios (admin only)
   ════════════════════════════════════════════════════════ */

import { supabase } from '../../assets/js/config/supabase.js';
import { escapeHtml } from '../../assets/js/utils/dom-helpers.js';
import { createExportButton } from '../../assets/js/utils/export-helpers.js';

let allData = [];

export async function init(container) {
  // Botones
  container.querySelector('#auditRefresh')?.addEventListener('click', () => loadData(container));
  container.querySelector('#auditFilterTable')?.addEventListener('change', () => renderTable(container));
  container.querySelector('#auditFilterOp')?.addEventListener('change', () => renderTable(container));

  // Boton de export CSV/Excel (insertarlo antes del boton refresh)
  const refreshBtn = container.querySelector('#auditRefresh');
  if (refreshBtn && !container.querySelector('.ftp-export-btn')) {
    const exportBtn = createExportButton({
      getData: () => getFiltered(container),
      filename: 'audit-log',
      sheetName: 'Audit Log',
      columns: [
        { key: 'occurred_at', label: 'Fecha' },
        { key: 'user_email', label: 'Usuario' },
        { key: 'user_role', label: 'Rol' },
        { key: 'table_name', label: 'Tabla' },
        { key: 'operation', label: 'Operacion' },
        { key: 'row_id', label: 'Row ID' },
        { key: 'changed_fields_str', label: 'Campos Cambiados' }
      ]
    });
    refreshBtn.parentNode.insertBefore(exportBtn, refreshBtn);
  }

  await loadData(container);
}

// Retorna data filtrada + formatea fecha y campos para export
function getFiltered(container) {
  const tableFilter = container.querySelector('#auditFilterTable')?.value || '';
  const opFilter = container.querySelector('#auditFilterOp')?.value || '';
  let filtered = [...allData];
  if (tableFilter) filtered = filtered.filter(r => r.table_name === tableFilter);
  if (opFilter) filtered = filtered.filter(r => r.operation === opFilter);
  return filtered.map(r => ({
    ...r,
    occurred_at: new Date(r.occurred_at).toLocaleString('es-PE'),
    changed_fields_str: Array.isArray(r.changed_fields) ? r.changed_fields.join(', ') : ''
  }));
}

async function loadData(container) {
  const tbody = container.querySelector('#auditTbody');
  if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--muted)">Cargando…</td></tr>';

  try {
    const { data, error } = await supabase
      .from('audit_log')
      .select('occurred_at, user_email, user_role, table_name, operation, row_id, changed_fields')
      .order('occurred_at', { ascending: false })
      .limit(500);

    if (error) {
      if (error.code === 'PGRST301' || error.message.includes('permission')) {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--naranja)">Acceso restringido: solo admin puede ver audit log</td></tr>';
      } else {
        if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--naranja)">Error: ' + escapeHtml(error.message) + '</td></tr>';
      }
      return;
    }

    allData = data || [];
    populateTableFilter(container);
    renderTable(container);

    const countEl = container.querySelector('#auditCount');
    if (countEl) countEl.textContent = allData.length + ' eventos (ultimos 500)';
  } catch (err) {
    console.error('Error audit:', err);
    if (tbody) tbody.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--naranja)">Error de red</td></tr>';
  }
}

function populateTableFilter(container) {
  const sel = container.querySelector('#auditFilterTable');
  if (!sel) return;
  const tables = [...new Set(allData.map(r => r.table_name).filter(Boolean))].sort();
  sel.innerHTML = '<option value="">Todas las tablas</option>' +
    tables.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
}

function renderTable(container) {
  const tbody = container.querySelector('#auditTbody');
  if (!tbody) return;

  const tableFilter = container.querySelector('#auditFilterTable')?.value || '';
  const opFilter = container.querySelector('#auditFilterOp')?.value || '';

  let filtered = [...allData];
  if (tableFilter) filtered = filtered.filter(r => r.table_name === tableFilter);
  if (opFilter) filtered = filtered.filter(r => r.operation === opFilter);

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:40px;text-align:center;color:var(--muted)">Sin registros con esos filtros</td></tr>';
    return;
  }

  const opColors = { INSERT: 'var(--verde)', UPDATE: 'var(--amber)', DELETE: 'var(--rojo)' };
  const opBg = { INSERT: 'var(--verde-bg)', UPDATE: 'var(--amber-bg)', DELETE: 'var(--rojo-bg)' };

  tbody.innerHTML = filtered.map(r => {
    const dt = new Date(r.occurred_at);
    const dtStr = dt.toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'medium' });
    const changed = Array.isArray(r.changed_fields) && r.changed_fields.length
      ? r.changed_fields.slice(0, 4).map(f => `<span style="background:var(--surface-alt,#f1f5f9);padding:2px 6px;border-radius:4px;font-size:10px;margin-right:4px">${escapeHtml(f)}</span>`).join('')
      : '<span style="color:var(--muted);font-size:11px">—</span>';
    return `<tr style="border-top:1px solid var(--border)">
      <td style="padding:10px;font-family:monospace;font-size:11px;white-space:nowrap">${escapeHtml(dtStr)}</td>
      <td style="padding:10px;font-weight:600">${escapeHtml(r.user_email || '—')}</td>
      <td style="padding:10px"><span style="padding:2px 8px;border-radius:6px;font-size:10px;font-weight:700;background:var(--surface-alt,#f1f5f9)">${escapeHtml(r.user_role || '—')}</span></td>
      <td style="padding:10px;font-family:monospace;font-size:11px">${escapeHtml(r.table_name)}</td>
      <td style="padding:10px"><span style="padding:3px 10px;border-radius:6px;font-size:10px;font-weight:800;color:${opColors[r.operation]};background:${opBg[r.operation]}">${escapeHtml(r.operation)}</span></td>
      <td style="padding:10px;font-family:monospace;font-size:10px;color:var(--muted)">${escapeHtml((r.row_id || '').substring(0, 12))}</td>
      <td style="padding:10px">${changed}</td>
    </tr>`;
  }).join('');
}
