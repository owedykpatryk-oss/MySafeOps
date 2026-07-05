import { describe, expect, it } from "vitest";
import { PERMIT_TYPES } from "./permitTypes";
import {
  filterPermitTypesForOrg,
  getEnabledPermitTypeIds,
  isPermitSupervisorMode,
  normalizeEnabledPermitTypeIds,
  PACK_DEFAULT_PERMIT_TYPES,
} from "./permitOrgPrefs";
import { recentPermitsFromHistory } from "./permitRecentHistory";

describe("permitOrgPrefs", () => {
  it("normalizes enabled permit type ids", () => {
    expect(normalizeEnabledPermitTypeIds(["hot_work", "nope", "hot_work"])).toEqual(["hot_work"]);
  });

  it("filters permit types for org", () => {
    const filtered = filterPermitTypesForOrg(PERMIT_TYPES, ["hot_work", "excavation"]);
    expect(Object.keys(filtered).sort()).toEqual(["excavation", "general", "hot_work"]);
  });

  it("keeps general fallback when filtering", () => {
    const filtered = filterPermitTypesForOrg(PERMIT_TYPES, ["hot_work"]);
    expect(filtered.general).toBeTruthy();
  });

  it("uses pack defaults when org has no explicit enabled list", () => {
    const ids = getEnabledPermitTypeIds({ industryPackId: "electricalContractor" });
    expect(ids).toEqual(PACK_DEFAULT_PERMIT_TYPES.electricalContractor);
  });

  it("detects supervisor mode", () => {
    expect(isPermitSupervisorMode({ permitSupervisorMode: true })).toBe(true);
    expect(isPermitSupervisorMode({})).toBe(false);
  });
});

describe("permitRecentHistory", () => {
  it("merges history with live permits", () => {
    const merged = recentPermitsFromHistory(
      [{ id: "p2", type: "excavation", location: "Yard", createdAt: "2026-07-02T10:00:00.000Z" }],
      5
    );
    expect(merged.some((p) => p.id === "p2")).toBe(true);
  });
});
