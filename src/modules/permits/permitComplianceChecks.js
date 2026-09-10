import { getOrgMarketId } from "../../utils/orgMarket";
import {
  checklistIdsForMarket,
  evidenceFieldsForMarket,
  getComplianceProfile,
  UK_COMPLIANCE_MATRIX_VERSION,
} from "./ukComplianceMatrix";

function hasValue(v) {
  if (typeof v === "number") return Number.isFinite(v);
  return !!String(v ?? "").trim();
}

/** Field keys stay shared; statute names follow the active country workspace. */
function regulatoryFrameworksForMarket(marketId = "uk") {
  if (marketId === "pl") {
    return {
      briefing: "Kodeks pracy",
      she: "BHP",
      lifting: "UDT",
      equipment: "UDT",
      isolation: "SEP",
      wah: "BHP",
      hardStop: "Regulatory hard-stop failed: missing critical UDT/BHP evidence.",
    };
  }
  if (marketId === "au") {
    return {
      briefing: "WHS",
      she: "WHS",
      lifting: "WHS",
      equipment: "WHS",
      isolation: "WHS",
      wah: "WHS",
      hardStop: "Regulatory hard-stop failed: missing critical WHS evidence.",
    };
  }
  return {
    briefing: "CDM",
    she: "SHE",
    lifting: "LOLER",
    equipment: "PUWER",
    isolation: "PUWER",
    wah: "WAHR",
    hardStop: "Regulatory hard-stop failed: missing critical PUWER/LOLER/CDM/SHE evidence.",
  };
}

function regulatoryMatrixForType(type, marketId = "uk") {
  const t = String(type || "general");
  const fw = regulatoryFrameworksForMarket(marketId);
  const liftingLabel =
    marketId === "pl"
      ? "Plan podnoszenia i osoba kompetentna zapisane"
      : marketId === "au"
        ? "Lift plan and competent person recorded"
        : "Lift plan and appointed person recorded";
  const shared = [
    { id: "cdm_briefing", framework: fw.briefing, label: "Task briefing, competence and supervision confirmed", critical: true, field: "authorisedByRole" },
    { id: "she_check", framework: fw.she, label: "Start/end controls and emergency arrangements confirmed", critical: true, field: "briefingConfirmedAt" },
  ];
  if (t === "lifting") {
    return [
      ...shared,
      { id: "loler_plan", framework: fw.lifting, label: liftingLabel, critical: true, field: "appointedPerson" },
      { id: "puwer_equipment", framework: fw.equipment, label: "Lifting equipment fit-for-purpose evidence recorded", critical: true, field: "liftingEquipment" },
    ];
  }
  if (t === "electrical" || t === "cold_work" || t === "line_break") {
    return [
      ...shared,
      { id: "puwer_tools", framework: fw.isolation, label: "Work equipment / isolation tooling references recorded", critical: true, field: "authorisedPerson" },
    ];
  }
  if (t === "work_at_height") {
    return [
      ...shared,
      { id: "wahr_rescue", framework: fw.wah, label: "Rescue arrangement and access method defined", critical: true, field: "rescuePlan" },
    ];
  }
  return shared;
}

export function evaluatePermitCompliance(permit, checklistItems = [], options = {}) {
  const marketId = options.marketId || getOrgMarketId();
  const rawProfile =
    options?.profileOverride && typeof options.profileOverride === "object"
      ? options.profileOverride
      : getComplianceProfile(permit?.type, marketId);
  const profile = {
    ...rawProfile,
    legalRequiredChecklistIds: checklistIdsForMarket(
      rawProfile?.legalRequiredChecklistIds,
      permit?.type,
      marketId
    ),
    requiredEvidenceFields: evidenceFieldsForMarket(rawProfile?.requiredEvidenceFields, marketId),
  };
  const checklistState = permit?.checklist || {};
  const checklistIds = new Set(checklistItems.map((item) => item.id));

  const missingChecklist = profile.legalRequiredChecklistIds.filter((id) => {
    // Phantom UK IDs (e.g. excavation_8 on a 6-item Poland form) are not on this checklist.
    if (checklistIds.size > 0 && !checklistIds.has(id)) return false;
    if (!checklistIds.has(id)) return true;
    return !checklistState[id];
  });

  const missingEvidence = profile.requiredEvidenceFields.filter((key) => !hasValue(permit?.extraFields?.[key]));
  const start = permit?.startDateTime ? new Date(permit.startDateTime) : null;
  const end = permit?.endDateTime ? new Date(permit.endDateTime) : null;
  const invalidTimeRange = !start || !end || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start;

  const hardStops = [];
  if (missingChecklist.length) hardStops.push("Missing mandatory legal checklist controls.");
  if (missingEvidence.length) hardStops.push("Missing mandatory evidence fields.");
  if (invalidTimeRange) hardStops.push("Permit end time must be after start time.");
  const frameworks = regulatoryFrameworksForMarket(marketId);
  const regulatoryMatrix = regulatoryMatrixForType(permit?.type, marketId).map((row) => ({
    ...row,
    ok: hasValue(permit?.extraFields?.[row.field]) || hasValue(permit?.[row.field]),
  }));
  const missingCriticalRegulatory = regulatoryMatrix.filter((r) => r.critical && !r.ok);
  if (missingCriticalRegulatory.length) {
    hardStops.push(frameworks.hardStop);
  }

  const readyCount = [
    hasValue(permit?.description),
    hasValue(permit?.location),
    hasValue(permit?.issuedBy),
    hasValue(permit?.issuedTo),
    hasValue(permit?.startDateTime),
    hasValue(permit?.endDateTime),
    hasValue(permit?.authorisedByRole),
    hasValue(permit?.briefingConfirmedAt),
  ].filter(Boolean).length;
  const dataComplete = Number((readyCount / 8).toFixed(2));
  const legalReady = hardStops.length === 0;

  return {
    matrixVersion: permit?.matrixVersion || UK_COMPLIANCE_MATRIX_VERSION,
    profile,
    missingChecklist,
    missingEvidence,
    invalidTimeRange,
    hardStops,
    regulatoryMatrix,
    missingCriticalRegulatory,
    legalReady,
    dataComplete,
  };
}

