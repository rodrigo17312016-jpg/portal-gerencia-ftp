/* ============================================================
   PLANILLA — Mensual (Rég. General) + Semanal (Rég. Agrario)
   ============================================================ */

// ==================== PLANILLA MENSUAL (RÉG. GENERAL) ====================
function generarPlanilla() {
    const periodo = document.getElementById('planPeriodo').value;
    if (!periodo) return toast('Seleccione un período', 'warning');
    const [anio, mes] = periodo.split('-').map(Number);
    const activos = getActiveEmps().filter(e => e.regimen === 'GENERAL');

    if (!activos.length) return toast('No hay empleados en Régimen General para planilla mensual', 'warning');

    payroll = payroll.filter(p => p.periodo !== periodo || p.tipo === 'SEMANAL');

    let totalNeto = 0, totalBruto = 0, totalEssalud = 0;

    activos.forEach(emp => {
        const diasMes = 30;
        const attMes = attendance.filter(a => a.empleadoId === emp.id && a.fecha.startsWith(periodo));
        const diasTrab = attMes.filter(a => a.tipo === 'ASISTENCIA' || a.tipo === 'TARDANZA').length || diasMes;
        const hh25 = attMes.reduce((s,a)=>s+(a.horasExtras25||0),0);
        const hh35 = attMes.reduce((s,a)=>s+(a.horasExtras35||0),0);

        const sueldoProp = emp.sueldoBasico * (diasTrab / diasMes);
        const asigFam = emp.asignacionFamiliar ? calcAsigFamiliar() : 0;
        const hheeCalc = calcHHEE(emp.sueldoBasico, hh25, hh35);
        const totalIngresos = sueldoProp + asigFam + hheeCalc;

        let descPensiones = 0, descPensLabel = '';
        if (emp.sistPensiones === 'ONP') {
            descPensiones = calcONP(totalIngresos);
            descPensLabel = 'ONP 13%';
        } else {
            const afpCalc = calcAFP(totalIngresos, emp.sistPensiones);
            descPensiones = afpCalc.total;
            descPensLabel = emp.sistPensiones.replace('AFP_','AFP ');
        }

        const ir5ta = calcIR5taMensual(totalIngresos, mes);
        const loanDesc = loans.filter(l => l.empleadoId === emp.id && l.estado === 'ACTIVO').reduce((s,l)=>s+l.cuotaMensual,0);
        const totalDescuentos = descPensiones + ir5ta + loanDesc;
        const essalud = calcEsSalud(totalIngresos, emp.regimen);
        const neto = totalIngresos - totalDescuentos;

        payroll.push({
            id: uid(), tipo: 'MENSUAL', periodo, empleadoId: emp.id, diasTrabajados: diasTrab,
            sueldoBasico: sueldoProp, asigFamiliar: asigFam, horasExtras: hheeCalc,
            totalIngresos, pensiones: descPensiones, pensionesLabel: descPensLabel,
            ir5ta, prestamos: loanDesc, totalDescuentos, essalud, neto, estado: 'BORRADOR'
        });

        totalNeto += neto; totalBruto += totalIngresos; totalEssalud += essalud;
    });

    persist();

    document.getElementById('planKpis').innerHTML = `
        <div class="kpi"><div class="kpi-icon">&#128176;</div><div class="kpi-label">Total Bruto</div><div class="kpi-val">${fmt(totalBruto)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128178;</div><div class="kpi-label">Total Neto</div><div class="kpi-val">${fmt(totalNeto)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#127973;</div><div class="kpi-label">EsSalud 9%</div><div class="kpi-val">${fmt(totalEssalud)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128101;</div><div class="kpi-label">Empleados (General)</div><div class="kpi-val">${activos.length}</div></div>
    `;

    const periodoPayroll = payroll.filter(p => p.periodo === periodo && p.tipo === 'MENSUAL');
    document.getElementById('planBody').innerHTML = periodoPayroll.map(p => {
        const emp = employees.find(e => e.id === p.empleadoId);
        if (!emp) return '';
        return `<tr>
            <td style="font-weight:700">${empName(emp)}</td>
            <td><span class="badge badge-purple">GENERAL</span></td>
            <td style="text-align:center">${p.diasTrabajados}</td>
            <td style="text-align:right">${fmt(p.sueldoBasico)}</td>
            <td style="text-align:right">${fmt(p.asigFamiliar)}</td>
            <td style="text-align:right">${fmt(p.horasExtras)}</td>
            <td style="text-align:right;font-weight:700">${fmt(p.totalIngresos)}</td>
            <td style="text-align:right;color:#f87171">${fmt(p.pensiones)}</td>
            <td style="text-align:right;color:#f87171">${fmt(p.ir5ta)}</td>
            <td style="text-align:right;color:#f87171">${fmt(p.prestamos)}</td>
            <td style="text-align:right;color:#f87171;font-weight:700">${fmt(p.totalDescuentos)}</td>
            <td style="text-align:right;color:var(--teal-l)">${fmt(p.essalud)}</td>
            <td style="text-align:right;font-weight:900;color:var(--green-l)">${fmt(p.neto)}</td>
        </tr>`;
    }).join('');

    document.getElementById('planFooter').textContent = `${periodoPayroll.length} empleados Rég. General - Período ${periodo}`;
    document.getElementById('planTotal').textContent = fmt(totalNeto);
    toast(`Planilla mensual generada: ${periodoPayroll.length} empleados General, Neto ${fmt(totalNeto)}`, 'success', 4000);
}

