/**
 * IndexedDB outbox for D1 KV PUT failures (offline or transient errors after client retries).
 * One row per org + namespace + data_key; latest payload wins.
 */

import { d1GetKv, d1PutKv, isD1TransientError } from "./d1SyncClient.js";
import { isForbiddenD1Write, notifyD1WriteForbidden } from "./d1WriteForbidden.js";

const DB_NAME = "mysafeops_d1_outbox";
const DB_VERSION = 1;
const STORE = "pending";
// Separate DB keeps the v1 pending queue usable by already-open web clients.
const RECOVERY_DB = "mysafeops_d1_recovery";
const RECOVERY_STORE = "recovery";
export const D1_OUTBOX_CHANGED_EVENT = "mysafeops:d1-outbox-changed";

function notifyChanged() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(D1_OUTBOX_CHANGED_EVENT));
}

let sequence = 0;
function operationId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${++sequence}-${Math.random().toString(36).slice(2)}`;
}

function sameOperation(row, expected) {
  if (!row || !expected) return false;
  if (row.operationId || expected.operationId) return row.operationId === expected.operationId;
  // Rows written by pre-upgrade clients have no operation ID.
  return row.enqueuedAt === expected.enqueuedAt && row.clientVersion === expected.clientVersion
    && JSON.stringify(row.value) === JSON.stringify(expected.value);
}

/** @param {string} orgSlug @param {string} namespace @param {string} d1DataKey */
export function d1OutboxRecordId(orgSlug, namespace, d1DataKey) {
  return `${String(orgSlug || "")}\u0001${String(namespace || "")}\u0001${String(d1DataKey || "main")}`;
}

function openDb(name = DB_NAME, storeName = STORE) {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB_unavailable"));
      return;
    }
    const req = indexedDB.open(name, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(storeName)) {
        db.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    req.onsuccess = () => {
      req.result.onversionchange = () => req.result.close();
      resolve(req.result);
    };
    req.onerror = () => reject(req.error || new Error("idb_open_failed"));
  });
}

/**
 * @param {{ orgSlug: string; namespace: string; d1DataKey: string; value: unknown; clientVersion?: number }} row
 */
export async function d1OutboxEnqueue(row) {
  const db = await openDb();
  const id = d1OutboxRecordId(row.orgSlug, row.namespace, row.d1DataKey);
  const record = {
    id,
    operationId: operationId(),
    orgSlug: row.orgSlug,
    namespace: row.namespace,
    d1DataKey: row.d1DataKey,
    value: row.value,
    clientVersion: Number.isFinite(row.clientVersion) ? row.clientVersion : 0,
    enqueuedAt: Date.now(),
  };
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(record);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error || new Error("idb_put_failed"));
      tx.onabort = () => reject(tx.error || new Error("idb_put_aborted"));
    });
  } finally {
    db.close();
  }
  notifyChanged();
  return record;
}

/**
 * @param {string} orgSlug
 * @param {string} namespace
 * @param {string} d1DataKey
 * @returns {Promise<object | null>} Snapshot for compare-and-delete acknowledgement.
 */
export async function d1OutboxPeek(orgSlug, namespace, d1DataKey) {
  try {
    const db = await openDb();
    const id = d1OutboxRecordId(orgSlug, namespace, d1DataKey);
    const row = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error || new Error("idb_get_failed"));
    });
    db.close();
    if (!row) return null;
    return row;
  } catch {
    return null;
  }
}

/**
 * @param {string} orgSlug
 * @param {string} namespace
 * @param {string} d1DataKey
 */
export async function d1OutboxDelete(orgSlug, namespace, d1DataKey, expected) {
  if (!expected) return false;
  let db;
  try {
    db = await openDb();
    const id = d1OutboxRecordId(orgSlug, namespace, d1DataKey);
    let deleted = false;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      const store = tx.objectStore(STORE);
      const req = store.get(id);
      req.onsuccess = () => {
        if (sameOperation(req.result, expected)) {
          store.delete(id);
          deleted = true;
        }
      };
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error || new Error("idb_delete_failed"));
      tx.onabort = () => reject(tx.error || new Error("idb_delete_aborted"));
    });
    if (deleted) notifyChanged();
    return deleted;
  } catch {
    return false;
  } finally {
    db?.close();
  }
}

/** Archive both versions before any conflict merge; never trim recovery data automatically. */
export async function d1OutboxArchiveConflict(pending, remote, { removePending = false } = {}) {
  const db = await openDb(RECOVERY_DB, RECOVERY_STORE);
  const record = {
    ...pending,
    id: pending.operationId || operationId(),
    reason: "version_conflict",
    recoveredAt: new Date().toISOString(),
    serverValue: remote.value,
    serverVersion: remote.version,
  };
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(RECOVERY_STORE, "readwrite");
      tx.objectStore(RECOVERY_STORE).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error || new Error("idb_recovery_failed"));
      tx.onabort = () => reject(tx.error || new Error("idb_recovery_aborted"));
    });
  } finally {
    db.close();
  }
  // Only after the recovery transaction commits may this exact queue row be acknowledged.
  if (removePending) await d1OutboxDelete(pending.orgSlug, pending.namespace, pending.d1DataKey, pending);
  notifyChanged();
}

export async function d1OutboxRecoveryForWorkspace(orgSlug, countryId = null) {
  const db = await openDb(RECOVERY_DB, RECOVERY_STORE);
  try {
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(RECOVERY_STORE, "readonly");
      const req = tx.objectStore(RECOVERY_STORE).getAll();
      tx.oncomplete = () => resolve(req.result || []);
      tx.onerror = () => reject(tx.error || new Error("idb_recovery_read_failed"));
      tx.onabort = () => reject(tx.error || new Error("idb_recovery_read_aborted"));
    });
    return rows.filter((row) => row.orgSlug === orgSlug && (countryId
      ? row.d1DataKey.startsWith(`country:${countryId}:`)
      : !row.d1DataKey.startsWith("country:")));
  } finally {
    db.close();
  }
}

/** A conflict remains unresolved for this exact D1 list, including after reload. */
export async function d1OutboxHasRecovery(orgSlug, namespace, d1DataKey) {
  const countryId = d1DataKey.startsWith("country:") ? d1DataKey.split(":")[1] : null;
  const rows = await d1OutboxRecoveryForWorkspace(orgSlug, countryId);
  return rows.some((row) => row.namespace === namespace && row.d1DataKey === d1DataKey);
}

/**
 * Whether a pending row exists for this KV key.
 * @param {string} orgSlug
 * @param {string} namespace
 * @param {string} d1DataKey
 */
export async function d1OutboxHasPending(orgSlug, namespace, d1DataKey) {
  const row = await d1OutboxPeek(orgSlug, namespace, d1DataKey);
  return row != null;
}

/** Count all pending D1 PUT rows for an org (any namespace). */
export async function d1OutboxCountForOrg(orgSlug) {
  if (!orgSlug || orgSlug === "default") return 0;
  try {
    const db = await openDb();
    const rows = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readonly");
      const req = tx.objectStore(STORE).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error || new Error("idb_get_all_failed"));
    });
    db.close();
    return rows.filter((r) => r.orgSlug === orgSlug).length;
  } catch {
    return 0;
  }
}

const transientHttp = (e) => isD1TransientError(e);

/**
 * Replay one pending PUT. On conflict, durably archive its snapshot into recovery
 * with the server version. Never overwrite current editor state or a newer queued operation.
 *
 * @param {object} ctx
 * @param {import("@supabase/supabase-js").SupabaseClient} ctx.supabase
 * @param {string} ctx.orgSlug
 * @param {string} ctx.namespace
 * @param {string} ctx.d1DataKey
 * @param {string} ctx.storageKey
 * @param {function} ctx.setValue
 * @param {function(string, unknown): void} ctx.save
 * @param {{ current: number }} ctx.versionRef
 * @returns {Promise<"empty" | "flushed" | "conflict_saved" | "forbidden" | "pending">}
 */
export async function d1OutboxTryFlush(ctx) {
  const pending = await d1OutboxPeek(ctx.orgSlug, ctx.namespace, ctx.d1DataKey);
  if (!pending) return "empty";
  if (ctx.isCurrent && !ctx.isCurrent()) return "pending";

  // Version zero means "create only", never an unchecked overwrite of cloud data.
  const useVersion = pending.clientVersion > 0 ? pending.clientVersion : 0;
  let put;
  try {
    put = await d1PutKv(ctx.supabase, ctx.orgSlug, ctx.namespace, ctx.d1DataKey, pending.value, useVersion);
  } catch {
    put = { ok: false, error: "fetch_failed" };
  }
  if (!put.ok && transientHttp(put.error)) {
    await new Promise((r) => setTimeout(r, 900));
    if (ctx.isCurrent && !ctx.isCurrent()) return "pending";
    try {
      put = await d1PutKv(ctx.supabase, ctx.orgSlug, ctx.namespace, ctx.d1DataKey, pending.value, useVersion);
    } catch {
      put = { ok: false, error: "fetch_failed" };
    }
  }
  if (put.ok) {
    const deleted = await d1OutboxDelete(ctx.orgSlug, ctx.namespace, ctx.d1DataKey, pending);
    if (!ctx.isCurrent || ctx.isCurrent()) ctx.versionRef.current = put.version || 0;
    return deleted ? "flushed" : "pending";
  }
  // A completed upload can be acknowledged above, but a new request must not
  // start for a workspace that was left while that upload was in flight.
  if (ctx.isCurrent && !ctx.isCurrent()) return "pending";
  if (isForbiddenD1Write(put.error)) {
    // Permissions/billing may be restored later. The unsent snapshot must survive.
    if (!ctx.isCurrent || ctx.isCurrent()) notifyD1WriteForbidden(ctx.namespace, put.error);
    return "forbidden";
  }
  if (put.error === "version_conflict") {
    let r;
    try {
      r = await d1GetKv(ctx.supabase, ctx.orgSlug, ctx.namespace, ctx.d1DataKey);
    } catch {
      r = { ok: false };
    }
    if (ctx.isCurrent && !ctx.isCurrent()) return "pending";
    if (r.ok && Array.isArray(r.value)) {
      try {
        await d1OutboxArchiveConflict(pending, r, { removePending: true });
        return "conflict_saved";
      } catch {
        // Quota/transaction failure keeps the pending row and editor untouched.
        return "pending";
      }
    }
  }
  return "pending";
}
