/* ════════════════════════════════════════════════════════
   MANTENIMIENTO - DATA MOCK REALISTA
   Datos de una planta agroindustrial de procesamiento de
   frutas (mango, arandano, granada) con tuneles IQF.

   NOTA: En produccion estos datos vendrian de Supabase.
   Por ahora se generan localmente con persistencia en
   localStorage (clave: ftp_mant_data_v1).
   ════════════════════════════════════════════════════════ */

const STORAGE_KEY = 'ftp_mant_data_v1';

let _cache = null;

export function getMantData() {
  if (_cache) return _cache;
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    if (s) {
      _cache = JSON.parse(s);
      if (_cache && _cache.version === 1) return _cache;
    }
  } catch (_) { /* noop */ }

  _cache = generateData();
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_cache)); } catch (_) {}
  return _cache;
}

export function saveMantData(data) {
  _cache = data;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (_) {}
}

export function resetMantData() {
  _cache = null;
  try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
  return getMantData();
}

// ════════════════════════════════════════════════════════
// GENERACION
// ════════════════════════════════════════════════════════
function generateData() {
  const equipos = generateEquipos();
  const tecnicos = generateTecnicos();
  const repuestos = generateRepuestos();
  const ordenes = generateOrdenes(equipos, tecnicos);
  const rutinas = generateRutinasPreventivas(equipos);
  const lubricacion = generateLubricacion(equipos);
  const predictivo = generatePredictivo(equipos);
  const costos = generateCostos(equipos);
  const tendencia = generateTendencia();
  const kpis = generateKpis(ordenes, equipos);

  return {
    version: 1,
    generated: new Date().toISOString(),
    equipos,
    tecnicos,
    repuestos,
    ordenes,
    rutinas,
    lubricacion,
    predictivo,
    costos,
    tendencia,
    kpis
  };
}

