/* Tuneles IQF */
import { supabase } from '../../../assets/js/config/supabase.js';
import { fmt, fmtPct, today } from '../../../assets/js/utils/formatters.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const hoy = today();
    const since = new Date(); since.setDate(since.getDate() - 7);

    const { data } = await supabase.from('registro_tuneles')
      .select('*')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha', { ascending: false });

    const recs = data || [];
    const todayRecs = recs.filter(r => r.fecha === hoy);

    // KPIs
    const ciclosHoy = todayRecs.length;
    const temps = todayRecs.map(r => r.temperatura).filter(v => v != null && !isNaN(v));
    const tempProm = temps.length > 0 ? temps.reduce((s, v) => s + v, 0) / temps.length : 0;
    const kgCongelados = todayRecs.reduce((s, r) => s + (r.kg_congelado || r.peso || 0), 0);
    const capacidadMax = ciclosHoy * 1500; // estimado por ciclo
    const eficiencia = capacidadMax > 0 ? (kgCongelados / capacidadMax * 100) : 0;

    setVal(container, 'tunCiclos', ciclosHoy.toString());
    setVal(container, 'tunTemp', tempProm !== 0 ? tempProm.toFixed(1) + '°C' : '—');
    setVal(container, 'tunKg', fmt(kgCongelados));
    setVal(container, 'tunEficiencia', eficiencia > 0 ? fmtPct(eficiencia) : '—');

    // Tabla
    const tbody = container.querySelector('#tunTabla');
    if (tbody) {
      if (recs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--muted);padding:24px">Sin ciclos registrados</td></tr>';
        return;
      }
      tbody.innerHTML = recs.slice(0, 30).map(r => {
        const estadoClass = r.estado === 'COMPLETADO' ? 'green' : 'amber';
        return `<tr>
          <td>${r.fecha || '—'}</td>
          <td style="font-weight:600">${r.tunel || r.numero_tunel || '—'}</td>
          <td>${r.fruta || '—'}</td>
          <td style="font-family:monospace">${r.hora_inicio?.slice(0, 5) || '—'}</td>
          <td style="font-family:monospace">${r.hora_fin?.slice(0, 5) || '—'}</td>
          <td style="font-family:monospace;color:var(--azul);font-weight:600">${r.temperatura != null ? r.temperatura.toFixed(1) + '°' : '—'}</td>
          <td style="font-family:monospace">${fmt(r.kg_congelado || r.peso || 0)}</td>
          <td><span class="badge badge-${estadoClass}">${r.estado || 'PROCESO'}</span></td>
        </tr>`;
      }).join('');
    }
  } catch (err) { console.error('Error tuneles:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-tuneles'); if (c) loadData(c); }
