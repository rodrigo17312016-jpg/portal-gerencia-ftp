/* Area de Recepcion */
import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../../assets/js/utils/formatters.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const since = new Date(); since.setDate(since.getDate() - 14);
    const { data } = await supabase.from('registro_produccion')
      .select('fecha, fruta, consumo_mp, lote, calidad, brix, proveedor')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha', { ascending: false });

    const recs = data || [];
    const hoy = today();
    const todayRecs = recs.filter(r => r.fecha === hoy);

    // KPIs
    const totalMP = todayRecs.reduce((s, r) => s + (r.consumo_mp || 0), 0);
    const tnRecep = totalMP / 1000;
    const lotesUnicos = [...new Set(todayRecs.map(r => r.lote).filter(Boolean))].length;
    const calidadA = todayRecs.filter(r => r.calidad === 'A' || r.calidad === 'A+').length;
    const pctCalidad = todayRecs.length > 0 ? (calidadA / todayRecs.length * 100) : 0;
    const brixValues = todayRecs.map(r => r.brix).filter(v => v != null && !isNaN(v));
    const brixProm = brixValues.length > 0 ? brixValues.reduce((s, v) => s + v, 0) / brixValues.length : 0;

    setVal(container, 'recTN', fmt(tnRecep, 1));
    setVal(container, 'recCalidad', fmtPct(pctCalidad));
    setVal(container, 'recLotes', lotesUnicos.toString());
    setVal(container, 'recBrix', brixProm > 0 ? brixProm.toFixed(1) + '°' : '—');

    // Tabla
    const tbody = container.querySelector('#recTabla');
    if (tbody) {
      if (recs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Sin lotes recibidos</td></tr>';
        return;
      }
      tbody.innerHTML = recs.slice(0, 25).map(r => {
        const calidadClass = (r.calidad === 'A' || r.calidad === 'A+') ? 'green' : 'amber';
        return `<tr>
          <td>${r.fecha || '—'}</td>
          <td>${r.fruta || '—'}</td>
          <td style="font-weight:600">${r.lote || '—'}</td>
          <td style="font-family:monospace">${fmt(r.consumo_mp)}</td>
          <td><span class="badge badge-${calidadClass}">${r.calidad || '—'}</span></td>
          <td style="font-family:monospace">${r.brix != null ? r.brix.toFixed(1) + '°' : '—'}</td>
          <td>${r.proveedor || '—'}</td>
        </tr>`;
      }).join('');
    }
  } catch (err) { console.error('Error recepcion:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-recepcion'); if (c) loadData(c); }
