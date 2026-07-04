/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { asStorageArray, loadOrgScoped } from "./orgStorage";

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
});
