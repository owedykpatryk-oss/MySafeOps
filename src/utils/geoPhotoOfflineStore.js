/** Durable browser storage. Resolve writes only after their transaction commits. */
const pending = new Map();

function transact(key, mode, value) {
  return new Promise((resolve) => {
    if (typeof indexedDB === "undefined") { resolve(null); return; }
    let request;
    try { request = indexedDB.open("mysafeops_geo_photo_offline", 1); }
    catch { resolve(null); return; }
    let settled = false;
    const finish = (result) => { if (!settled) { settled = true; resolve(result); } };
    request.onupgradeneeded = () => request.result.createObjectStore("photos");
    request.onerror = request.onblocked = () => finish(null);
    request.onsuccess = () => {
      const db = request.result;
      if (settled) { db.close(); return; }
      db.onversionchange = () => db.close();
      try {
        const tx = db.transaction("photos", mode === "read" ? "readonly" : "readwrite");
        const store = tx.objectStore("photos");
        const operation = mode === "read" ? store.get(key) : mode === "delete" ? store.delete(key) : store.put(value, key);
        tx.oncomplete = () => { db.close(); finish(mode === "read" ? operation.result ?? null : true); };
        tx.onerror = tx.onabort = () => { db.close(); finish(null); };
      } catch { db.close(); finish(null); }
    };
  });
}

function queue(key, mode, value) {
  const operation = (pending.get(key) || Promise.resolve()).then(() => transact(key, mode, value));
  pending.set(key, operation);
  void operation.finally(() => { if (pending.get(key) === operation) pending.delete(key); });
  return operation;
}

export const readGeoPhotoOffline = (key) => queue(key, "read");
export const writeGeoPhotoOffline = (key, value) => queue(key, "write", value);
export const deleteGeoPhotoOffline = (key) => queue(key, "delete");
