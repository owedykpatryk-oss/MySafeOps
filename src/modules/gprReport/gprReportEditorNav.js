/** Editor tab ids and completion checks for GPR reports. */
export const GPR_EDITOR_TABS = [
  { id: "setup", label: "Setup" },
  { id: "equipment", label: "Equipment" },
  { id: "ground", label: "Ground & env" },
  { id: "findings", label: "Findings" },
  { id: "narrative", label: "Narrative" },
  { id: "qa", label: "QA & print" },
];

export function gprTabComplete(report, tabId) {
  const r = report || {};
  switch (tabId) {
    case "setup":
      return Boolean(r.ref && r.surveyDate && r.surveyor && (r.projectId || r.siteAddress));
    case "equipment":
      return Boolean(
        (r.equipment?.[0]?.manufacturer || r.equipment?.[0]?.model) &&
          r.acquisition?.scanMode &&
          (r.velocityModel?.measuredVelocityCmNs || r.velocityModel?.assumedVelocityCmNs)
      );
    case "ground":
      return Boolean(r.groundConditions?.fetchedAt || r.groundConditions?.narrative) &&
        Boolean(r.environmental?.fetchedAt || r.environmental?.description);
    case "findings":
      return Boolean(
        r.anomalies?.length ||
          r.sections?.findings?.trim() ||
          r.scanPanels?.length ||
          r.chainageSegments?.length ||
          r.radargrams?.length
      );
    case "narrative":
      return Boolean(r.sections?.methodology?.trim() && r.sections?.limitations?.trim());
    case "qa":
      return Object.values(r.qaChecklist || {}).filter(Boolean).length >= 3;
    default:
      return false;
  }
}

export function gprOverallTabProgress(report) {
  const tabs = GPR_EDITOR_TABS;
  const done = tabs.filter((t) => gprTabComplete(report, t.id)).length;
  return { done, total: tabs.length };
}

export function firstIncompleteGprTab(report) {
  return GPR_EDITOR_TABS.find((t) => !gprTabComplete(report, t.id))?.id || null;
}
