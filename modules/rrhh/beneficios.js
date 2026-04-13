/* ============================================================
   BENEFICIOS — CTS, Gratificaciones, Vacaciones
   ============================================================ */

// ==================== CTS ====================
function calcularCTS() {
    const periodo = document.getElementById('ctsPeriodo').value;
    const anio = parseInt(document.getElementById('ctsAnio').value);
    const activos = getActiveEmps().filter(e => e.regimen === 'GENERAL');
    let totalCTS = 0;

    const rows = activos.map(emp => {
        const fechaIng = new Date(emp.fechaIngreso);
        const mesesTrab = Math.min(6, diffMonths(fechaIng, new Date(anio, periodo==='MAYO'?4:10, 1)));
        if (mesesTrab <= 0) return null;
        const gratif = emp.sueldoBasico / 6;
        const remuComp = emp.sueldoBasico + gratif;
        const cts = (remuComp / 12) * mesesTrab;
        totalCTS += cts;
        return `<tr><td>${empName(emp)}</td><td><span class="badge badge-purple">GENERAL</span></td><td style="text-align:right">${fmt(emp.sueldoBasico)}</td><td style="text-align:right">${fmt(gratif)}</td><td style="text-align:right">${fmt(remuComp)}</td><td style="text-align:center">${mesesTrab}</td><td style="text-align:center">0</td><td style="text-align:right;font-weight:800;color:var(--green-l)">${fmt(cts)}</td></tr>`;
    }).filter(Boolean);

    const agrarios = getActiveEmps().filter(e => e.regimen === 'AGRARIO');
    rows.push(`<tr class="tbl-total"><td colspan="7">Subtotal Régimen General (${activos.length} empleados)</td><td style="text-align:right">${fmt(totalCTS)}</td></tr>`);
    if (agrarios.length) {
        const ejRda = calcRDA(agrarios[0].sueldoBasico);
        rows.push(`<tr><td colspan="8" style="padding:16px;background:var(--bg3);border-radius:8px">
            <div style="color:var(--teal-l);font-weight:700;margin-bottom:8px">&#9432; ${agrarios.length} empleados en Régimen Agrario — Ley 31110</div>
            <div style="color:var(--t2);font-size:13px;line-height:1.8">
                La CTS está <b>incluida en la Remuneración Diaria Agraria (RDA)</b> como el <b>9.72%</b> del jornal básico diario.<br>
                Ejemplo (sueldo base ${fmt(agrarios[0].sueldoBasico)}): Jornal ${fmt(ejRda.jornal)} × 9.72% = <b>${fmt(ejRda.ctsDiaria)}/día</b> de CTS incluida.<br>
                <span style="color:var(--orange-l)">No requiere depósito semestral separado — ya se paga semanalmente con cada jornal.</span>
            </div>
        </td></tr>`);
    }

    document.getElementById('ctsBody').innerHTML = rows.join('');
    document.getElementById('ctsFooter').textContent = `${activos.length} empleados Régimen General`;
    document.getElementById('ctsTotal').textContent = fmt(totalCTS);
    document.getElementById('ctsKpis').innerHTML = `
        <div class="kpi"><div class="kpi-icon">&#127974;</div><div class="kpi-label">Total CTS a Depositar</div><div class="kpi-val">${fmt(totalCTS)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128101;</div><div class="kpi-label">Empleados Reg. General</div><div class="kpi-val">${activos.length}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128196;</div><div class="kpi-label">Período</div><div class="kpi-val" style="font-size:18px">${periodo} ${anio}</div></div>
    `;
}

function exportCTSCSV() {
    const activos = getActiveEmps().filter(e => e.regimen === 'GENERAL');
    if (!activos.length) return toast('No hay datos de CTS para exportar', 'warning');
    let csv = 'Empleado,Regimen,Sueldo,1/6 Gratif,Remun.Comp.,Meses,CTS\n';
    activos.forEach(emp => {
        const gratif = emp.sueldoBasico / 6;
        const remuComp = emp.sueldoBasico + gratif;
        const cts = (remuComp / 12) * 6;
        csv += `"${empName(emp)}","GENERAL",${emp.sueldoBasico.toFixed(2)},${gratif.toFixed(2)},${remuComp.toFixed(2)},6,${cts.toFixed(2)}\n`;
    });
    downloadCSV(csv, 'cts_deposito.csv');
    toast('CTS exportado a CSV correctamente', 'success');
}

