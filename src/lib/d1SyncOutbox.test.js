import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./d1SyncClient.js", () => ({
  d1PutKv: vi.fn(),
  d1GetKv: vi.fn(),
  isD1TransientError: (e) =>
    e === "rate_limited" || e === "http_429" || /^http_(502|503|504)$/.test(String(e || "")) || e === "fetch_failed",
}));

import { d1GetKv, d1PutKv } from "./d1SyncClient.js";
import {
  d1OutboxRecordId,
  d1OutboxEnqueue,
  d1OutboxHasPending,
  d1OutboxTryFlush,
  d1OutboxPeek,
  d1OutboxDelete,
  d1OutboxRecoveryForWorkspace,
  d1OutboxHasRecovery,
  d1OutboxArchiveConflict,
} from "./d1SyncOutbox.js";

async function clearDatabases() {
  await Promise.all(["mysafeops_d1_outbox", "mysafeops_d1_recovery"].map((name) => new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(name);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  })));
}

describe("d1SyncOutbox", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await clearDatabases();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("d1OutboxRecordId is stable and distinct per key", () => {
    const a = d1OutboxRecordId("org", "ns", "main");
    const b = d1OutboxRecordId("org", "ns", "other");
    expect(a).not.toBe(b);
    expect(d1OutboxRecordId("org", "ns", "main")).toBe(a);
  });

  it("enqueue then tryFlush clears outbox and updates versionRef", async () => {
    vi.mocked(d1PutKv).mockResolvedValueOnce({ ok: true, version: 7 });
    await d1OutboxEnqueue({
      orgSlug: "acme",
      namespace: "permits_v2",
      d1DataKey: "main",
      value: [{ id: "p1" }],
      clientVersion: 0,
    });
    expect(await d1OutboxHasPending("acme", "permits_v2", "main")).toBe(true);
    const versionRef = { current: 0 };
    const setValue = vi.fn();
    const save = vi.fn();
    const status = await d1OutboxTryFlush({
      supabase: {},
      orgSlug: "acme",
      namespace: "permits_v2",
      d1DataKey: "main",
      storageKey: "permits_v2",
      setValue,
      save,
      versionRef,
    });
    expect(status).toBe("flushed");
    expect(versionRef.current).toBe(7);
    expect(await d1OutboxHasPending("acme", "permits_v2", "main")).toBe(false);
    expect(d1PutKv).toHaveBeenCalledTimes(1);
  });

  it("archives both conflicting versions without replacing the editor", async () => {
    await d1OutboxEnqueue({
      orgSlug: "acme",
      namespace: "permits_v2",
      d1DataKey: "main",
      value: [{ id: "local" }],
      clientVersion: 3,
    });
    vi.mocked(d1PutKv).mockResolvedValueOnce({ ok: false, error: "version_conflict" });
    vi.mocked(d1GetKv).mockResolvedValueOnce({
      ok: true,
      value: [{ id: "server" }],
      version: 9,
    });
    const versionRef = { current: 3 };
    const setValue = vi.fn();
    const save = vi.fn();
    const status = await d1OutboxTryFlush({
      supabase: {},
      orgSlug: "acme",
      namespace: "permits_v2",
      d1DataKey: "main",
      storageKey: "permits_v2",
      setValue,
      save,
      versionRef,
    });
    expect(status).toBe("conflict_saved");
    expect(setValue).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
    expect(versionRef.current).toBe(3);
    expect(await d1OutboxHasPending("acme", "permits_v2", "main")).toBe(false);
    expect(await d1OutboxRecoveryForWorkspace("acme")).toEqual([
      expect.objectContaining({ value: [{ id: "local" }], serverValue: [{ id: "server" }], serverVersion: 9 }),
    ]);
  });
});

const row = (value, d1DataKey = "main", orgSlug = "acme") => ({ orgSlug, namespace: "permits_v2", d1DataKey, value, clientVersion: 3 });
const ctx = () => ({ supabase: {}, orgSlug: "acme", namespace: "permits_v2", d1DataKey: "main", versionRef: { current: 3 }, setValue: vi.fn(), save: vi.fn() });

