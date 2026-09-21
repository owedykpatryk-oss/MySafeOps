/**
 * One-click fixes surfaced from the survey blockers panel.
 */

import { UTILITY_RECORDS_PRESETS } from "./surveyReportConstants";
import { catalogDefaultDeliverables } from "../../utils/surveyContentCatalog";
import { seedUtilitiesTableFromCad } from "../../utils/surveyDxfAnalyzer";

export const SURVEY_AUTOFIX_ACTIONS = [
  { id: "records_pas128", label: "Apply PAS128 records preset", tab: "records", anchor: "records" },
  { id: "deliverables_default", label: "Add default deliverables", tab: "scope", anchor: "deliverables" },
  { id: "calibration_template", label: "Add calibration row template", tab: "professional", anchor: "calibration" },
  { id: "limitations_typical", label: "Apply typical utility limitations", tab: "limitations", anchor: "limitations" },
  { id: "utilities_from_cad", label: "Seed utilities from CAD", tab: "findings", anchor: "cad-import" },
];

const UTILITY_TYPES = new Set(["utility_mapping_survey", "eml_cat_survey", "gpr_survey"]);

/**
 * @param {string} fixId
 * @param {object} report
 * @returns {object|null} patched report or null if not applicable
 */
export function applySurveyAutofix(fixId, report) {
  if (!report || !fixId) return null;
  const now = new Date().toISOString();

  if (fixId === "records_pas128") {
    const preset = UTILITY_RECORDS_PRESETS.pas128_typical;
    if (!preset) return null;
    return {
      ...report,
      utilityRecords: {
        ...(report.utilityRecords || {}),
        sourcesConsulted: [...preset.sources],
        outcomes: [...preset.outcomes],
        informationGaps: [...preset.gaps],
      },
      updatedAt: now,
    };
  }

  if (fixId === "deliverables_default") {
    if ((report.deliverables || []).length) return null;
    const rows = catalogDefaultDeliverables(report.surveyType);
    if (!rows?.length) return null;
    return { ...report, deliverables: rows, updatedAt: now };
  }

  if (fixId === "calibration_template") {
    if ((report.equipmentCalibration || []).length) return null;
    return {
      ...report,
      equipmentCalibration: [
        {
          id: `cal_${Date.now()}`,
          instrument: report.surveyType === "utility_mapping_survey" ? "Cable locator / GPR" : "Total station / GNSS",
          serialNo: "",
          calibrationDue: "",
          status: "in_date",
        },
      ],
      updatedAt: now,
    };
  }

  if (fixId === "limitations_typical" && UTILITY_TYPES.has(report.surveyType)) {
    const keys = ["eml_confidence", "services_live", "site_access_restricted"];
    const merged = [...new Set([...(report.limitationKeys || []), ...keys])];
    return { ...report, limitationKeys: merged, updatedAt: now };
  }

  if (fixId === "utilities_from_cad") {
    return seedUtilitiesTableFromCad(report, { replaceCadRows: true });
  }

  return null;
}

/** Suggest autofix buttons based on report state. */
export function suggestSurveyAutofixes(report) {
  const out = [];
  if (!(report?.utilityRecords?.sourcesConsulted || []).length && UTILITY_TYPES.has(report?.surveyType)) {
    out.push("records_pas128");
  }
  if (!(report?.deliverables || []).length && report?.surveyType) out.push("deliverables_default");
  if (!(report?.equipmentCalibration || []).length) out.push("calibration_template");
  if (UTILITY_TYPES.has(report?.surveyType) && !(report?.limitationKeys || []).length) {
    out.push("limitations_typical");
  }
  const hasCad = Array.isArray(report?.cadImport?.summary) && report.cadImport.summary.some((r) => (Number(r.lengthM) || 0) > 0);
  const cadUtils = (report?.utilitiesTable || []).filter((u) => String(u?.notes || "").includes("CAD layer")).length;
  if (hasCad && cadUtils === 0) out.push("utilities_from_cad");
  return out;
}
