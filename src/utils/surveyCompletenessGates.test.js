/** @vitest-environment jsdom */
import { describe, it, expect } from "vitest";
import { blankSurveyReport } from "../modules/surveyReport/surveyReportConstants";
import { evaluateSurveyFinalGate, evaluateSurveyExportGate } from "./surveyCompletenessGates";

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
      qaChecklist: { catScanBeforeWork: true },
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
      pas128Ql: "QLB",
      utilitiesTable: [{ id: "u1", utilityType: "Electric" }],
      qaChecklist: { controlVerified: true },
      equipmentCalibration: [{ id: "eq_1" }],
      documentControl: { approvedBy: "Lead" },
      photos: [{ id: "ph_1" }],
    });
    expect(evaluateSurveyExportGate(report).allowed).toBe(true);
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
      qaChecklist: { utilityClearanceGi: true, chainOfCustody: true },
      equipmentCalibration: [{ id: "eq_1" }],
      documentControl: { approvedBy: "Lead" },
      photos: [{ id: "ph_1" }],
    });
    expect(evaluateSurveyExportGate(report).allowed).toBe(true);
  });
});