// ════════════════════════════════════════════════════════
// EQUIPOS (planta agroindustrial)
// ════════════════════════════════════════════════════════
function generateEquipos() {
  const equipos = [
    // RECEPCION
    { codigo: 'RCP-001', nombre: 'Volcador Hidraulico Jabas', area: 'Recepcion', tipo: 'Mecanico', criticidad: 'alta', horasUso: 8420, fabricante: 'Metalurgica Sur', modelo: 'VH-2500', anio: 2022, estado: 'operativo' },
    { codigo: 'RCP-002', nombre: 'Faja Transportadora Ingreso', area: 'Recepcion', tipo: 'Mecanico', criticidad: 'alta', horasUso: 9520, fabricante: 'Tecnalimentos', modelo: 'FT-800', anio: 2021, estado: 'operativo' },
    { codigo: 'RCP-003', nombre: 'Balanza de Plataforma 3TN', area: 'Recepcion', tipo: 'Instrumentacion', criticidad: 'media', horasUso: 5200, fabricante: 'Sartorius', modelo: 'IB-3000', anio: 2023, estado: 'operativo' },

    // ACONDICIONADO / LAVADO
    { codigo: 'ACD-001', nombre: 'Lavadora de Burbujas 1', area: 'Acondicionado', tipo: 'Mecanico', criticidad: 'alta', horasUso: 7820, fabricante: 'InduFood', modelo: 'LB-1200', anio: 2022, estado: 'alerta', ultimaFalla: 'Vibracion anormal en motor principal - requiere inspeccion' },
    { codigo: 'ACD-002', nombre: 'Lavadora de Burbujas 2', area: 'Acondicionado', tipo: 'Mecanico', criticidad: 'alta', horasUso: 7640, fabricante: 'InduFood', modelo: 'LB-1200', anio: 2022, estado: 'operativo' },
    { codigo: 'ACD-003', nombre: 'Mesa Peladora Mango 1', area: 'Acondicionado', tipo: 'Mecanico', criticidad: 'media', horasUso: 6120, fabricante: 'Tecnalimentos', modelo: 'MP-600', anio: 2023, estado: 'operativo' },
    { codigo: 'ACD-004', nombre: 'Mesa Peladora Mango 2', area: 'Acondicionado', tipo: 'Mecanico', criticidad: 'media', horasUso: 6080, fabricante: 'Tecnalimentos', modelo: 'MP-600', anio: 2023, estado: 'operativo' },
    { codigo: 'ACD-005', nombre: 'Cortadora Cubos 10mm', area: 'Acondicionado', tipo: 'Mecanico', criticidad: 'alta', horasUso: 8950, fabricante: 'Urschel', modelo: 'CC-A', anio: 2020, estado: 'operativo' },
    { codigo: 'ACD-006', nombre: 'Blanqueador Vapor', area: 'Acondicionado', tipo: 'Termico', criticidad: 'alta', horasUso: 9210, fabricante: 'ThermoFood', modelo: 'BV-500', anio: 2021, estado: 'operativo' },

    // TUNELES IQF
    { codigo: 'IQF-001', nombre: 'Tunel IQF 1 - Mango', area: 'Tuneles IQF', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 12450, fabricante: 'Gea Refrigeration', modelo: 'IQF-3000', anio: 2021, estado: 'operativo' },
    { codigo: 'IQF-002', nombre: 'Tunel IQF 2 - Arandano', area: 'Tuneles IQF', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 11820, fabricante: 'Gea Refrigeration', modelo: 'IQF-3000', anio: 2021, estado: 'alerta', ultimaFalla: 'Presion de amoniaco fuera de rango - revisar compresor' },
    { codigo: 'IQF-003', nombre: 'Tunel IQF 3 - Granada', area: 'Tuneles IQF', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 10560, fabricante: 'Gea Refrigeration', modelo: 'IQF-3000', anio: 2022, estado: 'operativo' },
    { codigo: 'IQF-004', nombre: 'Evaporador Tunel 1', area: 'Tuneles IQF', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 12300, fabricante: 'Guentner', modelo: 'EV-450', anio: 2021, estado: 'operativo' },
    { codigo: 'IQF-005', nombre: 'Evaporador Tunel 2', area: 'Tuneles IQF', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 11750, fabricante: 'Guentner', modelo: 'EV-450', anio: 2021, estado: 'operativo' },

    // EMPAQUE
    { codigo: 'EMP-001', nombre: 'Balanza Clasificadora Multihead', area: 'Empaque', tipo: 'Electronico', criticidad: 'alta', horasUso: 8650, fabricante: 'Ishida', modelo: 'CCW-RV', anio: 2022, estado: 'operativo' },
    { codigo: 'EMP-002', nombre: 'Enfundadora Vertical 1', area: 'Empaque', tipo: 'Neumatico', criticidad: 'alta', horasUso: 7820, fabricante: 'Bosch', modelo: 'VFFS-500', anio: 2023, estado: 'operativo' },
    { codigo: 'EMP-003', nombre: 'Enfundadora Vertical 2', area: 'Empaque', tipo: 'Neumatico', criticidad: 'alta', horasUso: 7640, fabricante: 'Bosch', modelo: 'VFFS-500', anio: 2023, estado: 'operativo' },
    { codigo: 'EMP-004', nombre: 'Detector de Metales', area: 'Empaque', tipo: 'Electronico', criticidad: 'alta', horasUso: 5820, fabricante: 'Mettler Toledo', modelo: 'Safeline-IQ4', anio: 2023, estado: 'operativo' },
    { codigo: 'EMP-005', nombre: 'Rayos X Control', area: 'Empaque', tipo: 'Electronico', criticidad: 'alta', horasUso: 4200, fabricante: 'Mettler Toledo', modelo: 'X36', anio: 2024, estado: 'operativo' },
    { codigo: 'EMP-006', nombre: 'Selladora Horizontal', area: 'Empaque', tipo: 'Neumatico', criticidad: 'media', horasUso: 6890, fabricante: 'Ulma', modelo: 'Flow-Pack', anio: 2022, estado: 'operativo' },

    // CAMARAS FRIO
    { codigo: 'CAM-001', nombre: 'Camara PT -25°C Zona A', area: 'Camaras Frio', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 14500, fabricante: 'Gea', modelo: 'CAM-500m3', anio: 2020, estado: 'operativo' },
    { codigo: 'CAM-002', nombre: 'Camara PT -25°C Zona B', area: 'Camaras Frio', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 14200, fabricante: 'Gea', modelo: 'CAM-500m3', anio: 2020, estado: 'operativo' },
    { codigo: 'CAM-003', nombre: 'Camara MP +5°C', area: 'Camaras Frio', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 13800, fabricante: 'Gea', modelo: 'CAM-200m3', anio: 2020, estado: 'falla', ultimaFalla: 'Perdida de refrigerante - requiere recarga urgente' },

    // SALA DE MAQUINAS
    { codigo: 'CMP-001', nombre: 'Compresor Amoniaco NH3 #1', area: 'Sala Maquinas', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 16800, fabricante: 'Mycom', modelo: 'N6WB', anio: 2019, estado: 'operativo' },
    { codigo: 'CMP-002', nombre: 'Compresor Amoniaco NH3 #2', area: 'Sala Maquinas', tipo: 'Refrigeracion', criticidad: 'alta', horasUso: 16200, fabricante: 'Mycom', modelo: 'N6WB', anio: 2019, estado: 'alerta', ultimaFalla: 'Temperatura descarga elevada - revisar aftercooler' },
    { codigo: 'CMP-003', nombre: 'Compresor Aire Industrial', area: 'Sala Maquinas', tipo: 'Neumatico', criticidad: 'alta', horasUso: 15800, fabricante: 'Atlas Copco', modelo: 'GA-75', anio: 2020, estado: 'operativo' },
    { codigo: 'CMP-004', nombre: 'Compresor Aire Backup', area: 'Sala Maquinas', tipo: 'Neumatico', criticidad: 'media', horasUso: 4200, fabricante: 'Atlas Copco', modelo: 'GA-37', anio: 2023, estado: 'operativo' },

    // CALDERAS / VAPOR
    { codigo: 'CLD-001', nombre: 'Caldera Pirotubular 300BHP', area: 'Sala Calderas', tipo: 'Termico', criticidad: 'alta', horasUso: 18500, fabricante: 'Continental', modelo: 'C-300', anio: 2018, estado: 'operativo' },
    { codigo: 'CLD-002', nombre: 'Ablandador de Agua', area: 'Sala Calderas', tipo: 'Instrumentacion', criticidad: 'media', horasUso: 17200, fabricante: 'Culligan', modelo: 'AB-50', anio: 2018, estado: 'operativo' },

    // TRATAMIENTO DE AGUA (PTAP)
    { codigo: 'PTA-001', nombre: 'Bomba Centrifuga PTAP', area: 'PTAP', tipo: 'Mecanico', criticidad: 'media', horasUso: 14200, fabricante: 'Grundfos', modelo: 'CR-32', anio: 2020, estado: 'operativo' },
    { codigo: 'PTA-002', nombre: 'Clorador Automatico', area: 'PTAP', tipo: 'Quimico', criticidad: 'alta', horasUso: 14000, fabricante: 'Prominent', modelo: 'Gamma', anio: 2020, estado: 'operativo' },

    // SERVICIOS GENERALES
    { codigo: 'ELC-001', nombre: 'Tablero General BT', area: 'Servicios', tipo: 'Electrico', criticidad: 'alta', horasUso: 24500, fabricante: 'Schneider', modelo: 'Prisma-G', anio: 2019, estado: 'operativo' },
    { codigo: 'ELC-002', nombre: 'Transformador 500KVA', area: 'Servicios', tipo: 'Electrico', criticidad: 'alta', horasUso: 24500, fabricante: 'ABB', modelo: 'TRIHAL', anio: 2019, estado: 'operativo' },
    { codigo: 'ELC-003', nombre: 'Grupo Electrogeno Backup', area: 'Servicios', tipo: 'Electrico', criticidad: 'alta', horasUso: 620, fabricante: 'Caterpillar', modelo: 'C18', anio: 2022, estado: 'operativo' },
    { codigo: 'MON-001', nombre: 'Montacargas Electrico 1', area: 'Logistica', tipo: 'Mecanico', criticidad: 'media', horasUso: 8420, fabricante: 'Toyota', modelo: '8FBCU25', anio: 2022, estado: 'operativo' },
    { codigo: 'MON-002', nombre: 'Montacargas Electrico 2', area: 'Logistica', tipo: 'Mecanico', criticidad: 'media', horasUso: 7820, fabricante: 'Toyota', modelo: '8FBCU25', anio: 2022, estado: 'operativo' },
    { codigo: 'MON-003', nombre: 'Transpaleta Electrica 1', area: 'Logistica', tipo: 'Mecanico', criticidad: 'baja', horasUso: 6200, fabricante: 'Crown', modelo: 'WP-3000', anio: 2023, estado: 'operativo' }
  ];

  return equipos;
}

