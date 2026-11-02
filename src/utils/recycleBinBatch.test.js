/** @vitest-environment jsdom */
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { archiveRecordsToRecycleBin, listRecycleBinEntries, restoreRecycleBinEntry, softDeleteToRecycleBin } from "./recycleBin";
import { countryOperationalStorageKey, loadOrgScoped, saveOrgScoped } from "./orgStorage";
const rows = [{ id: "a", title: "First" }, { id: "b", title: "Second" }];
beforeEach(() => { localStorage.clear(); saveOrgScoped("permits_v2", rows); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const remove = (expectedScope) => archiveRecordsToRecycleBin({ sourceKey: "permits_v2", ids: ["a", "b"], moduleId: "permits", expectedScope });
it("archives all records with one bin write, persists tombstones, and supports restoration", () => {
  const writes = vi.spyOn(Storage.prototype, "setItem");
  expect(remove().every(row => row.deletedAt)).toBe(true);
  expect(writes.mock.calls.filter(([key]) => key.startsWith("mysafeops_recycle_bin_v1_"))).toHaveLength(1);
  const copies = listRecycleBinEntries();
  expect(copies).toHaveLength(2);
  for (const copy of copies) expect(restoreRecycleBinEntry(copy.id).ok).toBe(true);
  expect(loadOrgScoped("permits_v2", []).map(row => row.id).sort()).toEqual(["a", "b"]);
  expect(loadOrgScoped("permits_v2", []).some(row => row.deletedAt)).toBe(false);
});
it("does not delete any records if the batch archive fails", () => {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key.startsWith("mysafeops_recycle_bin_v1_")) throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, key, value);
  });
  expect(remove()).toBeNull();
  expect(loadOrgScoped("permits_v2", [])).toEqual(rows);
  expect(listRecycleBinEntries()).toHaveLength(0);
});
it("restores the original bin when the source write fails without losing live records", () => {
  const original = Storage.prototype.setItem;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key.startsWith("permits_v2_")) throw new DOMException("Full", "QuotaExceededError");
    return original.call(this, key, value);
  });
  expect(remove()).toBeNull();
  expect(loadOrgScoped("permits_v2", [])).toEqual(rows);
  expect(listRecycleBinEntries()).toHaveLength(0);
});
it("keeps staged recovery copies if rollback also fails", () => {
  const original = Storage.prototype.setItem;
  let staged = false;
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
    if (key.startsWith("permits_v2_") || (key.startsWith("mysafeops_recycle_bin_v1_") && staged)) throw new DOMException("Full", "QuotaExceededError");
    if (key.startsWith("mysafeops_recycle_bin_v1_")) staged = true;
    return original.call(this, key, value);
  });
  expect(remove()).toBeNull();
  expect(loadOrgScoped("permits_v2", [])).toEqual(rows);
  expect(listRecycleBinEntries()).toHaveLength(2);
});
it("does not evict unrelated recovery copies at capacity", () => {
  const bin = Array.from({ length: 399 }, (_, i) => ({ id: `old${i}`, sourceKey: "other", payload: { id: `old${i}` }, deletedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86400000).toISOString() }));
  saveOrgScoped("mysafeops_recycle_bin_v1", bin);
  expect(remove()).toBeNull();
  expect(loadOrgScoped("mysafeops_recycle_bin_v1", [])).toEqual(bin);
  expect(loadOrgScoped("permits_v2", [])).toEqual(rows);
});
it("rejects the originating scope after another organisation with identical IDs is selected during confirm", () => {
  const origin = countryOperationalStorageKey("permits_v2");
  vi.stubGlobal("confirm", vi.fn(() => {
    localStorage.setItem("mysafeops_orgId", "other");
    saveOrgScoped("permits_v2", rows.map(row => ({ ...row, title: "Other company" })));
    return true;
  }));
  expect(softDeleteToRecycleBin({ sourceKey: "permits_v2", payload: rows[0] })).toBe(false);
  expect(remove(origin)).toBeNull();
  expect(loadOrgScoped("permits_v2", []).every(row => !row.deletedAt && row.title === "Other company")).toBe(true);
  expect(listRecycleBinEntries()).toEqual([]);
  expect(JSON.parse(localStorage.getItem("permits_v2_default"))).toEqual(rows);
});
it("does not save the original list into a new scope when an archive event switches organisation", () => {
  const onChange = (event) => {
    if (event.detail?.baseKey === "mysafeops_recycle_bin_v1") localStorage.setItem("mysafeops_orgId", "other");
  };
  window.addEventListener("mysafeops-org-data-changed", onChange);
  try { expect(remove()).toBeNull(); } finally { window.removeEventListener("mysafeops-org-data-changed", onChange); }
  expect(localStorage.getItem("permits_v2_other")).toBeNull();
  expect(JSON.parse(localStorage.getItem("permits_v2_default"))).toEqual(rows);
});