function exportPlanillaCSV() {
    const periodo = document.getElementById('planPeriodo').value;
    const data = payroll.filter(p => p.periodo === periodo && p.tipo !== 'SEMANAL');
    if (!data.length) return toast('No hay planilla generada para este período', 'warning');
    let csv = 'Empleado,Regimen,Dias,Sueldo,AsigFam,HHEE,TotalIngr,Pensiones,IR5ta,Prestamos,TotalDesc,EsSalud,Neto\n';
    data.forEach(p => {
        const emp = employees.find(e => e.id === p.empleadoId);
        csv += `"${emp?empName(emp):''}","GENERAL",${p.diasTrabajados},${p.sueldoBasico.toFixed(2)},${p.asigFamiliar.toFixed(2)},${p.horasExtras.toFixed(2)},${p.totalIngresos.toFixed(2)},${p.pensiones.toFixed(2)},${p.ir5ta.toFixed(2)},${p.prestamos.toFixed(2)},${p.totalDescuentos.toFixed(2)},${p.essalud.toFixed(2)},${p.neto.toFixed(2)}\n`;
    });
    downloadCSV(csv, `planilla_mensual_${periodo}.csv`);
}

// ==================== PLANILLA SEMANAL (RÉG. AGRARIO) ====================
function initPlanillaSemanal() {
    populateSemanasSelect();
    renderRDAInfo();
    // Listener para cambio de mes
    document.getElementById('planSemMes').addEventListener('change', populateSemanasSelect);
}

function populateSemanasSelect() {
    const mesVal = document.getElementById('planSemMes').value;
    if (!mesVal) return;
    const [anio, mes] = mesVal.split('-').map(Number);
    const semanas = getSemanasDelMes(anio, mes);
    const sel = document.getElementById('planSemWeek');
    sel.innerHTML = '<option value="">Seleccione semana...</option>' +
        semanas.map(s => `<option value="${s.key}" data-lunes="${s.lunes}" data-sabado="${s.sabado}" data-domingo="${s.domingo}">${s.label}</option>`).join('');
}

