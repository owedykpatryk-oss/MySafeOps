import { describe, expect, it } from "vitest";
import {
  applyDefaultRecordsPreset,
  batchCreateDraftReports,
  buildExecutiveSummaryDraft,
  buildRecommendationsDraft,
  buildSitePlanSummaryText,
  buildSurveyExtentFromProject,
  mapWeatherSnapshotToFields,
  mergeSitePlanIntoReport,
  projectsMissingReports,
  suggestAccessLimitationsFromPlans,
  suggestLimitationKeys,
  suggestLimitationKeysFromPlans,
} from "./surveyReportSmart.js";
import { blankSurveyReport } from "./surveyReportConstants.js";

describe("surveyReportSmart", () => {
  it("maps rain weather to phenomena and methods", () => {
    const m = mapWeatherSnapshotToFields({ description: "Light rain", tempC: 8, windMph: 10 });
    expect(m.rainDuringSurvey).toBe("light");
    expect(m.phenomena).toContain("light_rain");
    expect(m.methodsAffected).toContain("gpr");
  });

  it("suggests limitation keys from weather and records", () => {
    const report = blankSurveyReport({
      weather: { rainDuringSurvey: "heavy", phenomena: ["heavy_rain"], methodsAffected: ["gpr"] },
      utilityRecords: { informationGaps: ["client_not_supplied"], sourcesConsulted: ["no_records"], outcomes: [] },
    });
    const keys = suggestLimitationKeys(report);
    expect(keys).toContain("weather_impact");
    expect(keys).toContain("records_not_available");
  });

  it("builds extent from project boundary", () => {
    const text = buildSurveyExtentFromProject({
      boundaryName: "Phase 1",
      boundaryPoints: [
        [0, 0],
        [1, 0],
        [1, 1],
      ],
      postcode: "KT22 7SH",
    });
    expect(text).toContain("Phase 1");
    expect(text).toContain("3 vertices");
  });

  it("drafts executive summary from report fields", () => {
    const report = blankSurveyReport({
      surveyType: "utility_mapping_survey",
      surveyDate: "2026-04-15",
      siteAddress: "1 Test Road",
      sections: { findings: "Utilities traced across frontage." },
    });
    const summary = buildExecutiveSummaryDraft(report);
    expect(summary).toContain("PAS128 utility mapping");
    expect(summary).toContain("1 Test Road");
  });

  it("summarises site plan markup", () => {
    const text = buildSitePlanSummaryText([
      {
        name: "Layout A",
        escapeRoutes: [{ id: "r1", label: "North exit", points: [{ x: 1, y: 2 }, { x: 3, y: 4 }] }],
        zoneBlocks: [{ id: "z1", kind: "exclusion", label: "Crane zone" }],
        emergencyAssets: [],
      },
    ]);
    expect(text).toContain("Layout A");
    expect(text).toContain("North exit");
    expect(text).toContain("Crane zone");
  });

  it("merges site plan into report findings and access", () => {
    const report = blankSurveyReport();
    const next = mergeSitePlanIntoReport(report, [
      {
        name: "Plan 1",
        zoneBlocks: [{ id: "z1", kind: "exclusion", label: "No go" }],
        escapeRoutes: [],
        emergencyAssets: [],
      },
    ]);
    expect(next.sections.findings).toContain("Site plan context");
    expect(next.accessLimitations).toContain("access_restricted");
    expect(suggestLimitationKeysFromPlans([{ zoneBlocks: [{ kind: "hazard" }] }])).toContain("site_access_restricted");
    expect(suggestAccessLimitationsFromPlans([{ zoneBlocks: [{ kind: "hazard" }] }])).toContain("live_plant");
  });

  it("applies PAS128 records preset for utility mapping", () => {
    const report = blankSurveyReport({ surveyType: "utility_mapping_survey" });
    const next = applyDefaultRecordsPreset(report);
    expect(next.utilityRecords.sourcesConsulted).toContain("statutory_undertaker");
  });

  it("drafts recommendations by survey type", () => {
    const report = blankSurveyReport({ surveyType: "utility_mapping_survey", pas128Ql: "B1" });
    const text = buildRecommendationsDraft(report);
    expect(text).toContain("Trial holes");
  });

  it("finds projects without reports and batch creates drafts", () => {
    const projects = [{ id: "p1", name: "Alpha" }, { id: "p2", name: "Beta" }];
    const reports = [blankSurveyReport({ projectId: "p1", ref: "SR-2026-001" })];
    const missing = projectsMissingReports(projects, reports);
    expect(missing).toHaveLength(1);
    expect(missing[0].id).toBe("p2");

    const { created, reports: next } = batchCreateDraftReports(projects, reports, []);
    expect(created).toHaveLength(1);
    expect(next).toHaveLength(2);
    expect(created[0].projectName).toBe("Beta");
  });
});