// ════════════════════════════════════════════════════════
// TECNICOS
// ════════════════════════════════════════════════════════
function generateTecnicos() {
  return [
    { id: 'T001', nombre: 'Luis Mendoza Rojas', especialidad: 'Refrigeracion', nivel: 'Senior', telefono: '999123456', otCompletadas: 42, horasMes: 168, estado: 'activo', avatar: 'LM' },
    { id: 'T002', nombre: 'Carlos Huaman Perez', especialidad: 'Mecanica', nivel: 'Senior', telefono: '999234567', otCompletadas: 38, horasMes: 160, estado: 'activo', avatar: 'CH' },
    { id: 'T003', nombre: 'Roberto Sanchez Cruz', especialidad: 'Electrica', nivel: 'Senior', telefono: '999345678', otCompletadas: 35, horasMes: 152, estado: 'activo', avatar: 'RS' },
    { id: 'T004', nombre: 'Jorge Quispe Torres', especialidad: 'Instrumentacion', nivel: 'Junior', telefono: '999456789', otCompletadas: 22, horasMes: 144, estado: 'activo', avatar: 'JQ' },
    { id: 'T005', nombre: 'Miguel Ramos Diaz', especialidad: 'Refrigeracion', nivel: 'Semi-Senior', telefono: '999567890', otCompletadas: 28, horasMes: 156, estado: 'activo', avatar: 'MR' },
    { id: 'T006', nombre: 'Victor Flores Gamarra', especialidad: 'Soldadura', nivel: 'Senior', telefono: '999678901', otCompletadas: 31, horasMes: 148, estado: 'activo', avatar: 'VF' },
    { id: 'T007', nombre: 'Daniel Vargas Lozano', especialidad: 'Mecanica', nivel: 'Semi-Senior', telefono: '999789012', otCompletadas: 26, horasMes: 152, estado: 'activo', avatar: 'DV' },
    { id: 'T008', nombre: 'Andres Choque Mamani', especialidad: 'Electrica', nivel: 'Junior', telefono: '999890123', otCompletadas: 18, horasMes: 140, estado: 'vacaciones', avatar: 'AC' },
    { id: 'T009', nombre: 'Pedro Ortiz Salcedo', especialidad: 'Neumatica', nivel: 'Senior', telefono: '999901234', otCompletadas: 33, horasMes: 156, estado: 'activo', avatar: 'PO' },
    { id: 'T010', nombre: 'Ernesto Castillo Rivas', especialidad: 'Hidraulica', nivel: 'Semi-Senior', telefono: '999012345', otCompletadas: 24, horasMes: 148, estado: 'activo', avatar: 'EC' }
  ];
}