function renderRDAInfo() {
    const agrarios = getActiveEmps().filter(e => e.regimen === 'AGRARIO');
    if (!agrarios.length) {
        document.getElementById('rdaInfo').innerHTML = '<div class="detail-item"><div class="detail-label">Sin empleados agrarios</div><div class="detail-value">No hay empleados en R\u00e9gimen Agrario registrados</div></div>';
        return;
    }
    const ejemplo = agrarios[0];
    const calc = calcSemanalAgrario(ejemplo.sueldoBasico, 6, false, 0, 0);
    const jornal = calcJornalBasico(ejemplo.sueldoBasico);
    document.getElementById('rdaInfo').innerHTML = `
        <div class="detail-item"><div class="detail-label">Obreros Agrarios</div><div class="detail-value" style="font-weight:800;color:var(--green-l)">${agrarios.length} trabajadores</div></div>
        <div class="detail-item"><div class="detail-label">Rem. Diaria</div><div class="detail-value" style="font-weight:800">${fmt(jornal)}</div></div>
        <div class="detail-item"><div class="detail-label">B\u00e1sico (6d)</div><div class="detail-value">${fmt(calc.basico)}</div></div>
        <div class="detail-item"><div class="detail-label">Desc. Dominical</div><div class="detail-value">${fmt(calc.dominical)}</div></div>
        <div class="detail-item"><div class="detail-label">Gratificaci\u00f3n (16.66%)</div><div class="detail-value" style="color:var(--orange-l)">${fmt(calc.gratificacion)}</div></div>
        <div class="detail-item"><div class="detail-label">Bono Ley Gratif. (6%)</div><div class="detail-value" style="color:var(--teal-l)">${fmt(calc.bonoLeyGratif)}</div></div>
        <div class="detail-item"><div class="detail-label">CTS (9.72%)</div><div class="detail-value" style="color:var(--teal-l)">${fmt(calc.cts)}</div></div>
        <div class="detail-item"><div class="detail-label">EsSalud</div><div class="detail-value">6% (empleador)</div></div>
        <div class="detail-item"><div class="detail-label">Frecuencia Pago</div><div class="detail-value" style="font-weight:800">Semanal (cada S\u00e1bado)</div></div>
        <div class="detail-item"><div class="detail-label">Per\u00edodo</div><div class="detail-value">Lunes a Domingo</div></div>
    `;
}

