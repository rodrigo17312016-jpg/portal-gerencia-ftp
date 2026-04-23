/* ════════════════════════════════════════════════════════
   EXPORT HELPERS - CSV y Excel (XLSX)
   Frutos Tropicales Peru Export S.A.C.

   CSV: nativo, sin dependencias.
   XLSX: carga SheetJS (xlsx) desde CDN on-demand.
   ════════════════════════════════════════════════════════ */

/**
 * Escapa un valor para CSV: wrap en comillas si contiene coma/quote/newline.
 */
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const s = String(value);
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/**
 * Exporta un array de objetos a CSV descargable.
 *
 * @param {Array<Object>} rows - Datos a exportar
 * @param {string} filename - Nombre del archivo (sin extension)
 * @param {Array<{key:string, label:string}>} [columns] - Columnas opcionales.
 *        Si no se pasa, usa Object.keys(rows[0]).
 *
 * @example
 * exportToCSV([{id:1,name:'a'},{id:2,name:'b'}], 'usuarios', [
 *   {key:'id', label:'ID'},
 *   {key:'name', label:'Nombre'}
 * ]);
 */
export function exportToCSV(rows, filename, columns) {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('[export] No hay datos para exportar');
    return false;
  }

  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, label: k }));

  // Header (BOM para Excel detecte UTF-8)
  const BOM = '\uFEFF';
  const header = cols.map(c => csvEscape(c.label)).join(',');
  const body = rows.map(row =>
    cols.map(c => csvEscape(row[c.key])).join(',')
  ).join('\r\n');
  const csv = BOM + header + '\r\n' + body;

  // Descargar
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = (filename || 'export') + '-' + ymd() + '.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return true;
}

/**
 * Exporta a Excel (.xlsx) usando SheetJS. Carga la libreria on-demand.
 *
 * @param {Array<Object>} rows
 * @param {string} filename - Nombre del archivo (sin extension)
 * @param {Array<{key:string, label:string}>} [columns]
 * @param {string} [sheetName='Datos']
 */
export async function exportToExcel(rows, filename, columns, sheetName = 'Datos') {
  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn('[export] No hay datos para exportar');
    return false;
  }

  // Cargar SheetJS on-demand (solo la primera vez)
  if (!window.XLSX) {
    try {
      await loadScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
    } catch (err) {
      console.error('[export] No se pudo cargar SheetJS:', err);
      // Fallback: exportar a CSV
      console.info('[export] Fallback a CSV');
      return exportToCSV(rows, filename, columns);
    }
  }

  const cols = columns || Object.keys(rows[0]).map(k => ({ key: k, label: k }));
  // Transformar rows a array de arrays (header + body)
  const aoa = [cols.map(c => c.label)];
  rows.forEach(row => {
    aoa.push(cols.map(c => row[c.key] ?? ''));
  });

  const wb = window.XLSX.utils.book_new();
  const ws = window.XLSX.utils.aoa_to_sheet(aoa);

  // Auto-size columns (aproximado)
  const colWidths = cols.map((c, i) => {
    const maxLen = Math.max(
      c.label.length,
      ...rows.slice(0, 100).map(r => String(r[c.key] ?? '').length)
    );
    return { wch: Math.min(40, Math.max(10, maxLen + 2)) };
  });
  ws['!cols'] = colWidths;

  window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
  window.XLSX.writeFile(wb, (filename || 'export') + '-' + ymd() + '.xlsx');
  return true;
}

/**
 * Helper: carga un script externo (CDN) y resuelve cuando esta listo.
 */
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
}

/**
 * Fecha formato YYYYMMDD para nombres de archivo.
 */
function ymd() {
  const d = new Date();
  return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
}

/**
 * Crea un boton de export con dropdown CSV/Excel.
 *
 * @param {Object} opts
 * @param {() => Array<Object>} opts.getData - Funcion que retorna los datos actuales (permite filtros dinamicos)
 * @param {string} opts.filename - Nombre base del archivo
 * @param {Array<{key,label}>} opts.columns
 * @param {string} [opts.sheetName]
 * @returns {HTMLElement}
 */
export function createExportButton(opts) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'position:relative;display:inline-block';
  wrap.innerHTML = `
    <button type="button" class="btn btn-sm ftp-export-btn" style="background:var(--verde);color:#fff;padding:7px 14px;border-radius:8px;font-size:12px;font-weight:700;border:none;cursor:pointer;display:inline-flex;align-items:center;gap:6px">
      ⬇ Descargar
    </button>
    <div class="ftp-export-menu" style="display:none;position:absolute;top:100%;right:0;margin-top:4px;background:var(--surface,#fff);border:1px solid var(--border,#e2e8f0);border-radius:8px;box-shadow:0 4px 16px rgba(0,0,0,0.12);z-index:100;min-width:140px;overflow:hidden">
      <button type="button" data-format="csv" style="display:block;width:100%;text-align:left;padding:10px 14px;font-size:12px;border:none;background:transparent;cursor:pointer;color:var(--texto)">📄 CSV</button>
      <button type="button" data-format="xlsx" style="display:block;width:100%;text-align:left;padding:10px 14px;font-size:12px;border:none;background:transparent;cursor:pointer;color:var(--texto);border-top:1px solid var(--border,#e2e8f0)">📊 Excel (.xlsx)</button>
    </div>
  `;

  const btn = wrap.querySelector('.ftp-export-btn');
  const menu = wrap.querySelector('.ftp-export-menu');

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  });

  document.addEventListener('click', () => { menu.style.display = 'none'; });

  menu.querySelectorAll('button[data-format]').forEach(b => {
    b.addEventListener('click', async (e) => {
      e.stopPropagation();
      menu.style.display = 'none';
      const format = b.dataset.format;
      const data = typeof opts.getData === 'function' ? opts.getData() : opts.getData;
      const filename = opts.filename || 'export';
      const columns = opts.columns;
      try {
        btn.disabled = true;
        btn.textContent = '⏳ Generando…';
        if (format === 'csv') {
          exportToCSV(data, filename, columns);
        } else {
          await exportToExcel(data, filename, columns, opts.sheetName);
        }
      } finally {
        btn.disabled = false;
        btn.innerHTML = '⬇ Descargar';
      }
    });

    b.addEventListener('mouseenter', () => b.style.background = 'var(--surface-alt,#f1f5f9)');
    b.addEventListener('mouseleave', () => b.style.background = 'transparent');
  });

  return wrap;
}
