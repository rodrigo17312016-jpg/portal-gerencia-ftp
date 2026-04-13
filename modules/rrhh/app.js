/* ============================================================
   APP — Navegación, Tema, Datos Demo, Inicialización
   ============================================================ */

// ==================== NAV ====================
function showPanel(id, el) {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const panel = document.getElementById('panel-' + id);
    if (panel) panel.classList.add('active');
    if (el) el.classList.add('active');
    const titles = {
        dashboard:'Dashboard RRHH',empleados:'Gestión de Empleados',asistencia:'Control de Asistencia',
        planilla:'Planilla Mensual (Rég. General)',planillaSemanal:'Planilla Semanal (Rég. Agrario)',
        boletas:'Boletas de Pago',cts:'CTS - Compensación por Tiempo de Servicios',
        gratificaciones:'Gratificaciones',vacaciones:'Control de Vacaciones',liquidaciones:'Liquidación de Beneficios',
        prestamos:'Préstamos y Adelantos',reportes:'Centro de Reportes'
    };
    document.getElementById('topTitle').textContent = titles[id] || 'RRHH';
    if (id === 'dashboard') renderDashboard();
    if (id === 'empleados') renderEmpleados();
    if (id === 'asistencia') renderAsistencia();
    if (id === 'prestamos') renderPrestamos();
    if (id === 'vacaciones') renderVacaciones();
    if (id === 'planillaSemanal') initPlanillaSemanal();
    if (id === 'boletas' || id === 'liquidaciones') populateEmpSelects();
}

// ==================== THEME ====================
let theme = localStorage.getItem('rrhhTheme') || 'dark';
document.documentElement.setAttribute('data-theme', theme);
document.getElementById('themeIcon').textContent = theme === 'dark' ? '\u263E' : '\u2600';
document.getElementById('themeToggle').addEventListener('click', () => {
    theme = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('rrhhTheme', theme);
    document.getElementById('themeIcon').textContent = theme === 'dark' ? '\u263E' : '\u2600';
});

// ==================== DATE ====================
function updateDate() {
    const d = new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'America/Lima'});
    document.getElementById('topDate').textContent = d.charAt(0).toUpperCase()+d.slice(1);
}
updateDate();

// ==================== MODAL HELPERS ====================
function closeModal(id) { document.getElementById(id).classList.remove('show'); }
document.querySelectorAll('.modal-overlay').forEach(m => { m.addEventListener('click', e => { if (e.target === e.currentTarget) m.classList.remove('show'); }); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') document.querySelectorAll('.modal-overlay.show').forEach(m => m.classList.remove('show')); });

// ==================== SAMPLE DATA ====================
function loadSampleData() {
    function doLoad() {
    const nombres = ['Carlos','Maria','Juan','Ana','Pedro','Rosa','Luis','Carmen','Jose','Elena','Miguel','Lucia','Roberto','Diana','Fernando','Patricia','Andres','Claudia','Ricardo','Teresa'];
    const apellidos = ['Garcia','Lopez','Martinez','Rodriguez','Perez','Gonzalez','Hernandez','Torres','Ramirez','Flores','Castillo','Medina','Vargas','Quispe','Huaman','Mendoza','Chavez','Rojas','Diaz','Ramos'];
    const areas = ['Producción','Producción','Producción','Calidad','Almacén','Mantenimiento','Administración','Producción','Sanidad','Producción'];
    const cargos = ['Operario de Producción','Operario de Producción','Técnico de Calidad','Inspector de Calidad','Almacenero','Técnico de Mantenimiento','Asistente Administrativo','Supervisor de Línea','Inspector Sanitario','Jefe de Turno'];
    const pensiones = ['ONP','AFP_INTEGRA','AFP_PRIMA','AFP_PROFUTURO','AFP_HABITAT','ONP','AFP_INTEGRA','AFP_PRIMA','ONP','AFP_HABITAT'];

    employees = [];
    for (let i = 0; i < 20; i++) {
        const regimen = i < 14 ? 'AGRARIO' : 'GENERAL';
        const sueldo = regimen === 'AGRARIO' ? CFG.rmv : (i >= 18 ? 3500 : (i >= 16 ? 2200 : CFG.rmv));
        employees.push({
            id: uid(), codigo: 'EMP-'+String(i+1).padStart(3,'0'),
            dni: String(10000000+Math.floor(Math.random()*89999999)),
            nombres: nombres[i], apellidos: apellidos[i]+' '+apellidos[(i+5)%20],
            fechaNacimiento: `${1985+Math.floor(Math.random()*15)}-${String(1+Math.floor(Math.random()*12)).padStart(2,'0')}-${String(1+Math.floor(Math.random()*28)).padStart(2,'0')}`,
            fechaIngreso: `${2020+Math.floor(Math.random()*5)}-${String(1+Math.floor(Math.random()*12)).padStart(2,'0')}-01`,
            planta: i < 12 ? 'PLANTA HUAURA' : 'PLANTA PIURA',
            turno: i % 3 === 0 ? 'NOCHE' : 'DIA',
            regimen, area: areas[i%10], cargo: cargos[i%10],
            sueldoBasico: sueldo,
            asignacionFamiliar: i % 3 === 0,
            sistPensiones: pensiones[i%10],
            tipoContrato: i < 5 ? 'INDETERMINADO' : 'PLAZO_FIJO',
            estado: 'ACTIVO', telefono: '9'+String(10000000+Math.floor(Math.random()*89999999)),
            direccion: '', fechaCese: null
        });
    }

    loans = [
        { id:uid(), empleadoId:employees[2].id, tipo:'PRESTAMO', monto:1000, cuotas:5, cuotaMensual:200, saldoPendiente:600, fechaInicio:'2026-02-01', estado:'ACTIVO', pagos:[{fecha:'2026-03-01',monto:200},{fecha:'2026-04-01',monto:200}] },
        { id:uid(), empleadoId:employees[5].id, tipo:'ADELANTO', monto:500, cuotas:2, cuotaMensual:250, saldoPendiente:250, fechaInicio:'2026-03-01', estado:'ACTIVO', pagos:[{fecha:'2026-04-01',monto:250}] },
    ];

    vacations = [
        { id:uid(), empleadoId:employees[0].id, fechaInicio:'2026-01-15', fechaFin:'2026-01-29', dias:15, obs:'Vacaciones enero' },
    ];

    persist();
    toast('Datos demo cargados: 20 empleados, 2 préstamos, 1 vacación', 'success', 4500);
    renderDashboard();
    renderEmpleados();
    }
    if (employees.length > 0) {
        showConfirm('Ya existen datos. ¿Desea reemplazarlos con datos demo?', doLoad);
    } else { doLoad(); }
}

// ==================== INIT ====================
function init() {
    document.getElementById('attDate').value = new Date().toISOString().split('T')[0];
    const now = new Date();
    const mesActual = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');
    document.getElementById('planPeriodo').value = mesActual;
    document.getElementById('bolPeriodo').value = mesActual;
    document.getElementById('planSemMes').value = mesActual;
    document.getElementById('liqFechaCese').value = now.toISOString().split('T')[0];
    populateEmpSelects();
    // Auto-load sample data on first visit
    if (employees.length === 0) {
        loadSampleData();
    } else {
        renderDashboard();
    }
}
init();
