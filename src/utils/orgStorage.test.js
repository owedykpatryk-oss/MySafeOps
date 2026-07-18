/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { asStorageArray, loadOrgScoped, saveOrgScoped, STORAGE_QUOTA_EVENT } from "./orgStorage";

describe("orgStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
  });

  it("asStorageArray returns fallback for non-array values", () => {
    expect(asStorageArray(null)).toEqual([]);
    expect(asStorageArray({ id: 1 })).toEqual([]);
    expect(asStorageArray([{ id: 1 }])).toEqual([{ id: 1 }]);
  });

  it("loadOrgScoped coerces corrupted list registers to []", () => {
    localStorage.setItem("geo_photos_test-org", JSON.stringify({ broken: true }));
    expect(loadOrgScoped("geo_photos", [])).toEqual([]);
  });

  it("loadOrgScoped keeps object fallbacks unchanged", () => {
    localStorage.setItem("permit_prefs_test-org", JSON.stringify([1, 2]));
    expect(loadOrgScoped("permit_prefs", {})).toEqual([1, 2]);
  });

  it("saveOrgScoped returns false and emits on QuotaExceededError", () => {
    const events = [];
    const onQuota = (e) => events.push(e.detail);
    window.addEventListener(STORAGE_QUOTA_EVENT, onQuota);
    const err = new Error("quota");
    err.name = "QuotaExceededError";
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw err;
    });
    expect(saveOrgScoped("geo_photos", [{ id: 1 }], { bypassBillingGuard: true })).toBe(false);
    expect(events[0]?.baseKey).toBe("geo_photos");
    window.removeEventListener(STORAGE_QUOTA_EVENT, onQuota);
    vi.restoreAllMocks();
  });
});
