# Widget Sync para apps externas (FTP-PRODUCCION, ARES2428)

Este archivo contiene el snippet para agregar un **boton Sync flotante** a cualquier
app externa (FTP-PRODUCCION, ARES2428/temperaturas.html, etc) sin necesidad de
cargar archivos externos. **Copiar y pegar** al final del `<body>` del HTML.

## Requisitos previos
- El HTML ya tiene `supabaseClient` o `supabase` disponible globalmente.
- Los registros se guardan en `localStorage` bajo alguna key conocida.

## Snippet universal (pegar antes de `</body>`)

```html
<!-- ══ Sync Widget FTP — boton flotante para reenviar localStorage a Supabase ══ -->
<button id="ftpSyncFab" type="button" title="Sincronizar registros pendientes con Supabase"
  style="position:fixed;bottom:20px;right:20px;z-index:99998;
         background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;
         border:none;border-radius:50px;padding:12px 22px;font-size:14px;
         font-weight:800;cursor:pointer;box-shadow:0 8px 25px rgba(37,99,235,0.45);
         display:flex;align-items:center;gap:8px;font-family:system-ui,sans-serif">
  <span>🔄 Sync</span>
  <span id="ftpSyncBadge" style="background:#dc2626;border-radius:10px;padding:2px 8px;
    font-size:11px;display:none;min-width:22px;text-align:center">0</span>
</button>

<script>
(function(){
  // ─── CONFIGURACION — editar segun la app ────────────────────
  var CONFIG = {
    table: 'registro_produccion',        // ← TABLA EN SUPABASE
    storageKey: 'prod_registros',        // ← KEY DEL LOCALSTORAGE
    onConflict: 'fecha,hora,linea',      // ← UNIQUE KEY DE LA TABLA (o null)
    requiredFields: ['fecha','hora'],    // ← campos obligatorios
    mapRecord: function(r){              // ← mapea de local a Supabase
      return {
        fecha: r.fecha,
        hora: r.hora,
        turno: r.turno || null,
        fruta: r.fruta || null,
        linea: r.linea || null,
        consumo_kg: r.consumo_kg || null,
        pt_aprox_kg: r.pt_aprox_kg || null,
        personas: r.personas || null,
        supervisor: r.supervisor || null,
        observacion: r.observacion || null
      };
    }
  };
  // ─── FIN CONFIGURACION ──────────────────────────────────────

  var btn = document.getElementById('ftpSyncFab');
  var badge = document.getElementById('ftpSyncBadge');

  function getClient(){
    return window.supabaseClient || window.supabase || null;
  }
  function getRecords(){
    try { return JSON.parse(localStorage.getItem(CONFIG.storageKey) || '[]'); }
    catch(e) { return []; }
  }
  function toast(msg, color){
    var el = document.createElement('div');
    el.style.cssText = 'position:fixed;top:20px;right:20px;background:'+(color||'#16a34a')+
      ';color:#fff;padding:14px 22px;border-radius:12px;font-weight:700;'+
      'box-shadow:0 10px 30px rgba(0,0,0,0.3);z-index:999999;font-size:13px;'+
      'max-width:380px;font-family:system-ui';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(function(){ el.style.opacity='0'; el.style.transition='opacity .4s'; }, 4500);
    setTimeout(function(){ el.remove(); }, 5000);
  }
  function updateBadge(){
    var n = getRecords().length;
    if (n > 0) { badge.textContent = n; badge.style.display = 'inline-block'; }
    else { badge.style.display = 'none'; }
  }

  async function performSync(){
    var client = getClient();
    if (!client) { toast('❌ Supabase no disponible', '#dc2626'); return; }
    var records = getRecords();
    if (!records.length) { toast('ℹ️ No hay registros pendientes', '#2563eb'); return; }

    btn.disabled = true;
    btn.style.opacity = '0.7';
    var original = btn.innerHTML;
    btn.innerHTML = '⏳ Sincronizando '+records.length+'...';

    var synced = 0, failed = 0, firstError = null;
    var batchSize = 50;
    for (var i = 0; i < records.length; i += batchSize) {
      var slice = records.slice(i, i + batchSize);
      var payload = slice.map(function(r){
        try { return CONFIG.mapRecord(r); } catch(e) { return null; }
      }).filter(function(r){
        if (!r) return false;
        for (var j = 0; j < CONFIG.requiredFields.length; j++) {
          if (!r[CONFIG.requiredFields[j]]) return false;
        }
        return true;
      });
      if (!payload.length) continue;
      try {
        var q = client.from(CONFIG.table);
        var result = CONFIG.onConflict
          ? await q.upsert(payload, { onConflict: CONFIG.onConflict })
          : await q.upsert(payload);
        if (result.error) { firstError = firstError || result.error; failed += payload.length; }
        else { synced += payload.length; }
      } catch(e) { firstError = firstError || e; failed += payload.length; }
    }

    btn.disabled = false;
    btn.style.opacity = '1';
    btn.innerHTML = original;
    updateBadge();

    if (failed === 0 && synced > 0) toast('✅ '+synced+' registros sincronizados', '#16a34a');
    else if (failed > 0 && synced > 0) toast('⚠️ Parcial: '+synced+' OK, '+failed+' fallaron', '#f59e0b');
    else {
      var msg = firstError ? firstError.message : '';
      if (msg.indexOf('policy') >= 0 || msg.indexOf('row-level') >= 0)
        toast('🚫 Sin permiso. Contacta a Rodrigo', '#dc2626');
      else toast('❌ '+failed+' fallaron: '+msg, '#dc2626');
    }
  }

  btn.addEventListener('click', performSync);
  updateBadge();
  setInterval(updateBadge, 3000);
  window.addEventListener('storage', function(ev){
    if (ev.key === CONFIG.storageKey) updateBadge();
  });
})();
</script>
```