// ════════════════════════════════════════════════════════
// REPUESTOS
// ════════════════════════════════════════════════════════
function generateRepuestos() {
  return [
    { codigo: 'RP-001', nombre: 'Rodamiento SKF 6208-2RS', categoria: 'Rodamientos', stock: 24, minimo: 10, unidad: 'UND', precio: 48.50, ubicacion: 'A-1-3' },
    { codigo: 'RP-002', nombre: 'Rodamiento SKF 6306-2RS', categoria: 'Rodamientos', stock: 6, minimo: 8, unidad: 'UND', precio: 72.00, ubicacion: 'A-1-3' },
    { codigo: 'RP-003', nombre: 'Correa en V B-75', categoria: 'Transmision', stock: 18, minimo: 6, unidad: 'UND', precio: 35.00, ubicacion: 'A-2-1' },
    { codigo: 'RP-004', nombre: 'Cadena ANSI 80', categoria: 'Transmision', stock: 3, minimo: 4, unidad: 'M', precio: 125.00, ubicacion: 'A-2-2' },
    { codigo: 'RP-005', nombre: 'Valvula Solenoide NH3 1"', categoria: 'Refrigeracion', stock: 4, minimo: 2, unidad: 'UND', precio: 850.00, ubicacion: 'B-1-1' },
    { codigo: 'RP-006', nombre: 'Aceite Refrigeracion Mycom', categoria: 'Lubricantes', stock: 12, minimo: 8, unidad: 'GAL', precio: 180.00, ubicacion: 'B-3-1' },
    { codigo: 'RP-007', nombre: 'Aceite Hidraulico ISO 68', categoria: 'Lubricantes', stock: 45, minimo: 20, unidad: 'GAL', precio: 95.00, ubicacion: 'B-3-2' },
    { codigo: 'RP-008', nombre: 'Grasa EP-2 Litio', categoria: 'Lubricantes', stock: 22, minimo: 10, unidad: 'KG', precio: 28.00, ubicacion: 'B-3-3' },
    { codigo: 'RP-009', nombre: 'Contactor 65A Schneider', categoria: 'Electrico', stock: 8, minimo: 4, unidad: 'UND', precio: 240.00, ubicacion: 'C-1-1' },
    { codigo: 'RP-010', nombre: 'Guardamotor 25-40A', categoria: 'Electrico', stock: 5, minimo: 4, unidad: 'UND', precio: 280.00, ubicacion: 'C-1-2' },
    { codigo: 'RP-011', nombre: 'Sensor Temperatura PT100', categoria: 'Instrumentacion', stock: 14, minimo: 6, unidad: 'UND', precio: 185.00, ubicacion: 'C-2-1' },
    { codigo: 'RP-012', nombre: 'Transmisor Presion 4-20mA', categoria: 'Instrumentacion', stock: 2, minimo: 3, unidad: 'UND', precio: 620.00, ubicacion: 'C-2-2' },
    { codigo: 'RP-013', nombre: 'Empaques NH3 (Set)', categoria: 'Refrigeracion', stock: 16, minimo: 8, unidad: 'SET', precio: 125.00, ubicacion: 'B-1-2' },
    { codigo: 'RP-014', nombre: 'Filtro Aceite Atlas Copco', categoria: 'Filtros', stock: 10, minimo: 6, unidad: 'UND', precio: 145.00, ubicacion: 'B-2-1' },
    { codigo: 'RP-015', nombre: 'Filtro Aire Compresor', categoria: 'Filtros', stock: 9, minimo: 4, unidad: 'UND', precio: 98.00, ubicacion: 'B-2-2' },
    { codigo: 'RP-016', nombre: 'Cuchilla Cortadora Urschel', categoria: 'Mecanico', stock: 1, minimo: 2, unidad: 'UND', precio: 1250.00, ubicacion: 'A-3-1' },
    { codigo: 'RP-017', nombre: 'Manguera Hidraulica 1/2"', categoria: 'Hidraulico', stock: 28, minimo: 10, unidad: 'M', precio: 42.00, ubicacion: 'A-4-1' },
    { codigo: 'RP-018', nombre: 'Electrovalvula Aire 24VDC', categoria: 'Neumatico', stock: 7, minimo: 4, unidad: 'UND', precio: 320.00, ubicacion: 'A-4-2' },
    { codigo: 'RP-019', nombre: 'PLC Modulo I/O Siemens', categoria: 'Electrico', stock: 3, minimo: 2, unidad: 'UND', precio: 1580.00, ubicacion: 'C-1-3' },
    { codigo: 'RP-020', nombre: 'Variador de Frecuencia 30HP', categoria: 'Electrico', stock: 2, minimo: 1, unidad: 'UND', precio: 3850.00, ubicacion: 'C-3-1' }
  ];
}

