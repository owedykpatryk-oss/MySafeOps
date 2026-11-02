/**
 * Per-record storage for the future RAMS repository. Not yet connected to module saves.
 * A document and its pending upload commit in the same IndexedDB transaction.
 * Scope must come from the authenticated application context, never document fields.
 * This partitions application data; it is not encryption or server authorisation.
 */
const DB_NAME = "mysafeops_record_sync";
const RECORDS = "records";
const PENDING = "pending";
const CONFLICTS = "conflicts";

export class OfflineRecordStoreError extends Error {
  constructor(code) {
    super(code);
    this.name = "OfflineRecordStoreError";
    this.code = code;
  }
}

function required(value, name) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    throw new OfflineRecordStoreError(`invalid_${name}`);
  }
  return value;
}

function location(scope, namespace, recordId) {
  const owner = {
    userId: required(scope?.userId, "user_id"),
    orgSlug: required(scope?.orgSlug, "org_slug"),
    // Explicit "primary" or the secondary workspace ID; no ambient country fallback.
    countryKey: required(scope?.countryKey, "country_key"),
  };
  if (owner.orgSlug === "default") throw new OfflineRecordStoreError("invalid_org_slug");
  const scopeKey = JSON.stringify([owner.userId, owner.orgSlug, owner.countryKey]);
  const ns = required(namespace, "namespace");
  const result = { scope: owner, scopeKey, namespace: ns };
  if (recordId !== undefined) {
    result.recordId = required(recordId, "record_id");
    result.id = JSON.stringify([scopeKey, ns, result.recordId]);
  }
  return result;
}

function revision(value, name) {
  if (!Number.isSafeInteger(value) || value < 0) throw new OfflineRecordStoreError(`invalid_${name}`);
  return value;
}

function copyValue(value, recordId, allowNull = false) {
  if (allowNull && value === null) return null;
  if (!value || typeof value !== "object" || Array.isArray(value) || value.id !== recordId) {
    throw new OfflineRecordStoreError("invalid_record_value");
  }
  // Match the JSON transport and detach caller-owned objects before opening a transaction.
  return JSON.parse(JSON.stringify(value, (_key, item) => {
    if (["function", "symbol", "bigint"].includes(typeof item)
      || (typeof item === "number" && !Number.isFinite(item))) {
      throw new OfflineRecordStoreError("invalid_record_value");
    }
    return item;
  }));
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new OfflineRecordStoreError("storage_unavailable"));
      return;
    }
    const request = indexedDB.open(DB_NAME, 1);
    let blocked = false;
    request.onblocked = () => {
      blocked = true;
      reject(new OfflineRecordStoreError("storage_blocked"));
    };
    request.onupgradeneeded = () => {
      for (const name of [RECORDS, PENDING, CONFLICTS]) {
        const store = request.result.createObjectStore(name, { keyPath: "id" });
        store.createIndex("scopeNamespace", ["scopeKey", "namespace"]);
        if (name === PENDING) store.createIndex("scopeNamespaceStatus", ["scopeKey", "namespace", "status"]);
      }
    };
    request.onerror = () => reject(request.error || new OfflineRecordStoreError("storage_open_failed"));
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      if (blocked) db.close();
      else resolve(db);
    };
  });
}

async function transaction(stores, mode, work) {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(stores, mode);
      let result;
      let failure;
      // Resolve only after commit, never on an individual put's success event.
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(failure || tx.error || new OfflineRecordStoreError("storage_transaction_aborted"));
      const guard = (fn) => (...args) => {
        try { fn(...args); }
        catch (error) {
          failure = error;
          try { tx.abort(); } catch { /* An underlying storage operation may already have aborted. */ }
        }
      };
      guard(work)(tx, (value) => { result = value; }, guard);
    });
  } finally {
    db.close();
  }
}

export function getOfflineRecord({ scope, namespace, recordId }) {
  const key = location(scope, namespace, required(recordId, "record_id"));
  return transaction([RECORDS], "readonly", (tx, done, guard) => {
    const request = tx.objectStore(RECORDS).get(key.id);
    request.onsuccess = guard(() => done(request.result || null));
  });
}

