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
    vi.unstubAllGlobals();
  });

  it("queues item when user confirms", () => {
    const payload = { id: "ppe_1", item: "Hard hat" };
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
});
