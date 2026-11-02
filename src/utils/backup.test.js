// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { collectBackupBundle, restoreBackupBundle, validateBackupBundle } from "./backup";

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem("mysafeops_orgId", "acme");
  vi.stubGlobal("confirm", vi.fn(() => true));
});

describe("organisation and country backups", () => {
  it("round trips primary and secondary countries without including another organisation", () => {
    const own = ["rams_builder_docs_acme", "rams_builder_docs_acme__country_pl-id", "permits_v2_acme__country_au-id"];
    for (const key of own) localStorage.setItem(key, '[{"id":"kept"}]');
    localStorage.setItem("rams_builder_docs_acme-other__country_pl-id", "[]");
    localStorage.setItem("rams_builder_docs_other", "[]");
    localStorage.setItem("rams_builder_docs_other_acme", "[]");
    localStorage.setItem("mysafeops_org_settings", '{"name":"unowned"}');
    const bundle = collectBackupBundle();
    expect(Object.keys(bundle.keys).sort()).toEqual(own.sort());
    expect(bundle.scopes["rams_builder_docs_acme__country_pl-id"].countryId).toBe("pl-id");
    for (const key of own) localStorage.removeItem(key);
    expect(restoreBackupBundle(bundle).applied).toBe(3);
    for (const key of own) expect(localStorage.getItem(key)).toBe('[{"id":"kept"}]');
  });

  it("rejects foreign or malformed country keys before writing anything", () => {
    for (const key of ["rams_builder_docs_other", "rams_builder_docs_other_acme", "rams_builder_docs_acme__country_", "rams_builder_docs_acme__country_pl:main", "rams_builder_docs_acme__country_pl__country_au"]) {
      const bundle = { version: 1, orgId: "acme", keys: { rams_builder_docs_acme: "[]", [key]: "[]" } };
      expect(() => restoreBackupBundle(bundle)).toThrow();
      expect(localStorage.getItem("rams_builder_docs_acme")).toBeNull();
    }
  });

  it("rejects a changed manifest and a restore into a different organisation", () => {
    localStorage.setItem("rams_builder_docs_acme__country_pl-id", "[]");
    const bundle = collectBackupBundle();

    bundle.scopes["rams_builder_docs_acme__country_pl-id"].countryId = "other";
    expect(validateBackupBundle(bundle).ok).toBe(false);
    localStorage.setItem("mysafeops_orgId", "other");
    expect(() => restoreBackupBundle(bundle)).toThrow(/organisation/);
  });

  it("restores legacy owned keys without changing active organisation or unowned settings", () => {
    const bundle = { version: 1, orgId: "acme", keys: { rams_builder_docs_acme: "[]", mysafeops_orgId: "other", mysafeops_org_settings: "{}" } };
    expect(restoreBackupBundle(bundle).applied).toBe(1);
    expect(localStorage.getItem("mysafeops_orgId")).toBe("acme");
    expect(localStorage.getItem("mysafeops_org_settings")).toBeNull();
  });
});