/** expectedRevision=0 creates a record; existing records require their current local revision. */
export function saveOfflineRecord({ scope, namespace, recordId, value, expectedRevision, initialServerVersion = 0 }) {
  const key = location(scope, namespace, required(recordId, "record_id"));
  revision(expectedRevision, "expected_revision");
  revision(initialServerVersion, "server_version");
  const snapshot = copyValue(value, recordId);
  const operationId = globalThis.crypto.randomUUID();
  return transaction([RECORDS, PENDING], "readwrite", (tx, done, guard) => {
    const records = tx.objectStore(RECORDS);
    const request = records.get(key.id);
    request.onsuccess = guard(() => {
      const previous = request.result;
      if ((previous?.localRevision || 0) !== expectedRevision) throw new OfflineRecordStoreError("local_revision_conflict");
      const localRevision = revision(expectedRevision + 1, "local_revision");
      const serverVersion = previous?.serverVersion ?? initialServerVersion;
      const syncState = previous?.syncState === "conflict" ? "conflict" : "pending";
      const record = {
        ...key, value: snapshot, localRevision, serverVersion, syncState,
        updatedAt: new Date().toISOString(),
        ...(previous?.conflictId ? { conflictId: previous.conflictId } : {}),
      };
      const pending = {
        ...key, value: snapshot, operationId, localRevision,
        baseServerVersion: serverVersion, status: syncState, queuedAt: record.updatedAt,
      };
      records.put(record);
      tx.objectStore(PENDING).put(pending);
      done(record);
    });
  });
}

/** Includes tombstones; callers decide how deleted records are presented. */
export function listOfflineRecords({ scope, namespace }) {
  return listScoped(RECORDS, location(scope, namespace));
}

export function listOfflineConflicts({ scope, namespace }) {
  return listScoped(CONFLICTS, location(scope, namespace));
}

function listScoped(store, key) {
  return transaction([store], "readonly", (tx, done, guard) => {
    const request = tx.objectStore(store).index("scopeNamespace").getAll([key.scopeKey, key.namespace]);
    request.onsuccess = guard(() => done(request.result));
  });
}

export function listPendingRecords({ scope, namespace, limit = 100 }) {
  const key = location(scope, namespace);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1000) throw new OfflineRecordStoreError("invalid_limit");
  return transaction([PENDING], "readonly", (tx, done, guard) => {
    const request = tx.objectStore(PENDING).index("scopeNamespaceStatus")
      .getAll([key.scopeKey, key.namespace, "pending"], limit);
    request.onsuccess = guard(() => done(request.result));
  });
}

/** A late acknowledgement cannot delete or mark as synced a newer edit. */
export function acknowledgeOfflineRecord({ scope, namespace, recordId, operationId, serverVersion }) {
  const key = location(scope, namespace, required(recordId, "record_id"));
  required(operationId, "operation_id");
  revision(serverVersion, "server_version");
  return transaction([RECORDS, PENDING], "readwrite", (tx, done, guard) => {
    const pending = tx.objectStore(PENDING);
    const request = pending.get(key.id);
    request.onsuccess = guard(() => {
      const operation = request.result;
      if (!operation || operation.operationId !== operationId || operation.status !== "pending") return done(false);
      if (serverVersion <= operation.baseServerVersion) throw new OfflineRecordStoreError("invalid_acknowledgement_version");
      const records = tx.objectStore(RECORDS);
      const recordRequest = records.get(key.id);
      recordRequest.onsuccess = guard(() => {
        const record = recordRequest.result;
        if (!record || record.localRevision !== operation.localRevision) return done(false);
        records.put({ ...record, serverVersion, syncState: "synced" });
        pending.delete(key.id);
        done(true);
      });
    });
  });
}

/** Store both versions and block automatic upload atomically; never replace the local document. */
export function recordOfflineConflict({ scope, namespace, recordId, operationId, serverValue, serverVersion }) {
  const key = location(scope, namespace, required(recordId, "record_id"));
  required(operationId, "operation_id");
  revision(serverVersion, "server_version");
  const remote = copyValue(serverValue, recordId, true);
  return transaction([RECORDS, PENDING, CONFLICTS], "readwrite", (tx, done, guard) => {
    const pending = tx.objectStore(PENDING);
    const request = pending.get(key.id);
    request.onsuccess = guard(() => {
      const operation = request.result;
      if (!operation || operation.operationId !== operationId || operation.status !== "pending") return done(false);
      const records = tx.objectStore(RECORDS);
      const recordRequest = records.get(key.id);
      recordRequest.onsuccess = guard(() => {
        const record = recordRequest.result;
        if (!record || record.localRevision !== operation.localRevision) return done(false);
        const conflictId = JSON.stringify([key.id, operationId]);
        tx.objectStore(CONFLICTS).add({
          ...key, id: conflictId, operationId, localRevision: record.localRevision,
          localValue: operation.value, serverValue: remote, serverVersion,
          baseServerVersion: operation.baseServerVersion, createdAt: new Date().toISOString(),
        });
        records.put({ ...record, syncState: "conflict", conflictId });
        pending.put({ ...operation, status: "conflict" });
        done(true);
      });
    });
  });
}