// ════════════════════════════════════════════════════════
// ORDENES DE TRABAJO
// ════════════════════════════════════════════════════════
function generateOrdenes(equipos, tecnicos) {
  const hoy = new Date();
  const orders = [];
  const estados = ['abierta', 'ejecucion', 'completada', 'pausada'];
  const tipos = ['preventivo', 'correctivo', 'predictivo'];
  const prioridades = ['alta', 'media', 'baja'];

  const descripciones = {
    preventivo: [
      'Inspeccion programada mensual - revision general',
      'Cambio de rodamientos segun plan anual',
      'Cambio de aceite y filtros - rutina 1000h',
      'Inspeccion termografica semestral',
      'Ajuste y calibracion trimestral',
      'Limpieza profunda y lubricacion programada',
      'Verificacion de parametros electricos',
      'Test de seguridad y paradas de emergencia'
    ],
    correctivo: [
      'Fuga de refrigerante detectada por operador',
      'Ruido anormal en rodamiento principal',
      'Falla electrica - no arranca el motor',
      'Vibracion excesiva en eje de transmision',
      'Perdida de presion en sistema neumatico',
      'Sobrecalentamiento de motor',
      'Sensor de temperatura con lectura erratica',
      'Atasco mecanico en faja transportadora'
    ],
    predictivo: [
      'Analisis de vibraciones - evolucion negativa',
      'Termografia detecta punto caliente',
      'Analisis de aceite muestra contaminacion',
      'Ultrasonido detecta fuga de aire',
      'Tendencia negativa en consumo de corriente',
      'Analisis de particulas en aceite fuera de rango'
    ]
  };

  let contador = 2041;
  for (let i = 0; i < 48; i++) {
    const equipo = equipos[Math.floor(Math.random() * equipos.length)];
    const tipo = tipos[Math.floor(Math.random() * tipos.length)];
    const tecnico = tecnicos[Math.floor(Math.random() * tecnicos.length)];

    let estado, prioridad;
    if (i < 8) { estado = 'completada'; prioridad = prioridades[Math.floor(Math.random() * 3)]; }
    else if (i < 20) { estado = 'ejecucion'; prioridad = Math.random() < 0.5 ? 'alta' : 'media'; }
    else if (i < 38) { estado = 'abierta'; prioridad = prioridades[Math.floor(Math.random() * 3)]; }
    else { estado = 'pausada'; prioridad = 'media'; }

    const diasAtras = Math.floor(Math.random() * 30);
    const fecha = new Date(hoy);
    fecha.setDate(fecha.getDate() - diasAtras);
    const fechaStr = fecha.toISOString().substring(0, 10);

    const descArr = descripciones[tipo];
    const descripcion = descArr[Math.floor(Math.random() * descArr.length)];

    const horasEst = tipo === 'preventivo' ? (2 + Math.floor(Math.random() * 4)) : tipo === 'correctivo' ? (1 + Math.floor(Math.random() * 8)) : (1 + Math.floor(Math.random() * 3));
    const costo = tipo === 'preventivo' ? (150 + Math.floor(Math.random() * 500)) : tipo === 'correctivo' ? (300 + Math.floor(Math.random() * 2500)) : (200 + Math.floor(Math.random() * 800));

    orders.push({
      codigo: 'OT-' + (contador++),
      equipo: equipo.codigo + ' ' + equipo.nombre,
      equipoCodigo: equipo.codigo,
      area: equipo.area,
      tipo,
      prioridad,
      estado,
      tecnico: tecnico.nombre,
      tecnicoId: tecnico.id,
      descripcion,
      fecha: fechaStr,
      horasEstimadas: horasEst,
      horasReales: estado === 'completada' ? horasEst + (Math.random() - 0.5) * 2 : null,
      costoEstimado: costo,
      costoReal: estado === 'completada' ? costo + (Math.random() - 0.3) * 400 : null
    });
  }

  return orders;
}

