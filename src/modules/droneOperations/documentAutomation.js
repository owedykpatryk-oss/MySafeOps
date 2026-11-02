import { isHelicopter, ruleVersion, regionOf } from "./droneRegions.js";
import { MISSION_TEMPLATES } from "./droneLibrary.js";

export const WORK_CONTEXTS = [
  {
    id: "remote",
    name: "Remote site",
    prompt: "Record reliable communications, check-in intervals, overdue response, assistance and access arrangements.",
  },
  {
    id: "roads",
    name: "Roads and rail",
    prompt: "Record traffic and rail interfaces, responsible contacts, permissions and agreed exclusion arrangements.",
  },
  {
    id: "public",
    name: "Public access",
    prompt:
      "Record public access controls, briefing responsibilities, privacy and how work stops if people enter the operating area.",
  },
  {
    id: "water",
    name: "Over or beside water",
    prompt:
      "Record operator-agreed recovery, survival equipment, rescue contacts and the limits of the survey team's role.",
  },
  {
    id: "night",
    name: "Night or reduced light",
    prompt:
      "Record applicable operator authorisation, crew competence, illumination, visibility limits and emergency arrangements.",
  },
  {
    id: "infrastructure",
    name: "Wires and infrastructure",
    prompt:
      "Record known wires, structures, owner contacts, survey limitations and avoidance arrangements. Missing map features do not prove absence.",
  },
  {
    id: "environment",
    name: "Sensitive environment",
    prompt:
      "Record land-access conditions, wildlife or heritage sensitivities, applicable consents and disturbance controls.",
  },
  {
    id: "airspace",
    name: "Airspace coordination",
    prompt:
      "Record the official briefing, restrictions, authority contacts and permission references for the whole operating window.",
  },
];
export const SOURCE_FIELDS = [
  ["helicopter.operatorName", "Operator name"],
  ["helicopter.certificateReference", "AWC number"],
  ["helicopter.aircraftRegistration", "Aircraft registration"],
  ["helicopter.aircraftType", "Aircraft type"],
  ["helicopter.pilotName", "Pilot in command"],
  ["helicopter.operatorManualReference", "Operator manual reference"],
  ["operatorId", "Operator ID"],
  ["operatorId", "Operator ARN"],
];
export const valueAt = (m, field) => (field.startsWith("helicopter.") ? m.helicopter?.[field.slice(11)] : m[field]);
const allowedField = (m, field) =>
  SOURCE_FIELDS.some(([f]) => f === field) &&
  (isHelicopter(m) ? field.startsWith("helicopter.") : field === "operatorId");
const hasText = (value) => typeof value === "string" && Boolean(value.trim());
const validDate = (value) =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  Number.isFinite(Date.parse(value)) &&
  new Date(value).toISOString().slice(0, 10) === value;
const validExpiryEvidence = (e, date) =>
  !e ||
  (e.date === date &&
    validDate(date) &&
    hasText(e.quote) &&
    e.quote.length <= 600 &&
    e.quote.includes(date) &&
    Number.isInteger(e.page) &&
    e.page >= 1 &&
    e.page <= 40);

