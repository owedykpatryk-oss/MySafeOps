/**
 * Bidirectional survey report ↔ RAMS sync (catalog-driven, no site/client specifics).
 */

import {
  enrichMethodologyWithPas128,
  getPlaybookSurveyPack,
  getSurveyAssumptionsProse,
  getSurveyCatalogEntry,
  getSurveyDeliverablesProse,
  getSurveyPackMeta,
  isUtilitySurveyType,
} from "../../utils/surveyContentCatalog";
import { getSurveyTypeTemplate } from "../../utils/surveyOrgTemplates";
import { buildPas128Foreword } from "./pas128ReportBoilerplate";
import { applyPas128MethodToReport } from "./pas128MethodPresets";

function shouldFill(current, overwrite) {
  return overwrite || !String(current || "").trim();
}

/** HSE / RAMS reference line for survey report — title + hold points. */
export function buildRamsHseExcerpt(ramsDoc) {
  if (!ramsDoc) return "";
  const title = ramsDoc.title || ramsDoc.documentNo || ramsDoc.documentTitle || "";
  const holds = (ramsDoc.surveyHoldPoints || []).slice(0, 4);
  const parts = [];
  if (title) parts.push(title);
  if (holds.length) parts.push(`Hold points: ${holds.join("; ")}`);
  return parts.join(" · ");
}

/**
 * Pull catalog-correct scope/method from linked RAMS (not raw 4.x RAMS prose into methodology).
 * @param {object} report
 * @param {object} ramsDoc
 * @param {{ overwrite?: boolean }} [options]
 */
export function syncSurveyReportFromRams(report, ramsDoc, { overwrite = false } = {}) {
  if (!ramsDoc) throw new Error("No RAMS document linked — select RAMS first.");

  const typeKey = ramsDoc.surveyWorkType || report.surveyType || "";
  const catalog = getSurveyCatalogEntry(typeKey);
  const pack = getPlaybookSurveyPack(typeKey);
  const meta = getSurveyPackMeta(typeKey);
  const template = getSurveyTypeTemplate(typeKey);

  let next = {
    ...report,
    linkedRamsId: ramsDoc.id,
    sections: { ...(report.sections || {}) },
    hseRefs: { ...(report.hseRefs || {}) },
    scopeFromRamsAt: new Date().toISOString(),
  };

  if (typeKey && shouldFill(next.surveyType, overwrite)) next.surveyType = typeKey;

  if (catalog?.defaultPas128Ql && shouldFill(next.pas128Ql, overwrite)) {
    next.pas128Ql = catalog.defaultPas128Ql;
  }
  if (meta.defaultPas128Method && shouldFill(next.pas128Method, overwrite)) {
    next.pas128Method = meta.defaultPas128Method;
  }

  const scopeText = (catalog?.scope || pack?.scope || ramsDoc.surveyDeliverables || "").trim();
  const methodologyText = enrichMethodologyWithPas128(
    typeKey,
    template?.methodology || catalog?.methodology || ""
  ).trim();
  const equipmentText = (template?.equipmentUsed || catalog?.equipmentUsed || "").trim();

  if (scopeText && shouldFill(next.sections.scope, overwrite)) next.sections.scope = scopeText;
  if (methodologyText && shouldFill(next.sections.methodology, overwrite)) next.sections.methodology = methodologyText;
  if (equipmentText && shouldFill(next.sections.equipmentUsed, overwrite)) next.sections.equipmentUsed = equipmentText;

  if (isUtilitySurveyType(typeKey) && shouldFill(next.sections.foreword, overwrite)) {
    next.sections.foreword = buildPas128Foreword({
      ...next,
      pas128Method: next.pas128Method,
      pas128Ql: next.pas128Ql,
    });
  }

  if (next.pas128Method) {
    next = applyPas128MethodToReport(next, next.pas128Method, { overwrite });
  }

  const excerpt = buildRamsHseExcerpt(ramsDoc);
  if (excerpt && shouldFill(next.hseRefs.ramsExcerpt, overwrite)) {
    next.hseRefs.ramsExcerpt = excerpt;
  }

  const standards = new Set(next.standardsCited || []);
  if (isUtilitySurveyType(typeKey)) {
    standards.add("pas128");
    standards.add("hsg47");
  }
  if (typeKey === "cctv_drainage_survey" || typeKey === "drainage_connectivity_survey") {
    standards.add("mscc5");
  }
  if (typeKey === "uav_aerial") standards.add("cap1686");
  if (typeKey === "asbestos_survey") standards.add("hsg264");
  next.standardsCited = [...standards];

  return next;
}

/** Build RAMS survey-pack patch from a survey report draft. */
export function buildRamsPatchFromSurveyReport(report) {
  const typeKey = String(report?.surveyType || "").trim();
  if (!typeKey) return null;
  const pack = getPlaybookSurveyPack(typeKey);
  if (!pack) return null;
  const meta = getSurveyPackMeta(typeKey);

  return {
    surveyWorkType: typeKey,
    surveyWorkTypeLabel: pack.label,
    surveyMethodStatement: pack.method,
    surveyDeliverables: report.sections?.scope?.trim() || getSurveyDeliverablesProse(typeKey),
    surveyAssumptions: getSurveyAssumptionsProse(typeKey),
    surveyRequiredPermits: meta.permitDependencies || [],
    surveyRequiredCerts: meta.requiredCerts || [],
    surveyEvidenceSet: meta.mandatoryEvidence || [],
    surveyHoldPoints: meta.holdPoints || [],
  };
}

/** Merge survey-derived pack metadata into an existing RAMS document. */
export function mergeRamsWithSurveyReport(ramsDoc, report) {
  const patch = buildRamsPatchFromSurveyReport(report);
  if (!patch || !ramsDoc) return ramsDoc;
  const linkedIds = [...new Set([...(ramsDoc.linkedSurveyIds || []), report.id].filter(Boolean))];
  return {
    ...ramsDoc,
    ...patch,
    linkedSurveyIds: linkedIds,
    ramsSyncedFromSurveyAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
