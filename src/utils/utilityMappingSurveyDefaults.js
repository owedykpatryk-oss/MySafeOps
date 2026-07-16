/**
 * Utility Mapping survey report defaults — prose aligned to their PAS128 Word templates.
 * Seeded only for this organisation via surveyTypeTemplates overrides.
 */
import { saveSurveyTypeTemplateOverride } from "./surveyOrgTemplates";
import { canUseUtilityMappingExclusiveFeatures } from "./utilityMappingExclusive";

const EML_LIMITATIONS = [
  "The signal from a cable in a duct will be from wherever the cable is in the duct.",
  "A trace wire (if constructed) will be offset vertically or horizontally from the pipe.",
  "Signals can jump from asset to asset due to poor continuity (breaks, joints or repairs).",
  "Non-metallic clean water and gas pipes cannot be detected unless they have a detection strip; flexitrace/sonde may be used in accessible ducts.",
  "Plastic sections or repairs will interrupt the transmitted signal.",
  "HV/EHV cables can be so well balanced that they are hard to detect passively.",
  "For metallic pipes/cables, the location is given as the centre of the pipe.",
].join("\n");

const GPR_LIMITATIONS = [
  "Reinforcement bars, high ground water and made-up ground can limit penetration.",
  "The minimum detectable asset size diminishes with depth (approx. 10% rule).",
  "GPR detects the top surface of an asset; EML typically detects the centre of the metallic path.",
  "Acquisition is blind — at the time of scan the GPR has no positive identification of the target.",
  "GPR sometimes detects trench lines rather than the asset itself.",
  "Data quality depends on local ground conditions; penetration can vary from about 1 m to several metres.",
].join("\n");

export const UM_SURVEY_TYPE_DEFAULTS = {
  utility_mapping_survey: {
    scope:
      "Full underground utility survey of the agreed extent in accordance with PAS 128:2014 Specification for underground utility detection, verification and location (section 11.1), typically to Level B / methodology M2 unless otherwise stated.",
    methodology: `Workflow (Utility Mapping PAS128 M2):
1. Desktop review of statutory undertaker records (QL-D).
2. Electromagnetic Location (EML) survey — results marked with UV-degradable paint showing horizontal position; depth, material and diameter recorded where available (QL-B4 / B3 / B2).
3. Ground Penetrating Radar (GPR) survey — real-time interpretation on site unless post-processing (M2P) is specified; upgrade to QL-B1 where EML and GPR positions agree within PAS128 tolerance.
4. Topographical capture of mark-ups and metadata with total station / GNSS referenced to OSGB36.
5. Digitisation to CAD, QC against utility records, then final QC before issue.

Detection methods: EML and GPR. Control typically via robotic total station and GNSS RTK.`,
    equipmentUsed:
      "EML: CAT & Genny (or equivalent) with induction / connection / sonde as required.\nGPR: cart or array system suitable for the site surface.\nControl: robotic total station (e.g. Leica TS16) and GNSS RTK rover referenced to OSGB36.",
    recordsBoilerplate:
      "Statutory undertaker plans were obtained and reviewed before fieldwork. Assets shown on records but not detected are marked as TFR (taken from records) on the drawing where alignment can be inferred.",
    executiveSummaryTemplate:
      "This report presents the results of a PAS 128 underground utility survey carried out by Utility Mapping for the client named on the document control page. Detection used Electromagnetic Location (EML) and Ground Penetrating Radar (GPR). Quality levels are assigned in accordance with PAS 128 Table 2 / Level B requirements.",
    recommendationsTemplate:
      "Treat all undetected record alignments as live until proven otherwise. Use trial holes / vacuum excavation before mechanical dig. Refer to the CAD drawing for QL coding and TFR notes. Review EML and GPR limitations before design or excavation.",
    defaultLimitationKeys: ["eml_duct_offset", "gpr_penetration", "records_accuracy", "access_constraints"],
    defaultDeliverables: [
      "PAS128 Utility Survey Report (methods, extent, limitations, findings)",
      "CAD drawing in 2D and 3D (PDF extract as required)",
      "Geo-photo evidence of mark-ups, constraints and chambers (where lifted)",
    ],
  },
  gpr_survey: {
    scope:
      "Ground Penetrating Radar survey of the agreed corridor / areas, with interpretation suitable for PAS 128 utility mapping or as a standalone GPR deliverable.",
    methodology:
      "Calibration plate check before acquisition. Transects / array passes as per site plan. Real-time or post-processed interpretation. Anomalies cross-checked against EML and records where available.",
    equipmentUsed: "GPR system with antenna frequency suited to target depth; GNSS/total station for positioning.",
    executiveSummaryTemplate:
      "GPR survey completed for the stated extent. Anomalies and interpreted utilities are summarised with confidence levels; raw data archived for client QA.",
    recommendationsTemplate:
      "Verify critical anomalies with EML or trial excavation before dig. Ground conditions may limit penetration — see limitations.",
    defaultDeliverables: [
      "GPR report with acquisition parameters and anomaly table",
      "Raw data archive reference",
      "Calibration / QA note",
    ],
  },
  service_clearance_survey: {
    scope:
      "Service clearance mark-up ahead of ground investigation or excavation — records review, walkover, EML/GPR as required, and clear paint marks for the GI contractor.",
    methodology:
      "Review records and GI dig locations. Walkover and EML/GPR clearance. Mark clear / caution zones on the ground. Photograph mark-ups and brief the GI contractor.",
    equipmentUsed: "CAT & Genny; GPR where required; GNSS for mark coordinates if requested.",
    executiveSummaryTemplate:
      "Service clearance completed for the listed GI / excavation locations. Clearance marks and residual risks are recorded for permit-to-dig interface.",
    recommendationsTemplate:
      "Do not dig outside marked clearance without further survey. Maintain exclusion around TFR / unknown targets.",
    defaultDeliverables: [
      "Clearance mark-up photos",
      "Records search note",
      "Handover briefing record to GI contractor",
    ],
  },
};

/** Seed org surveyTypeTemplates for Utility Mapping only (idempotent merge). */
export function seedUtilityMappingSurveyTemplates() {
  if (!canUseUtilityMappingExclusiveFeatures()) return { ok: false, seeded: [] };
  const seeded = [];
  for (const [key, fields] of Object.entries(UM_SURVEY_TYPE_DEFAULTS)) {
    saveSurveyTypeTemplateOverride(key, fields);
    seeded.push(key);
  }
  return { ok: true, seeded };
}

export { EML_LIMITATIONS, GPR_LIMITATIONS };
