import "fake-indexeddb/auto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./d1SyncClient.js", () => ({
  d1PutKv: vi.fn(),
  d1GetKv: vi.fn(),
}));

import { d1GetKv, d1PutKv } from "./d1SyncClient.js";
import {
  d1OutboxRecordId,
  d1OutboxEnqueue,
  d1OutboxHasPending,
  d1OutboxTryFlush,
} from "./d1SyncOutbox.js";

describe("d1SyncOutbox", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    await new Promise((resolve, reject) => {
      const d = indexedDB.deleteDatabase("mysafeops_d1_outbox");
      d.onsuccess = () => resolve(undefined);
      d.onerror = () => reject(d.error);
    });
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

  it("version_conflict resolves with server array and deletes outbox", async () => {
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
    expect(status).toBe("conflict_resolved");
    expect(setValue).toHaveBeenCalledWith([{ id: "server" }]);
    expect(save).toHaveBeenCalledWith("permits_v2", [{ id: "server" }]);
    expect(versionRef.current).toBe(9);
    expect(await d1OutboxHasPending("acme", "permits_v2", "main")).toBe(false);
  });
});
