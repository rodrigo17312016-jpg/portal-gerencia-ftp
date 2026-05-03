/* ════════════════════════════════════════════════════════
   TRAZABILIDAD MP→CLIENTE · Datos mock
   Datos extraídos de la guía SUNAT real EG07-00004381
   (Tropical Food Inc → Frutos Tropicales Perú Export)

   NOTA: Estos datos se cablearán a Supabase en una fase
   posterior. Tablas previstas:
     - trz_guias_sunat
     - trz_paletickets
     - trz_tuneles_log
     - trz_camara_slots
     - trz_eventos_blockchain
   ════════════════════════════════════════════════════════ */

(function (global) {
  'use strict';

  const TRZ = {
    // --- Plantas FTP ---
    plantas: [
      { id: 'PL-HUAURA', nombre: 'FTP Huaura · Vegueta', direccion: 'Lote 1 Fnd. Predio Rural Don José de San Martín SN · Vegueta · Huaura · Lima', lat: -11.0270, lng: -77.6478 },
      { id: 'PL-PIURA',  nombre: 'Centro Acopio Piura',   direccion: 'Av. Ignacia Shaeffer 110 · Tambo Grande · Piura · Piura', lat: -4.9230, lng: -80.3408 }
    ],

    // --- Proveedores (norte del Perú) ---
    proveedores: [
      { id: 'PRV-001', razonSocial: 'TROPICAL FOOD INC S.A.C.',                 ruc: '20602831222', tipo: 'Productor·Acopio', origen: 'Tambo Grande · Piura',     fruta: 'Mango Kent Orgánico', certificaciones: ['NOP', 'EU', 'RTPO', 'Control Union PE-BIO-149'], rating: 4.9, fechaUltimaCompra: '2026-02-19' },
      { id: 'PRV-002', razonSocial: 'AGRÍCOLA DON LUIS S.A.',                   ruc: '20498765432', tipo: 'Productor',         origen: 'Sullana · Piura',         fruta: 'Mango Kent Convencional', certificaciones: ['GlobalGAP'],                   rating: 4.6, fechaUltimaCompra: '2026-02-10' },
      { id: 'PRV-003', razonSocial: 'CAMPOS DEL CHIRA AGROEXPORT EIRL',         ruc: '20512345678', tipo: 'Acopio',            origen: 'Bellavista · Piura',      fruta: 'Mango Edward / Palta Hass', certificaciones: ['GlobalGAP', 'BRC'],          rating: 4.4, fechaUltimaCompra: '2026-01-28' },
      { id: 'PRV-004', razonSocial: 'FRUTAS SELECTAS DEL NORTE S.A.C.',         ruc: '20587654321', tipo: 'Productor',         origen: 'Tambo Grande · Piura',    fruta: 'Mango Tommy Atkins',        certificaciones: ['Rainforest Alliance'],       rating: 4.3, fechaUltimaCompra: '2026-01-15' },
      { id: 'PRV-005', razonSocial: 'AGROEXPORTADORA OLMOS NORTE S.R.L.',       ruc: '20623456789', tipo: 'Productor',         origen: 'Olmos · Lambayeque',      fruta: 'Palta Hass / Mango Kent',   certificaciones: ['GlobalGAP', 'SMETA'],        rating: 4.7, fechaUltimaCompra: '2026-02-12' }
    ],

    // --- Transportistas y vehículos ---
    transportistas: [
      { id: 'TR-001', razonSocial: 'AGROTRANSPORTES E INVERSIONES J. BERRU EIRL', ruc: '20603654421', mtc: 'MTC2007385CNG' },
      { id: 'TR-002', razonSocial: 'TRANSPORTES NORTE EXPRESS S.A.C.',           ruc: '20512348765', mtc: 'MTC1998421CNG' },
      { id: 'TR-003', razonSocial: 'LOGÍSTICA REFRIGERADA DEL PACÍFICO S.R.L.',  ruc: '20567891234', mtc: 'MTC2015896CNG' }
    ],

    vehiculos: [
      { placa: 'B4R-935', marca: 'Volvo',    modelo: 'FH-440',         anio: 2019, transportista: 'TR-001', tipo: 'Furgón refrigerado', capacidadKg: 22000, tuce: '0151118757' },
      { placa: 'AKB-217', marca: 'Scania',   modelo: 'R-450',          anio: 2021, transportista: 'TR-002', tipo: 'Furgón refrigerado', capacidadKg: 24000, tuce: '0152334872' },
      { placa: 'CXT-880', marca: 'Mercedes', modelo: 'Actros 2641',    anio: 2022, transportista: 'TR-003', tipo: 'Furgón refrigerado', capacidadKg: 26000, tuce: '0152988471' }
    ],

    conductores: [
      { dni: '15953605', nombres: 'Maximino Alberto', apellidos: 'Acosta García',    licencia: 'Q15953605', categoria: 'A-IIIc', telefono: '+51 969 412 887' },
      { dni: '40278196', nombres: 'Pedro Luis',       apellidos: 'Berrú Saavedra',   licencia: 'Q40278196', categoria: 'A-IIIb', telefono: '+51 945 887 213' },
      { dni: '08745621', nombres: 'José Antonio',     apellidos: 'Quispe Chumpitaz', licencia: 'Q08745621', categoria: 'A-IIIc', telefono: '+51 998 332 411' }
    ],

    // --- Guías SUNAT (la primera es la del PDF real) ---
    guiasSunat: [
      {
        id: 'EG07-00004381',
        serie: 'EG07', numero: '00004381',
        fechaEmision: '2026-02-19', horaEmision: '19:28',
        fechaInicio: '2026-02-19',
        remitente:    { razonSocial: 'TROPICAL FOOD INC S.A.C.',               ruc: '20602831222' },
        destinatario: { razonSocial: 'FRUTOS TROPICALES PERU EXPORT S.A.C.',   ruc: '20607892955' },
        puntoPartida: 'Av. Ignacia Shaeffer 110 · Tambo Grande · Piura',
        puntoLlegada: 'Lote 1 Fnd. Predio Rural Don José de San Martín SN · Vegueta · Huaura · Lima',
        motivo: 'Venta sujeta a confirmación del comprador',
        modalidad: 'Público',
        producto: { descripcion: '349 mallas con mango fresco (Kent) orgánico, NOP, EU, RTPO', fruta: 'Mango', variedad: 'Kent', tipo: 'Orgánico', lote: '17C', certificaciones: 'NOP/EU/RTPO/Control Union PE-BIO-149' },
        pesoBruto: 19000, pesoNeto: 18870, mallas: 349, unidadMedida: 'KGM',
        transportista: 'TR-001', vehiculoPlaca: 'B4R-935', conductorDni: '15953605',
        estado: 'Recibido',
        eta: '2026-02-21 06:30',
        fechaRecepcion: '2026-02-21 06:18',
        kgRecibidos: 18870, paletsGenerados: 19,
        hashBlockchain: 'a7f3d9e1b8c4f2a6...4381'
      },
      {
        id: 'EG07-00004382',
        serie: 'EG07', numero: '00004382',
        fechaEmision: '2026-04-29', horaEmision: '08:14',
        fechaInicio: '2026-04-29',
        remitente:    { razonSocial: 'AGROEXPORTADORA OLMOS NORTE S.R.L.',     ruc: '20623456789' },
        destinatario: { razonSocial: 'FRUTOS TROPICALES PERU EXPORT S.A.C.',   ruc: '20607892955' },
        puntoPartida: 'Olmos · Lambayeque',
        puntoLlegada: 'Lote 1 Fnd. Predio Rural Don José de San Martín SN · Vegueta · Huaura · Lima',
        motivo: 'Venta sujeta a confirmación del comprador', modalidad: 'Público',
        producto: { descripcion: '420 mallas con palta Hass orgánica calibre 14-18', fruta: 'Palta', variedad: 'Hass', tipo: 'Orgánico', lote: '21H', certificaciones: 'GlobalGAP / SMETA' },
        pesoBruto: 22500, pesoNeto: 22050, mallas: 420, unidadMedida: 'KGM',
        transportista: 'TR-003', vehiculoPlaca: 'CXT-880', conductorDni: '08745621',
        estado: 'En tránsito',
        eta: '2026-05-01 04:00',
        fechaRecepcion: null, kgRecibidos: 0, paletsGenerados: 0,
        hashBlockchain: 'b2e8c1d4a9f6e3b7...4382'
      },
      {
        id: 'EG07-00004383',
        serie: 'EG07', numero: '00004383',
        fechaEmision: '2026-05-02', horaEmision: '14:52',
        fechaInicio: '2026-05-02',
        remitente:    { razonSocial: 'AGRÍCOLA DON LUIS S.A.',                  ruc: '20498765432' },
        destinatario: { razonSocial: 'FRUTOS TROPICALES PERU EXPORT S.A.C.',   ruc: '20607892955' },
        puntoPartida: 'Sullana · Piura',
        puntoLlegada: 'Lote 1 Fnd. Predio Rural Don José de San Martín SN · Vegueta · Huaura · Lima',
        motivo: 'Venta sujeta a confirmación del comprador', modalidad: 'Público',
        producto: { descripcion: '380 mallas con mango fresco (Kent) convencional', fruta: 'Mango', variedad: 'Kent', tipo: 'Convencional', lote: '22C', certificaciones: 'GlobalGAP' },
        pesoBruto: 20800, pesoNeto: 20420, mallas: 380, unidadMedida: 'KGM',
        transportista: 'TR-002', vehiculoPlaca: 'AKB-217', conductorDni: '40278196',
        estado: 'Programado',
        eta: '2026-05-04 11:00',
        fechaRecepcion: null, kgRecibidos: 0, paletsGenerados: 0,
        hashBlockchain: 'c4f1a8d6b3e9c5f2...4383'
      }
    ],

    // --- Paletickets generados (a partir de la guía 4381) ---
    // 19 palets · 18 de 1000kg + 1 de 870kg
    paletickets: (function () {
      const arr = [];
      const today = '2026-02-21';
      const guia = 'EG07-00004381';
      for (let i = 1; i <= 19; i++) {
        const numero = String(i).padStart(2, '0');
        const kg = i === 19 ? 870 : 1000;
        const pesoBruto = kg + 18;
        const pesoPalet = 18;
        const codTraz = `FTP-MGK-26-0517C-P${numero}`;
        const estado = i <= 4 ? 'En empaque' : i <= 8 ? 'En túnel' : i <= 12 ? 'En acond.' : 'En espera';
        arr.push({
          id: `PT-2026-${guia}-${numero}`,
          guiaId: guia,
          numeroPalet: numero,
          producto: 'Mango', variedad: 'Kent', tipo: 'Orgánico',
          viaje: 12,
          proveedor: 'FTP',
          proveedorRazon: 'TROPICAL FOOD INC S.A.C.',
          fechaIngreso: today,
          julianoIngreso: 52,
          lote: '17C',
          codTrazabilidad: codTraz,
          fechaMaduracion: null,
          nJabas: Math.round(kg / 24),
          pesoBruto, pesoPalet, pesoNeto: kg,
          madurez: i <= 6 ? 'Maduro' : i <= 14 ? 'Pintón' : 'Verde',
          destino: i <= 6 ? 'Acond. inmediato' : i <= 14 ? 'Cámara espera' : 'Cámara reposo',
          estado,
          qrPayload: JSON.stringify({ pid: `P${numero}`, g: guia, kg, lt: '17C', v: 'Kent', t: 'O', d: today }),
          horaRegistro: i <= 6 ? '07:12' : i <= 14 ? '07:48' : '08:24',
          observaciones: ''
        });
      }
      return arr;
    })(),

    // --- 3 Túneles de congelado estáticos (planta Vegueta) ---
    tuneles: [
      {
        id: 'TUN-01', nombre: 'Túnel Estático #1', tipo: 'Estático', capacidadPalets: 8,
        tempActual: -34.2, tempObjetivo: -35, humedad: 92,
        estado: 'Congelando',
        inicio: '2026-02-21 09:30', estimadoFin: '2026-02-21 12:00',
        progreso: 78,
        palets: ['PT-2026-EG07-00004381-01','PT-2026-EG07-00004381-02','PT-2026-EG07-00004381-03','PT-2026-EG07-00004381-04','PT-2026-EG07-00004381-05','PT-2026-EG07-00004381-06']
      },
      {
        id: 'TUN-02', nombre: 'Túnel Estático #2', tipo: 'Estático', capacidadPalets: 8,
        tempActual: -36.0, tempObjetivo: -35, humedad: 91,
        estado: 'Listo · Por descargar',
        inicio: '2026-02-21 06:30', estimadoFin: '2026-02-21 09:00',
        progreso: 100,
        palets: ['PT-LOTE-PREV-A','PT-LOTE-PREV-B','PT-LOTE-PREV-C','PT-LOTE-PREV-D']
      },
      {
        id: 'TUN-03', nombre: 'Túnel Estático #3', tipo: 'Estático', capacidadPalets: 8,
        tempActual: 4.5, tempObjetivo: -35, humedad: 88,
        estado: 'Cargando',
        inicio: null, estimadoFin: null,
        progreso: 0,
        palets: ['PT-2026-EG07-00004381-07','PT-2026-EG07-00004381-08']
      }
    ],

    // --- Órdenes de Empaque ---
    ordenesEmpaque: [
      { id: 'EMP-2026-0125', cliente: 'CL001', clienteNombre: 'McCormick & Company Inc.', pedido: 'PO-2026-MC-887', contenedor: 'MSCU-7234812', fruta: 'Mango Kent Orgánico IQF',
        presentacion: 'Bolsa 1kg x 10 (caja máster)', tipoCorte: 'Chunks 19mm', cajasObjetivo: 1280, cajasEmpacadas: 412,
        kilosObjetivo: 12800, kilosEmpacados: 4120, lote: '17C', codTraz: 'FTP-MGK-26-0517C-EMP01',
        hora_inicio: '2026-02-21 11:00', hora_estimada_fin: '2026-02-21 18:30', operarios: 24, productividad: 7.7, estado: 'En proceso' },
      { id: 'EMP-2026-0124', cliente: 'CL002', clienteNombre: 'Carmencita Especias S.A.', pedido: 'PO-2026-CA-451', contenedor: 'TCLU-6612388', fruta: 'Mango Kent Orgánico IQF',
        presentacion: 'IQF granel · 10kg', tipoCorte: 'Slices 12mm', cajasObjetivo: 800, cajasEmpacadas: 800,
        kilosObjetivo: 8000, kilosEmpacados: 8000, lote: '16B', codTraz: 'FTP-MGK-26-0416B-EMP04',
        hora_inicio: '2026-02-20 06:00', hora_estimada_fin: '2026-02-20 14:30', operarios: 22, productividad: 8.4, estado: 'Completado' }
    ],

    // --- Cámara PT: 6 racks × 4 niveles × 5 slots = 120 slots ---
    camaraSlots: (function () {
      const arr = [];
      // Semilla determinista para que la distribución sea siempre igual
      let seed = 17;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let r = 1; r <= 6; r++) {
        for (let n = 1; n <= 4; n++) {
          for (let s = 1; s <= 5; s++) {
            const v = rnd();
            const ocupado = v > 0.35;
            arr.push({
              id: `CAM-R${r}-N${n}-S${String(s).padStart(2,'0')}`,
              rack: r, nivel: n, slot: s,
              ocupado,
              cajas: ocupado ? Math.floor(35 + rnd() * 25) : 0,
              kilos: ocupado ? Math.floor(350 + rnd() * 250) : 0,
              cliente: ocupado ? (rnd() > 0.5 ? 'McCormick' : 'Carmencita') : null,
              fechaIngreso: ocupado ? '2026-02-' + String(15 + Math.floor(rnd() * 6)).padStart(2,'0') : null,
              tempActual: -22.4 - (rnd() * 1.2)
            });
          }
        }
      }
      return arr;
    })(),

    // --- Contenedores ---
    contenedores: [
      { id: 'MSCU-7234812', cliente: 'McCormick & Company Inc.', pais: 'EE.UU.', puerto: 'Callao', booking: 'BK-2026-1124', estado: 'En empaque', ocupacionPct: 32,  fechaCierre: '2026-02-22', naviera: 'MSC' },
      { id: 'TCLU-6612388', cliente: 'Carmencita Especias S.A.', pais: 'España', puerto: 'Callao', booking: 'BK-2026-1118', estado: 'Listo',      ocupacionPct: 100, fechaCierre: '2026-02-20', naviera: 'CMA-CGM' },
      { id: 'CMAU-9985421', cliente: 'McCormick Foods México',   pais: 'México', puerto: 'Callao', booking: 'BK-2026-1131', estado: 'Asignado',   ocupacionPct: 0,   fechaCierre: '2026-02-26', naviera: 'CMA-CGM' }
    ],

    // --- Eventos timeline / blockchain mock ---
    eventos: [
      { ts: '2026-02-19 19:28', actor: 'SUNAT',            accion: 'Guía electrónica EG07-00004381 emitida',                hash: 'a7f3...4381' },
      { ts: '2026-02-19 19:55', actor: 'TROPICAL FOOD',    accion: 'Camión B4R-935 sale de Tambo Grande · Piura',           hash: 'b1c8...0001' },
      { ts: '2026-02-21 06:18', actor: 'FTP Vegueta',      accion: 'Camión llega a planta · pesado en romana',               hash: 'c2d9...0002' },
      { ts: '2026-02-21 06:42', actor: 'FTP Recepción',    accion: '19 paletickets QR generados (18 × 1000kg + 1 × 870kg)', hash: 'd3e0...0003' },
      { ts: '2026-02-21 07:12', actor: 'FTP Acond.',       accion: 'Inicio acondicionado palet PT-01 · 1000 kg',             hash: 'e4f1...0004' },
      { ts: '2026-02-21 09:30', actor: 'FTP Túnel #1',     accion: 'Carga 6 palets · inicio congelado IQF',                  hash: 'f5g2...0005' },
      { ts: '2026-02-21 11:00', actor: 'FTP Empaque',      accion: 'Inicio empaque OE-EMP-2026-0125 · cliente McCormick',   hash: 'g6h3...0006' }
    ]
  };

  global.TRZ = TRZ;
  // Indicador de origen de datos: 'mock' | 'supabase'. Por ahora todo mock.
  global.TRZ_DATA_SOURCE = 'mock';

  console.info('[TRZ] Datos cargados ·',
    TRZ.guiasSunat.length, 'guías ·',
    TRZ.paletickets.length, 'paletickets ·',
    TRZ.tuneles.length, 'túneles ·',
    TRZ.camaraSlots.length, 'slots cámara');
})(window);