describe("outbox acknowledgement and recovery", () => {
  beforeEach(async () => {
    vi.resetAllMocks();
    await clearDatabases();
  });
  afterEach(() => vi.restoreAllMocks());

  it("does not delete a new edit when an older upload completes", async () => {
    await d1OutboxEnqueue(row([{ id: "first" }]));
    vi.mocked(d1PutKv).mockImplementationOnce(async () => {
      await d1OutboxEnqueue(row([{ id: "newer" }]));
      return { ok: true, version: 4 };
    });
    expect(await d1OutboxTryFlush(ctx())).toBe("pending");
    expect((await d1OutboxPeek("acme", "permits_v2", "main")).value).toEqual([{ id: "newer" }]);
  });

  it("requires the exact receipt even when both operations have identical data and time", async () => {
    const first = await d1OutboxEnqueue(row([{ id: "same" }]));
    const second = await d1OutboxEnqueue(row([{ id: "same" }]));
    expect(await d1OutboxDelete("acme", "permits_v2", "main")).toBe(false);
    expect(await d1OutboxDelete("acme", "permits_v2", "main", first)).toBe(false);
    expect(await d1OutboxDelete("acme", "permits_v2", "main", second)).toBe(true);
  });

  it("archives the conflicting operation while retaining a newer queued edit", async () => {
    await d1OutboxEnqueue(row([{ id: "first" }]));
    vi.mocked(d1PutKv).mockResolvedValueOnce({ ok: false, error: "version_conflict" });
    vi.mocked(d1GetKv).mockImplementationOnce(async () => {
      await d1OutboxEnqueue(row([{ id: "newer" }]));
      return { ok: true, value: [{ id: "remote" }], version: 4 };
    });
    expect(await d1OutboxTryFlush(ctx())).toBe("conflict_saved");
    expect((await d1OutboxPeek("acme", "permits_v2", "main")).value).toEqual([{ id: "newer" }]);
    expect((await d1OutboxRecoveryForWorkspace("acme"))[0].value).toEqual([{ id: "first" }]);
  });

  it.each(["forbidden", "billing_write_blocked", "billing_limit_reached"])("retains the pending edit after %s", async (error) => {
    await d1OutboxEnqueue(row([{ id: "local" }]));
    vi.mocked(d1PutKv).mockResolvedValueOnce({ ok: false, error });
    expect(await d1OutboxTryFlush(ctx())).toBe("forbidden");
    expect(await d1OutboxHasPending("acme", "permits_v2", "main")).toBe(true);
  });

  it("keeps pending data if saving the recovery transaction fails", async () => {
    await d1OutboxEnqueue(row([{ id: "local" }]));
    vi.mocked(d1PutKv).mockResolvedValueOnce({ ok: false, error: "version_conflict" });
    vi.mocked(d1GetKv).mockResolvedValueOnce({ ok: true, value: [], version: 4 });
    const originalPut = IDBObjectStore.prototype.put;
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(function (...args) {
      if (this.name === "recovery") { this.transaction.abort(); throw new Error("quota"); }
      return originalPut.apply(this, args);
    });
    const context = ctx();
    expect(await d1OutboxTryFlush(context)).toBe("pending");
    spy.mockRestore();
    expect(await d1OutboxHasPending("acme", "permits_v2", "main")).toBe(true);
    expect(context.setValue).not.toHaveBeenCalled();
    expect(await d1OutboxRecoveryForWorkspace("acme")).toEqual([]);
  });

  it("scopes recovery exports by organisation and country", async () => {
    for (const pending of [row([1]), row([2], "country:uk:main"), row([3], "country:pl:main"), row([4], "main", "other")]) {
      await d1OutboxArchiveConflict(pending, { value: [], version: 4 });
    }
    expect((await d1OutboxRecoveryForWorkspace("acme")).map((r) => r.value)).toEqual([[1]]);
    expect((await d1OutboxRecoveryForWorkspace("acme", "pl")).map((r) => r.value)).toEqual([[3]]);
    expect(await d1OutboxHasRecovery("acme", "permits_v2", "main")).toBe(true);
    expect(await d1OutboxHasRecovery("acme", "permits_v2", "country:pl:main")).toBe(true);
    expect(await d1OutboxHasRecovery("acme", "other_namespace", "main")).toBe(false);
    expect(await d1OutboxHasRecovery("acme", "permits_v2", "country:de:main")).toBe(false);
  });

  it("does not update a different workspace after a late upload response", async () => {
    await d1OutboxEnqueue(row([{ id: "local" }]));
    let current = true;
    const context = { ...ctx(), isCurrent: () => current };
    vi.mocked(d1PutKv).mockImplementationOnce(async () => { current = false; return { ok: true, version: 20 }; });
    await d1OutboxTryFlush(context);
    expect(context.versionRef.current).toBe(3);
    expect(context.setValue).not.toHaveBeenCalled();
  });

  it("uses version zero as create-only rather than an unchecked overwrite", async () => {
    await d1OutboxEnqueue({ ...row([]), clientVersion: 0 });
    vi.mocked(d1PutKv).mockResolvedValueOnce({ ok: true, version: 1 });
    await d1OutboxTryFlush(ctx());
    expect(d1PutKv).toHaveBeenCalledWith({}, "acme", "permits_v2", "main", [], 0);
  });

  it.each(["upload", "conflict fetch"])("retains the pending edit when workspace changes during %s", async (stage) => {
    const pending = await d1OutboxEnqueue(row([{ id: "local" }]));
    let current = true;
    vi.mocked(d1PutKv).mockImplementationOnce(async () => {
      if (stage === "upload") current = false;
      return { ok: false, error: "version_conflict" };
    });
    vi.mocked(d1GetKv).mockImplementationOnce(async () => {
      current = false;
      return { ok: true, version: 9, value: [{ id: "cloud" }] };
    });
    expect(await d1OutboxTryFlush({ ...ctx(), isCurrent: () => current })).toBe("pending");
    expect(d1GetKv).toHaveBeenCalledTimes(stage === "upload" ? 0 : 1);
    expect(await d1OutboxPeek("acme", "permits_v2", "main")).toEqual(pending);
    expect(await d1OutboxRecoveryForWorkspace("acme")).toEqual([]);
    vi.mocked(d1GetKv).mockReset();
  });

  it("reads and acknowledges a legacy v1 queue without upgrading its database", async () => {
    const legacy = { ...row([{ id: "legacy" }]), id: d1OutboxRecordId("acme", "permits_v2", "main"), enqueuedAt: 123 };
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("mysafeops_d1_outbox", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("pending", { keyPath: "id" });
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("pending", "readwrite");
        tx.objectStore("pending").put(legacy);
        tx.oncomplete = () => { db.close(); resolve(); };
        tx.onerror = () => { db.close(); reject(tx.error); };
      };
    });
    vi.mocked(d1PutKv).mockResolvedValueOnce({ ok: false, error: "version_conflict" });
    vi.mocked(d1GetKv).mockResolvedValueOnce({ ok: true, value: [], version: 4 });
    expect(await d1OutboxTryFlush(ctx())).toBe("conflict_saved");
    expect((await d1OutboxRecoveryForWorkspace("acme"))[0].value).toEqual([{ id: "legacy" }]);
    await new Promise((resolve, reject) => {
      const req = indexedDB.open("mysafeops_d1_outbox", 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => { expect(req.result.version).toBe(1); req.result.close(); resolve(); };
    });
  });

  it("retains the queue when an acknowledgement transaction aborts", async () => {
    const expected = await d1OutboxEnqueue(row([{ id: "local" }]));
    const originalDelete = IDBObjectStore.prototype.delete;
    vi.spyOn(IDBObjectStore.prototype, "delete").mockImplementation(function (...args) {
      const result = originalDelete.apply(this, args);
      this.transaction.abort();
      return result;
    });
    expect(await d1OutboxDelete("acme", "permits_v2", "main", expected)).toBe(false);
    expect(await d1OutboxHasPending("acme", "permits_v2", "main")).toBe(true);
  });
});
