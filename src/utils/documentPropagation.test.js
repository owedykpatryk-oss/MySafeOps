/** @vitest-environment jsdom */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  buildSurveyAppendixText,
  appendSurveySummaryToRams,
  batchAssignSurveysToProject,
  batchDuplicateRamsToProject,
  cloneProjectDocuments,
  persistRamsSyncFromSurvey,
  persistSurveyAppendixToRams,
  batchAppendFinalSurveysToRams,
  resolveRamsForSurvey,
} from "./documentPropagation";
import { saveOrgScoped, loadOrgScoped as load, setOrgId } from "./orgStorage";
import { setAuthorshipUserCache, clearAuthorshipUserCache } from "./documentAuthorship";
import { PROJECT_DOC_KEYS } from "./projectDashboard";

describe("documentPropagation", () => {
  afterEach(() => { vi.restoreAllMocks(); clearAuthorshipUserCache(); });

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

  it("project cloning creates unsigned RAMS drafts and leaves issued originals intact", () => {
    const original = {
      id: "issued", projectId: "src", title: "Released RAMS", status: "issued", documentStatus: "issued",
      signatureEvents: [{ action: "issue_released" }], operativeSignatures: { worker: "signature" },
      clientApproval: { by: "Client" }, approvedBy: "Approver", shareToken: "private-token", rows: [],
    };
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [original, { ...original, id: "deleted", deletedAt: "2026-10-01" }]);
    const result = cloneProjectDocuments("src", "dst", { includeSurveys: false, includeMethodStatements: false });
    expect(result.rams).toBe(1);
    const documents = load(PROJECT_DOC_KEYS.rams, []);
    expect(documents.find((doc) => doc.id === original.id)).toEqual(original);
    expect(documents.find((doc) => doc.projectId === "dst")).toMatchObject({
      title: "Released RAMS (copy)", status: "draft", documentStatus: "draft",
      signatureEvents: [], operativeSignatures: {}, clientApproval: null, approvedBy: "",
      clonedFromRamsId: original.id,
    });
    expect(documents.find((doc) => doc.projectId === "dst").shareToken).toBeUndefined();
  });

  it("project cloning reports a failed RAMS write instead of counting unsaved copies", () => {
    const original = { id: "r1", projectId: "src", title: "RAMS", rows: [] };
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [original]);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key.startsWith("rams_builder_docs_")) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    expect(() => cloneProjectDocuments("src", "dst", { includeSurveys: false, includeMethodStatements: false }))
      .toThrow(/could not be saved/);
    expect(load(PROJECT_DOC_KEYS.rams, [])).toEqual([original]);
  });

  it("project cloning reports a failed survey write instead of counting unsaved copies", () => {
    const original = { id: "s1", projectId: "src", status: "final", signatureEvents: [{ action: "issue_released" }] };
    saveOrgScoped(PROJECT_DOC_KEYS.surveys, [original]);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key.startsWith("survey_reports_")) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    expect(() => cloneProjectDocuments("src", "dst", { includeRams: false, includeSurveys: true, includeMethodStatements: false }))
      .toThrow(/survey copies could not be saved/);
    expect(load(PROJECT_DOC_KEYS.surveys, [])).toEqual([original]);
  });

  it("project cloning identifies copies already saved before a later write fails", () => {
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [{ id: "r1", projectId: "src", rows: [] }]);
    saveOrgScoped(PROJECT_DOC_KEYS.surveys, [{ id: "s1", projectId: "src", linkedRamsId: "r1" }]);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (String(key).startsWith("survey_reports_")) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    let error;
    try {
      cloneProjectDocuments("src", "dst", { includeMethodStatements: false });
    } catch (caught) {
      error = caught;
    }
    expect(error?.message).toMatch(/Already saved: 1 RAMS.*avoid duplicate copies/);
    expect(error?.partialSummary).toMatchObject({ rams: 1, surveys: 0 });
    expect(load(PROJECT_DOC_KEYS.rams, []).filter((row) => row.projectId === "dst")).toHaveLength(1);
  });

  it("project cloning connects copied drafts only to copied RAMS and clears old approvals", () => {
    saveOrgScoped("mysafeops_projects", [{ id: "dst", name: "New site", address: "New address" }]);
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [{
      id: "r1", projectId: "src", title: "Source RAMS", rows: [],
      linkedSurveyIds: ["s1"], surveyAppendices: [{ surveyId: "s1", summary: "Old findings" }],
    }]);
    saveOrgScoped(PROJECT_DOC_KEYS.surveys, [{
      id: "s1", projectId: "src", projectName: "Old site", linkedRamsId: "r1", linkedGprReportId: "old-gpr",
      status: "final", finalisedAt: "2026-09-01", signatures: { surveyorName: "A", surveyorSignedDate: "2026-09-01" },
      hseRefs: { linkedPermitId: "old-permit" },
    }]);
    saveOrgScoped(PROJECT_DOC_KEYS.permits, [{ id: "p1", projectId: "src", linkedRamsId: "r1", status: "issued", location: "Old site" }]);
    saveOrgScoped(PROJECT_DOC_KEYS.methodStatements, [{
      id: "m1", projectId: "src", relatedRamsId: "r1", status: "approved", location: "Old site",
      approvedBy: "Old approver", operativeSignatures: { worker: { imageDataUrl: "old-signature" } },
    }]);

    cloneProjectDocuments("src", "dst", { includePermits: true });
    const rams = load(PROJECT_DOC_KEYS.rams, []).find((row) => row.projectId === "dst");
    const survey = load(PROJECT_DOC_KEYS.surveys, []).find((row) => row.projectId === "dst");
    const permit = load(PROJECT_DOC_KEYS.permits, []).find((row) => row.projectId === "dst");
    const method = load(PROJECT_DOC_KEYS.methodStatements, []).find((row) => row.projectId === "dst");
    expect(rams).toMatchObject({ linkedSurveyIds: [], surveyAppendices: [] });
    expect(survey).toMatchObject({ projectName: "New site", linkedRamsId: rams.id, linkedGprReportId: "", status: "draft", finalisedAt: null });
    expect(survey.signatures.surveyorSignedDate).toBe("");
    expect(survey.hseRefs.linkedPermitId).toBe("");
    expect(permit).toMatchObject({ linkedRamsId: rams.id, status: "draft", location: "New address" });
    expect(method).toMatchObject({
      relatedRamsId: rams.id, status: "draft", location: "New address", approvedBy: "", operativeSignatures: {},
    });
  });

  it("project cloning clears source RAMS references when RAMS is not copied", () => {
    saveOrgScoped(PROJECT_DOC_KEYS.surveys, [{ id: "s1", projectId: "src", linkedRamsId: "old-rams" }]);
    saveOrgScoped(PROJECT_DOC_KEYS.methodStatements, [{ id: "m1", projectId: "src", relatedRamsId: "old-rams" }]);
    cloneProjectDocuments("src", "dst", { includeRams: false });
    expect(load(PROJECT_DOC_KEYS.surveys, [])[0].linkedRamsId).toBe("");
    expect(load(PROJECT_DOC_KEYS.methodStatements, [])[0].relatedRamsId).toBe("");
  });
});

