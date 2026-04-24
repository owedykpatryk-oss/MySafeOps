/**
 * IndexedDB outbox for D1 KV PUT failures (offline or transient errors after client retries).
 * One row per org + namespace + data_key; latest payload wins.
 */

import { d1GetKv, d1PutKv } from "./d1SyncClient.js";

const DB_NAME = "mysafeops_d1_outbox";
const DB_VERSION = 1;
const STORE = "pending";

/** @param {string} orgSlug @param {string} namespace @param {string} d1DataKey */
export function d1OutboxRecordId(orgSlug, namespace, d1DataKey) {
  return `${String(orgSlug || "")}\u0001${String(namespace || "")}\u0001${String(d1DataKey || "main")}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("indexedDB_unavailable"));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
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
    orgSlug: row.orgSlug,
    namespace: row.namespace,
    d1DataKey: row.d1DataKey,
    value: row.value,
    clientVersion: Number.isFinite(row.clientVersion) ? row.clientVersion : 0,
    enqueuedAt: Date.now(),
  };
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(record);
    tx.oncomplete = () => resolve(undefined);
    tx.onerror = () => reject(tx.error || new Error("idb_put_failed"));
    tx.onabort = () => reject(tx.error || new Error("idb_put_aborted"));
  });
  db.close();
}

/**
 * @param {string} orgSlug
 * @param {string} namespace
 * @param {string} d1DataKey
 * @returns {Promise<{ value: unknown; clientVersion: number } | null>}
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
    return { value: row.value, clientVersion: row.clientVersion || 0 };
  } catch {
    return null;
  }
}

/**
 * @param {string} orgSlug
 * @param {string} namespace
 * @param {string} d1DataKey
 */
export async function d1OutboxDelete(orgSlug, namespace, d1DataKey) {
  try {
    const db = await openDb();
    const id = d1OutboxRecordId(orgSlug, namespace, d1DataKey);
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => resolve(undefined);
      tx.onerror = () => reject(tx.error || new Error("idb_delete_failed"));
    });
    db.close();
  } catch {
    /* ignore */
  }
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

const transientHttp = (e) => /^http_(502|503|504|429)$/.test(String(e || ""));

/**
 * Replay one pending PUT (after transient retry). On version conflict, refetch server
 * array into React state, delete outbox (server wins). Matches useD1OrgArraySync conflict UX.
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
 * @returns {Promise<"empty" | "flushed" | "conflict_resolved" | "pending">}
 */
export async function d1OutboxTryFlush(ctx) {
  const pending = await d1OutboxPeek(ctx.orgSlug, ctx.namespace, ctx.d1DataKey);
  if (!pending) return "empty";

  const useVersion = pending.clientVersion > 0 ? pending.clientVersion : undefined;
  let put;
  try {
    put = await d1PutKv(ctx.supabase, ctx.orgSlug, ctx.namespace, ctx.d1DataKey, pending.value, useVersion);
  } catch {
    put = { ok: false, error: "fetch_failed" };
  }
  if (!put.ok && transientHttp(put.error)) {
    await new Promise((r) => setTimeout(r, 900));
    try {
      put = await d1PutKv(ctx.supabase, ctx.orgSlug, ctx.namespace, ctx.d1DataKey, pending.value, useVersion);
    } catch {
      put = { ok: false, error: "fetch_failed" };
    }
  }
  if (put.ok) {
    await d1OutboxDelete(ctx.orgSlug, ctx.namespace, ctx.d1DataKey);
    ctx.versionRef.current = put.version || 0;
    return "flushed";
  }
  if (put.error === "version_conflict") {
    let r;
    try {
      r = await d1GetKv(ctx.supabase, ctx.orgSlug, ctx.namespace, ctx.d1DataKey);
    } catch {
      r = { ok: false };
    }
    if (r.ok && Array.isArray(r.value)) {
      ctx.versionRef.current = r.version || 0;
      ctx.setValue(r.value);
      ctx.save(ctx.storageKey, r.value);
      await d1OutboxDelete(ctx.orgSlug, ctx.namespace, ctx.d1DataKey);
      return "conflict_resolved";
    }
  }
  return "pending";
}
