/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import ALL from "../modules/rams/ramsAllHazards.js";
import {
  ensureOrgExclusiveQuickPacks,
  filterQuickPacksForOrg,
  FESS_ME_SITE_BASELINE_PACK_DEF,
} from "../modules/rams/orgExclusiveQuickPacks.js";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";

describe("orgExclusiveQuickPacks", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Contractor" });
  });

  it("adds baseline pack only for FESS org", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
    const merged = ensureOrgExclusiveQuickPacks([], ALL, "fess-group");
    expect(merged.some((p) => p.id === FESS_ME_SITE_BASELINE_PACK_DEF.id)).toBe(true);
    expect(merged.find((p) => p.id === FESS_ME_SITE_BASELINE_PACK_DEF.id)?.orgExclusive).toBe(true);
    expect(merged.find((p) => p.id === FESS_ME_SITE_BASELINE_PACK_DEF.id)?.templates.length).toBeGreaterThan(15);
  });

  it("does not add exclusive packs for other orgs", () => {
    const merged = ensureOrgExclusiveQuickPacks([], ALL, "acme-ltd");
    expect(merged.some((p) => p.orgExclusive)).toBe(false);
  });

  it("filters exclusive packs out of UI for non-FESS orgs", () => {
    const packs = [
      { id: "builtin_food_factory_me", orgExclusive: false },
      { id: FESS_ME_SITE_BASELINE_PACK_DEF.id, orgExclusive: true },
    ];
    expect(filterQuickPacksForOrg(packs, "acme-ltd").length).toBe(1);
    expect(filterQuickPacksForOrg(packs, "fess-group").length).toBe(2);
  });
});