// ==================== GRATIFICACIONES ====================
function calcularGratificacion() {
    const periodo = document.getElementById('gratPeriodo').value;
    const anio = parseInt(document.getElementById('gratAnio').value);
    const activos = getActiveEmps();
    let total = 0;

    const rows = activos.map(emp => {
        if (emp.regimen === 'AGRARIO') return null;
        const fechaIng = new Date(emp.fechaIngreso);
        const mesRef = periodo === 'JULIO' ? 6 : 11;
        const meses = Math.min(6, diffMonths(fechaIng, new Date(anio, mesRef, 30)));
        if (meses <= 0) return null;
        const asigFam = emp.asignacionFamiliar ? calcAsigFamiliar() : 0;
        const base = emp.sueldoBasico + asigFam;
        const gratif = base * (meses / 6);
        const bonif = gratif * 0.09;
        const totalGrat = gratif + bonif;
        total += totalGrat;
        return `<tr><td>${empName(emp)}</td><td><span class="badge badge-purple">GENERAL</span></td><td style="text-align:right">${fmt(emp.sueldoBasico)}</td><td style="text-align:right">${fmt(asigFam)}</td><td style="text-align:center">${meses}/6</td><td style="text-align:right">${fmt(gratif)}</td><td style="text-align:right">${fmt(bonif)}</td><td style="text-align:right;font-weight:800;color:var(--green-l)">${fmt(totalGrat)}</td></tr>`;
    }).filter(Boolean);

    const agrarios = activos.filter(e => e.regimen === 'AGRARIO');
    if (agrarios.length) {
        const ejRda = calcRDA(agrarios[0].sueldoBasico);
        rows.push(`<tr><td colspan="8" style="padding:16px;background:var(--bg3);border-radius:8px">
            <div style="color:var(--teal-l);font-weight:700;margin-bottom:8px">&#9432; ${agrarios.length} empleados en Régimen Agrario — Ley 31110</div>
            <div style="color:var(--t2);font-size:13px;line-height:1.8">
                La Gratificación está <b>incluida en la Remuneración Diaria Agraria (RDA)</b> como el <b>16.66%</b> del jornal básico diario.<br>
                Ejemplo (sueldo base ${fmt(agrarios[0].sueldoBasico)}): Jornal ${fmt(ejRda.jornal)} × 16.66% = <b>${fmt(ejRda.gratifDiaria)}/día</b> de gratificación incluida.<br>
                <span style="color:var(--orange-l)">No corresponde pago de gratificación separada en julio/diciembre — ya se paga semanalmente con cada jornal.</span>
            </div>
        </td></tr>`);
    }

    document.getElementById('gratBody').innerHTML = rows.join('');
    document.getElementById('gratFooter').textContent = `${rows.length-1} empleados Régimen General`;
    document.getElementById('gratTotal').textContent = fmt(total);
    document.getElementById('gratKpis').innerHTML = `
        <div class="kpi"><div class="kpi-icon">&#127873;</div><div class="kpi-label">Total Gratificación</div><div class="kpi-val">${fmt(total)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128176;</div><div class="kpi-label">Bonif. Extraordinaria 9%</div><div class="kpi-val">${fmt(total*0.09/(1.09))}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128197;</div><div class="kpi-label">Período</div><div class="kpi-val" style="font-size:18px">${periodo} ${anio}</div></div>
    `;
}

// ==================== VACACIONES ====================
function renderVacaciones() {
    const search = (document.getElementById('vacSearch')?.value||'').toLowerCase();
    const emps = getActiveEmps().filter(e => {
        if (search) return [e.nombres,e.apellidos,e.codigo].join(' ').toLowerCase().includes(search);
        return true;
    });
    const now = new Date();
    document.getElementById('vacBody').innerHTML = emps.map(e => {
        const ingreso = new Date(e.fechaIngreso);
        const anios = ((now - ingreso) / (365.25*24*60*60*1000));
        const derecho = 30;
        const derechoTotal = Math.floor(anios) * derecho;
        const tomados = vacations.filter(v => v.empleadoId === e.id).reduce((s,v) => s + v.dias, 0);
        const saldo = derechoTotal - tomados;
        return `<tr>
            <td style="font-weight:700">${empName(e)}</td>
            <td>${e.fechaIngreso}</td>
            <td style="text-align:center">${anios.toFixed(1)}</td>
            <td style="text-align:center">${derechoTotal}</td>
            <td style="text-align:center">${tomados}</td>
            <td style="text-align:center;font-weight:800;color:${saldo>0?'var(--green-l)':'#f87171'}">${saldo}</td>
            <td><span class="badge ${saldo>0?'badge-green':'badge-red'}">${saldo>0?'Disponible':'Agotado'}</span></td>
        </tr>`;
    }).join('');
}

function openVacModal() { populateEmpSelects(); document.getElementById('vacModal').classList.add('show'); }

function saveVacacion(e) {
    e.preventDefault();
    const empId = document.getElementById('fVacEmp').value;
    const inicio = new Date(document.getElementById('fVacInicio').value);
    const fin = new Date(document.getElementById('fVacFin').value);
    const dias = Math.ceil((fin - inicio) / (24*60*60*1000)) + 1;
    vacations.push({ id: uid(), empleadoId: empId, fechaInicio: document.getElementById('fVacInicio').value, fechaFin: document.getElementById('fVacFin').value, dias, obs: document.getElementById('fVacObs').value });
    persist();
    closeModal('vacModal');
    renderVacaciones();
    toast(`Vacaciones registradas: ${dias} días`, 'success');
}