export function reuseConflicts(m, context = {}) {
  const project = (context.projects || []).find((p) => p.id === m.projectId && !p.deletedAt);
  const template = [
    ...MISSION_TEMPLATES,
    ...(context.templates || []).filter((t) => !t.deletedAt && regionOf(t) === regionOf(m)),
  ].find((t) => t.id === m.templateId);
  const fresh = projectSuggestions({}, project, template);
  return Object.entries(m.fieldOrigins || {}).flatMap(([field, origin]) => {
    if (
      !["client", "location", "postcode", "deliverables", "qa"].includes(field) ||
      !origin ||
      m[field] !== origin.value
    )
      return [];
    const current = fresh.find((s) => s.field === field);
    if (current && current.sourceId === origin.sourceId && current.value === origin.value) return [];
    return [
      {
        field,
        previous: origin.value,
        value: current?.value || "",
        source: current?.source || "Source unavailable",
        sourceId: current?.sourceId,
        available: Boolean(current),
      },
    ];
  });
}
export function resolveReuseConflict(m, field, decision, context, actor, now = Date.now()) {
  const conflict = reuseConflicts(m, context).find((c) => c.field === field);
  if (!conflict || !["manual", "update"].includes(decision))
    throw new Error("This source difference changed. Review the current values.");
  if (decision === "manual") {
    const origins = { ...m.fieldOrigins };
    delete origins[field];
    return { fieldOrigins: origins };
  }
  if (!conflict.available) throw new Error("The source is unavailable. Enter and review a manual value.");
  return preparationPatch({ ...m, [field]: "" }, [conflict], actor, now);
}
export function extractExpiryCandidates(pages) {
  const candidates = [];
  for (const page of pages.slice(0, 40))
    for (const raw of String(page.text || "").split(/\r?\n/)) {
      const quote = raw.trim(),
        match = quote.match(/^(?:Document expiry|Valid until|Expiry date)\s*:\s*(\d{4}-\d{2}-\d{2})$/i);
      if (match && validDate(match[1]) && !candidates.some((c) => c.date === match[1]))
        candidates.push({ date: match[1], quote, page: page.page });
      if (candidates.length >= 20) return candidates;
    }
  return candidates;
}
export function acceptCandidates(m, source, candidates, actor, now = Date.now()) {
  if (!candidates.length || candidates.length > 8 || new Set(candidates.map((c) => c.field)).size !== candidates.length)
    throw new Error("Select one value per field before applying the reviewed values.");
  let current = m;
  const patch = {};
  for (const candidate of candidates) {
    Object.assign(patch, acceptCandidate(current, source, candidate, actor, now));
    current = { ...current, ...patch };
  }
  return patch;
}

