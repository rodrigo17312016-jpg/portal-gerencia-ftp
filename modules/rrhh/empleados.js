/* ============================================================
   EMPLEADOS — CRUD, Filtros, Exportación
   ============================================================ */

function renderEmpleados() {
    const search = (document.getElementById('empSearch')?.value||'').toLowerCase();
    const fPlanta = document.getElementById('empFilterPlanta')?.value||'';
    const fRegimen = document.getElementById('empFilterRegimen')?.value||'';
    const fArea = document.getElementById('empFilterArea')?.value||'';
    const fEstado = document.getElementById('empFilterEstado')?.value||'';

    let filtered = employees.filter(e => {
        if (fPlanta && e.planta !== fPlanta) return false;
        if (fRegimen && e.regimen !== fRegimen) return false;
        if (fArea && e.area !== fArea) return false;
        if (fEstado && e.estado !== fEstado) return false;
        if (search) {
            const h = [e.codigo,e.dni,e.nombres,e.apellidos,e.cargo,e.area].join(' ').toLowerCase();
            if (!h.includes(search)) return false;
        }
        return true;
    });

    const tbody = document.getElementById('empBody');
    tbody.innerHTML = filtered.map(e => `<tr>
        <td>${e.codigo}</td>
        <td>${e.dni}</td>
        <td style="font-weight:700">${empName(e)}</td>
        <td><span class="badge ${e.planta==='PLANTA HUAURA'?'badge-green':'badge-blue'}">${e.planta}</span></td>
        <td>${e.turno}</td>
        <td><span class="badge ${e.regimen==='AGRARIO'?'badge-teal':'badge-purple'}">${e.regimen}</span></td>
        <td>${e.area}</td>
        <td>${e.cargo}</td>
        <td style="text-align:right;font-weight:700">${fmt(e.sueldoBasico)}</td>
        <td><span class="badge badge-gray">${e.sistPensiones.replace('AFP_','')}</span></td>
        <td><span class="badge ${e.estado==='ACTIVO'?'badge-green':'badge-red'}">${e.estado}</span></td>
        <td><button class="btn btn-sm btn-secondary" onclick="editEmpleado('${e.id}')">&#9998;</button> <button class="btn btn-sm btn-danger" onclick="deleteEmpleado('${e.id}')">&#128465;</button></td>
    </tr>`).join('');
    document.getElementById('empFooter').textContent = `${filtered.length} empleados encontrados`;
    document.getElementById('empCount').textContent = getActiveEmps().length;
}

function openEmpModal(id) {
    document.getElementById('empModalTitle').textContent = id ? 'Editar Empleado' : 'Nuevo Empleado';
    document.getElementById('fEmpId').value = id || '';
    if (id) {
        const e = employees.find(x => x.id === id);
        if (!e) return;
        document.getElementById('fEmpCodigo').value = e.codigo;
        document.getElementById('fEmpDni').value = e.dni;
        document.getElementById('fEmpNombres').value = e.nombres;
        document.getElementById('fEmpApellidos').value = e.apellidos;
        document.getElementById('fEmpFechaNac').value = e.fechaNacimiento||'';
        document.getElementById('fEmpFechaIng').value = e.fechaIngreso;
        document.getElementById('fEmpPlanta').value = e.planta;
        document.getElementById('fEmpTurno').value = e.turno;
        document.getElementById('fEmpRegimen').value = e.regimen;
        document.getElementById('fEmpArea').value = e.area;
        document.getElementById('fEmpCargo').value = e.cargo;
        document.getElementById('fEmpSueldo').value = e.sueldoBasico;
        document.getElementById('fEmpAsigFam').value = String(e.asignacionFamiliar);
        document.getElementById('fEmpPensiones').value = e.sistPensiones;
        document.getElementById('fEmpContrato').value = e.tipoContrato;
        document.getElementById('fEmpEstado').value = e.estado;
        document.getElementById('fEmpTelefono').value = e.telefono||'';
        document.getElementById('fEmpDireccion').value = e.direccion||'';
    } else {
        document.getElementById('empForm').reset();
        document.getElementById('fEmpCodigo').value = 'EMP-' + String(employees.length+1).padStart(3,'0');
        document.getElementById('fEmpSueldo').value = CFG.rmv;
    }
    document.getElementById('empModal').classList.add('show');
}

function editEmpleado(id) { openEmpModal(id); }

function deleteEmpleado(id) {
    showConfirm('¿Está seguro de eliminar este empleado? Esta acción no se puede deshacer.', () => {
        employees = employees.filter(e => e.id !== id);
        persist(); renderEmpleados();
        toast('Empleado eliminado correctamente', 'success');
    });
}

function saveEmpleado(e) {
    e.preventDefault();
    const id = document.getElementById('fEmpId').value;
    const data = {
        id: id || uid(),
        codigo: document.getElementById('fEmpCodigo').value,
        dni: document.getElementById('fEmpDni').value,
        nombres: document.getElementById('fEmpNombres').value,
        apellidos: document.getElementById('fEmpApellidos').value,
        fechaNacimiento: document.getElementById('fEmpFechaNac').value,
        fechaIngreso: document.getElementById('fEmpFechaIng').value,
        planta: document.getElementById('fEmpPlanta').value,
        turno: document.getElementById('fEmpTurno').value,
        regimen: document.getElementById('fEmpRegimen').value,
        area: document.getElementById('fEmpArea').value,
        cargo: document.getElementById('fEmpCargo').value,
        sueldoBasico: parseFloat(document.getElementById('fEmpSueldo').value),
        asignacionFamiliar: document.getElementById('fEmpAsigFam').value === 'true',
        sistPensiones: document.getElementById('fEmpPensiones').value,
        tipoContrato: document.getElementById('fEmpContrato').value,
        estado: document.getElementById('fEmpEstado').value,
        telefono: document.getElementById('fEmpTelefono').value,
        direccion: document.getElementById('fEmpDireccion').value,
        fechaCese: null
    };
    if (id) {
        const idx = employees.findIndex(x => x.id === id);
        if (idx >= 0) employees[idx] = { ...employees[idx], ...data };
    } else {
        employees.push(data);
    }
    persist();
    closeModal('empModal');
    renderEmpleados();
    toast(id ? 'Empleado actualizado correctamente' : 'Nuevo empleado registrado', 'success');
}

function exportEmpleadosCSV() {
    let csv = 'Codigo,DNI,Nombres,Apellidos,Planta,Turno,Regimen,Area,Cargo,Sueldo,Pensiones,Estado\n';
    employees.forEach(e => {
        csv += `"${e.codigo}","${e.dni}","${e.nombres}","${e.apellidos}","${e.planta}","${e.turno}","${e.regimen}","${e.area}","${e.cargo}",${e.sueldoBasico},"${e.sistPensiones}","${e.estado}"\n`;
    });
    downloadCSV(csv, 'empleados_ftp.csv');
}