function generarPlanillaSemanal() {
    const mesVal = document.getElementById('planSemMes').value;
    const semSel = document.getElementById('planSemWeek');
    const semanaKey = semSel.value;
    if (!mesVal || !semanaKey) return toast('Seleccione mes y semana', 'warning');

    const opt = semSel.options[semSel.selectedIndex];
    const lunes = opt.dataset.lunes;
    const domingo = opt.dataset.domingo;
    const sabado = opt.dataset.sabado;
    const activos = getActiveEmps().filter(e => e.regimen === 'AGRARIO');

    if (!activos.length) return toast('No hay empleados en Régimen Agrario', 'warning');

    // Remove previous payroll for this week
    payroll = payroll.filter(p => p.periodoSemanal !== semanaKey);

    let totalNeto = 0, totalBruto = 0, totalEssalud = 0;

    activos.forEach(emp => {
        // Count attendance days in the week (Mon-Sat = 6 laborales)
        const attSem = attendance.filter(a => a.empleadoId === emp.id && a.fecha >= lunes && a.fecha <= sabado);
        const diasTrab = attSem.filter(a => a.tipo === 'ASISTENCIA' || a.tipo === 'TARDANZA').length || 6;
        const hh25 = attSem.reduce((s,a) => s + (a.horasExtras25 || 0), 0);
        const hh35 = attSem.reduce((s,a) => s + (a.horasExtras35 || 0), 0);

        const calc = calcSemanalAgrario(emp.sueldoBasico, diasTrab, emp.asignacionFamiliar, hh25, hh35);
        const totalRemuneraciones = calc.totalRemuneraciones;

        let descPensiones = 0, descPensLabel = '';
        if (emp.sistPensiones === 'ONP') {
            descPensiones = calcONP(totalRemuneraciones);
            descPensLabel = 'ONP 13%';
        } else {
            const afpCalc = calcAFP(totalRemuneraciones, emp.sistPensiones);
            descPensiones = afpCalc.total;
            descPensLabel = emp.sistPensiones.replace('AFP_','AFP ');
        }

        const ir5ta = calcIR5taSemanal(totalRemuneraciones);
        const loanDesc = loans.filter(l => l.empleadoId === emp.id && l.estado === 'ACTIVO').reduce((s,l) => s + Math.ceil(l.cuotaMensual / 4 * 100) / 100, 0);
        const totalDescuentos = descPensiones + ir5ta + loanDesc;
        const essalud = calcEsSalud(totalRemuneraciones, emp.regimen);
        const neto = totalRemuneraciones - totalDescuentos;

        payroll.push({
            id: uid(), tipo: 'SEMANAL', periodo: mesVal, periodoSemanal: semanaKey,
            semanaLabel: opt.textContent, fechaLunes: lunes, fechaSabado: sabado, fechaDomingo: domingo,
            empleadoId: emp.id, diasTrabajados: diasTrab,
            // Desglose remuneraciones
            basico: calc.basico,
            asigFamiliar: calc.asigFamiliar,
            dominical: calc.dominical,
            gratificacion: calc.gratificacion,
            bonoLeyGratif: calc.bonoLeyGratif,
            ctsIncluida: calc.cts,
            horasExtras25: calc.montoHHEE25,
            horasExtras35: calc.montoHHEE35,
            horasExtras: calc.montoHHEE25 + calc.montoHHEE35,
            totalIngresos: totalRemuneraciones,
            // Descuentos
            pensiones: descPensiones, pensionesLabel: descPensLabel,
            ir5ta, prestamos: loanDesc, totalDescuentos,
            // Aportes
            essalud,
            // Neto
            neto, estado: 'BORRADOR'
        });

        totalNeto += neto; totalBruto += totalRemuneraciones; totalEssalud += essalud;
    });

    persist();

    document.getElementById('planSemKpis').innerHTML = `
        <div class="kpi"><div class="kpi-icon">&#128176;</div><div class="kpi-label">Total Remuneraciones</div><div class="kpi-val">${fmt(totalBruto)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128178;</div><div class="kpi-label">Total Neto</div><div class="kpi-val">${fmt(totalNeto)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#127973;</div><div class="kpi-label">EsSalud 6%</div><div class="kpi-val">${fmt(totalEssalud)}</div></div>
        <div class="kpi"><div class="kpi-icon">&#128101;</div><div class="kpi-label">Obreros Agrarios</div><div class="kpi-val">${activos.length}</div></div>
    `;

    const semPayroll = payroll.filter(p => p.periodoSemanal === semanaKey);
    document.getElementById('planSemBody').innerHTML = semPayroll.map(p => {
        const emp = employees.find(e => e.id === p.empleadoId);
        if (!emp) return '';
        return `<tr>
            <td style="font-weight:700">${empName(emp)}</td>
            <td style="text-align:center">${p.diasTrabajados}</td>
            <td style="text-align:right">${fmt(p.basico)}</td>
            <td style="text-align:right">${fmt(p.asigFamiliar)}</td>
            <td style="text-align:right">${fmt(p.dominical)}</td>
            <td style="text-align:right;color:var(--orange-l)">${fmt(p.gratificacion)}</td>
            <td style="text-align:right;color:var(--teal-l)">${fmt(p.bonoLeyGratif)}</td>
            <td style="text-align:right;color:var(--teal-l)">${fmt(p.ctsIncluida)}</td>
            <td style="text-align:right">${fmt(p.horasExtras)}</td>
            <td style="text-align:right;font-weight:700">${fmt(p.totalIngresos)}</td>
            <td style="text-align:right;color:#f87171">${fmt(p.pensiones)}</td>
            <td style="text-align:right;color:#f87171">${fmt(p.ir5ta)}</td>
            <td style="text-align:right;color:#f87171">${fmt(p.prestamos)}</td>
            <td style="text-align:right;color:var(--teal-l)">${fmt(p.essalud)}</td>
            <td style="text-align:right;font-weight:900;color:var(--green-l)">${fmt(p.neto)}</td>
        </tr>`;
    }).join('');

    document.getElementById('planSemFooter').textContent = `${semPayroll.length} obreros agrarios — ${opt.textContent} — Pago: S\u00e1bado ${sabado}`;
    document.getElementById('planSemTotal').textContent = fmt(totalNeto);
    toast(`Planilla semanal generada: ${semPayroll.length} obreros, Neto ${fmt(totalNeto)}`, 'success', 4000);
}

