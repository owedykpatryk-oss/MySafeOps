/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach, vi } from "vitest";
import { asStorageArray, countryOperationalStorageKey, loadOrgScoped, saveOrgScoped, STORAGE_QUOTA_EVENT } from "./orgStorage";

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

  it("keeps the primary country on legacy keys and isolates a secondary country", () => {
    localStorage.setItem(
      "mysafeops_active_country_workspace_snapshot_test-org",
      JSON.stringify({ id: "workspace-uk", market_id: "uk", is_primary: true }),
    );
    expect(countryOperationalStorageKey("mysafeops_projects")).toBe("mysafeops_projects_test-org");

    localStorage.setItem(
      "mysafeops_active_country_workspace_snapshot_test-org",
      JSON.stringify({ id: "workspace-pl", market_id: "pl", is_primary: false }),
    );
    expect(countryOperationalStorageKey("mysafeops_projects")).toBe(
      "mysafeops_projects_test-org__country_workspace-pl",
    );
    expect(countryOperationalStorageKey("mysafeops_org_settings")).toBe("mysafeops_org_settings_test-org");
    expect(saveOrgScoped("mysafeops_projects", [{ id: "pl-1" }], { bypassBillingGuard: true })).toBe(true);
    expect(JSON.parse(localStorage.getItem("mysafeops_projects_test-org__country_workspace-pl"))).toEqual([{ id: "pl-1" }]);
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
