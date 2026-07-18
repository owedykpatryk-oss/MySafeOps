/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import { setOrgId } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  FESS_BOTTOM_NAV_IDS,
  buildFessBottomNavTabDefs,
  getFessDefaultWorkspaceView,
  isFessBottomNavActive,
} from "./fessBottomNav";

describe("fessBottomNav", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("default");
    saveOrgSettingsRaw({ name: "Other Org", industryPackId: "generalContractor" });
  });

  it("is inactive for non-FESS orgs", () => {
    expect(isFessBottomNavActive()).toBe(false);
  });

  it("is active for FESS Group slug", () => {
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group" });
    expect(isFessBottomNavActive()).toBe(true);
  });

  it("uses Sites as default landing", () => {
    expect(getFessDefaultWorkspaceView()).toBe("fess-sites");
  });

  it("builds Sites / RAMS / Permits / People / Photos / More", () => {
    expect(FESS_BOTTOM_NAV_IDS).toEqual([
      "fess-sites",
      "rams",
      "permits",
      "people",
      "geo-photos",
    ]);
    const tabs = buildFessBottomNavTabDefs("uk");
    expect(tabs.map((t) => t.id)).toEqual([...FESS_BOTTOM_NAV_IDS, "more"]);
    expect(tabs[0].label).toBe("Sites");
    expect(tabs.find((t) => t.id === "geo-photos")?.label).toBe("Photos");
  });
});