function exportPlanillaSemanalCSV() {
    const semanaKey = document.getElementById('planSemWeek').value;
    const data = payroll.filter(p => p.periodoSemanal === semanaKey);
    if (!data.length) return toast('No hay planilla semanal generada para esta semana', 'warning');
    let csv = 'Empleado,DNI,Planta,Turno,Dias,Basico,AsigFam,Dominical,Gratificacion,BonoLeyGratif,CTS,HorasExtras,TotalRem,Pensiones,IR5ta,Prestamos,TotalDesc,EsSalud,Neto\n';
    data.forEach(p => {
        const emp = employees.find(e => e.id === p.empleadoId);
        csv += `"${emp?empName(emp):''}","${emp?.dni}","${emp?.planta}","${emp?.turno}",${p.diasTrabajados},${p.basico.toFixed(2)},${p.asigFamiliar.toFixed(2)},${p.dominical.toFixed(2)},${p.gratificacion.toFixed(2)},${p.bonoLeyGratif.toFixed(2)},${p.ctsIncluida.toFixed(2)},${p.horasExtras.toFixed(2)},${p.totalIngresos.toFixed(2)},${p.pensiones.toFixed(2)},${p.ir5ta.toFixed(2)},${p.prestamos.toFixed(2)},${p.totalDescuentos.toFixed(2)},${p.essalud.toFixed(2)},${p.neto.toFixed(2)}\n`;
    });
    downloadCSV(csv, `planilla_semanal_${semanaKey}.csv`);
}

// ==================== BOLETAS ====================
function populateEmpSelects() {
    const opts = '<option value="">Seleccione empleado...</option>' + employees.map(e => `<option value="${e.id}">${e.codigo} - ${empName(e)} (${e.regimen})</option>`).join('');
    ['bolEmp','liqEmp','fLoanEmp','fVacEmp'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = opts;
    });
}

function toggleBoletaTipo() {
    const tipo = document.getElementById('bolTipo').value;
    const periodoEl = document.getElementById('bolPeriodo');
    const semanaEl = document.getElementById('bolSemana');
    if (tipo === 'SEMANAL') {
        periodoEl.style.display = 'none';
        semanaEl.style.display = '';
        populateBoletaSemanas();
    } else {
        periodoEl.style.display = '';
        semanaEl.style.display = 'none';
    }
}

function populateBoletaSemanas() {
    const semanasEnPayroll = [...new Set(payroll.filter(p => p.tipo === 'SEMANAL').map(p => JSON.stringify({key: p.periodoSemanal, label: p.semanaLabel, sabado: p.fechaSabado})))];
    const sel = document.getElementById('bolSemana');
    sel.innerHTML = '<option value="">Seleccione semana...</option>' +
        semanasEnPayroll.map(s => { const o = JSON.parse(s); return `<option value="${o.key}">${o.label} (Pago: ${o.sabado})</option>`; }).join('');
}

function generarBoleta() {
    const tipo = document.getElementById('bolTipo').value;
    const empId = document.getElementById('bolEmp').value;
    if (!empId) return toast('Seleccione un empleado', 'warning');
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    if (tipo === 'SEMANAL') {
        generarBoletaSemanal(emp);
    } else {
        generarBoletaMensual(emp);
    }
}

