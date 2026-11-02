import { EQUIPMENT_PROFILES, PAYLOADS, MISSION_TEMPLATES } from "./droneLibrary.js";
import { geometrySummary } from "./droneGeometry.js";
import { evaluateForecast } from "./droneWeatherAssessment.js";
import {
  regionOf,
  kindOf,
  isHelicopter,
  missionTimeZone,
  regionalEvidence,
  regionalChecklist,
  regionalSources,
  ruleVersion,
  manualApplies,
  approvedStatus,
  UK_PATHWAYS,
  AU_PATHWAYS,
  HELICOPTER_PATHWAYS,
  pointInRegion,
} from "./droneRegions.js";
import { zonedToUtc } from "./droneTime.js";
import { helicopterActions, operatorDecisionFingerprint } from "./helicopterAssessment.js";
import { contextChecklist, automationActions } from "./documentAutomation.js";
import { validateFieldJournal } from "./fieldSession.js";

export const EVIDENCE_KINDS = [
  [
    "airspace",
    "Airspace and NOTAM briefing",
    "Review the whole flight area, buffers, height references and full time window. Record FRZ, temporary restrictions and permission actions.",
  ],
  [
    "weather",
    "Weather assessment",
    "Review representative points, forecast age and height, gusts and confirmed aircraft / payload / operator limits.",
  ],
  [
    "pathway",
    "Operating category and authorisation",
    "Confirm Open subcategory or Specific authorisation conditions, aircraft class / legacy status, actual mass, VLOS/BVLOS, Remote ID and lighting.",
  ],
  [
    "competence",
    "Pilot and crew competence",
    "Confirm current qualifications, currency, Operator ID / Flyer ID as applicable and assigned roles.",
  ],
  ["insurance", "Insurance", "Record policy, scope, validity and insurer."],
  [
    "permission",
    "Land and airspace permissions",
    "Record each applicable consent, issuer/contact, conditions and validity. Land access is separate from airspace consent.",
  ],
  [
    "equipment",
    "Aircraft, payload and maintenance",
    "Confirm actual serial number, mass, configuration compatibility, battery condition, inspections and no unresolved defects.",
  ],
  [
    "rams",
    "RAMS and emergency arrangements",
    "Review linked RAMS, access, people, roads/rail, wires, lost link/GNSS, batteries/fire, weather, privacy and confirmed emergency contacts.",
  ],
  [
    "manual",
    "Operations Manual review",
    "Confirm the appropriate manual version and whether its scope and procedures cover this mission.",
  ],
];
const clone = (value) => JSON.parse(JSON.stringify(value));
export const evidenceKinds = (m) => regionalEvidence(m, EVIDENCE_KINDS);
export const droneId = () => crypto.randomUUID();
export function setupMissionDefaults(setup) {
  return Object.fromEntries(
    ["assetId", "payloadAssetId", "profileId", "payloadId", "pilotId", "useRtk", "limits"]
      .filter((k) => setup?.[k] !== undefined)
      .map((k) => [k, clone(setup[k])])
  );
}
export function applyMissionMutation(rows, next) {
  const previous = rows.find((m) => m.id === next.id);
  if (previous && previous.editToken !== next.editToken)
    throw new Error("Mission changed while this action was running. Review the current version and retry.");
  const journalError = validateFieldJournal(
    previous?.fieldJournal,
    next.fieldJournal,
    next.fieldJournal?.at(-1)?.userId,
    next.revision
  );
  if (journalError) throw new Error("Session history must be preserved. Reload the current mission and retry.");
  const saved = { ...next, editToken: droneId() };
  if (saved.operatorRelease && saved.operatorRelease.missionFingerprint !== operatorDecisionFingerprint(saved))
    saved.operatorRelease = null;
  return { saved, rows: previous ? rows.map((m) => (m.id === next.id ? saved : m)) : [saved, ...rows] };
}
export function matchesApprovedSnapshot(m, snapshot) {
  const ignored = new Set([
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
  return (
    Boolean(snapshot) &&
    [...new Set([...Object.keys(m), ...Object.keys(snapshot)])]
      .filter((k) => !ignored.has(k))
      .every((k) => JSON.stringify(m[k]) === JSON.stringify(snapshot[k]))
  );
}
export function blankMission(defaults = {}) {
  return {
    id: droneId(),
    title: "New drone survey",
    regionCode: "uk",
    aircraftKind: "drone",
    timeZone: "Europe/London",
    helicopter: {},
    operatorRelease: null,
    revision: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    projectId: "",
    client: "",
    location: "",
    postcode: "",
    country: "",
    start: "",
    end: "",
    timeOccurrence: "",
    pilotId: "",
    observerId: "",
    assetId: "",
    payloadAssetId: "",
    profileId: "",
    payloadId: "",
    templateId: "topo",
    category: "",
    classMark: "",
    massKg: "",
    heightM: "",
    heightReference: "AGL",
    flightMode: "VLOS",
    useRtk: false,
    boundary: null,
    flightArea: null,
    contingencyArea: null,
    safetyArea: null,
    takeoff: null,
    landing: null,
    alternateLanding: null,
    fieldJournal: [],
    corridorWidthM: "",
    corridorConfirmed: false,
    crs: "",
    verticalDatum: "",
    qa: "",
    deliverables: "",
    emergency: "",
    ramsId: "",
    manualId: "",
    operatorId: "",
    limits: { wind: "", gust: "", rain: "", minTemp: "", maxTemp: "", visibility: "", confirmed: false },
    evidence: [],
    checklist: {},
    weather: null,
    approval: null,
    issues: [],
    history: [],
    cancelled: false,
    ...clone(defaults),
  };
}
const CRITICAL = new Set([
  "workContexts",
  "regionCode",
  "aircraftKind",
  "timeZone",
  "helicopter",
  "projectId",
  "start",
  "end",
  "timeOccurrence",
  "pilotId",
  "observerId",
  "assetId",
  "payloadAssetId",
  "profileId",
  "payloadId",
  "templateId",
  "category",
  "classMark",
  "massKg",
  "heightM",
  "heightReference",
  "flightMode",
  "useRtk",
  "boundary",
  "flightArea",
  "contingencyArea",
  "safetyArea",
  "takeoff",
  "landing",
  "alternateLanding",
  "corridorWidthM",
  "corridorConfirmed",
  "limits",
  "ramsId",
  "manualId",
  "operatorId",
]);
export function editMission(m, patch, actor = "Workspace user") {
  if (patch.aircraftKind && patch.aircraftKind !== kindOf(m)) patch = { ...patch, payloadAssetId: "" };
  const changed = Object.keys(patch).filter((k) => JSON.stringify(m[k]) !== JSON.stringify(patch[k]));
  if (!changed.length) return m;
  const critical = changed.some((k) => CRITICAL.has(k));
  const now = new Date().toISOString();
  return {
    ...m,
    ...patch,
    revision: m.revision + 1,
    updatedAt: now,
    approval: null,
    recheckRequired: Boolean(m.approval || m.recheckRequired),
    ...(critical ? { evidence: [], checklist: {}, weather: null, operatorRelease: null } : {}),
    history: [
      ...(m.history || []),
      { at: now, actor, action: `Updated ${changed.join(", ")}${critical ? "; dependent checks reset" : ""}` },
    ].slice(-150),
  };
}
export function copyMission(m) {
  return {
    ...blankMission(),
    ...clone(m),
    id: droneId(),
    title: `${m.title} (copy)`,
    limits: { ...clone(m.limits || {}), confirmed: false },
    corridorConfirmed: false,
    fieldJournal: [],
    operatorRelease: null,
    revision: 1,
    start: "",
    end: "",
    evidence: [],
    checklist: {},
    weather: null,
    approval: null,
    issues: [],
    history: [],
    cancelled: false,
    recheckRequired: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}
export function londonToUtc(value, occurrence = "") {
  return zonedToUtc(value, "Europe/London", occurrence);
}
export function missionWindow(m) {
  const zone = missionTimeZone(m);
  const start = zonedToUtc(m.start, zone, m.timeOccurrence),
    end = zonedToUtc(m.end, zone, m.timeOccurrence);
  if (Date.parse(end) <= Date.parse(start)) throw new Error("End must be after start.");
  if (Date.parse(end) - Date.parse(start) > 24 * 3600000)
    throw new Error("Use one mission per operating window (maximum 24 hours).");
  return { start, end };
}
export function applicableChecklist(m, library = {}) {
  const payload = [...PAYLOADS, ...(library.payloads || [])].find((p) => p.id === m.payloadId);
  return [
    ...regionalChecklist(m),
    ...contextChecklist(m),
    ...(library.checklists || []).filter(
      (c) => regionOf(c) === regionOf(m) && (c.aircraftKind || "drone") === kindOf(m)
    ),
  ].filter(
    (i) =>
      !i.condition ||
      (i.condition === "rtk" && m.useRtk) ||
      (i.condition === "lidar" && payload?.capabilities?.includes("lidar"))
  );
}
export function addEvidence(m, e, now = Date.now()) {
  if (
    !EVIDENCE_KINDS.some(([id]) => id === e.kind) ||
    !e.source?.trim() ||
    !e.note?.trim() ||
    !e.reviewer?.trim() ||
    !["reviewed", "awaiting_permission", "action_required"].includes(e.result)
  )
    throw new Error("Record the check type, source, reviewer, result and findings.");
  if (
    !Number.isFinite(Date.parse(e.checkedAt)) ||
    Date.parse(e.checkedAt) > now ||
    !Number.isFinite(Date.parse(e.validUntil)) ||
    Date.parse(e.validUntil) <= Date.parse(e.checkedAt)
  )
    throw new Error("Record a valid check time and expiry after the check; checks cannot be future-dated.");
  const evidence = { ...e, id: droneId(), missionRevision: m.revision, ruleVersion: ruleVersion(m) };
  return {
    ...m,
    evidence: [...(m.evidence || []).filter((x) => x.kind !== e.kind), evidence],
    approval: null,
    operatorRelease: null,
    updatedAt: new Date(now).toISOString(),
    history: [
      ...(m.history || []),
      { at: new Date(now).toISOString(), actor: e.reviewer, action: `Recorded ${e.kind}: ${e.result}` },
    ].slice(-150),
  };
}
export function recordFingerprint(context, m) {
  const find = (key, id) => (context[key] || []).find((r) => r.id === id && !r.deletedAt) || null;
  return JSON.stringify({
    project: find("projects", m.projectId),
    pilot: find("workers", m.pilotId),
    observer: find("workers", m.observerId),
    asset: find("assets", m.assetId),
    payloadAsset: find("assets", m.payloadAssetId),
    rams: find("rams", m.ramsId),
    manual: find("manuals", m.manualId),
  });
}
export function assessMission(m, context = {}, now = Date.now(), offline = false) {
  const actions = automationActions(m, now, context);
  const add = (key, text) => actions.push({ key, text });
  const helicopter = isHelicopter(m),
    au = regionOf(m) === "au";
  if (!["drone", "helicopter"].includes(kindOf(m)) || (helicopter && !au))
    add("operation-kind", "This aircraft type is not supported in the selected region.");
  const profile = [
    ...EQUIPMENT_PROFILES,
    ...(context.profiles || []).filter((r) => !r.deletedAt && regionOf(r) === regionOf(m)),
  ].find((p) => p.id === m.profileId);
  const payload = [
    ...PAYLOADS,
    ...(context.payloads || []).filter((r) => !r.deletedAt && regionOf(r) === regionOf(m)),
  ].find((p) => p.id === m.payloadId);
  const template = [
    ...MISSION_TEMPLATES,
    ...(context.templates || []).filter((r) => !r.deletedAt && regionOf(r) === regionOf(m)),
  ].find((t) => t.id === m.templateId);
  let window;
  if (!template) add("template", "Select an available survey template; the previous template is missing or deleted.");
  try {
    window = missionWindow(m);
    if (Date.parse(window.end) <= now) add("time", "Operation window has ended; create or copy a new mission.");
  } catch (e) {
    add("time", e.message);
  }
  if (!m.title?.trim()) add("title", "Name the mission.");
  if (!m.projectId || !(context.projects || []).some((p) => p.id === m.projectId && !p.deletedAt))
    add("project", "Select an existing project.");
  const boundary = geometrySummary(m.boundary),
    flight = geometrySummary(m.flightArea);
  const areaBounds = ["boundary", "flightArea", "contingencyArea", "safetyArea"]
    .map((k) => geometrySummary(m[k]).bounds)
    .filter(Boolean);
  if (
    areaBounds.some((b) => !pointInRegion([b[0], b[1]], regionOf(m)) || !pointInRegion([b[2], b[3]], regionOf(m))) ||
    ["takeoff", "landing", "alternateLanding"].some((key) => m[key] && !pointInRegion(m[key], regionOf(m)))
  )
    add(
      "region-geometry",
      "The operating geometry is outside the supported region. Confirm coordinates and jurisdiction."
    );
  if (!boundary.bounds) add("boundary", "Import or draw the survey boundary.");
  if (!flight.polygonCount) add("flightArea", "Define the flight area separately from the survey boundary.");
  if (boundary.hasLines && (!m.corridorConfirmed || !(Number(m.corridorWidthM) > 0)))
    add("corridor", "Confirm corridor width and draw the flight area. A line is not a flight area.");
  if (!Array.isArray(m.takeoff) || m.takeoff.length !== 2 || !m.takeoff.every(Number.isFinite))
    add("takeoff", "Mark the take-off / landing point.");
  for (const key of ["landing", "alternateLanding"])
    if (m[key] != null && (!Array.isArray(m[key]) || m[key].length !== 2 || !m[key].every(Number.isFinite)))
      add(key, "Correct the landing location coordinates (WGS84 longitude, latitude).");
  const pilot = (context.workers || []).find((w) => w.id === m.pilotId && !w.deletedAt);
  const asset = (context.assets || []).find((a) => a.id === m.assetId && !a.deletedAt);
  if (!pilot && !helicopter) add("pilot", "Select a pilot from People.");
  if (m.observerId && !(context.workers || []).some((w) => w.id === m.observerId && !w.deletedAt))
    add("observer", "Re-select the observer; the linked person is unavailable.");
  if (
    m.payloadAssetId &&
    !(context.assets || []).some(
      (a) => a.id === m.payloadAssetId && !a.deletedAt && a.result === "pass" && a.nextDue >= m.end?.slice(0, 10)
    )
  )
    add("payload-asset", "Resolve the payload asset inspection, expiry or missing record.");
  if (!asset && !helicopter) add("asset", "Select an aircraft from Plant.");
  if (asset && asset.result !== "pass" && !helicopter)
    add("defect", "Resolve the aircraft inspection result in Plant.");
  const missionDate = m.end?.slice(0, 10);
  if (!helicopter && asset && (!asset.nextDue || asset.nextDue < missionDate))
    add("inspection", "Confirm an aircraft inspection valid through the mission.");
  if (!helicopter && (!profile || !payload || !profile.payloadIds?.includes(payload.id)))
    add("compatibility", "Choose a verified compatible aircraft and payload profile.");
  if (!helicopter && template && payload && !payload.capabilities?.includes(template.capability))
    add("capability", `${template.name} requires ${template.capability}; the selected payload does not provide it.`);
  if (
    !helicopter &&
    (!m.category ||
      (!au && !m.classMark) ||
      !Number.isFinite(Number(m.massKg)) ||
      !(Number(m.massKg) > 0) ||
      !Number.isFinite(Number(m.heightM)) ||
      !(Number(m.heightM) > 0) ||
      !m.operatorId?.trim())
  )
    add(
      "pathway-fields",
      au
        ? "Record the CASA pathway, actual take-off mass, height and operator/registration references."
        : "Record category, actual class / legacy status, take-off mass, height and Operator ID."
    );
  const pathways = helicopter ? HELICOPTER_PATHWAYS : au ? AU_PATHWAYS : UK_PATHWAYS;
  if (!pathways.includes(m.category))
    add("category", "Select an operating pathway applicable to this aircraft type and region.");
  if (!["AGL", "AMSL", "Above take-off — terrain review required"].includes(m.heightReference))
    add("height-reference", "Choose a supported height reference and record any required terrain review.");
  if (helicopter) actions.push(...helicopterActions(m, context, window, now));
  if (!m.emergency?.trim()) add("emergency", "Record emergency procedures and confirmed site contacts.");
  if (!m.qa?.trim() || !m.deliverables?.trim())
    add("qa", "Confirm survey deliverables and QA plan. GSD does not guarantee accuracy.");
  if (!m.ramsId || !(context.rams || []).some((r) => r.id === m.ramsId && !r.deletedAt))
    add("rams-link", "Link the existing RAMS assessment.");
  const manual = (context.manuals || []).find((r) => r.id === m.manualId && r.approvedAt && !r.deletedAt);
  if (
    (String(m.category).startsWith("Specific") || m.category === "CASA ReOC operation") &&
    (!manual || !manualApplies(manual, m))
  )
    add("manual-link", "Select a reviewed Operations Manual version for this Specific operation.");
  if (manual && !manualApplies(manual, m))
    add("manual-scope", "The selected manual belongs to a different region or aircraft type.");
  for (const [kind, label] of evidenceKinds(m)) {
    const e = (m.evidence || []).find((x) => x.kind === kind);
    if (!e || e.missionRevision !== m.revision || e.ruleVersion !== ruleVersion(m)) {
      add(kind, `${label}: Not checked for this mission revision.`);
      continue;
    }
    if (e.result !== "reviewed") {
      add(kind, `${label}: ${e.result === "awaiting_permission" ? "Awaiting permission" : "Action required"}.`);
      continue;
    }
    if (
      !e.source?.trim() ||
      !e.reviewer?.trim() ||
      !e.note?.trim() ||
      !Number.isFinite(Date.parse(e.checkedAt)) ||
      Date.parse(e.checkedAt) > now ||
      !Number.isFinite(Date.parse(e.validUntil)) ||
      Date.parse(e.validUntil) <= now ||
      (window && Date.parse(e.validUntil) < Date.parse(window.end))
    )
      add(kind, `${label}: evidence is incomplete, expired or does not cover the full window.`);
  }
  for (const item of applicableChecklist(m, context).filter((i) => ["planning", "site"].includes(i.phase))) {
    const check = m.checklist?.[item.id];
    if (check?.status !== "done" || !check.at || !check.by)
      add(`checklist-${item.id}`, `${item.stage}: pilot confirmation required.`);
  }
  if (m.weather && (!Number.isFinite(Date.parse(m.weather.validUntil)) || Date.parse(m.weather.validUntil) <= now))
    add(
      "forecast",
      "Stored forecast has expired. Fetch a new forecast or remove it and record a current manual assessment."
    );
  if (m.weather) {
    const evaluated = evaluateForecast(m.weather, m.limits);
    if (evaluated.status !== "Within entered limits — pilot review required")
      add("forecast-limits", `Weather: ${evaluated.status}. Resolve all forecast gaps and limit exceedances.`);
  }
  if (offline) add("offline", "Offline: recheck current conditions and synchronise before approval.");
  const changed = m.approval && m.approval.recordFingerprint !== recordFingerprint(context, m);
  if (changed)
    add("register-change", "A linked person, asset, RAMS or manual changed. Recheck and approve the current records.");
  if (
    m.approval &&
    !matchesApprovedSnapshot(m, m.issues?.find((i) => i.snapshot?.approval?.at === m.approval.at)?.snapshot)
  )
    add(
      "approved-content-changed",
      "Mission content no longer matches its approved snapshot. Recheck and approve again."
    );
  let status = actions.length ? "Action required" : "Ready for pilot review";
  if (actions.length && (m.evidence || []).some((e) => e.result === "awaiting_permission"))
    status = "Awaiting permission";
  if (m.recheckRequired || (m.approval && (actions.length || m.approval.revision !== m.revision)))
    status = "Expired / Recheck required";
  if (m.approval && !actions.length && m.approval.revision === m.revision) status = approvedStatus(m);
  if (m.cancelled) status = "Cancelled";
  return { status, actions, profile, payload, template, window };
}
export function issuePack(m, context, actor, onSiteConfirmed, now = Date.now(), offline = false) {
  if (!["admin", "supervisor"].includes(actor?.role) || !actor?.name?.trim())
    throw new Error("A named responsible administrator or supervisor must approve this operation.");
  if (!onSiteConfirmed || offline) throw new Error("Confirm current conditions on site while online before approving.");
  const assessment = assessMission({ ...m, approval: null, recheckRequired: false }, context, now, offline);
  if (m.cancelled || assessment.actions.length) throw new Error("Resolve all next actions before approval.");
  const issuedAt = new Date(now).toISOString();
  const approval = {
    name: actor.name,
    userId: actor.id || null,
    role: actor.role,
    at: issuedAt,
    revision: m.revision,
    onSiteConfirmed: true,
    recordFingerprint: recordFingerprint(context, m),
  };
  const snapshot = clone({
    ...m,
    approval,
    issues: [],
    history: m.history,
    records: JSON.parse(approval.recordFingerprint),
    catalogue: { profile: assessment.profile, payload: assessment.payload, template: assessment.template },
    sources: regionalSources(m),
    checklistDefinitions: applicableChecklist(m, context),
    ruleVersion: ruleVersion(m),
  });
  const issue = { id: droneId(), issuedAt, revision: m.revision, kind: "approved", snapshot };
  return { ...m, approval, recheckRequired: false, updatedAt: issuedAt, issues: [...(m.issues || []), issue] };
}
