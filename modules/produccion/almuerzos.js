/* Gestion de Almuerzos */
import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtSoles, today } from '../../assets/js/utils/formatters.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const hoy = today();
    const since = new Date(); since.setDate(since.getDate() - 14);

    const [{ data: persData }, { data: costData }] = await Promise.all([
      supabase.from('registro_personal').select('fecha, num_personal, area').gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })).order('fecha', { ascending: false }),
      supabase.from('config_costos').select('fecha, costo_almuerzo').gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })).order('fecha', { ascending: false })
    ]);

    const pers = persData || [];
    const costs = costData || [];
    const todayPers = pers.filter(r => r.fecha === hoy);
    const totalPersonalHoy = todayPers.reduce((s, r) => s + (r.num_personal || 0), 0);
    const costoAlm = costs.find(c => c.fecha === hoy)?.costo_almuerzo || 0;
    const costoTotalHoy = totalPersonalHoy * costoAlm;
    const costoPP = totalPersonalHoy > 0 ? costoTotalHoy / totalPersonalHoy : 0;

    setVal(container, 'almHoy', fmt(totalPersonalHoy));
    setVal(container, 'almCostoTotal', fmtSoles(costoTotalHoy));
    setVal(container, 'almCostoPP', costoAlm > 0 ? fmtSoles(costoPP) : '—');
    setVal(container, 'almPersonal', fmt(totalPersonalHoy));

    // Tabla de ultimos dias
    const fechas = [...new Set(pers.map(r => r.fecha))].sort().reverse().slice(0, 14);
    const tbody = container.querySelector('#almTabla');
    if (tbody) {
      if (fechas.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Sin registros</td></tr>';
        return;
      }
      tbody.innerHTML = fechas.map(f => {
        const dayPers = pers.filter(r => r.fecha === f);
        const cantidad = dayPers.reduce((s, r) => s + (r.num_personal || 0), 0);
        const costoU = costs.find(c => c.fecha === f)?.costo_almuerzo || 0;
        const costoT = cantidad * costoU;
        const areas = [...new Set(dayPers.map(r => r.area).filter(Boolean))].join(', ') || '—';
        return `<tr>
          <td>${f}</td>
          <td style="font-family:monospace">${fmt(cantidad)}</td>
          <td style="font-family:monospace">${fmtSoles(costoU)}</td>
          <td style="font-family:monospace;font-weight:700;color:var(--amber)">${fmtSoles(costoT)}</td>
          <td>${areas}</td>
        </tr>`;
      }).join('');
    }
  } catch (err) { console.error('Error almuerzos:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-almuerzos'); if (c) loadData(c); }
