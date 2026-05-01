/* ============================================================
   offline-queue.js — cola de pendientes en IndexedDB.

   Estructura:
   - DB: temperaturas-pwa
   - Object store: pending_registros
     keyPath: 'syncOfflineId' (UUID generado en cliente)
     value:   {
       syncOfflineId, createdAt, payload (json a insertar),
       fotoBlob (Blob | null), uploaded (bool), tries (int), lastError
     }

   Flow:
   - addPending(payload, blob)  → guarda en queue
   - flush()                    → intenta subir todo lo pendiente
   - dispara evento 'queue:changed'
   ============================================================ */

(function () {
  'use strict';

  const DB_NAME = 'temperaturas-pwa';
  const DB_VERSION = 1;
  const STORE = 'pending_registros';

  let dbPromise = null;

  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = (ev) => {
        const db = ev.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          const os = db.createObjectStore(STORE, { keyPath: 'syncOfflineId' });
          os.createIndex('createdAt', 'createdAt');
          os.createIndex('uploaded', 'uploaded');
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  function tx(mode = 'readonly') {
    return openDB().then(db => db.transaction(STORE, mode).objectStore(STORE));
  }

  function uuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    // Fallback v4
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  async function addPending(payload, fotoBlob = null) {
    const syncOfflineId = payload.sync_offline_id || uuid();
    payload.sync_offline_id = syncOfflineId;
    const record = {
      syncOfflineId,
      createdAt: Date.now(),
      payload,
      fotoBlob: fotoBlob || null,
      uploaded: false,
      tries: 0,
      lastError: null
    };
    const store = await tx('readwrite');
    return new Promise((resolve, reject) => {
      const r = store.put(record);
      r.onsuccess = () => {
        document.dispatchEvent(new CustomEvent('queue:changed'));
        resolve(record);
      };
      r.onerror = () => reject(r.error);
    });
  }

  async function getAllPending() {
    const store = await tx();
    return new Promise((resolve, reject) => {
      const r = store.getAll();
      r.onsuccess = () => resolve((r.result || []).filter(x => !x.uploaded));
      r.onerror = () => reject(r.error);
    });
  }

  async function countPending() {
    const all = await getAllPending();
    return all.length;
  }

  async function deleteRecord(syncOfflineId) {
    const store = await tx('readwrite');
    return new Promise((resolve, reject) => {
      const r = store.delete(syncOfflineId);
      r.onsuccess = () => {
        document.dispatchEvent(new CustomEvent('queue:changed'));
        resolve();
      };
      r.onerror = () => reject(r.error);
    });
  }

  async function markFailed(syncOfflineId, errorMsg) {
    const store = await tx('readwrite');
    return new Promise((resolve, reject) => {
      const get = store.get(syncOfflineId);
      get.onsuccess = () => {
        const record = get.result;
        if (!record) return resolve();
        record.tries = (record.tries || 0) + 1;
        record.lastError = errorMsg;
        const put = store.put(record);
        put.onsuccess = () => resolve();
        put.onerror = () => reject(put.error);
      };
      get.onerror = () => reject(get.error);
    });
  }

  /**
   * Intenta subir todos los pendientes.
   * Devuelve {synced, failed}.
   */
  async function flush() {
    if (!navigator.onLine) return { synced: 0, failed: 0, skipped: true };
    if (!window.SBClient || !window.SBClient.isConfigured()) {
      return { synced: 0, failed: 0, skipped: true };
    }
    const pendings = await getAllPending();
    let synced = 0, failed = 0;

    for (const p of pendings) {
      try {
        // 1) subir foto si existe y aún no tiene url
        let fotoUrl = p.payload.foto_url || null;
        if (!fotoUrl && p.fotoBlob) {
          const up = await window.SBClient.uploadFoto(p.fotoBlob, p.syncOfflineId);
          if (!up.ok) {
            // Si falla foto, puede ser temporal — registramos error pero seguimos sin foto
            // si llevamos > 3 intentos, perdemos la foto y guardamos solo el dato.
            if ((p.tries || 0) >= 3) {
              fotoUrl = null;  // se acepta sin foto
            } else {
              await markFailed(p.syncOfflineId, 'foto: ' + (up.error?.message || 'error'));
              failed++;
              continue;
            }
          } else {
            // Bucket privado: guardamos el path (el dashboard genera signed URL al renderizar)
            fotoUrl = up.path;
          }
        }

        // 2) insertar registro
        const payload = { ...p.payload, foto_url: fotoUrl };
        const ins = await window.SBClient.insertRegistro(payload);
        if (!ins.ok) {
          // Conflicto unique (sync_offline_id ya existe) → ya se subió antes, eliminar
          if (ins.error?.code === '23505' || /duplicate/i.test(ins.error?.message || '')) {
            await deleteRecord(p.syncOfflineId);
            synced++;
            continue;
          }
          await markFailed(p.syncOfflineId, ins.error?.message || 'insert error');
          failed++;
          continue;
        }
        await deleteRecord(p.syncOfflineId);
        synced++;
      } catch (e) {
        await markFailed(p.syncOfflineId, e.message || String(e));
        failed++;
      }
    }

    document.dispatchEvent(new CustomEvent('queue:flushed', { detail: { synced, failed } }));
    return { synced, failed };
  }

  // Auto-flush cuando vuelve la red
  window.addEventListener('online', () => {
    setTimeout(() => flush().catch(console.warn), 500);
  });

  // Flush inicial al cargar
  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
      if (navigator.onLine) flush().catch(console.warn);
    }, 1500);
  });

  // Mensaje del SW sobre sync background
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', (ev) => {
      if (ev.data && ev.data.type === 'SYNC_TRIGGERED') {
        flush().catch(console.warn);
      }
    });
  }

  window.OfflineQueue = {
    uuid,
    addPending,
    getAllPending,
    countPending,
    deleteRecord,
    flush
  };
})();
