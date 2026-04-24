/* ══════════════════════════════════════════════════════════════════════
   SYNC-BUTTON - Boton universal para sincronizar registros localStorage
                 con Supabase. Reutilizable en todas las apps.
   Frutos Tropicales Peru Export S.A.C.

   USO tipico en una app:

     <!-- en el HTML, slot donde va el boton -->
     <span id="syncSlot"></span>

     <!-- al final de la app, despues de crear supabaseClient -->
     <script src="../_shared/sync-button.js"></script>
     <script>
       mountSyncButton({
         container: '#syncSlot',
         table: 'registro_produccion',
         storageKey: 'prod_registros',
         onConflict: 'fecha,hora,linea',
         mapRecord: (r) => ({
           fecha: r.fecha, hora: r.hora, fruta: r.fruta, linea: r.linea,
           consumo_kg: r.consumo_kg, pt_aprox_kg: r.pt_aprox_kg,
           personas: r.personas, supervisor: r.supervisor,
           observacion: r.observacion || null
         }),
         requiredFields: ['fecha','hora','consumo_kg']
       });
     </script>

   Features:
   - Badge rojo con cantidad de registros pendientes
   - Verifica sesion Supabase antes de sincronizar
   - Muestra toast con resultado (exito/parcial/error)
   - Batch de 50 registros para no saturar
   - No bloquea la UI durante el sync
   ══════════════════════════════════════════════════════════════════════ */

