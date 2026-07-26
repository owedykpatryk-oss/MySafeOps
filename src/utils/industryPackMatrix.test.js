/** @vitest-environment jsdom */
import { describe, expect, it, beforeEach } from "vitest";
import { applyIndustryPack, INDUSTRY_PACKS } from "./orgIndustryPacks";
import { saveOrgSettingsRaw } from "./orgSettingsStorage";
import { saveOrgScoped } from "./orgStorage";
import {
  applyIndustryReadinessGates,
  getIndustrySitePackTitle,
  INDUSTRY_SITE_PACKS,
  pickIndustryMoreNextAction,
  previewPackSwitch,
} from "./industryPackProfile";
import { getPlaybooksForOrg, getProjectHubTailStep, isSurveyWorkflowEnabled } from "./projectHubIndustry";

import { todayLocalISO } from "./localDate";
const PACK_IDS = Object.keys(INDUSTRY_PACKS);

function baseGates() {
  return [
    { key: "intel", label: "Site intel", max: 10, ok: true, points: 10 },
    { key: "location", label: "Map", max: 5, ok: true, points: 5 },
    { key: "cdm", label: "CDM", max: 10, ok: false, points: 0 },
    { key: "rams", label: "RAMS", max: 20, ok: true, points: 20 },
    { key: "ptw", label: "PTW", max: 15, ok: true, points: 15 },
    { key: "briefing", label: "Briefing", max: 15, ok: false, points: 0 },
    { key: "ms", label: "MS", max: 10, ok: false, points: 0 },
    { key: "inspections", label: "Inspections", max: 10, ok: false, points: 0 },
    { key: "plans", label: "Drawings", max: 5, ok: false, points: 0 },
  ];
}

describe("industryPackMatrix", () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem("mysafeops_orgId", "test-org");
    saveOrgSettingsRaw({});
  });

  it.each(PACK_IDS)("pack %s has site pack config", (packId) => {
    applyIndustryPack(packId);
    expect(getIndustrySitePackTitle(packId)).toBeTruthy();
    expect(INDUSTRY_SITE_PACKS[packId]?.focus?.length).toBeGreaterThan(0);
  });

  it("surveying org enables survey pipeline tail", () => {
    applyIndustryPack("surveyingGeodesy");
    const step = getProjectHubTailStep({ surveys: [], inspections: [] });
    expect(step.key).toBe("survey");
    expect(isSurveyWorkflowEnabled()).toBe(true);
  });

  it("electrical org uses inspections pipeline tail", () => {
    applyIndustryPack("electricalContractor");
    const step = getProjectHubTailStep({ surveys: [], inspections: [] });
    expect(step.key).toBe("inspections");
    expect(getPlaybooksForOrg().every((p) => !p.surveyType)).toBe(true);
  });

  it("electrical readiness adds PAT and LOTO gates", () => {
    applyIndustryPack("electricalContractor");
    saveOrgScoped("electrical_pat_log", [{ id: "1", projectId: "p1" }]);
    saveOrgScoped("loto_register", [{ id: "l1", projectId: "p1", phase: "live" }]);
    const gates = baseGates();
    applyIndustryReadinessGates(
      gates,
      { id: "p1" },
      { permits: [], rams: [{}], inspections: [{}] },
      "electricalContractor",
      {
        pat: [{ id: "1", projectId: "p1" }],
        hotWork: [],
        gmp: [],
        allergen: [],
        surveys: [],
        geoPhotos: [],
        loto: [{ id: "l1", projectId: "p1", phase: "live" }],
        highCare: [],
        inspections: [],
      }
    );
    expect(gates.find((g) => g.key === "hotwork")).toBeTruthy();
    expect(gates.find((g) => g.key === "pat")?.ok).toBe(true);
    expect(gates.find((g) => g.key === "loto")?.ok).toBe(true);
    expect(gates.reduce((s, g) => s + g.max, 0)).toBe(100);
  });

  it("surveying readiness adds PAS128 and completeness gates", () => {
    applyIndustryPack("surveyingGeodesy");
    const gates = [
      ...baseGates().filter((g) => g.key !== "inspections"),
      { key: "survey", label: "Survey", max: 10, ok: false, points: 0 },
    ];
    applyIndustryReadinessGates(
      gates,
      { id: "p1" },
      {
        surveys: [
          {
            id: "s1",
            surveyType: "utility_mapping_survey",
            pas128Ql: "QL-B",
            utilitiesTable: [{}],
            status: "draft",
            qaChecklist: { a: true },
            equipmentCalibration: [{}],
            photos: [{}],
            documentControl: { approvedBy: "Lead" },
          },
        ],
        methodStatements: [],
      },
      "surveyingGeodesy",
      createEmptyRegisters()
    );
    expect(gates.find((g) => g.key === "pas128")?.ok).toBe(true);
    expect(gates.find((g) => g.key === "survey_qa")).toBeTruthy();
  });

  it("food pharma more action prioritises active allergen window", () => {
    applyIndustryPack("foodPharma");
    const today = todayLocalISO();
    const action = pickIndustryMoreNextAction("foodPharma", {
      pat: [],
      hotWork: [],
      gmp: [],
      allergen: [{ id: "a1", startAt: `${today}T08:00`, endAt: `${today}T18:00` }],
      surveys: [],
      geoPhotos: [],
      loto: [],
      highCare: [],
      inspections: [],
    });
    expect(action?.viewId).toBe("allergen-changeovers");
  });

  it("preview warns that survey data is kept when hiding module", () => {
    const preview = previewPackSwitch("surveyingGeodesy", "generalContractor");
    expect(preview.changes.some((c) => /data kept/i.test(c))).toBe(true);
  });
});

function createEmptyRegisters() {
  return {
    pat: [],
    hotWork: [],
    gmp: [],
    allergen: [],
    surveys: [],
    geoPhotos: [],
    loto: [],
    highCare: [],
    inspections: [],
  };
}
