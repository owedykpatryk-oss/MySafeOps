/** @vitest-environment jsdom */
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
    expect(summary).toMatch(/utility mapping survey/i);
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
    expect(text).toMatch(/permit-to-dig|hand-dig/i);
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

describe("surveyReportHelpers extended", () => {
  it("normalizes legacy reports with new nested fields", async () => {
    const { normalizeSurveyReport } = await import("./surveyReportHelpers.js");
    const legacy = { id: "sr_old", title: "Old report", sections: { findings: "Done" } };
    const next = normalizeSurveyReport(legacy);
    expect(next.documentControl.issueNumber).toBe("1");
    expect(next.qaChecklist.catScanBeforeWork).toBe(false);
    expect(next.deliverables).toEqual([]);
  });

  it("finalizes report with revision history and sign-off", async () => {
    const { finalizeReportRevision } = await import("./surveyReportHelpers.js");
    const report = blankSurveyReport({
      surveyor: "Alex",
      surveyDate: "2026-04-01",
      documentControl: { revision: "A", preparedBy: "Alex" },
    });
    const final = finalizeReportRevision(report);
    expect(final.status).toBe("final");
    expect(final.signatures.surveyorName).toBe("Alex");
    expect(final.revisionHistory.some((h) => h.description === "Marked final")).toBe(true);
  });

  it("bumps revision and builds duplicate payloads", async () => {
    const { bumpRevisionLetter, buildDuplicateReportPayload, buildPas128SummaryStats } = await import(
      "./surveyReportHelpers.js"
    );
    expect(bumpRevisionLetter("A")).toBe("B");
    expect(bumpRevisionLetter("Z")).toBe("AA");

    const final = blankSurveyReport({
      ref: "SR-2026-001",
      status: "final",
      documentControl: { revision: "A", issueNumber: "1" },
      utilitiesTable: [{ utilityType: "gas", depth: "1m", pas128Ql: "B1", confidence: "medium" }],
    });
    const stats = buildPas128SummaryStats(final);
    expect(stats.total).toBe(1);

    const rev = buildDuplicateReportPayload(final, [final], { asRevision: true });
    expect(rev.documentControl.revision).toBe("B");
    expect(rev.ref).toBe("SR-2026-001");
    expect(rev.parentReportId).toBe(final.id);
  });
});

describe("surveyReportPrintHtml", () => {
  it("builds cover page, contents and utility table", async () => {
    const store = {
      mysafeops_orgId: "default",
      mysafeops_org_settings_default: JSON.stringify({ name: "Test Surveys Ltd", primaryColor: "#0d9488" }),
    };
    globalThis.localStorage = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => {
        store[k] = v;
      },
    };
    const { buildSurveyReportHtml } = await import("./surveyReportPrintHtml.js");
    const report = blankSurveyReport({
      ref: "SR-2026-010",
      title: "Utility mapping — Test site",
      surveyType: "utility_mapping_survey",
      pas128Ql: "B1",
      surveyDate: "2026-04-15",
      surveyor: "Alex Surveyor",
      client: "Test Client",
      sections: {
        scope: "Map utilities.",
        methodology: "EML and GPR.",
        findings: "HV cable traced along frontage.",
      },
      utilitiesTable: [
        { utilityType: "hv_cable", depth: "0.8 m", method: "EML", pas128Ql: "B1", confidence: "medium", notes: "" },
      ],
      documentControl: { issueNumber: "1", revision: "A", preparedBy: "Alex Surveyor" },
    });
    const html = buildSurveyReportHtml(report, { projectLat: 51.31, projectLng: -0.12 });
    expect(html).toContain("sr-cover");
    expect(html).toContain("Contents");
    expect(html).toContain("Document control");
    expect(html).toContain("Findings &amp; results");
    expect(html).toContain("HV cable");
    expect(html).toContain("Sign-off");
    expect(html).toContain("staticmap.openstreetmap.de");
    expect(html).toContain('class="sr-watermark"');
    expect(html).toContain("DRAFT");
  });

  it("pullScopeFromRams copies catalog scope and method from RAMS work type", async () => {
    const { pullScopeFromRams } = await import("./surveyReportSmart.js");
    const report = blankSurveyReport({ sections: { scope: "", methodology: "" } });
    const rams = {
      id: "rams_1",
      surveyWorkType: "utility_mapping_survey",
      surveyDeliverables: "PAS128 scope text",
      surveyMethodStatement: "4.0 Work procedure — should not land in report methodology",
      title: "Site RAMS",
      surveyHoldPoints: ["HP1 records review complete"],
    };
    const next = pullScopeFromRams(report, rams);
    expect(next.sections.scope).toMatch(/PAS 128 utility mapping/i);
    expect(next.sections.methodology).toMatch(/PAS 128 Type B/i);
    expect(next.sections.methodology).not.toMatch(/4\.0 Work procedure/);
    expect(next.hseRefs.ramsExcerpt).toMatch(/Site RAMS/);
    expect(next.scopeFromRamsAt).toBeTruthy();
  });
});

describe("surveyReportSmart professional prefill", () => {
  it("builds default deliverables for utility mapping", async () => {
    const { buildDefaultDeliverables, prefillProfessionalFields } = await import("./surveyReportSmart.js");
    const rows = buildDefaultDeliverables("utility_mapping_survey");
    expect(rows.length).toBeGreaterThan(1);
    expect(rows.some((r) => r.format === "pdf_drawing")).toBe(true);

    const report = prefillProfessionalFields(
      blankSurveyReport({ surveyType: "utility_mapping_survey", surveyor: "Alex", surveyDate: "2026-04-01", projectId: "p1" }),
      { permits: [{ projectId: "p1", status: "active", permitNo: "PTW-99" }] }
    );
    expect(report.documentControl.preparedBy).toBe("Alex");
    expect(report.hseRefs.permitRef).toBe("PTW-99");
    expect(report.deliverables.length).toBeGreaterThan(0);
  });
});