function generarBoletaMensual(emp) {
    const periodo = document.getElementById('bolPeriodo').value;
    if (!periodo) return toast('Seleccione un período', 'warning');
    const p = payroll.find(x => x.empleadoId === emp.id && x.periodo === periodo && x.tipo !== 'SEMANAL');
    if (!p) return toast('No se encontró planilla mensual para este empleado/período. Genere la planilla primero.', 'error');

    document.getElementById('boletaContainer').innerHTML = `
    <div class="boleta">
        <h2>BOLETA DE PAGO - MENSUAL</h2>
        <div class="bol-sub">FRUTOS TROPICALES PERU EXPORT S.A.C. | RUC: 20XXXXXXXXX | Período: ${periodo}</div>
        <table><tr><th>Código</th><td>${emp.codigo}</td><th>DNI</th><td>${emp.dni}</td></tr>
        <tr><th>Empleado</th><td>${empName(emp)}</td><th>Cargo</th><td>${emp.cargo}</td></tr>
        <tr><th>Planta</th><td>${emp.planta}</td><th>Régimen</th><td><b>GENERAL</b> (D.L. 728)</td></tr>
        <tr><th>Fecha Ingreso</th><td>${emp.fechaIngreso}</td><th>Pensiones</th><td>${emp.sistPensiones}</td></tr>
        <tr><th>Frecuencia Pago</th><td colspan="3"><b>MENSUAL</b> (fin de mes)</td></tr></table>

        <table><tr><th colspan="2" style="background:#e8f5e9;text-align:center">INGRESOS</th><th colspan="2" style="background:#ffebee;text-align:center">DESCUENTOS</th></tr>
        <tr><td>Sueldo Básico</td><td style="text-align:right">${p.sueldoBasico.toFixed(2)}</td><td>${p.pensionesLabel||'Pensiones'}</td><td style="text-align:right">${p.pensiones.toFixed(2)}</td></tr>
        <tr><td>Asignación Familiar</td><td style="text-align:right">${p.asigFamiliar.toFixed(2)}</td><td>IR 5ta Categoría</td><td style="text-align:right">${p.ir5ta.toFixed(2)}</td></tr>
        <tr><td>Horas Extras</td><td style="text-align:right">${p.horasExtras.toFixed(2)}</td><td>Préstamos</td><td style="text-align:right">${p.prestamos.toFixed(2)}</td></tr>
        <tr style="font-weight:700;background:#f5f5f5"><td>TOTAL INGRESOS</td><td style="text-align:right">${p.totalIngresos.toFixed(2)}</td><td>TOTAL DESCUENTOS</td><td style="text-align:right">${p.totalDescuentos.toFixed(2)}</td></tr></table>

        <table><tr><th>Aporte Empleador - EsSalud (9%)</th><td style="text-align:right">${p.essalud.toFixed(2)}</td></tr></table>

        <div style="text-align:center;margin-top:16px;padding:12px;background:#e8f5e9;border-radius:8px">
            <div style="font-size:12px;color:#666">NETO A PAGAR</div>
            <div class="bol-total">S/ ${p.neto.toFixed(2)}</div>
        </div>
        <div style="margin-top:24px;display:flex;justify-content:space-between;font-size:10px;color:#999">
            <span>Firma Empleador: ___________________</span>
            <span>Firma Trabajador: ___________________</span>
        </div>
    </div>`;
}

