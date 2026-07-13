/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach } from "vitest";
import {
  buildSurveyAppendixText,
  appendSurveySummaryToRams,
  batchAssignSurveysToProject,
  batchDuplicateRamsToProject,
  cloneProjectDocuments,
  persistRamsSyncFromSurvey,
} from "./documentPropagation";
import { saveOrgScoped, loadOrgScoped as load } from "./orgStorage";
import { PROJECT_DOC_KEYS } from "./projectDashboard";

describe("documentPropagation", () => {
  beforeEach(() => {
    saveOrgScoped("rams_builder_docs", []);
    saveOrgScoped(PROJECT_DOC_KEYS.geoPhotos, []);
    saveOrgScoped(PROJECT_DOC_KEYS.rams, []);
  });

  it("buildSurveyAppendixText includes key fields", () => {
    const text = buildSurveyAppendixText({
      ref: "SR-001",
      title: "Site A survey",
      status: "final",
      surveyType: "utility_mapping_survey",
      pas128Method: "M2",
      sections: { findings: "Two gas mains detected." },
      utilitiesTable: [{ id: "u1" }],
    });
    expect(text).toMatch(/SR-001/);
    expect(text).toMatch(/Two gas mains/);
    expect(text).toMatch(/Utility schedule: 1/);
    expect(text).toMatch(/PAS128 method: M2/);
    expect(text).toMatch(/Hold points:/);
  });

  it("persistRamsSyncFromSurvey applies catalog pack to linked RAMS", () => {
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [
      { id: "r1", title: "RAMS", projectId: "p1", rows: [] },
    ]);
    const report = {
      id: "s1",
      projectId: "p1",
      linkedRamsId: "r1",
      surveyType: "service_clearance_survey",
      sections: { scope: "Clearance around BH-01 to BH-04." },
    };
    const next = persistRamsSyncFromSurvey(report, load(PROJECT_DOC_KEYS.rams, []));
    expect(next.surveyWorkType).toBe("service_clearance_survey");
    expect(next.surveyMethodStatement).toMatch(/4\.0 Work procedure/i);
    expect(next.surveyHoldPoints?.length).toBeGreaterThan(0);
    expect(next.linkedSurveyIds).toContain("s1");
  });

  it("appendSurveySummaryToRams updates handover notes and appendices", () => {
    const rams = { id: "r1", title: "RAMS", handoverNotes: "Existing note." };
    const report = { id: "s1", ref: "SR-9", title: "Survey", status: "final", sections: { findings: "OK" } };
    const { rams: next, appended } = appendSurveySummaryToRams(rams, report);
    expect(appended).toBe(true);
    expect(next.handoverNotes).toMatch(/Survey appendix/);
    expect(next.handoverNotes).toMatch(/Existing note/);
    expect(next.surveyAppendices).toHaveLength(1);
    expect(next.linkedSurveyIds).toEqual(["s1"]);
  });

  it("batchAssignSurveysToProject re-links selected reports", () => {
    const next = batchAssignSurveysToProject(["a"], "p2", [
      { id: "a", projectId: "p1" },
      { id: "b", projectId: "p1" },
    ]);
    expect(next.find((r) => r.id === "a")?.projectId).toBe("p2");
    expect(next.find((r) => r.id === "b")?.projectId).toBe("p1");
  });

  it("batchDuplicateRamsToProject creates multiple drafts", () => {
    const projects = [{ id: "p2", name: "Site B" }];
    const docs = [
      { id: "r1", title: "RAMS A", projectId: "p1", rows: [] },
      { id: "r2", title: "RAMS B", projectId: "p1", rows: [] },
    ];
    const copies = batchDuplicateRamsToProject(docs, "p2", projects);
    expect(copies).toHaveLength(2);
    expect(copies.every((c) => c.projectId === "p2")).toBe(true);
  });

  it("cloneProjectDocuments can include geo-photos", () => {
    saveOrgScoped(PROJECT_DOC_KEYS.geoPhotos, [
      { id: "g1", projectId: "src", caption: "Test", includeInReport: true },
    ]);
    const summary = cloneProjectDocuments("src", "dst", { includeGeoPhotos: true, includeRams: false, includeSurveys: false, includeMethodStatements: false });
    expect(summary.geoPhotos).toBe(1);
  });
});
