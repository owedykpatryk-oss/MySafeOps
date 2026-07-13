/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { blankSurveyReport } from "../modules/surveyReport/surveyReportConstants";
import { getQaChecklistItemsForSurveyType } from "../modules/surveyReport/surveyQaPack";
import { evaluateSurveyFinalGate, evaluateSurveyExportGate } from "./surveyCompletenessGates";

function qaMeetingFinalGate(surveyType, extra = {}) {
  const items = getQaChecklistItemsForSurveyType(surveyType);
  const need = Math.max(1, Math.ceil(items.length * 0.5));
  const qa = { ...extra };
  items.slice(0, need).forEach((i) => {
    qa[i.key] = true;
  });
  return qa;
}

describe("surveyCompletenessGates", () => {
  it("blocks final when QA, calibration, sign-off or photos missing", () => {
    const draft = blankSurveyReport({ status: "draft", surveyType: "topographical_survey" });
    const gate = evaluateSurveyFinalGate(draft);
    expect(gate.allowed).toBe(false);
    expect(gate.missing.length).toBeGreaterThan(0);
  });

  it("allows final when required fields present", () => {
    const ready = blankSurveyReport({
      status: "draft",
      surveyType: "topographical_survey",
      qaChecklist: qaMeetingFinalGate("topographical_survey"),
      equipmentCalibration: [{ id: "eq_1", instrument: "TS" }],
      documentControl: { approvedBy: "HSE Lead" },
      photos: [{ id: "ph_1", dataUrl: "data:image/png;base64,abc", caption: "" }],
    });
    expect(evaluateSurveyFinalGate(ready).allowed).toBe(true);
  });

  it("blocks export pack for utility mapping without QL and utilities table", () => {
    const report = blankSurveyReport({
      status: "final",
      surveyType: "utility_mapping_survey",
      qaChecklist: { controlVerified: true },
      equipmentCalibration: [{ id: "eq_1" }],
      documentControl: { approvedBy: "Lead" },
      photos: [{ id: "ph_1" }],
    });
    const gate = evaluateSurveyExportGate(report);
    expect(gate.allowed).toBe(false);
    expect(gate.missing.some((m) => /PAS128/i.test(m))).toBe(true);
    expect(gate.missing.some((m) => /utility schedule/i.test(m))).toBe(true);
  });

  it("allows export pack when PAS128 utility report is complete", () => {
    const report = blankSurveyReport({
      status: "final",
      surveyType: "utility_mapping_survey",
      pas128Ql: "B1",
      utilitiesTable: [{ id: "u1", utilityType: "Electric", pas128Ql: "B2" }],
      qaChecklist: qaMeetingFinalGate("utility_mapping_survey"),
      equipmentCalibration: [{ id: "eq_1" }],
      documentControl: { approvedBy: "Lead" },
      photos: [{ id: "ph_1" }],
    });
    const gate = evaluateSurveyExportGate(report);
    expect(gate.missing, gate.missing.join("; ")).toEqual([]);
    expect(gate.allowed).toBe(true);
  });

  it("blocks GI export without location schedule or utility clearance QA", () => {
    const report = blankSurveyReport({
      status: "final",
      surveyType: "site_investigation_campaign",
      qaChecklist: { controlVerified: true },
      equipmentCalibration: [{ id: "eq_1" }],
      documentControl: { approvedBy: "Lead" },
      photos: [{ id: "ph_1" }],
    });
    const gate = evaluateSurveyExportGate(report);
    expect(gate.allowed).toBe(false);
    expect(gate.missing.some((m) => /GI location/i.test(m))).toBe(true);
  });

  it("allows GI export when location schedule and clearance QA present", () => {
    const report = blankSurveyReport({
      status: "final",
      surveyType: "site_investigation_campaign",
      giLocationsTable: [{ id: "gi1", locationId: "BH01", method: "Borehole" }],
      qaChecklist: qaMeetingFinalGate("site_investigation_campaign", {
        utilityClearanceGi: true,
        catScanBeforeWork: true,
      }),
      equipmentCalibration: [{ id: "eq_1" }],
      documentControl: { approvedBy: "Lead" },
      photos: [{ id: "ph_1" }],
    });
    expect(evaluateSurveyExportGate(report).allowed).toBe(true);
  });
});