// ════════════════════════════════════════════════════════
// RUTINAS PREVENTIVAS
// ════════════════════════════════════════════════════════
function generateRutinasPreventivas(equipos) {
  const rutinas = [];
  const frecuencias = ['diaria', 'semanal', 'mensual', 'trimestral', 'semestral', 'anual'];
  let id = 1;

  equipos.slice(0, 25).forEach(e => {
    // 1-3 rutinas por equipo
    const cantidad = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < cantidad; i++) {
      const freq = frecuencias[Math.floor(Math.random() * frecuencias.length)];
      const diasRestantes = Math.floor(Math.random() * 60) - 15;
      const estado = diasRestantes < 0 ? 'vencida' : diasRestantes < 7 ? 'proxima' : 'programada';

      rutinas.push({
        id: 'PM-' + String(id++).padStart(4, '0'),
        equipo: e.codigo,
        equipoNombre: e.nombre,
        area: e.area,
        frecuencia: freq,
        descripcion: getRutinaDescripcion(freq, e.tipo),
        duracion: 1 + Math.floor(Math.random() * 4),
        diasRestantes,
        estado,
        ultima: fechaHaceDias(diasHaceUltima(freq)),
        proxima: fechaEnDias(diasRestantes)
      });
    }
  });

  return rutinas;
}