(function(global){
  'use strict';

  // ─── Helpers ───
  function getClient() {
    return global.supabaseClient || null;
  }

  function toast(msg, color, durationMs) {
    color = color || '#16a34a';
    durationMs = durationMs || 4500;
    var el = document.createElement('div');
    el.style.cssText =
      'position:fixed;top:20px;right:20px;background:' + color + ';' +
      'color:#fff;padding:14px 22px;border-radius:12px;' +
      'font-weight:700;box-shadow:0 10px 30px rgba(0,0,0,0.25);' +
      'z-index:999999;font-size:13px;max-width:380px;' +
      'font-family:system-ui,-apple-system,sans-serif;line-height:1.4;' +
      'opacity:0;transform:translateY(-10px);transition:opacity 0.3s,transform 0.3s';
    el.textContent = msg;
    document.body.appendChild(el);
    requestAnimationFrame(function(){
      el.style.opacity = '1';
      el.style.transform = 'translateY(0)';
    });
    setTimeout(function(){
      el.style.opacity = '0';
      el.style.transform = 'translateY(-10px)';
    }, durationMs);
    setTimeout(function(){ if (el.parentNode) el.parentNode.removeChild(el); }, durationMs + 400);
  }

  function getLocalRecords(storageKey) {
    try { return JSON.parse(localStorage.getItem(storageKey) || '[]'); }
    catch(e) { return []; }
  }

  // ─── Core sync ───
  async function performSync(config) {
    var table = config.table;
    var storageKey = config.storageKey;
    var mapRecord = config.mapRecord || function(r){ return r; };
    var onConflict = config.onConflict;
    var requiredFields = config.requiredFields || [];
    var button = config.button;
    var badge = config.badge;

    var client = getClient();
    if (!client) {
      toast('❌ Cliente Supabase no disponible. Verifica tu conexion.', '#dc2626');
      return { synced: 0, failed: 0 };
    }

    // Verificar sesion activa
    try {
      var sessionResp = await client.auth.getSession();
      var session = sessionResp && sessionResp.data && sessionResp.data.session;
      if (!session) {
        toast('🔒 No hay sesion activa. Cierra y vuelve a entrar al portal.', '#dc2626', 7000);
        return { synced: 0, failed: 0 };
      }
      // Check expiracion
      var expiresAt = session.expires_at ? session.expires_at * 1000 : null;
      if (expiresAt && expiresAt < Date.now()) {
        toast('🔒 Tu sesion expiro. Vuelve a iniciar sesion.', '#dc2626', 7000);
        return { synced: 0, failed: 0 };
      }
    } catch (e) {
      console.error('[sync] session check error:', e);
    }

    var records = getLocalRecords(storageKey);
    if (!records.length) {
      toast('ℹ️ No hay registros locales pendientes', '#2563eb', 3500);
      return { synced: 0, failed: 0 };
    }

    if (button) {
      button.disabled = true;
      button.dataset.originalHtml = button.dataset.originalHtml || button.innerHTML;
      button.innerHTML = '⏳ Sincronizando ' + records.length + '...';
    }

    var synced = 0, failed = 0;
    var batchSize = 50;
    var firstError = null;

    for (var i = 0; i < records.length; i += batchSize) {
      var slice = records.slice(i, i + batchSize);
      var payload = slice
        .map(function(r){
          try { return mapRecord(r); }
          catch(e){ console.error('[sync] mapRecord error:', e, r); return null; }
        })
        .filter(function(r){
          if (!r) return false;
          for (var j = 0; j < requiredFields.length; j++) {
            if (r[requiredFields[j]] === undefined || r[requiredFields[j]] === null || r[requiredFields[j]] === '') {
              return false;
            }
          }
          return true;
        });

      if (!payload.length) continue;

      try {
        var q = client.from(table);
        var result;
        if (onConflict) {
          result = await q.upsert(payload, { onConflict: onConflict });
        } else {
          result = await q.upsert(payload);
        }
        if (result.error) {
          console.error('[sync] batch error:', result.error);
          firstError = firstError || result.error;
          failed += payload.length;
        } else {
          synced += payload.length;
        }
      } catch (e) {
        console.error('[sync] exception:', e);
        firstError = firstError || { message: e.message };
        failed += payload.length;
      }
    }

    if (button) {
      button.disabled = false;
      button.innerHTML = button.dataset.originalHtml || '🔄 Sync';
    }
    if (badge) updateBadge(badge, storageKey);

    if (failed === 0 && synced > 0) {
      toast('✅ ' + synced + ' registros sincronizados a Supabase', '#16a34a');
    } else if (failed > 0 && synced > 0) {
      toast('⚠️ Parcial: ' + synced + ' OK, ' + failed + ' fallaron. ' +
            (firstError ? '(' + firstError.message + ')' : ''), '#f59e0b', 7000);
    } else if (failed > 0) {
      var errMsg = firstError ? firstError.message : '';
      // Mensaje especifico si es RLS
      if (errMsg && (errMsg.indexOf('policy') >= 0 || errMsg.indexOf('row-level') >= 0 || errMsg.indexOf('RLS') >= 0)) {
        toast('🚫 Sin permiso para escribir. Tu usuario necesita rol adecuado. Contacta a Rodrigo.', '#dc2626', 10000);
      } else if (errMsg && (errMsg.indexOf('duplicate key') >= 0 || errMsg.indexOf('unique constraint') >= 0)) {
        // Estos registros ya existen en Supabase y el upsert no tuvo onConflict configurado.
        toast('ℹ️ ' + failed + ' registros ya existen en Supabase (duplicados). El boton Sync necesita configurar onConflict para esta tabla.', '#f59e0b', 8000);
      } else {
        toast('❌ ' + failed + ' registros no se pudieron sincronizar. ' + errMsg, '#dc2626', 7000);
      }
    }

    return { synced: synced, failed: failed, error: firstError };
  }

  // ─── Badge con contador (desactivado por preferencia UX) ───
  // Se mantiene la funcion como no-op para compatibilidad con consumidores
  // externos que invoquen refreshBadge(). No renderiza nada visible.
  function updateBadge(badge, storageKey) {
    if (badge) badge.style.display = 'none';
  }

  // ─── Mount ───
  function mountSyncButton(config) {
    if (!config || !config.table || !config.storageKey) {
      console.warn('[mountSyncButton] falta table o storageKey');
      return null;
    }

    var container = typeof config.container === 'string'
      ? document.querySelector(config.container)
      : config.container;

    if (!container) {
      console.warn('[mountSyncButton] container no encontrado:', config.container);
      return null;
    }

    // Boton
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ftp-sync-btn';
    btn.innerHTML = '🔄 Sync';
    btn.title = 'Sincronizar registros locales a Supabase';
    btn.style.cssText =
      'background:rgba(37,99,235,0.15);color:#3b82f6;' +
      'border:1px solid rgba(37,99,235,0.35);border-radius:8px;' +
      'padding:4px 10px;font-size:11px;font-weight:700;' +
      'cursor:pointer;display:inline-flex;align-items:center;gap:4px;' +
      'position:relative;transition:all 0.2s;margin-left:6px';

    btn.addEventListener('mouseenter', function(){
      btn.style.background = 'rgba(37,99,235,0.25)';
      btn.style.borderColor = 'rgba(37,99,235,0.6)';
    });
    btn.addEventListener('mouseleave', function(){
      btn.style.background = 'rgba(37,99,235,0.15)';
      btn.style.borderColor = 'rgba(37,99,235,0.35)';
    });

    // Badge desactivado (se mantiene la variable en null para que el resto del
    // codigo siga funcionando sin mostrar el contador numerico)
    var badge = null;

    // Estilos del boton (spin y disabled). Keyframes del badge eliminados.
    if (!document.getElementById('ftpSyncStyles')) {
      var style = document.createElement('style');
      style.id = 'ftpSyncStyles';
      style.textContent =
        '@keyframes ftpSyncSpin{to{transform:rotate(360deg)}}' +
        '.ftp-sync-btn:disabled{opacity:0.7;cursor:wait}';
      document.head.appendChild(style);
    }

    btn.addEventListener('click', function(){
      performSync({
        table: config.table,
        storageKey: config.storageKey,
        mapRecord: config.mapRecord,
        onConflict: config.onConflict,
        requiredFields: config.requiredFields,
        button: btn,
        badge: badge
      });
    });

    container.appendChild(btn);

    // Auto-actualizar badge cuando cambia localStorage
    window.addEventListener('storage', function(ev){
      if (ev.key === config.storageKey) updateBadge(badge, config.storageKey);
    });

    // Exponer API para refresh manual
    return {
      button: btn,
      badge: badge,
      sync: function(){ return performSync({ ...config, button: btn, badge: badge }); },
      refreshBadge: function(){ updateBadge(badge, config.storageKey); }
    };
  }

  // ─── Exponer global ───
  global.mountSyncButton = mountSyncButton;
  global.ftpPerformSync = performSync;
})(window);
