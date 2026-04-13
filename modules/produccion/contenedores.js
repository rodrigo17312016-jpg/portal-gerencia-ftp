/* Contenedores */
import { supabase } from '/assets/js/config/supabase.js';
import { fmt } from '/assets/js/utils/formatters.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const since = new Date(); since.setDate(since.getDate() - 60);
    const { data } = await supabase.from('registro_empaque_congelado')
      .select('fecha, contenedor, fruta, peso_neto, destino, estado')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha', { ascending: false });

    const recs = data || [];

    // Agrupar por contenedor
    const contenedores = {};
    recs.forEach(r => {
      const key = r.contenedor || r.fecha;
      if (!contenedores[key]) contenedores[key] = { fecha: r.fecha, contenedor: r.contenedor, fruta: r.fruta, peso: 0, destino: r.destino, estado: r.estado };
      contenedores[key].peso += r.peso_neto || 0;
    });
    const contList = Object.values(contenedores);

    const enProceso = contList.filter(c => c.estado === 'EN PROCESO' || c.estado === 'PROCESO' || !c.estado).length;
    const completados = contList.filter(c => c.estado === 'COMPLETADO' || c.estado === 'DESPACHADO').length;
    const totalTN = contList.reduce((s, c) => s + c.peso, 0) / 1000;
    const destinos = [...new Set(contList.map(c => c.destino).filter(Boolean))].length;

    setVal(container, 'contProceso', fmt(enProceso));
    setVal(container, 'contCompletados', fmt(completados));
    setVal(container, 'contTN', fmt(totalTN, 1));
    setVal(container, 'contDestinos', destinos.toString());

    // Tabla
    const tbody = container.querySelector('#contTabla');
    if (tbody) {
      if (contList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Sin contenedores registrados</td></tr>';
        return;
      }
      tbody.innerHTML = contList.slice(0, 30).map(c => {
        const estadoClass = (c.estado === 'COMPLETADO' || c.estado === 'DESPACHADO') ? 'green' : 'amber';
        return `<tr>
          <td>${c.fecha || '—'}</td>
          <td style="font-weight:600">${c.contenedor || '—'}</td>
          <td>${c.fruta || '—'}</td>
          <td style="font-family:monospace">${fmt(c.peso)}</td>
          <td>${c.destino || '—'}</td>
          <td><span class="badge badge-${estadoClass}">${c.estado || 'PROCESO'}</span></td>
        </tr>`;
      }).join('');
    }
  } catch (err) { console.error('Error contenedores:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-contenedores'); if (c) loadData(c); }
