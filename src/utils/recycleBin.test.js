/** @vitest-environment jsdom */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { pushRecycleBinItem, softDeleteToRecycleBin, listRecycleBinEntries } from "./recycleBin";

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