function generarBoletaSemanal(emp) {
    const semanaKey = document.getElementById('bolSemana').value;
    if (!semanaKey) return toast('Seleccione una semana', 'warning');
    const p = payroll.find(x => x.empleadoId === emp.id && x.periodoSemanal === semanaKey);
    if (!p) return toast('No se encontr\u00f3 planilla semanal para este empleado/semana. Genere la planilla semanal primero.', 'error');

    const jornal = calcJornalBasico(emp.sueldoBasico);
    const pensLabel = emp.sistPensiones === 'ONP' ? 'S.N.P' : emp.sistPensiones.replace('AFP_','AFP ');

    document.getElementById('boletaContainer').innerHTML = `
    <div class="boleta">
        <h2>BOLETA DE PAGO - OBREROS AGRARIOS</h2>
        <div class="bol-sub">FRUTOS TROPICALES PERU EXPORT S.A.C. | RUC: 20607892955</div>
        <div class="bol-sub" style="font-weight:700">CORRESPONDIENTE AL PERIODO DEL ${p.fechaLunes} AL ${p.fechaDomingo || p.fechaSabado}</div>

        <table>
            <tr><th>TRAB.</th><td colspan="3" style="font-weight:700">${emp.apellidos}, ${emp.nombres}</td><th>REM.DIARIA:</th><td style="font-weight:700">${jornal.toFixed(2)}</td></tr>
            <tr><th>DNI</th><td>${emp.dni}</td><th>F.INGRESO</th><td>${emp.fechaIngreso}</td><th>SSP</th><td>${emp.sistPensiones}</td></tr>
            <tr><th>CARGO</th><td>${emp.cargo}</td><th>PLANTA</th><td>${emp.planta}</td><th>TURNO</th><td>${emp.turno}</td></tr>
        </table>

        <table>
            <tr>
                <th colspan="2" style="background:#e8f5e9;text-align:center">REMUNERACIONES</th>
                <th colspan="2" style="background:#ffebee;text-align:center">DESCUENTOS</th>
                <th colspan="2" style="background:#e0f2fe;text-align:center">APORTES EMPRESA</th>
            </tr>
            <tr>
                <td>BASICO</td><td style="text-align:right">${p.basico.toFixed(2)}</td>
                <td>${pensLabel}</td><td style="text-align:right">${p.pensiones.toFixed(2)}</td>
                <td>ESSALUD</td><td style="text-align:right">${p.essalud.toFixed(2)}</td>
            </tr>
            <tr>
                <td>ASIG. FAMILIAR</td><td style="text-align:right">${p.asigFamiliar.toFixed(2)}</td>
                <td>${p.ir5ta > 0 ? 'IR 5TA CAT.' : ''}</td><td style="text-align:right">${p.ir5ta > 0 ? p.ir5ta.toFixed(2) : ''}</td>
                <td></td><td></td>
            </tr>
            <tr>
                <td>GRATIFICACION</td><td style="text-align:right">${p.gratificacion.toFixed(2)}</td>
                <td>${p.prestamos > 0 ? 'PRESTAMOS' : ''}</td><td style="text-align:right">${p.prestamos > 0 ? p.prestamos.toFixed(2) : ''}</td>
                <td></td><td></td>
            </tr>
            <tr>
                <td>DESC.DOMINICAL</td><td style="text-align:right">${p.dominical.toFixed(2)}</td>
                <td></td><td></td>
                <td></td><td></td>
            </tr>
            <tr>
                <td>BONO LEY GRATI</td><td style="text-align:right">${p.bonoLeyGratif.toFixed(2)}</td>
                <td></td><td></td>
                <td></td><td></td>
            </tr>
            <tr>
                <td>C.T.S.</td><td style="text-align:right">${p.ctsIncluida.toFixed(2)}</td>
                <td></td><td></td>
                <td></td><td></td>
            </tr>
            ${p.horasExtras > 0 ? `<tr>
                <td>IMP.HOR.EXT.</td><td style="text-align:right">${p.horasExtras.toFixed(2)}</td>
                <td></td><td></td>
                <td></td><td></td>
            </tr>` : ''}
            <tr style="font-weight:700;background:#f5f5f5;border-top:2px solid #333">
                <td>TOT.REM.:</td><td style="text-align:right">${p.totalIngresos.toFixed(2)}</td>
                <td>TOT.DESC.:</td><td style="text-align:right">${p.totalDescuentos.toFixed(2)}</td>
                <td>TOT.APOR</td><td style="text-align:right">${p.essalud.toFixed(2)}</td>
            </tr>
        </table>

        <div style="text-align:center;margin-top:16px;padding:16px;background:#e8f5e9;border-radius:8px">
            <div style="font-size:12px;color:#666">NETO A PAGAR</div>
            <div class="bol-total">S/ ${p.neto.toFixed(2)}</div>
            <div style="font-size:11px;color:#666;margin-top:4px">D\u00edas trabajados: ${p.diasTrabajados} | Pago: S\u00e1bado ${p.fechaSabado}</div>
        </div>

        <div style="margin-top:8px;padding:8px;background:#fff8e1;border-radius:6px;font-size:10px;color:#b45309;text-align:center">
            Ley 31110 \u2014 R\u00e9gimen Agrario: CTS (9.72%) y Gratificaciones (16.66%) incluidas. Bono Ley Gratif. = Gratif. \u00d7 6% (EsSalud Agrario).
        </div>
        <div style="margin-top:20px;display:flex;justify-content:space-between;font-size:10px;color:#999">
            <span>Firma Empleador: ___________________</span>
            <span>Firma Trabajador: ___________________</span>
        </div>
    </div>`;
}
