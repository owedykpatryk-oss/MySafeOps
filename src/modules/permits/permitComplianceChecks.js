import { getComplianceProfile, UK_COMPLIANCE_MATRIX_VERSION } from "./ukComplianceMatrix";

function hasValue(v) {
  if (typeof v === "number") return Number.isFinite(v);
  return !!String(v ?? "").trim();
}

function regulatoryMatrixForType(type) {
  const t = String(type || "general");
  const shared = [
    { id: "cdm_briefing", framework: "CDM", label: "Task briefing, competence and supervision confirmed", critical: true, field: "authorisedByRole" },
    { id: "she_check", framework: "SHE", label: "Start/end controls and emergency arrangements confirmed", critical: true, field: "briefingConfirmedAt" },
  ];
  if (t === "lifting") {
    return [
      ...shared,
      { id: "loler_plan", framework: "LOLER", label: "Lift plan and appointed person recorded", critical: true, field: "appointedPerson" },
      { id: "puwer_equipment", framework: "PUWER", label: "Lifting equipment fit-for-purpose evidence recorded", critical: true, field: "liftingEquipment" },
    ];
  }
  if (t === "electrical" || t === "cold_work" || t === "line_break") {
    return [
      ...shared,
      { id: "puwer_tools", framework: "PUWER", label: "Work equipment / isolation tooling references recorded", critical: true, field: "authorisedPerson" },
    ];
  }
  if (t === "work_at_height") {
    return [
      ...shared,
      { id: "wahr_rescue", framework: "WAHR", label: "Rescue arrangement and access method defined", critical: true, field: "rescuePlan" },
    ];
  }
  return shared;
}

export function evaluatePermitCompliance(permit, checklistItems = []) {
  const profile = getComplianceProfile(permit?.type);
  const checklistState = permit?.checklist || {};
  const checklistIds = new Set(checklistItems.map((item) => item.id));

  const missingChecklist = profile.legalRequiredChecklistIds.filter((id) => {
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
  const regulatoryMatrix = regulatoryMatrixForType(permit?.type).map((row) => ({
    ...row,
    ok: hasValue(permit?.extraFields?.[row.field]) || hasValue(permit?.[row.field]),
  }));
  const missingCriticalRegulatory = regulatoryMatrix.filter((r) => r.critical && !r.ok);
  if (missingCriticalRegulatory.length) {
    hardStops.push("Regulatory hard-stop failed: missing critical PUWER/LOLER/CDM/SHE evidence.");
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