function getRutinaDescripcion(freq, tipo) {
  const pool = {
    diaria: ['Inspeccion visual y limpieza', 'Verificacion niveles', 'Revision parametros operacion'],
    semanal: ['Limpieza profunda', 'Revision fugas y holguras', 'Ajuste tensiones'],
    mensual: ['Lubricacion general', 'Inspeccion termografica', 'Verificacion de sensores'],
    trimestral: ['Cambio de filtros', 'Calibracion instrumentacion', 'Analisis vibraciones'],
    semestral: ['Cambio de aceite', 'Inspeccion interna', 'Reaprieto conexiones electricas'],
    anual: ['Overhaul completo', 'Cambio rodamientos', 'Mantto mayor programado']
  };
  const arr = pool[freq] || pool.mensual;
  return arr[Math.floor(Math.random() * arr.length)];
}

function diasHaceUltima(freq) {
  const map = { diaria: 1, semanal: 7, mensual: 30, trimestral: 90, semestral: 180, anual: 365 };
  return map[freq] || 30;
}

function fechaHaceDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d.toISOString().substring(0, 10);
}

function fechaEnDias(dias) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().substring(0, 10);
}

// ════════════════════════════════════════════════════════
// LUBRICACION
// ════════════════════════════════════════════════════════
function generateLubricacion(equipos) {
  const puntos = [];
  const lubricantes = [
    { tipo: 'Grasa EP-2 Litio', color: 'amber' },
    { tipo: 'Aceite ISO VG 68 Hidraulico', color: 'azul' },
    { tipo: 'Aceite Mycom Refrigeracion', color: 'cyan' },
    { tipo: 'Grasa NLGI-2 Alta Temp', color: 'rose' },
    { tipo: 'Aceite Sintetico ISO 46', color: 'verde' },
    { tipo: 'Grasa Alimentaria NSF H1', color: 'purple' }
  ];

  let id = 1;
  equipos.forEach(e => {
    const nPuntos = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < nPuntos; i++) {
      const lub = lubricantes[Math.floor(Math.random() * lubricantes.length)];
      const dias = Math.floor(Math.random() * 120) - 30;
      puntos.push({
        id: 'LP-' + String(id++).padStart(4, '0'),
        equipo: e.codigo,
        equipoNombre: e.nombre,
        area: e.area,
        puntoLubricacion: ['Rodamiento lado A', 'Rodamiento lado B', 'Cadena transmision', 'Reductor', 'Cojinete principal', 'Eje de transmision'][Math.floor(Math.random() * 6)],
        lubricante: lub.tipo,
        color: lub.color,
        frecuencia: ['Diario', 'Semanal', 'Mensual', 'Trimestral'][Math.floor(Math.random() * 4)],
        cantidad: (0.1 + Math.random() * 2).toFixed(1),
        unidad: lub.tipo.startsWith('Grasa') ? 'kg' : 'L',
        proximaFecha: fechaEnDias(dias),
        diasRestantes: dias,
        estado: dias < 0 ? 'vencido' : dias < 7 ? 'proximo' : 'programado'
      });
    }
  });

  return puntos.slice(0, 50);
}

