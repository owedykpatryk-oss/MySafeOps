/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { pushRecycleBinItem, softDeleteToRecycleBin, listRecycleBinEntries, restoreRecycleBinEntry } from "./recycleBin";
import { loadOrgScoped, saveOrgScoped } from "./orgStorage";
import { replaceWithTombstone } from "./d1ArrayMerge";

describe("softDeleteToRecycleBin", () => {
  beforeEach(() => {
    vi.stubGlobal("confirm", vi.fn(() => true));
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("queues item when user confirms", () => {
    const payload = { id: "ppe_1", item: "Hard hat" };
    saveOrgScoped("ppe_register", [payload]);
    const ok = softDeleteToRecycleBin({
      moduleId: "ppe",
      moduleLabel: "PPE",
      sourceKey: "ppe_register",
      itemLabel: "Hard hat",
      payload,
    });
    expect(ok).toBe(true);
    expect(listRecycleBinEntries()).toHaveLength(1);
    expect(listRecycleBinEntries()[0].payload).toEqual(payload);
  });

  it("returns false when user cancels", () => {
    vi.stubGlobal("confirm", vi.fn(() => false));
    const ok = softDeleteToRecycleBin({
      moduleId: "ppe",
      moduleLabel: "PPE",
      sourceKey: "ppe_register",
      payload: { id: "x" },
    });
    expect(ok).toBe(false);
    expect(listRecycleBinEntries()).toHaveLength(0);
  });

  it("keeps the live record when the Recycle Bin cannot be saved", () => {
    saveOrgScoped("ppe_register", [{ id: "ppe_1" }]);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (String(key).startsWith("mysafeops_recycle_bin_v1_")) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    expect(softDeleteToRecycleBin({ sourceKey: "ppe_register", payload: { id: "ppe_1" } })).toBe(false);
    expect(listRecycleBinEntries()).toHaveLength(0);
  });
});

describe("pushRecycleBinItem", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("rejects invalid payload", () => {
    expect(pushRecycleBinItem({ sourceKey: "x", payload: null })).toBeNull();
  });
});

describe("restoreRecycleBinEntry", () => {
  afterEach(() => vi.restoreAllMocks());
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("removes tombstone and re-inserts live payload without deletedAt", () => {
    const live = { id: "ppe_1", item: "Hard hat", updatedAt: "2026-01-01T00:00:00.000Z" };
    saveOrgScoped("ppe_register", replaceWithTombstone([live], live.id, "2026-07-01T00:00:00.000Z"));
    const entry = pushRecycleBinItem({
      moduleId: "ppe",
      moduleLabel: "PPE",
      sourceKey: "ppe_register",
      itemLabel: "Hard hat",
      payload: live,
    });
    const res = restoreRecycleBinEntry(entry.id);
    expect(res.ok).toBe(true);
    const next = loadOrgScoped("ppe_register", []);
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("ppe_1");
    expect(next[0].item).toBe("Hard hat");
    expect(next[0].deletedAt).toBeUndefined();
    expect(listRecycleBinEntries()).toHaveLength(0);
  });

  it("keeps the recovery entry if restoring the source record fails", () => {
    const live = { id: "ppe_1", item: "Hard hat" };
    saveOrgScoped("ppe_register", replaceWithTombstone([live], live.id));
    const entry = pushRecycleBinItem({ sourceKey: "ppe_register", payload: live });
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (String(key).startsWith("ppe_register_")) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    expect(restoreRecycleBinEntry(entry.id)).toMatchObject({ ok: false });
    expect(listRecycleBinEntries()).toHaveLength(1);
    expect(loadOrgScoped("ppe_register", [])[0].deletedAt).toBeTruthy();
  });

  it("does not overwrite a newer live record while restoring an older entry", () => {
    const entry = pushRecycleBinItem({ sourceKey: "ppe_register", payload: { id: "ppe_1", item: "Old helmet" } });
    saveOrgScoped("ppe_register", [{ id: "ppe_1", item: "New helmet" }]);
    expect(restoreRecycleBinEntry(entry.id)).toMatchObject({ ok: false });
    expect(loadOrgScoped("ppe_register", [])[0].item).toBe("New helmet");
    expect(listRecycleBinEntries()).toHaveLength(1);
  });
});
