import { describe, expect, it } from "vitest";
import library from "./ramsAllHazards";
import { SURVEY_TASK_HAZARD_IDS, selectSurveyHazards } from "./ramsSurveyHazardSelection";
import { getPlaybookSurveyPack } from "../../utils/surveyContentCatalog";
import { enrichRamsDraftFromPlaybookPack } from "./ramsPlaybookEnrichment";
import { isValidRiskAssessment } from "./ramsRiskLevel";

describe("task-specific survey RAMS suggestions", () => {
  it("keeps task hazards even when they occur at the end of the library", () => {
    const rows = selectSurveyHazards({ key: "hand_auger_sampling" }, [...library].reverse(), 1);
    expect(rows.map((h) => h.id)).toContain("si_007");
    expect(rows.map((h) => h.id)).not.toContain("drill_003");
  });
  it("does not turn a surface GPR scan into electrical installation or drilling", () => {
    const ids = selectSurveyHazards(getPlaybookSurveyPack("gpr_survey"), library).map((h) => h.id);
    expect(ids).toEqual(["gen_001", "mh_001", "elec_005"]);
    expect(ids.some((id) => id.startsWith("drill_") || id === "elec_003")).toBe(false);
  });
  it("includes GI hazards and site hazards without truncation in playbook generation", () => {
    let id = 0;
    const result = enrichRamsDraftFromPlaybookPack({}, { ramsSurveyKey: "site_investigation_campaign", siteContextKey: "brownfield" },
      getPlaybookSurveyPack("site_investigation_campaign"), library, () => `r${++id}`);
    const ids = result.rows.map((r) => r.sourceId);
    expect(ids).toContain("si_006");
    expect(ids).toContain("si_011");
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("has existing, unambiguous hazard ids and valid scores throughout the library", () => {
    const ids = new Set(library.map((h) => h.id));
    expect(ids.size).toBe(library.length);
    for (const hazards of Object.values(SURVEY_TASK_HAZARD_IDS)) {
      for (const id of hazards) expect(ids.has(id), id).toBe(true);
    }
    for (const h of library) {
      expect(isValidRiskAssessment(h.initialRisk), `${h.id} initial`).toBe(true);
      expect(isValidRiskAssessment(h.revisedRisk), `${h.id} residual`).toBe(true);
    }
  });
});
