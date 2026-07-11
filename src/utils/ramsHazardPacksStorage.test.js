/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import {
  loadRamsHazardPacks,
  saveRamsHazardPacks,
  RAMS_HAZARD_PACKS_KEY,
  RAMS_HAZARD_PACKS_LEGACY_KEY,
} from "./ramsHazardPacksStorage";

describe("ramsHazardPacksStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("test-org");
  });

  it("migrates legacy rams_quick_packs on first read", () => {
    localStorage.setItem("rams_quick_packs_test-org", JSON.stringify([{ id: "builtin_food_1" }]));
    const packs = loadRamsHazardPacks([]);
    expect(packs).toHaveLength(1);
    expect(localStorage.getItem(`${RAMS_HAZARD_PACKS_KEY}_test-org`)).toBeTruthy();
  });

  it("persists to canonical key", () => {
    saveRamsHazardPacks([{ id: "orgexclusive_fess_me_site_baseline" }]);
    expect(loadRamsHazardPacks([])[0].id).toBe("orgexclusive_fess_me_site_baseline");
    expect(localStorage.getItem(`${RAMS_HAZARD_PACKS_LEGACY_KEY}_test-org`)).toBeNull();
  });
});