describe("safe survey propagation into RAMS", () => {
  const original = { id: "r1", projectId: "p1", title: "Original RAMS", status: "draft", rows: [] };
  const report = { id: "s1", ref: "SR-1", projectId: "p1", linkedRamsId: "r1", status: "final", surveyType: "gpr_survey", sections: { findings: "Survey findings" } };
  beforeEach(() => { localStorage.clear(); saveOrgScoped(PROJECT_DOC_KEYS.rams, [original]); });
  afterEach(() => { vi.restoreAllMocks(); clearAuthorshipUserCache(); });

  for (const [name, persist] of [["pack", persistRamsSyncFromSurvey], ["appendix", persistSurveyAppendixToRams]]) {
    it(`${name} rejects a stale snapshot without overwriting a newer RAMS`, () => {
      const newer = { ...original, title: "Newer RAMS", rows: [{ hazard: "New hazard" }] };
      saveOrgScoped(PROJECT_DOC_KEYS.rams, [newer]);
      expect(() => persist(report, [original])).toThrow(/changed|removed/i);
      expect(load(PROJECT_DOC_KEYS.rams, [])).toEqual([newer]);
    });

    it(`${name} does not recreate a deleted RAMS from an old list`, () => {
      saveOrgScoped(PROJECT_DOC_KEYS.rams, []);
      expect(() => persist(report, [original])).toThrow(/changed|removed/i);
      expect(load(PROJECT_DOC_KEYS.rams, [])).toEqual([]);
    });

    it.each([
      { status: "issued" }, { documentStatus: "approved" }, { status: "issued", documentStatus: "draft" },
      { signed: true }, { operativeSignatures: { worker: { signedAt: "2026-10-01" } } },
      { signatureEvents: [{ action: "approval_signed" }] }, { clientApproval: { at: "2026-10-01" } },
    ])(`${name} protects released or signed content: %j`, (evidence) => {
      const locked = { ...original, ...evidence };
      saveOrgScoped(PROJECT_DOC_KEYS.rams, [locked]);
      expect(() => persist(report, [locked])).toThrow(/unsigned draft/i);
      expect(load(PROJECT_DOC_KEYS.rams, [])).toEqual([locked]);
    });

    it(`${name} reports failed persistence`, () => {
      const setItem = Storage.prototype.setItem;
      vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
        if (key.startsWith("rams_builder_docs_")) throw new DOMException("Full", "QuotaExceededError");
        return setItem.call(this, key, value);
      });
      expect(() => persist(report, [original])).toThrow(/could not be saved/i);
      expect(load(PROJECT_DOC_KEYS.rams, [])).toEqual([original]);
    });
  }

  it("does not substitute another document when an explicit RAMS link was deleted", () => {
    const other = { ...original, id: "r2" };
    expect(resolveRamsForSurvey(report, [other])).toBeNull();
    expect(resolveRamsForSurvey(report, [{ ...original, deletedAt: "2026-10-01" }, other])).toBeNull();
  });

  it("does not target another project through an old link", () => {
    const elsewhere = { ...original, projectId: "p2" };
    expect(resolveRamsForSurvey(report, [elsewhere])).toBeNull();
  });

  it("preserves unrelated new records and accumulates two survey appendices on the same RAMS", () => {
    const unrelated = { id: "other", title: "New unrelated RAMS" };
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [original, unrelated]);
    const outcome = batchAppendFinalSurveysToRams([report, { ...report, id: "s2", ref: "SR-2" }], [original]);
    expect(outcome.results.every((result) => result.ok)).toBe(true);
    const stored = load(PROJECT_DOC_KEYS.rams, []);
    expect(stored.find((doc) => doc.id === "other")).toEqual(unrelated);
    expect(stored.find((doc) => doc.id === "r1").linkedSurveyIds).toEqual(["s1", "s2"]);
    expect(outcome.ramsList).toEqual(stored);
  });

  it("reports partial batch persistence accurately and retains existing RAMS", () => {
    const second = { ...original, id: "r2" };
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [original, second]);
    const setItem = Storage.prototype.setItem;
    let writes = 0;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      if (key.startsWith("rams_builder_docs_") && ++writes === 2) throw new DOMException("Full", "QuotaExceededError");
      return setItem.call(this, key, value);
    });
    const outcome = batchAppendFinalSurveysToRams([report, { ...report, id: "s2", linkedRamsId: "r2" }], [original, second]);
    expect(outcome.results.map((result) => result.ok)).toEqual([true, false]);
    expect(outcome.results[1].reason).toBe("storage_failed");
    expect(load(PROJECT_DOC_KEYS.rams, []).find((doc) => doc.id === "r2")).toEqual(second);
    expect(outcome.ramsList).toEqual(load(PROJECT_DOC_KEYS.rams, []));
  });

  it("does not propagate deleted final surveys", () => {
    const outcome = batchAppendFinalSurveysToRams([{ ...report, deletedAt: "2026-10-01" }], [original]);
    expect(outcome.results).toEqual([]);
    expect(load(PROJECT_DOC_KEYS.rams, [])).toEqual([original]);
  });

  it("records the editor without assigning them as creator of a legacy document", () => {
    setAuthorshipUserCache({ id: "editor", email: "editor@example.test" });
    const hashed = { ...original, contentHash: "outdated-hash" };
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [hashed]);
    const next = persistSurveyAppendixToRams(report, [hashed]);
    expect(next.updatedById).toBe("editor");
    expect(next.createdById).toBeUndefined();
    expect(load(PROJECT_DOC_KEYS.rams, [])[0].contentHash).toBeUndefined();
  });

  it("blocks remaining batch writes after a workspace switch", () => {
    const second = { ...original, id: "r2" };
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [original, second]);
    const setItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (key, value) {
      const result = setItem.call(this, key, value);
      if (key === "rams_builder_docs_default") setOrgId("another-org");
      return result;
    });
    const outcome = batchAppendFinalSurveysToRams([report, { ...report, id: "s2", linkedRamsId: "r2" }], [original, second]);
    expect(outcome.results.map((result) => result.ok)).toEqual([true, false]);
    expect(outcome.results[1].reason).toBe("workspace_changed");
    expect(localStorage.getItem("rams_builder_docs_another-org")).toBeNull();
    expect(JSON.parse(localStorage.getItem("rams_builder_docs_default"))[1]).toEqual(second);
  });

  it("does not refresh away a conflicting snapshot for another batch target", () => {
    const second = { ...original, id: "r2" };
    const newer = { ...second, title: "Concurrent change" };
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [original, newer]);
    const outcome = batchAppendFinalSurveysToRams([report, { ...report, id: "s2", linkedRamsId: "r2" }], [original, second]);
    expect(outcome.results.map((result) => result.ok)).toEqual([true, false]);
    expect(outcome.results[1].reason).toBe("document_changed");
    expect(load(PROJECT_DOC_KEYS.rams, []).find((doc) => doc.id === "r2")).toEqual(newer);
  });

  it("updates an unsigned internal review with an issue-date stamp", () => {
    const review = { ...original, documentStatus: "internal_review", signatureEvents: [{ action: "issue_stamp" }] };
    saveOrgScoped(PROJECT_DOC_KEYS.rams, [review]);
    expect(persistSurveyAppendixToRams(report, [review]).linkedSurveyIds).toEqual([report.id]);
  });

  it("replaces the same literal appendix reference without duplicating it", () => {
    const special = { ...report, ref: "SR-[1].(A)+" };
    const first = appendSurveySummaryToRams(original, special).rams;
    const next = appendSurveySummaryToRams(first, { ...special, sections: { findings: "Revised findings" } }).rams;
    expect(next.handoverNotes.match(/--- Survey appendix/g)).toHaveLength(1);
    expect(next.handoverNotes).toContain("Revised findings");
    expect(next.handoverNotes).not.toContain("Survey findings");
  });

  it("replacing SR-1 does not erase the appendix for SR-10", () => {
    const withOther = appendSurveySummaryToRams(original, { ...report, id: "s10", ref: "SR-10" }).rams;
    const withBoth = appendSurveySummaryToRams(withOther, report).rams;
    expect(withBoth.handoverNotes).toContain("SR-10");
    expect(withBoth.handoverNotes).toContain("SR-1)");
  });

  it("preserves manual handover notes written after the generated appendix", () => {
    const first = appendSurveySummaryToRams(original, report).rams;
    first.handoverNotes += "\n\nManual handover: retain access restrictions.";
    const next = appendSurveySummaryToRams(first, { ...report, sections: { findings: "Updated findings" } }).rams;
    expect(next.handoverNotes).toContain("Manual handover: retain access restrictions.");
    expect(next.handoverNotes).not.toContain("Survey findings");
  });

  it("identifies the old appendix by survey ID when its reference changes", () => {
    const first = appendSurveySummaryToRams(original, report).rams;
    const next = appendSurveySummaryToRams(first, { ...report, ref: "SR-RENAMED" }).rams;
    expect(next.handoverNotes.match(/--- Survey appendix/g)).toHaveLength(1);
    expect(next.handoverNotes).toContain("SR-RENAMED");
    expect(next.surveyAppendices).toHaveLength(1);
  });
});
