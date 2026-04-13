/* Programa de Produccion */
import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../assets/js/utils/formatters.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const hoy = today();
    const d = new Date(hoy + 'T00:00:00');
    const dayOfWeek = d.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d); monday.setDate(d.getDate() + mondayOffset);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const fmtISO = dt => dt.toLocaleDateString('en-CA', { timeZone: 'America/Lima' });
    const startWeek = fmtISO(monday);
    const endWeek = fmtISO(sunday);

    const { data } = await supabase.from('registro_produccion')
      .select('fecha, fruta, consumo_kg, pt_aprox_kg, turno')
      .gte('fecha', startWeek)
      .lte('fecha', endWeek)
      .order('fecha');

    const recs = data || [];
    const totalPT = recs.reduce((s, r) => s + (r.pt_aprox_kg || 0), 0);
    const totalMP = recs.reduce((s, r) => s + (r.consumo_kg || 0), 0);
    const programado = totalMP > 0 ? totalMP * 1.2 : 0;
    const cumplimiento = programado > 0 ? (totalPT / programado * 100) : 0;

    const daysInWeek = Math.min(7, Math.max(0, Math.ceil((sunday - new Date()) / 86400000)));

    setVal(container, 'progProgramado', fmt(programado));
    setVal(container, 'progEjecutado', fmt(totalPT));
    setVal(container, 'progCumplimiento', fmtPct(cumplimiento));
    setVal(container, 'progDiasRest', daysInWeek.toString());

    // Tabla
    const tbody = container.querySelector('#progTabla');
    if (tbody) {
      if (recs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Sin registros esta semana</td></tr>';
        return;
      }
      tbody.innerHTML = recs.map(r => {
        const rend = r.consumo_kg > 0 ? (r.pt_aprox_kg / r.consumo_kg * 100).toFixed(1) : '-';
        const estado = r.pt_aprox_kg > 0 ? 'Ejecutado' : 'Pendiente';
        return `<tr>
          <td>${r.fecha}</td>
          <td>${r.fruta || '—'}</td>
          <td style="font-family:monospace">${fmt(r.consumo_kg)}</td>
          <td style="font-family:monospace;font-weight:700">${fmt(r.pt_aprox_kg)}</td>
          <td style="color:var(--verde);font-weight:600">${rend}%</td>
          <td><span class="badge badge-${r.turno === 'DIA' ? 'amber' : 'azul'}">${r.turno || '—'}</span></td>
          <td><span class="badge badge-${estado === 'Ejecutado' ? 'green' : 'amber'}">${estado}</span></td>
        </tr>`;
      }).join('');
    }
  } catch (err) { console.error('Error programa:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-programa'); if (c) loadData(c); }
