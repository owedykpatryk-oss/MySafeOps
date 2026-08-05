import { describe, it, expect } from "vitest";
import {
  latestSurveyForProject,
  mapSurveyQlToPermitPas128,
  mapSurveyTypeToPermitSurveyType,
  applySurveyLinkToPermitDraft,
  enrichPermitDraftFromProjectSurveys,
} from "./surveyPermitLink";

describe("surveyPermitLink", () => {
  const surveys = [
    { id: "s1", projectId: "p1", status: "draft", pas128Ql: "B3", surveyType: "utility_mapping_survey", ref: "SR-001", updatedAt: "2026-01-01" },
    { id: "s2", projectId: "p1", status: "final", pas128Ql: "B1", surveyType: "utility_mapping_survey", ref: "SR-002", updatedAt: "2026-02-01", utilitiesTable: [{ id: "u1" }] },
  ];

  it("picks latest final survey for project", () => {
    expect(latestSurveyForProject("p1", surveys)?.id).toBe("s2");
  });

  it("maps survey QL to permit PAS128 QL", () => {
    expect(mapSurveyQlToPermitPas128("B4")).toBe("QL-D");
    expect(mapSurveyQlToPermitPas128("B0")).toBe("QL-A");
  });

  it("maps utility survey type from QL band", () => {
    expect(mapSurveyTypeToPermitSurveyType({ surveyType: "eml_cat_survey", pas128Ql: "B3" })).toBe("C");
    expect(mapSurveyTypeToPermitSurveyType({ surveyType: "topographical_survey", pas128Ql: "B1" })).toBe("");
  });

  it("enriches excavation permit draft from linked survey", () => {
    const draft = applySurveyLinkToPermitDraft(
      { type: "excavation", projectId: "p1", extraFields: {} },
      {
        ...surveys[1],
        recommendations: "Hand dig within 500mm of marked services.",
      },
      { permitType: "excavation" }
    );
    expect(draft.extraFields.pas128QualityLevel).toBe("QL-B");
    expect(draft.extraFields.surveyDrawingRef).toBe("SR-002");
    expect(draft.extraFields.knownServices).toMatch(/utility row/i);
    expect(draft.linkedSurveyId).toBe("s2");
    expect(draft.notes).toMatch(/Linked survey: SR-002/);
    expect(draft.notes).toMatch(/Dig readiness:/);
    expect(draft.notes).toMatch(/Hand dig within 500mm/);
  });

  it("skips non-excavation permit types", () => {
    const draft = applySurveyLinkToPermitDraft({ type: "hot_work", extraFields: {} }, surveys[1]);
    expect(draft.extraFields?.pas128QualityLevel).toBeUndefined();
  });

  it("enrichPermitDraftFromProjectSurveys uses project surveys", () => {
    const out = enrichPermitDraftFromProjectSurveys(
      { type: "excavation", projectId: "p1", extraFields: {} },
      { id: "p1" },
      surveys
    );
    expect(out.extraFields.pas128QualityLevel).toBe("QL-B");
  });
});
