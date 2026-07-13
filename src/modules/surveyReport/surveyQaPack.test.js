import { describe, expect, it } from "vitest";
import {
  blankQaChecklistState,
  getQaChecklistGroupsForSurveyType,
  getQaChecklistItemsForSurveyType,
  getQaChecklistProgress,
  getQaGroupProgress,
  getNextIncompleteQaGroupLabel,
  mergeStandardsCited,
  applyMobilisationQaPrefill,
  suggestStandardsCitedForSurveyType,
  patchQaGroup,
} from "./surveyQaPack";
import { blankSurveyReport } from "./surveyReportConstants";
import { buildStandardsCitedNarrative, normalizeSurveyReport } from "./surveyReportHelpers";

describe("surveyQaPack", () => {
  it("includes core site checks for all survey types", () => {
    const items = getQaChecklistItemsForSurveyType("general_site_survey");
    expect(items.some((i) => i.key === "catScanBeforeWork")).toBe(true);
    expect(items.some((i) => i.key === "cadCrsChecked")).toBe(false);
    expect(items.some((i) => i.key === "ppeAdequate")).toBe(true);
  });

  it("adds utility mapping, deliverable and CAD checks for PAS128 surveys", () => {
    const items = getQaChecklistItemsForSurveyType("utility_mapping_survey");
    expect(items.some((i) => i.key === "pas128QlRecorded")).toBe(true);
    expect(items.some((i) => i.key === "cadCrsChecked")).toBe(true);
    expect(items.some((i) => i.key === "drawingNorthOriented")).toBe(true);
  });

  it("adds CCTV checks for drainage surveys", () => {
    const items = getQaChecklistItemsForSurveyType("cctv_drainage_survey");
    expect(items.some((i) => i.key === "cctvChambersAccessed")).toBe(true);
    expect(items.some((i) => i.key === "cctvFootageChainLogged")).toBe(true);
  });

  it("adds UAV checks for aerial surveys", () => {
    const items = getQaChecklistItemsForSurveyType("uav_aerial");
    expect(items.some((i) => i.key === "uavAirspaceChecked")).toBe(true);
  });

  it("adds GI checks for site investigation campaigns", () => {
    const items = getQaChecklistItemsForSurveyType("site_investigation_campaign");
    expect(items.some((i) => i.key === "chainOfCustody")).toBe(true);
  });

  it("groups items for the editor UI including mobilisation", () => {
    const groups = getQaChecklistGroupsForSurveyType("utility_mapping_survey");
    expect(groups.some((g) => g.id === "mobilisation" && g.items.length > 0)).toBe(true);
    expect(groups.some((g) => g.id === "deliverable" && g.items.length > 0)).toBe(true);
  });

  it("blank report merges all QA keys with false defaults", () => {
    const report = blankSurveyReport();
    const keys = Object.keys(blankQaChecklistState());
    keys.forEach((key) => {
      expect(report.qaChecklist[key]).toBe(false);
    });
  });

  it("reports QA progress percentage", () => {
    const qa = { catScanBeforeWork: true, controlVerified: true };
    const { checked, total, pct } = getQaChecklistProgress(qa, "general_site_survey");
    expect(checked).toBe(2);
    expect(total).toBeGreaterThan(2);
    expect(pct).toBeGreaterThan(0);
  });

  it("patchQaGroup toggles all items in a group", () => {
    const qa = blankQaChecklistState();
    const next = patchQaGroup(qa, "mobilisation", "topographical_survey", true);
    const groups = getQaGroupProgress(next, "topographical_survey");
    const mob = groups.find((g) => g.id === "mobilisation");
    expect(mob?.complete).toBe(true);
  });

  it("returns next incomplete QA group label", () => {
    const qa = { ramsBriefingComplete: true };
    const label = getNextIncompleteQaGroupLabel(qa, "general_site_survey");
    expect(typeof label).toBe("string");
    expect(label?.length).toBeGreaterThan(0);
  });

  it("suggests standards per survey type", () => {
    expect(suggestStandardsCitedForSurveyType("utility_mapping_survey")).toContain("pas128");
    expect(suggestStandardsCitedForSurveyType("cctv_drainage_survey")).toContain("mscc5");
  });

  it("merges standards without dropping existing", () => {
    const merged = mergeStandardsCited(["rics_measured"], "utility_mapping_survey");
    expect(merged).toContain("rics_measured");
    expect(merged).toContain("pas128");
  });

  it("prefills mobilisation QA when checklist empty", () => {
    const qa = applyMobilisationQaPrefill({}, "topographical_survey");
    expect(qa.ramsBriefingComplete).toBe(true);
    expect(qa.calibrationInDate).toBe(true);
  });
});

describe("survey standards cited", () => {
  it("builds narrative from cited standard keys", () => {
    const text = buildStandardsCitedNarrative(["pas128", "hsg47"]);
    expect(text).toMatch(/PAS 128/);
    expect(text).toMatch(/HSG47/);
  });

  it("normalizes standardsCited on saved reports", () => {
    const r = normalizeSurveyReport({ standardsCited: ["rics_measured"] });
    expect(r.standardsCited).toEqual(["rics_measured"]);
  });
});
