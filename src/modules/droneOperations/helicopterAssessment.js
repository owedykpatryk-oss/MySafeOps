// Bind the recorded decision to operational content, independent of object key order.
// This is a content comparison, not a signature or proof of operator identity.
export function operatorDecisionFingerprint(m) {
  const ignored = new Set([
    "operatorRelease",
    "approval",
    "issues",
    "history",
    "updatedAt",
    "editToken",
    "recheckRequired",
    "records",
    "catalogue",
    "sources",
    "checklistDefinitions",
    "ruleVersion",
    "branding",
    "nextActions",
    "fieldJournal",
  ]);
  const ordered = (value) =>
    Array.isArray(value)
      ? value.map(ordered)
      : value && typeof value === "object"
        ? Object.fromEntries(
            Object.keys(value)
              .sort()
              .map((key) => [key, ordered(value[key])])
          )
        : value;
  return JSON.stringify(ordered(Object.fromEntries(Object.entries(m).filter(([key]) => !ignored.has(key)))));
}

export function helicopterActions(m, context, window, now) {
  const actions = [],
    add = (key, text) => actions.push({ key, text }),
    h = m.helicopter || {};
  if (!["own", "contracted"].includes(h.relationship)) add("operator", "Choose own or contracted aviation operator.");
  for (const [key, label] of [
    ["operatorName", "aviation operator"],
    ["certificateReference", "Aerial Work Certificate and verified scope reference"],
    ["pilotName", "pilot in command"],
    ["aircraftRegistration", "aircraft registration"],
    ["aircraftType", "helicopter type"],
    ["sensorDescription", "survey sensor and installation"],
    ["taskSpecialists", "task specialists and duties"],
    ["operatorManualReference", "applicable operator manual"],
    ["loadingReference", "operator loading, fuel and maintenance confirmation"],
    ["landingPlan", "landing and ground access plan"],
    ["communications", "communications and stop-work arrangements"],
    ["remoteAreaPlan", "remote-area / emergency assistance arrangements"],
  ]) {
    if (!String(h[key] || "").trim()) add("operator", `Record the ${label}.`);
  }
  if (!m.observerId || !(context.workers || []).some((w) => w.id === m.observerId && !w.deletedAt))
    add("survey-lead", "Select the survey lead from People.");
  if (
    h.relationship === "own" &&
    (!m.pilotId || !(context.workers || []).some((w) => w.id === m.pilotId && !w.deletedAt))
  )
    add("pilot", "Select the organisation pilot from People.");
  if (
    h.relationship === "own" &&
    (!m.assetId || !(context.assets || []).some((a) => a.id === m.assetId && !a.deletedAt))
  )
    add(
      "aircraft-record",
      "Link the organisation aircraft record in Plant; operator airworthiness evidence remains separate."
    );
  if (!Number.isFinite(Number(m.heightM)) || Number(m.heightM) <= 0)
    add("height", "Record planned operating height and its reference from the operator.");
  const r = m.operatorRelease;
  if (
    !r ||
    r.missionRevision !== m.revision ||
    r.missionFingerprint !== operatorDecisionFingerprint(m) ||
    !r.by?.trim() ||
    !r.reference?.trim() ||
    !r.conditions?.trim() ||
    !Number.isFinite(Date.parse(r.at)) ||
    Date.parse(r.at) > now ||
    !Number.isFinite(Date.parse(r.validUntil)) ||
    Date.parse(r.validUntil) <= now ||
    (window && Date.parse(r.validUntil) < Date.parse(window.end))
  )
    add(
      "operator-release",
      "Record the named operator/pilot decision and conditions for the current mission, evidence and checks, valid for the full operating window."
    );
  return actions;
}
