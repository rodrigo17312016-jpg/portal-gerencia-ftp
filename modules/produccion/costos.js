/* Costos de Produccion */
import { supabase } from '../../assets/js/config/supabase.js';
import { fmt, fmtUSD, today } from '../../assets/js/utils/formatters.js';
import { createChart, getColors, getDefaultOptions } from '../../assets/js/utils/chart-helpers.js';

export async function init(container) { await loadData(container); }

async function loadData(container) {
  try {
    const since = new Date(); since.setDate(since.getDate() - 14);
    const [{ data: prodData }, { data: costData }] = await Promise.all([
      supabase.from('registro_produccion').select('fecha, producto_terminado, personal, consumo_mp').gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })).order('fecha'),
      supabase.from('config_costos').select('*').gte('fecha', since.toLocaleDateString('en-CA', { timeZone: 'America/Lima' })).order('fecha')
    ]);

    const prod = prodData || [];
    const costs = costData || [];
    const hoy = today();
    const todayRecs = prod.filter(r => r.fecha === hoy);
    const totalPT = todayRecs.reduce((s, r) => s + (r.producto_terminado || 0), 0);
    const totalPers = todayRecs.reduce((s, r) => s + (r.personal || 0), 0);
    const todayCost = costs.find(c => c.fecha === hoy);
    const costoKg = todayCost?.costo_kg_congelado || 0;

    setVal(container, 'costoTotalKg', costoKg > 0 ? fmtUSD(costoKg) : '—');
    setVal(container, 'costoMODKg', todayCost?.costo_hora_hombre ? fmtUSD(todayCost.costo_hora_hombre) : '—');
    setVal(container, 'costoPersonal', fmt(totalPers));
    setVal(container, 'costoPTAcum', fmt(totalPT) + ' kg');

    // Charts
    const colors = getColors();
    const fechas = [...new Set(prod.map(r => r.fecha))].sort().slice(-14);
    const costoPorDia = fechas.map(f => {
      const c = costs.find(cc => cc.fecha === f);
      return c?.costo_kg_congelado || 0;
    });

    createChart('chartCostoKg', {
      type: 'line',
      data: { labels: fechas.map(f => f.slice(5)), datasets: [{ label: '$/Kg', data: costoPorDia, borderColor: colors.amber.border, backgroundColor: colors.amber.bg, fill: true, tension: 0.4, pointRadius: 3 }] },
      options: getDefaultOptions('line')
    });

    createChart('chartCostoMOD', {
      type: 'bar',
      data: { labels: fechas.map(f => f.slice(5)), datasets: [{ label: 'Costo MOD', data: fechas.map(f => { const c = costs.find(cc => cc.fecha === f); return c?.costo_hora_hombre || 0; }), backgroundColor: colors.naranja.bg, borderColor: colors.naranja.border, borderWidth: 2, borderRadius: 6 }] },
      options: getDefaultOptions('bar')
    });

    // Tabla
    const tbody = container.querySelector('#costoTabla');
    if (tbody) {
      tbody.innerHTML = fechas.reverse().map(f => {
        const dayRecs = prod.filter(r => r.fecha === f);
        const pt = dayRecs.reduce((s, r) => s + (r.producto_terminado || 0), 0);
        const pers = dayRecs.reduce((s, r) => s + (r.personal || 0), 0);
        const c = costs.find(cc => cc.fecha === f);
        return `<tr><td>${f}</td><td>${fmt(pers)}</td><td style="font-family:monospace">${fmt(pt)}</td><td>${c?.costo_hora_hombre ? fmtUSD(c.costo_hora_hombre) : '—'}</td><td style="font-weight:700;color:var(--amber)">${c?.costo_kg_congelado ? fmtUSD(c.costo_kg_congelado) : '—'}</td></tr>`;
      }).join('') || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:24px">Sin datos</td></tr>';
    }
  } catch (err) { console.error('Error costos:', err); }
}

function setVal(c, id, v) { const el = c.querySelector('#' + id); if (el) el.textContent = v; }
export function refresh() { const c = document.getElementById('panel-costos'); if (c) loadData(c); }
