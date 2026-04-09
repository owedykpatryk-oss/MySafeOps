import { loadOrgScoped as load, saveOrgScoped as save } from "../../utils/orgStorage";

const INCIDENTS_KEY = "permit_incidents_v1";

export const INCIDENT_SEVERITY = ["near_miss", "minor", "major", "environmental", "utility_strike", "confined_space", "property_damage"];

export function listPermitIncidents() {
  const rows = load(INCIDENTS_KEY, []);
  return Array.isArray(rows) ? rows : [];
}

export function savePermitIncidents(rows) {
  save(INCIDENTS_KEY, Array.isArray(rows) ? rows : []);
}

export function incidentsForPermit(permitId, rows = listPermitIncidents()) {
  return (rows || []).filter((x) => x?.permitId === permitId);
}

export function createPermitIncident({
  permit,
  linkedRamsId = "",
  title = "",
  severity = "near_miss",
  summary = "",
  media = [],
  planPin = null,
  createdBy = "",
}) {
  const now = new Date().toISOString();
  return {
    id: `inc_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    permitId: permit?.id || "",
    linkedRamsId: linkedRamsId || permit?.linkedRamsId || "",
    projectId: permit?.projectId || "",
    location: permit?.location || "",
    permitType: permit?.type || "general",
    title: String(title || "Incident").slice(0, 120),
    severity: INCIDENT_SEVERITY.includes(severity) ? severity : "near_miss",
    summary: String(summary || "").slice(0, 1200),
    media: Array.isArray(media) ? media.slice(0, 12) : [],
    planPin: planPin && planPin.planId ? planPin : null,
    correctiveActions: [],
    timeline: [{ at: now, by: createdBy || "unknown", type: "created", note: "Incident logged from permit workflow." }],
    status: "open",
    createdAt: now,
    updatedAt: now,
  };
}

export function addCorrectiveAction(incident, { owner = "", dueAt = "", note = "" }) {
  const now = new Date().toISOString();
  const action = {
    id: `ca_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    owner: String(owner || "").slice(0, 120),
    dueAt: String(dueAt || ""),
    note: String(note || "").slice(0, 500),
    status: "open",
    createdAt: now,
    closedAt: "",
  };
  return {
    ...incident,
    correctiveActions: [...(incident.correctiveActions || []), action],
    timeline: [...(incident.timeline || []), { at: now, by: owner || "unknown", type: "corrective_action_added", note: action.note || "Corrective action added." }],
    updatedAt: now,
  };
}

export function closeCorrectiveAction(incident, actionId, closedBy = "") {
  const now = new Date().toISOString();
  const actions = (incident.correctiveActions || []).map((a) =>
    a.id === actionId ? { ...a, status: "closed", closedAt: now } : a
  );
  return {
    ...incident,
    correctiveActions: actions,
    timeline: [...(incident.timeline || []), { at: now, by: closedBy || "unknown", type: "corrective_action_closed", note: actionId }],
    updatedAt: now,
  };
}