export function projectSuggestions(m, project, template) {
  const rows =
    project && !project.deletedAt
      ? [
          ["client", project.client || project.clientName],
          ["location", project.siteAddress || project.address || project.name],
          ["postcode", project.postcode],
        ].map(([field, value]) => ({ field, value, source: `Project: ${project.name}`, sourceId: project.id }))
      : [];
  if (template)
    for (const field of ["deliverables", "qa"])
      rows.push({ field, value: template[field], source: `Survey template: ${template.name}`, sourceId: template.id });
  return rows.filter((s) => hasText(s.value) && !String(m[s.field] || "").trim());
}
export function preparationPatch(m, suggestions, actor, now = Date.now()) {
  const patch = {},
    origins = { ...m.fieldOrigins };
  for (const s of suggestions) {
    if (
      !["client", "location", "postcode", "deliverables", "qa"].includes(s.field) ||
      String(m[s.field] || "").trim() ||
      !hasText(s.value)
    )
      continue;
    patch[s.field] = s.value;
    origins[s.field] = {
      value: s.value,
      source: s.source,
      sourceId: s.sourceId,
      by: actor,
      at: new Date(now).toISOString(),
    };
  }
  if (Object.keys(patch).length) patch.fieldOrigins = origins;
  return patch;
}
export function contextChecklist(m) {
  const ids = Array.isArray(m.workContexts) ? m.workContexts : [];
  return WORK_CONTEXTS.filter((c) => ids.includes(c.id)).map((c) => ({
    id: `context-${c.id}`,
    stage: c.name,
    text: c.prompt,
    phase: "planning",
    role: "Survey lead with operator",
    version: ruleVersion(m),
    source: { title: "MySafeOps contextual planning prompt", kind: "platform recommendation" },
  }));
}
export function documentOutline(m) {
  return [
    "Mission and survey plan",
    "Aircraft and crew",
    ...contextChecklist(m).map((c) => c.stage),
    "Crew briefing",
    "Emergency arrangements",
    "Evidence and source register",
    "Review and decision record",
  ];
}
export function extractCandidates(pages, kind) {
  const fields = SOURCE_FIELDS.filter(([field]) =>
    kind === "helicopter" ? field.startsWith("helicopter.") : field === "operatorId"
  );
  const candidates = [];
  for (const page of pages.slice(0, 40))
    for (const raw of String(page.text || "").split(/\r?\n/)) {
      const line = raw.trim();
      for (const [field, label] of fields) {
        const match = line.match(new RegExp(`^${label}\\s*:\\s*(.{1,300})$`, "i"));
        if (match && !candidates.some((c) => c.field === field && c.value === match[1].trim()))
          candidates.push({ field, label, value: match[1].trim(), quote: line, page: page.page });
      }
      if (candidates.length >= 40) return candidates.slice(0, 40);
    }
  return candidates;
}
export function acceptCandidate(m, source, candidate, actor, now = Date.now()) {
  if (
    !allowedField(m, candidate.field) ||
    !hasText(candidate.value) ||
    candidate.value.length > 300 ||
    !hasText(candidate.quote) ||
    !candidate.quote.includes(candidate.value) ||
    candidate.quote.length > 600 ||
    !Number.isInteger(candidate.page) ||
    candidate.page < 1 ||
    candidate.page > 40 ||
    (source.expiresOn && !validDate(source.expiresOn)) ||
    !validExpiryEvidence(source.expiryEvidence, source.expiresOn) ||
    !/^[a-f0-9]{64}$/.test(source.hash || "") ||
    !hasText(source.name) ||
    !hasText(actor)
  )
    throw new Error("Review a supported field and its original source excerpt before applying it.");
  const fact = {
    ...candidate,
    sourceName: source.name.slice(0, 200),
    hash: source.hash,
    expiresOn: source.expiresOn || "",
    ...(source.expiryEvidence ? { expiryEvidence: { ...source.expiryEvidence } } : {}),
    by: actor,
    at: new Date(now).toISOString(),
  };
  return {
    ...(candidate.field.startsWith("helicopter.")
      ? { helicopter: { ...m.helicopter, [candidate.field.slice(11)]: candidate.value } }
      : { [candidate.field]: candidate.value }),
    sourceFacts: [...(m.sourceFacts || []).filter((f) => f.field !== candidate.field), fact],
  };
}
export function automationActions(m, now = Date.now(), context) {
  const actions = [],
    add = (key, text) => actions.push({ key, text });
  if (context)
    for (const conflict of reuseConflicts(m, context))
      add(
        "document-reuse",
        `${conflict.field}: the copied source changed or is unavailable. Review the difference in Prepare documents.`
      );
  if (
    m.workContexts != null &&
    (!Array.isArray(m.workContexts) || m.workContexts.some((id) => !WORK_CONTEXTS.some((c) => c.id === id)))
  )
    add("document-context", "Review unsupported working conditions before issuing this package.");
  for (const c of contextChecklist(m)) {
    const check = m.checklist?.[c.id];
    if (
      !hasText(check?.note) ||
      check.status !== "done" ||
      !hasText(check.by) ||
      !Number.isFinite(Date.parse(check.at)) ||
      Date.parse(check.at) > now
    )
      add("document-context", `${c.stage}: record the site-specific arrangements and named review.`);
  }
  if (m.sourceFacts != null && (!Array.isArray(m.sourceFacts) || m.sourceFacts.length > 12)) {
    add("document-source", "The source register is invalid. Review imported fields.");
    return actions;
  }
  for (const fact of m.sourceFacts || []) {
    if (
      !fact ||
      !allowedField(m, fact.field) ||
      !hasText(fact.value) ||
      !hasText(fact.quote) ||
      !fact.quote.includes(fact.value) ||
      !hasText(fact.sourceName) ||
      !Number.isInteger(fact.page) ||
      fact.page < 1 ||
      fact.page > 40 ||
      !validExpiryEvidence(fact.expiryEvidence, fact.expiresOn) ||
      !/^[a-f0-9]{64}$/.test(fact.hash || "") ||
      !hasText(fact.by) ||
      !Number.isFinite(Date.parse(fact.at)) ||
      Date.parse(fact.at) > now
    ) {
      add("document-source", "An imported field has incomplete attribution. Review or remove its source link.");
      continue;
    }
    if (valueAt(m, fact.field) !== fact.value)
      add(
        "document-source",
        `${fact.label || fact.field}: value changed after source review. Review the new source or remove the old link.`
      );
    if (
      fact.expiresOn &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(fact.expiresOn) ||
        !Number.isFinite(Date.parse(fact.expiresOn)) ||
        (Number.isFinite(Date.parse(fact.expiresOn)) &&
          new Date(fact.expiresOn).toISOString().slice(0, 10) !== fact.expiresOn) ||
        fact.expiresOn < new Date(now).toISOString().slice(0, 10) ||
        (m.end && fact.expiresOn < m.end.slice(0, 10)))
    )
      add(
        "document-source",
        `${fact.sourceName}: document validity does not cover the operation. Record current evidence.`
      );
  }
  return actions;
}