---

## Configuraciones por app

### Para `app-registro-produccion.html` (repo FTP-PRODUCCION)
```js
CONFIG = {
  table: 'registro_produccion',
  storageKey: 'prod_registros',
  onConflict: 'fecha,hora,linea',
  requiredFields: ['fecha','hora','consumo_kg'],
  mapRecord: (r) => ({
    fecha: r.fecha, hora: r.hora, turno: r.turno,
    fruta: r.fruta || 'MANGO', linea: r.linea || 'Linea 1',
    proyectado_tn: r.proyectado_tn || 16, consumo_kg: r.consumo_kg,
    pt_aprox_kg: r.pt_aprox_kg, personas: r.personas || 0,
    supervisor: r.supervisor, observacion: r.observacion || null
  })
};
```

### Para `app-registro-personal.html` (repo FTP-PRODUCCION)
```js
CONFIG = {
  table: 'registro_personal',
  storageKey: 'personal_registros',
  onConflict: 'fecha,hora,linea',
  requiredFields: ['fecha','hora'],
  mapRecord: (r) => ({
    fecha: r.fecha, hora: r.hora, turno: r.turno,
    fruta: r.fruta, linea: r.linea || 'Linea 1',
    num_personal: r.num_personal || 0,
    distribucion: r.distribucion || null,
    observacion: r.observacion || null,
    registrado_por: r.registrado_por || null
  })
};
```

### Para `app-registro-tuneles.html` (repo FTP-PRODUCCION)
```js
CONFIG = {
  table: 'registro_tuneles',
  storageKey: 'tuneles_registros',
  onConflict: 'fecha,tunel,hora_inicio',
  requiredFields: ['fecha','tunel','fruta'],
  mapRecord: (r) => ({
    fecha: r.fecha, turno: r.turno, tunel: r.tunel,
    fruta: r.fruta, hora_inicio: r.hora_inicio,
    hora_fin: r.hora_fin, coches: r.coches || 0,
    kg: r.kg || 0, temp_ingreso: r.temp_ingreso,
    temp_final: r.temp_final, hrs_congelamiento: r.hrs_congelamiento,
    eficiencia: r.eficiencia, operador: r.operador,
    observacion: r.observacion || null
  })
};
```

### Para `app-empaque-congelado.html` (repo FTP-PRODUCCION)
```js
CONFIG = {
  table: 'registro_empaque_congelado',
  storageKey: 'empaque_congelado_registros',
  onConflict: null,                                 // sin conflict
  requiredFields: ['fecha','hora','fruta'],
  mapRecord: (r) => ({
    fecha: r.fecha, hora: r.hora, turno: r.turno,
    fruta: r.fruta, tipo: r.tipo, corte: r.corte,
    cuts_detail: r.cuts_detail || null,
    kg_presentacion: r.kg_presentacion, cajas: r.cajas,
    kg_pt: r.kg_pt, cj_hr: r.cj_hr, cj_hr_op: r.cj_hr_op,
    operarios: r.operarios, cliente: r.cliente,
    lote_mp: r.lote_mp, cod_trazabilidad: r.cod_trazabilidad,
    supervisor: r.supervisor, observacion: r.observacion || null
  })
};
```

### Para `temperaturas.html` (repo ARES2428)
```js
CONFIG = {
  table: 'registros_temperatura',
  storageKey: 'temps_local',          // ← verificar nombre real del localStorage key
  onConflict: null,
  requiredFields: ['fecha','hora','area'],
  mapRecord: (r) => ({
    fecha: r.fecha, hora: r.hora, area: r.area,
    temperatura: r.temperatura, estado: r.estado,
    operario: r.operario, turno: r.turno,
    observaciones: r.observaciones || null
  })
};
```

---

## Instrucciones para Rodrigo

1. Copiar el snippet base a cada `app-*.html` de FTP-PRODUCCION y a `temperaturas.html` de ARES2428.
2. Ajustar el bloque `CONFIG` segun la app.
3. Commit + push a cada repo.
4. En cada dispositivo de planta hacer Ctrl+Shift+R para descargar la version nueva.
5. Presionar el boton 🔄 Sync para subir los registros atrapados en localStorage.

## Nota de seguridad
Las policies RLS anon permiten INSERT/UPDATE SOLO en la ventana temporal
`hoy +/- 2 dias`. Esto evita inyeccion masiva de registros historicos.
Cuando se migre FTP-PRODUCCION a auth real, estas policies anon deberan
eliminarse via `DROP POLICY`.
