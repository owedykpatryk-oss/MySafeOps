import "fake-indexeddb/auto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  acknowledgeOfflineRecord, getOfflineRecord, listOfflineConflicts, listOfflineRecords,
  listPendingRecords, recordOfflineConflict, saveOfflineRecord,
} from "./offlineRecordStore";

const scope = { userId: "user-a", orgSlug: "acme", countryKey: "primary" };
const key = { scope, namespace: "rams", recordId: "r1" };
const value = { id: "r1", title: "Offline RAMS", hazards: [{ id: "h1", risk: 3 }] };
const save = (options = {}) => saveOfflineRecord({ ...key, value, expectedRevision: 0, ...options });
const pending = () => listPendingRecords(key);

beforeEach(async () => {
  await new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase("mysafeops_record_sync");
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function abortWrite(storeName, method = "put") {
  const original = IDBObjectStore.prototype[method];
  return vi.spyOn(IDBObjectStore.prototype, method).mockImplementation(function (...args) {
    if (this.name === storeName) {
      this.transaction.abort();
      return undefined;
    }
    return original.apply(this, args);
  });
}

describe("offline record storage", () => {
  it("commits a detached document snapshot together with its owned upload operation", async () => {
    const input = structuredClone(value);
    const saving = save({ value: input });
    input.hazards[0].risk = 999;
    const record = await saving;
    expect(record).toMatchObject({ scope, localRevision: 1, serverVersion: 0, syncState: "pending", value });
    const [operation] = await pending();
    expect(operation).toMatchObject({ scope, localRevision: 1, baseServerVersion: 0, status: "pending", value });
    expect(operation.operationId).toEqual(expect.any(String));
    record.value.title = "Caller changed its copy";
    expect((await getOfflineRecord(key)).value).toEqual(value);
  });

  it.each(["new record", "existing record"])("rolls back both writes when the queue transaction aborts for an %s", async (kind) => {
    if (kind === "existing record") await save();
    const before = await getOfflineRecord(key);
    const queueBefore = await pending();
    const fault = abortWrite("pending");
    await expect(save({ value: { ...value, title: "Must not commit" }, expectedRevision: before?.localRevision || 0 }))
      .rejects.toThrow("storage_transaction_aborted");
    fault.mockRestore();
    expect(await getOfflineRecord(key)).toEqual(before);
    expect(await pending()).toEqual(queueBefore);
  });

  it("rejects concurrent stale edits instead of silently replacing another tab's work", async () => {
    await save();
    const results = await Promise.allSettled([
      save({ expectedRevision: 1, value: { ...value, title: "Tab A" } }),
      save({ expectedRevision: 1, value: { ...value, title: "Tab B" } }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.find((result) => result.status === "rejected").reason.code).toBe("local_revision_conflict");
    const record = await getOfflineRecord(key);
    expect(record.localRevision).toBe(2);
    expect((await pending())[0].value).toEqual(record.value);
  });

  it("reports quota failure without acknowledging or retaining half a save", async () => {
    const original = IDBObjectStore.prototype.put;
    const fault = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (...args) {
      if (this.name === "pending") throw new DOMException("Device storage full", "QuotaExceededError");
      return original.apply(this, args);
    });
    await expect(save()).rejects.toMatchObject({ name: "QuotaExceededError" });
    fault.mockRestore();
    expect(await getOfflineRecord(key)).toBeNull();
    expect(await pending()).toEqual([]);
  });

  it("reports unavailable storage instead of claiming a save succeeded", async () => {
    vi.stubGlobal("indexedDB", undefined);
    await expect(save()).rejects.toMatchObject({ code: "storage_unavailable" });
  });

  it.each([
    { ...scope, userId: "user-b" },
    { ...scope, orgSlug: "other" },
    { ...scope, countryKey: "pl" },
  ])("isolates the same record ID in scope %j", async (otherScope) => {
    await save();
    const [firstOperation] = await pending();
    const other = { ...key, scope: otherScope };
    expect(await getOfflineRecord(other)).toBeNull();
    expect(await listPendingRecords(other)).toEqual([]);
    expect(await listOfflineConflicts(other)).toEqual([]);
    await save({ scope: otherScope, value: { ...value, title: "Separate record" } });
    expect(await acknowledgeOfflineRecord({ ...other, operationId: firstOperation.operationId, serverVersion: 1 })).toBe(false);
    expect((await getOfflineRecord(key)).value.title).toBe("Offline RAMS");
    expect((await listOfflineRecords(other))[0].value.title).toBe("Separate record");
    expect(await pending()).toEqual([firstOperation]);
  });

  it.each([undefined, {}, { ...scope, userId: "" }, { ...scope, countryKey: "" }, { ...scope, orgSlug: "default" }])("requires an explicit complete owner scope: %j", (invalidScope) => {
    expect(() => save({ scope: invalidScope })).toThrow(/invalid_/);
  });

  it("rejects missing revisions and invalid payloads before creating an upload", async () => {
    expect(() => save({ recordId: undefined })).toThrow("invalid_record_id");
    expect(() => save({ expectedRevision: undefined })).toThrow("invalid_expected_revision");
    expect(() => save({ value: { ...value, id: "another" } })).toThrow("invalid_record_value");
    expect(() => save({ value: { ...value, risk: Infinity } })).toThrow("invalid_record_value");
    expect(await getOfflineRecord(key)).toBeNull();
    expect(await pending()).toEqual([]);
  });

  it("acknowledges only the exact upload and commits its server revision with queue removal", async () => {
    await save({ initialServerVersion: 3 });
    const [old] = await pending();
    await save({ expectedRevision: 1, value: { ...value, title: "Newer edit" } });
    expect(await acknowledgeOfflineRecord({ ...key, operationId: old.operationId, serverVersion: 4 })).toBe(false);
    const [latest] = await pending();
    expect(latest.value.title).toBe("Newer edit");
    expect((await getOfflineRecord(key)).syncState).toBe("pending");
    expect(await acknowledgeOfflineRecord({ ...key, operationId: latest.operationId, serverVersion: 5 })).toBe(true);
    expect(await pending()).toEqual([]);
    expect(await getOfflineRecord(key)).toMatchObject({ localRevision: 2, serverVersion: 5, syncState: "synced" });
    expect(await acknowledgeOfflineRecord({ ...key, operationId: latest.operationId, serverVersion: 5 })).toBe(false);
  });

  it("keeps document and queue unchanged when acknowledgement storage fails", async () => {
    await save();
    const [operation] = await pending();
    const before = await getOfflineRecord(key);
    const fault = abortWrite("pending", "delete");
    await expect(acknowledgeOfflineRecord({ ...key, operationId: operation.operationId, serverVersion: 1 }))
      .rejects.toThrow("storage_transaction_aborted");
    fault.mockRestore();
    expect(await getOfflineRecord(key)).toEqual(before);
    expect(await pending()).toEqual([operation]);
  });

  it("does not accept a server version that fails to advance the queued base", async () => {
    await save({ initialServerVersion: 3 });
    const [operation] = await pending();
    await expect(acknowledgeOfflineRecord({ ...key, operationId: operation.operationId, serverVersion: 3 }))
      .rejects.toThrow("invalid_acknowledgement_version");
    expect(await pending()).toEqual([operation]);
  });

  it("archives both conflicting snapshots and pauses upload without overwriting the editor", async () => {
    await save();
    const [operation] = await pending();
    const conflict = { ...key, operationId: operation.operationId, serverVersion: 9, serverValue: { ...value, title: "Cloud edit" } };
    expect(await recordOfflineConflict(conflict)).toBe(true);
    expect(await pending()).toEqual([]);
    expect(await getOfflineRecord(key)).toMatchObject({ value, syncState: "conflict", localRevision: 1 });
    expect(await listOfflineConflicts(key)).toEqual([expect.objectContaining({ localValue: value, serverValue: conflict.serverValue })]);
    expect(await recordOfflineConflict({ ...conflict, serverValue: { ...value, title: "Late duplicate" } })).toBe(false);
    await save({ expectedRevision: 1, value: { ...value, title: "Still editing" } });
    expect(await pending()).toEqual([]);
    expect((await getOfflineRecord(key)).value.title).toBe("Still editing");
    expect((await listOfflineConflicts(key))[0].localValue).toEqual(value);
  });

  it("keeps an upload pending when saving conflict evidence fails", async () => {
    await save();
    const [operation] = await pending();
    const before = await getOfflineRecord(key);
    const fault = abortWrite("conflicts", "add");
    await expect(recordOfflineConflict({ ...key, operationId: operation.operationId, serverVersion: 2, serverValue: null }))
      .rejects.toThrow();
    fault.mockRestore();
    expect(await getOfflineRecord(key)).toEqual(before);
    expect(await pending()).toEqual([operation]);
    expect(await listOfflineConflicts(key)).toEqual([]);
  });

  it("does not block a newer edit on an old request's conflict", async () => {
    await save();
    const [old] = await pending();
    await save({ expectedRevision: 1, value: { ...value, title: "Newer edit" } });
    expect(await recordOfflineConflict({ ...key, operationId: old.operationId, serverVersion: 3, serverValue: null })).toBe(false);
    expect((await pending())[0].value.title).toBe("Newer edit");
    expect(await listOfflineConflicts(key)).toEqual([]);
  });

  it("queues deletion as a tombstone, retaining evidence until the server acknowledges it", async () => {
    await save();
    await save({ expectedRevision: 1, value: { ...value, deletedAt: "2026-10-07T18:00:00Z" } });
    expect((await pending())[0].value.deletedAt).toBe("2026-10-07T18:00:00Z");
    expect(await listOfflineRecords(key)).toHaveLength(1);
  });
});
