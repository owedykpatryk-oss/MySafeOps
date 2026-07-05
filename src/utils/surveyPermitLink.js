/**
 * Link latest project survey report to excavation / ground disturbance permit fields (PAS 128).
 */

/** Survey report QL (B4–B0) → permit dig QL (QL-D–QL-A). */
export const SURVEY_QL_TO_PERMIT_QL = {
  B4: "QL-D",
  B3: "QL-C",
  B2: "QL-B",
  B1: "QL-B",
  B0: "QL-A",
};

const UTILITY_SURVEY_TYPES = new Set(["utility_mapping_survey", "eml_cat_survey", "gpr_survey"]);

export function latestSurveyForProject(projectId, surveys = []) {
  const pid = String(projectId || "").trim();
  if (!pid) return null;
  const rows = (Array.isArray(surveys) ? surveys : []).filter((s) => String(s.projectId || "") === pid);
  if (!rows.length) return null;
  return [...rows].sort((a, b) => {
    const score = (r) => (r.status === "final" ? 2 : r.status === "draft" ? 1 : 0);
    const ds = score(b) - score(a);
    if (ds !== 0) return ds;
    return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
  })[0];
}

export function mapSurveyQlToPermitPas128(surveyQl) {
  const key = String(surveyQl || "").trim().toUpperCase();
  return SURVEY_QL_TO_PERMIT_QL[key] || "";
}

export function mapSurveyTypeToPermitSurveyType(survey) {
  if (!survey) return "";
  const type = String(survey.surveyType || "").trim();
  if (!UTILITY_SURVEY_TYPES.has(type)) return "";
  const ql = String(survey.pas128Ql || "").trim().toUpperCase();
  if (ql === "B0") return "A";
  if (["B1", "B2"].includes(ql)) return "B1";
  if (ql === "B3") return "C";
  if (ql === "B4") return "D";
  return "B1";
}

export function surveyToPermitDigExtras(survey) {
  if (!survey) return {};
  const ref = String(survey.ref || survey.title || "").trim();
  const utilityCount = Array.isArray(survey.utilitiesTable) ? survey.utilitiesTable.length : 0;
  const out = {
    pas128QualityLevel: mapSurveyQlToPermitPas128(survey.pas128Ql),
    pas128SurveyType: mapSurveyTypeToPermitSurveyType(survey),
    surveyDrawingRef: ref,
  };
  if (utilityCount > 0) {
    out.knownServices = `${utilityCount} utility row(s) from survey ${ref || survey.id || ""}`.trim();
  }
  return out;
}

export function applySurveyLinkToPermitDraft(draft, survey, { permitType } = {}) {
  if (!draft || !survey) return draft;
  const type = String(permitType || draft.type || "").trim();
  if (type !== "excavation" && type !== "ground_disturbance") return draft;
  const extras = surveyToPermitDigExtras(survey);
  const extraFields = { ...(draft.extraFields || {}) };
  Object.entries(extras).forEach(([k, v]) => {
    if (v != null && String(v).trim()) extraFields[k] = v;
  });
  return {
    ...draft,
    extraFields,
    linkedSurveyId: survey.id || draft.linkedSurveyId,
    notes: draft.notes
      ? `${draft.notes}\n\nLinked survey: ${survey.ref || survey.id}`
      : `Linked survey: ${survey.ref || survey.id}`,
  };
}

export function enrichPermitDraftFromProjectSurveys(draft, project, surveys = []) {
  if (!draft?.projectId && !project?.id) return draft;
  const survey = latestSurveyForProject(draft.projectId || project?.id, surveys);
  return applySurveyLinkToPermitDraft(draft, survey, { permitType: draft.type });
}
