/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { setOrgId, loadOrgScoped as load } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { seedFessSitePortals, getFessPortalForSite } from "./fessPortalPreset";

describe("fessPortalPreset", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", slug: "fess-group" });
  });

  it("does not seed for non-FESS org", () => {
    setOrgId("acme");
    saveOrgSettingsRaw({ name: "Acme" });
    const result = seedFessSitePortals();
    expect(result.created).toBe(0);
    expect(load("client_portals", [])).toEqual([]);
  });

  it("seeds portals per site with RAMS approval", () => {
    const first = seedFessSitePortals();
    expect(first.created).toBe(6);
    const portals = load("client_portals", []);
    expect(portals.every((p) => p.allowRamsApproval === true)).toBe(true);
    expect(portals.every((p) => p.fessPortalPreset)).toBe(true);
    expect(portals.every((p) => p.sections?.includes("rams"))).toBe(true);

    const second = seedFessSitePortals();
    expect(second.created).toBe(0);
    expect(getFessPortalForSite("fess_site_quorn")?.projectId).toBeTruthy();
  });
});