// ════════════════════════════════════════════════════════
// PREDICTIVO - ANALISIS DE CONDICIONES
// ════════════════════════════════════════════════════════
function generatePredictivo(equipos) {
  const analisis = [];
  const tecnicas = [
    { tecnica: 'Analisis de Vibraciones', unidad: 'mm/s', rangoOk: [0, 2.8], rangoAlerta: [2.8, 4.5] },
    { tecnica: 'Termografia Infrarroja', unidad: '°C', rangoOk: [0, 60], rangoAlerta: [60, 85] },
    { tecnica: 'Analisis de Aceite', unidad: 'ppm', rangoOk: [0, 50], rangoAlerta: [50, 100] },
    { tecnica: 'Ultrasonido', unidad: 'dB', rangoOk: [0, 28], rangoAlerta: [28, 40] }
  ];

  let id = 1;
  equipos.slice(0, 18).forEach(e => {
    tecnicas.forEach(t => {
      const valor = Math.random() < 0.7
        ? t.rangoOk[0] + Math.random() * (t.rangoOk[1] - t.rangoOk[0])
        : t.rangoAlerta[0] + Math.random() * (t.rangoAlerta[1] - t.rangoAlerta[0]);
      const estado = valor <= t.rangoOk[1] ? 'normal' : valor <= t.rangoAlerta[1] ? 'alerta' : 'critico';

      analisis.push({
        id: 'PD-' + String(id++).padStart(4, '0'),
        equipo: e.codigo,
        equipoNombre: e.nombre,
        area: e.area,
        tecnica: t.tecnica,
        valor: parseFloat(valor.toFixed(2)),
        unidad: t.unidad,
        limiteOk: t.rangoOk[1],
        limiteAlerta: t.rangoAlerta[1],
        estado,
        fecha: fechaHaceDias(Math.floor(Math.random() * 20)),
        tecnico: 'Luis Mendoza Rojas'
      });
    });
  });

  return analisis;
}

// ════════════════════════════════════════════════════════
// COSTOS
// ════════════════════════════════════════════════════════
function generateCostos(equipos) {
  const porArea = {};
  const areas = [...new Set(equipos.map(e => e.area))];
  areas.forEach(a => {
    porArea[a] = 3000 + Math.floor(Math.random() * 22000);
  });

  const porMes = {
    meses: ['Nov 25', 'Dic 25', 'Ene 26', 'Feb 26', 'Mar 26', 'Abr 26'],
    preventivo: [18500, 22000, 19800, 21200, 24500, 23100],
    correctivo: [12400, 15800, 8900, 11200, 14500, 9800],
    predictivo: [4200, 5100, 4800, 5500, 6200, 5800]
  };

  return {
    porArea,
    porMes,
    presupuestoMes: 45000,
    gastoMes: Object.values(porArea).reduce((s, v) => s + v, 0)
  };
}

// ════════════════════════════════════════════════════════
// TENDENCIA
// ════════════════════════════════════════════════════════
function generateTendencia() {
  return {
    meses: ['Nov 25', 'Dic 25', 'Ene 26', 'Feb 26', 'Mar 26', 'Abr 26'],
    mttr: [4.8, 4.2, 3.8, 3.5, 3.2, 2.9],
    mtbf: [410, 440, 480, 520, 560, 610],
    disponibilidad: [94.2, 95.1, 95.8, 96.2, 96.8, 97.3]
  };
}

// ════════════════════════════════════════════════════════
// KPIs consolidados
// ════════════════════════════════════════════════════════
function generateKpis(ordenes, equipos) {
  const completadas = ordenes.filter(o => o.estado === 'completada');
  const preventivas = ordenes.filter(o => o.tipo === 'preventivo');
  const correctivas = ordenes.filter(o => o.tipo === 'correctivo');

  return {
    mttr: 2.9,
    mtbf: 610,
    oee: 87.4,
    disponibilidad: 97.3,
    pmCumplimiento: 94.6,
    costoMes: 68400,
    presupuestoMes: 75000,
    equiposOperativos: equipos.filter(e => e.estado === 'operativo').length,
    equiposAlerta: equipos.filter(e => e.estado === 'alerta').length,
    equiposFalla: equipos.filter(e => e.estado === 'falla').length,
    otAbiertas: ordenes.filter(o => o.estado !== 'completada').length,
    otCompletadasMes: completadas.length,
    ratioPrevCorr: preventivas.length / Math.max(1, correctivas.length)
  };
}
