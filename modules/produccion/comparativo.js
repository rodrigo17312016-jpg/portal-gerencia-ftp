/* Comparativo Turnos */
import { supabase } from '/assets/js/config/supabase.js';
import { fmt, fmtPct } from '/assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '/assets/js/utils/chart-helpers.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const since = new Date(); since.setDate(since.getDate() - 30);
    const { data } = await supabase.from('registro_produccion')
      .select('fecha, producto_terminado, turno')
      .gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' }))
      .order('fecha');

    const recs = data || [];
    if (recs.length === 0) return;

    const isDia = r => r.turno === 'DIA' || r.turno === 'TURNO DIA';
    const totalDia = recs.filter(isDia).reduce((s, r) => s + (r.producto_terminado || 0), 0);
    const totalNoche = recs.filter(r => !isDia(r)).reduce((s, r) => s + (r.producto_terminado || 0), 0);
    const diff = totalDia > 0 ? ((totalDia - totalNoche) / totalDia * 100) : 0;
    const mejor = totalDia >= totalNoche ? 'DIA' : 'NOCHE';

    setVal(container, 'compDia', fmt(totalDia));
    setVal(container, 'compNoche', fmt(totalNoche));
    setVal(container, 'compDiff', fmtPct(Math.abs(diff)));
    setVal(container, 'compMejor', mejor);

    // Chart
    const colors = getColors();
    const fechas = [...new Set(recs.map(r => r.fecha))].sort().slice(-14);
    const diaPorFecha = fechas.map(f => recs.filter(r => r.fecha === f && isDia(r)).reduce((s, r) => s + (r.producto_terminado || 0), 0));
    const nochePorFecha = fechas.map(f => recs.filter(r => r.fecha === f && !isDia(r)).reduce((s, r) => s + (r.producto_terminado || 0), 0));

    createChart('chartCompTurnos', {
      type: 'bar',
      data: {
        labels: fechas.map(f => f.slice(5)),
        datasets: [
          { label: 'Turno Dia', data: diaPorFecha, backgroundColor: colors.amber.bg, borderColor: colors.amber.border, borderWidth: 2, borderRadius: 6 },
          { label: 'Turno Noche', data: nochePorFecha, backgroundColor: colors.azul.bg, borderColor: colors.azul.border, borderWidth: 2, borderRadius: 6 }
        ]
      },
      options: { ...getDefaultOptions('bar'), plugins: { legend: { display: true, labels: { color: '#64748b', font: { size: 11 } } } } }
    });

    // Tabla
    const tbody = container.querySelector('#compTabla');
    if (tbody) {
      tbody.innerHTML = fechas.reverse().map((f, i) => {
        const idx = fechas.length - 1 - i;
        const ptD = diaPorFecha[idx] || 0;
        const ptN = nochePorFecha[idx] || 0;
        const total = ptD + ptN;
        const diffDay = ptD > 0 ? ((ptD - ptN) / ptD * 100).toFixed(1) : '0';
        const mejorDay = ptD >= ptN ? 'DIA' : 'NOCHE';
        return `<tr>
          <td>${f}</td>
          <td style="font-family:monospace">${fmt(ptD)}</td>
          <td style="font-family:monospace">${fmt(ptN)}</td>
          <td style="font-family:monospace;font-weight:700">${fmt(total)}</td>
          <td style="color:var(--verde);font-weight:600">${diffDay}%</td>
          <td><span class="badge badge-${mejorDay === 'DIA' ? 'amber' : 'azul'}">${mejorDay}</span></td>
        </tr>`;
      }).join('') || '<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Sin datos</td></tr>';
    }
  } catch (err) { console.error('Error comparativo:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-comparativo'); if (c) loadData(c); }
