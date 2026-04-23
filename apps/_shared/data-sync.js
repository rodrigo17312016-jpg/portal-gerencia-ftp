/* ══════════════════════════════════════════════════════════════════════
   DATA-SYNC - Sincronizacion unificada localStorage <-> Supabase
   Frutos Tropicales Peru Export S.A.C.

   Estrategia:
   - loadRecords(opts):  intenta Supabase; si falla, lee localStorage
   - saveRecord(opts):   escribe ambos destinos; marca _synced:false si Supabase falla
   - flushPending(opts): al recuperar conexion, reenvia los _synced:false

   Las apps pueden (opcionalmente) migrar su logica actual a estas funciones
   para evitar reimplementaciones divergentes.
   ══════════════════════════════════════════════════════════════════════ */

(function(global) {
  'use strict';

  function _getClient() { return global.supabaseClient || null; }

  async function loadRecords(opts) {
    const { table, storageKey, orderBy, limit } = opts || {};
    const client = _getClient();

    // 1) Intentar Supabase
    if (client && table) {
      try {
        let q = client.from(table).select('*');
        if (orderBy) q = q.order(orderBy.column, { ascending: orderBy.ascending !== false });
        if (limit) q = q.limit(limit);
        const { data, error } = await q;
        if (!error && Array.isArray(data)) {
          // Cache en localStorage como backup
          if (storageKey) {
            try { localStorage.setItem(storageKey, JSON.stringify(data)); } catch (e) {}
          }
          return { source: 'supabase', data };
        }
      } catch (e) { /* cae al fallback */ }
    }

    // 2) Fallback localStorage
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) return { source: 'local', data: JSON.parse(raw) };
      } catch (e) {}
    }
    return { source: 'empty', data: [] };
  }

  async function saveRecord(opts) {
    const { table, storageKey, record, primaryKey } = opts || {};
    const pk = primaryKey || 'id';
    const client = _getClient();

    // 1) Append a localStorage SIEMPRE (buffer)
    let list = [];
    if (storageKey) {
      try {
        const raw = localStorage.getItem(storageKey);
        list = raw ? JSON.parse(raw) : [];
      } catch (e) {}
    }
    // Evitar duplicados por id
    if (record[pk]) {
      list = list.filter((r) => r[pk] !== record[pk]);
    }
    list.push({ ...record, _synced: false, _localTs: Date.now() });
    if (storageKey) {
      try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch (e) {}
    }

    // 2) Intentar Supabase
    if (client && table) {
      try {
        const payload = { ...record };
        delete payload._synced;
        delete payload._localTs;
        const { data, error } = await client.from(table).upsert(payload).select();
        if (!error) {
          // Marcar como sincronizado en el buffer
          list = list.map((r) =>
            r[pk] === record[pk] ? { ...r, _synced: true } : r
          );
          if (storageKey) {
            try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch (e) {}
          }
          return { success: true, synced: true, data };
        }
        return { success: true, synced: false, error: error.message };
      } catch (e) {
        return { success: true, synced: false, error: e.message };
      }
    }
    return { success: true, synced: false, error: 'No supabase client' };
  }

  async function flushPending(opts) {
    const { table, storageKey } = opts || {};
    if (!storageKey || !table) return { flushed: 0, failed: 0 };
    const client = _getClient();
    if (!client) return { flushed: 0, failed: 0 };

    let list = [];
    try {
      const raw = localStorage.getItem(storageKey);
      list = raw ? JSON.parse(raw) : [];
    } catch (e) { return { flushed: 0, failed: 0 }; }

    const pending = list.filter((r) => r._synced === false);
    let flushed = 0, failed = 0;
    for (const r of pending) {
      try {
        const payload = { ...r };
        delete payload._synced;
        delete payload._localTs;
        const { error } = await client.from(table).upsert(payload);
        if (!error) {
          r._synced = true;
          flushed++;
        } else {
          failed++;
        }
      } catch (e) { failed++; }
    }
    try { localStorage.setItem(storageKey, JSON.stringify(list)); } catch (e) {}
    return { flushed, failed };
  }

  // Exponer
  global.ftpDataSync = {
    loadRecords,
    saveRecord,
    flushPending
  };
})(window);
