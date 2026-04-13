/* Area de Empaque */
import { supabase } from '/assets/js/config/supabase.js';
import { fmt, today } from '/assets/js/utils/formatters.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const hoy = today();
    const since = new Date(); since.setDate(since.getDate() - 7);

    const [{ data: empData }, { data: persData }] = await Promise.all([
      supabase.from('registro_empaque_congelado').select('*').gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })).order('fecha', { ascending: false }),
      supabase.from('registro_personal').select('*').eq('fecha', hoy)
    ]);

    const recs = empData || [];
    const pers = persData || [];
    const todayRecs = recs.filter(r => r.fecha === hoy);

    // KPIs
    const totalCajas = todayRecs.reduce((s, r) => s + (r.cajas || r.num_cajas || 0), 0);
    const totalKg = todayRecs.reduce((s, r) => s + (r.peso_neto || 0), 0);
    const horasUnicas = [...new Set(todayRecs.map(r => r.hora?.slice(0, 5)).filter(Boolean))].length;
    const cajasHr = horasUnicas > 0 ? Math.round(totalCajas / horasUnicas) : 0;
    const operarios = pers.reduce((s, r) => s + (r.num_personal || 0), 0);

    setVal(container, 'empCajas', fmt(totalCajas));
    setVal(container, 'empCajasHr', fmt(cajasHr));
    setVal(container, 'empKg', fmt(totalKg));
    setVal(container, 'empOperarios', fmt(operarios));

    // Tabla
    const tbody = container.querySelector('#empTabla');
    if (tbody) {
      if (recs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--muted);padding:24px">Sin registros de empaque</td></tr>';
        return;
      }
      tbody.innerHTML = recs.slice(0, 30).map(r => {
        return `<tr>
          <td>${r.fecha || '—'}</td>
          <td style="font-family:monospace">${r.hora?.slice(0, 5) || '—'}</td>
          <td>${r.fruta || '—'}</td>
          <td style="font-family:monospace;font-weight:700">${fmt(r.cajas || r.num_cajas || 0)}</td>
          <td style="font-family:monospace">${fmt(r.peso_neto || 0)}</td>
          <td>${r.presentacion || r.tipo || '—'}</td>
          <td style="font-weight:600">${r.contenedor || '—'}</td>
        </tr>`;
      }).join('');
    }
  } catch (err) { console.error('Error empaque:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-empaque'); if (c) loadData(c); }
