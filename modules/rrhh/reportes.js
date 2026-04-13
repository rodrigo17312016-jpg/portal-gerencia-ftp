/* ============================================================
   REPORTES — Centro de reportes (Headcount, PLAME, etc.)
   ============================================================ */

function genReporte(tipo) {
    const container = document.getElementById('reporteResult');
    const activos = getActiveEmps();
    let html = '';

    if (tipo === 'headcount') {
        html = `<div class="sec-title" style="margin-top:20px"><div class="icon">&#128101;</div><h2>Reporte de Headcount</h2><div class="line"></div></div>`;
        const byPlanta = {};
        activos.forEach(e => { byPlanta[e.planta] = (byPlanta[e.planta]||0)+1; });
        const byArea = {};
        activos.forEach(e => { byArea[e.area] = (byArea[e.area]||0)+1; });
        const byRegimen = {};
        activos.forEach(e => { byRegimen[e.regimen] = (byRegimen[e.regimen]||0)+1; });
        html += `<div class="detail-grid">`;
        Object.entries(byPlanta).forEach(([k,v]) => { html += `<div class="detail-item"><div class="detail-label">${k}</div><div class="detail-value">${v} empleados</div></div>`; });
        Object.entries(byRegimen).forEach(([k,v]) => { html += `<div class="detail-item"><div class="detail-label">Régimen ${k}</div><div class="detail-value">${v}</div></div>`; });
        Object.entries(byArea).forEach(([k,v]) => { html += `<div class="detail-item"><div class="detail-label">${k}</div><div class="detail-value">${v}</div></div>`; });
        html += `</div>`;
    } else if (tipo === 'costos') {
        html = `<div class="sec-title" style="margin-top:20px"><div class="icon">&#128200;</div><h2>Análisis de Costos Laborales</h2><div class="line"></div></div>`;
        let totalCosto = 0;
        html += `<div class="tbl-card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Empleado</th><th>Sueldo</th><th>Asig.Fam.</th><th>EsSalud</th><th>Gratif.Prov.</th><th>CTS Prov.</th><th>Costo Total</th></tr></thead><tbody>`;
        activos.forEach(e => {
            const asig = e.asignacionFamiliar ? calcAsigFamiliar() : 0;
            const essalud = calcEsSalud(e.sueldoBasico + asig, e.regimen);
            const gratProv = e.regimen === 'GENERAL' ? (e.sueldoBasico + asig) / 6 : 0;
            const ctsProv = e.regimen === 'GENERAL' ? ((e.sueldoBasico + (e.sueldoBasico/6)) / 12) : 0;
            const costo = e.sueldoBasico + asig + essalud + gratProv + ctsProv;
            totalCosto += costo;
            html += `<tr><td>${empName(e)}</td><td style="text-align:right">${fmt(e.sueldoBasico)}</td><td style="text-align:right">${fmt(asig)}</td><td style="text-align:right">${fmt(essalud)}</td><td style="text-align:right">${fmt(gratProv)}</td><td style="text-align:right">${fmt(ctsProv)}</td><td style="text-align:right;font-weight:800;color:var(--green-l)">${fmt(costo)}</td></tr>`;
        });
        html += `<tr class="tbl-total"><td colspan="6">COSTO LABORAL TOTAL MENSUAL</td><td style="text-align:right">${fmt(totalCosto)}</td></tr></tbody></table></div></div>`;
    } else if (tipo === 'planilla') {
        const periodos = [...new Set(payroll.map(p=>p.periodo))].sort().reverse();
        if (!periodos.length) { toast('No hay planillas generadas. Vaya a Planilla Mensual y genere una primero.','warning'); return; }
        html = `<div class="sec-title" style="margin-top:20px"><div class="icon">&#128176;</div><h2>Reporte PLAME - Planilla Mensual</h2><div class="line"></div></div>`;
        const lastPer = periodos[0];
        const data = payroll.filter(p=>p.periodo===lastPer);
        const totalBruto = data.reduce((s,p)=>s+p.totalIngresos,0);
        const totalNeto = data.reduce((s,p)=>s+p.neto,0);
        const totalPens = data.reduce((s,p)=>s+p.pensiones,0);
        const totalEss = data.reduce((s,p)=>s+p.essalud,0);
        const totalIR = data.reduce((s,p)=>s+p.ir5ta,0);
        html += `<div class="detail-grid">
            <div class="detail-item"><div class="detail-label">Período</div><div class="detail-value">${lastPer}</div></div>
            <div class="detail-item"><div class="detail-label">Trabajadores</div><div class="detail-value">${data.length}</div></div>
            <div class="detail-item"><div class="detail-label">Total Remuneraciones</div><div class="detail-value">${fmt(totalBruto)}</div></div>
            <div class="detail-item"><div class="detail-label">Total ONP/AFP</div><div class="detail-value">${fmt(totalPens)}</div></div>
            <div class="detail-item"><div class="detail-label">Total IR 5ta Cat.</div><div class="detail-value">${fmt(totalIR)}</div></div>
            <div class="detail-item"><div class="detail-label">Total EsSalud</div><div class="detail-value">${fmt(totalEss)}</div></div>
            <div class="detail-item"><div class="detail-label">Total Neto a Pagar</div><div class="detail-value" style="color:var(--green-l);font-weight:800">${fmt(totalNeto)}</div></div>
            <div class="detail-item"><div class="detail-label">Costo Empleador Total</div><div class="detail-value" style="color:var(--orange-l);font-weight:800">${fmt(totalBruto+totalEss)}</div></div>
        </div>`;
        html += `<div class="tbl-card" style="margin-top:16px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>N°</th><th>DNI</th><th>Empleado</th><th>Rég.</th><th>Días</th><th>Remuneración</th><th>ONP/AFP</th><th>IR 5ta</th><th>EsSalud</th><th>Neto</th></tr></thead><tbody>`;
        data.forEach((p,i)=>{const emp=employees.find(e=>e.id===p.empleadoId);if(!emp)return;html+=`<tr><td>${i+1}</td><td>${emp.dni}</td><td style="font-weight:700">${empName(emp)}</td><td>${emp.regimen.substring(0,3)}</td><td style="text-align:center">${p.diasTrabajados}</td><td style="text-align:right">${fmt(p.totalIngresos)}</td><td style="text-align:right;color:#f87171">${fmt(p.pensiones)}</td><td style="text-align:right;color:#f87171">${fmt(p.ir5ta)}</td><td style="text-align:right;color:var(--teal-l)">${fmt(p.essalud)}</td><td style="text-align:right;font-weight:700;color:var(--green-l)">${fmt(p.neto)}</td></tr>`;});
        html += `</tbody></table></div></div>`;
    } else if (tipo === 'asistencia') {
        const mes = new Date().toISOString().slice(0,7);
        const attMes = attendance.filter(a=>a.fecha.startsWith(mes));
        html = `<div class="sec-title" style="margin-top:20px"><div class="icon">&#128340;</div><h2>Reporte de Asistencia - ${mes}</h2><div class="line"></div></div>`;
        if (!attMes.length) { html += `<div style="padding:30px;text-align:center;color:var(--t3)">No hay registros de asistencia para este mes</div>`; }
        else {
            const emps = getActiveEmps();
            html += `<div class="tbl-card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Empleado</th><th>Planta</th><th>Asistencias</th><th>Faltas</th><th>Tardanzas</th><th>Permisos</th><th>% Asistencia</th></tr></thead><tbody>`;
            emps.forEach(e=>{
                const eAtt = attMes.filter(a=>a.empleadoId===e.id);
                const asist = eAtt.filter(a=>a.tipo==='ASISTENCIA').length;
                const faltas = eAtt.filter(a=>a.tipo==='FALTA').length;
                const tard = eAtt.filter(a=>a.tipo==='TARDANZA').length;
                const perm = eAtt.filter(a=>a.tipo==='PERMISO'||a.tipo==='VACACIONES').length;
                const pct = eAtt.length ? ((asist+tard)/eAtt.length*100).toFixed(1) : '0.0';
                html += `<tr><td style="font-weight:700">${empName(e)}</td><td>${e.planta}</td><td style="text-align:center;color:var(--green-l)">${asist}</td><td style="text-align:center;color:#f87171">${faltas}</td><td style="text-align:center;color:var(--orange-l)">${tard}</td><td style="text-align:center;color:var(--blue-l)">${perm}</td><td style="text-align:center;font-weight:700">${pct}%</td></tr>`;
            });
            html += `</tbody></table></div></div>`;
        }
    } else if (tipo === 'prestamos') {
        html = `<div class="sec-title" style="margin-top:20px"><div class="icon">&#128178;</div><h2>Reporte de Préstamos y Adelantos</h2><div class="line"></div></div>`;
        const loanActivos = loans.filter(l=>l.estado==='ACTIVO');
        const pagados = loans.filter(l=>l.estado==='PAGADO');
        html += `<div class="detail-grid">
            <div class="detail-item"><div class="detail-label">Préstamos Activos</div><div class="detail-value">${loanActivos.length}</div></div>
            <div class="detail-item"><div class="detail-label">Préstamos Pagados</div><div class="detail-value">${pagados.length}</div></div>
            <div class="detail-item"><div class="detail-label">Saldo Total Pendiente</div><div class="detail-value" style="color:#f87171">${fmt(loanActivos.reduce((s,l)=>s+l.saldoPendiente,0))}</div></div>
            <div class="detail-item"><div class="detail-label">Descuento Mensual</div><div class="detail-value">${fmt(loanActivos.reduce((s,l)=>s+l.cuotaMensual,0))}</div></div>
        </div>`;
        if (loans.length) {
            html += `<div class="tbl-card" style="margin-top:16px"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Empleado</th><th>Tipo</th><th>Monto Original</th><th>Cuotas</th><th>Pagado</th><th>Saldo</th><th>Estado</th></tr></thead><tbody>`;
            loans.forEach(l=>{const emp=employees.find(e=>e.id===l.empleadoId);html+=`<tr><td style="font-weight:700">${emp?empName(emp):'N/A'}</td><td>${l.tipo}</td><td style="text-align:right">${fmt(l.monto)}</td><td style="text-align:center">${l.pagos?l.pagos.length:0}/${l.cuotas}</td><td style="text-align:right">${fmt(l.monto-l.saldoPendiente)}</td><td style="text-align:right;font-weight:700;color:${l.saldoPendiente>0?'#f87171':'var(--green-l)'}">${fmt(l.saldoPendiente)}</td><td><span class="badge ${l.estado==='ACTIVO'?'badge-green':'badge-gray'}">${l.estado}</span></td></tr>`;});
            html += `</tbody></table></div></div>`;
        }
    } else if (tipo === 'tregistro') {
        html = `<div class="sec-title" style="margin-top:20px"><div class="icon">&#128221;</div><h2>Formato T-Registro SUNAT</h2><div class="line"></div></div>`;
        html += `<div class="tbl-card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>N°</th><th>Tipo Doc.</th><th>N° Documento</th><th>Apellidos y Nombres</th><th>F. Nacimiento</th><th>F. Ingreso</th><th>Régimen</th><th>Cat. Ocupacional</th><th>Sit. Especial</th><th>Tipo Pago</th></tr></thead><tbody>`;
        activos.forEach((e,i)=>{
            html += `<tr><td>${i+1}</td><td>DNI</td><td>${e.dni}</td><td style="font-weight:700">${e.apellidos}, ${e.nombres}</td><td>${e.fechaNacimiento||'-'}</td><td>${e.fechaIngreso}</td><td>${e.regimen==='AGRARIO'?'Rég.Agrario Ley 31110':'Rég.General D.L.728'}</td><td>${e.cargo}</td><td>${e.regimen==='AGRARIO'?'Agrario':'Ninguna'}</td><td>Depósito en cuenta</td></tr>`;
        });
        html += `</tbody></table></div></div>`;
        html += `<div class="btn-group" style="margin-top:16px"><button class="btn btn-secondary" onclick="exportTRegistroCSV()">&#128196; Exportar CSV T-Registro</button></div>`;
    }
    container.innerHTML = html;
}

function exportTRegistroCSV() {
    const activos = getActiveEmps();
    let csv = 'TipoDoc,NumDoc,Apellidos,Nombres,FechaNac,FechaIngreso,Regimen,Cargo,Planta,Turno,Pensiones\n';
    activos.forEach(e => { csv += `"DNI","${e.dni}","${e.apellidos}","${e.nombres}","${e.fechaNacimiento||''}","${e.fechaIngreso}","${e.regimen}","${e.cargo}","${e.planta}","${e.turno}","${e.sistPensiones}"\n`; });
    downloadCSV(csv, 'tregistro_ftp.csv');
    toast('T-Registro exportado correctamente', 'success');
}
