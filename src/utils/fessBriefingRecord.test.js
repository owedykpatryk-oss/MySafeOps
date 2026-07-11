/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it } from "vitest";
import { setOrgId, loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import {
  buildFessBriefingOperativeRows,
  seedFessSiteBriefing,
  FESS_FOOD_FACTORY_BRIEFING_TOPICS,
} from "./fessBriefingRecord";

describe("fessBriefingRecord", () => {
  beforeEach(() => {
    localStorage.clear();
    setOrgId("fess-group");
    saveOrgSettingsRaw({ name: "FESS Group", slug: "fess-group" });
    save("mysafeops_workers", [
      {
        id: "w1",
        name: "Alex Smith",
        projectIds: ["p1"],
        certifications: [{ certCode: "food_hygiene_l2", expiryDate: "2026-12-01" }],
      },
    ]);
  });

  it("returns empty rows for non-FESS org", () => {
    setOrgId("acme");
    saveOrgSettingsRaw({ name: "Acme" });
    expect(buildFessBriefingOperativeRows({ projectId: "p1" }, [])).toEqual([]);
  });

  it("builds briefing rows with cert expiry", () => {
    const rows = buildFessBriefingOperativeRows({ projectId: "p1" }, load("mysafeops_workers", []));
    expect(rows[0].name).toBe("Alex Smith");
    expect(rows[0].certs).toMatch(/Food Hygiene/i);
    expect(rows[0].certExpiry).toBe("2026-12-01");
  });

  it("seeds idempotent FESS site briefing for today", () => {
    save("mysafeops_projects", [
      {
        id: "p1",
        name: "Quorn site",
        client: "Quorn",
        fessSiteTemplateId: "fess_site_quorn",
        fessSuggestedJobStarterKey: "unistrut_pipe_support",
      },
    ]);
    const first = seedFessSiteBriefing("fess_site_quorn");
    expect(first.created).toBe(true);
    expect(first.briefing.topics).toEqual(FESS_FOOD_FACTORY_BRIEFING_TOPICS);
    const second = seedFessSiteBriefing("fess_site_quorn");
    expect(second.created).toBe(false);
  });
});
