import { manualSections, kindOf, ruleVersion } from "./droneRegions.js";

export const MANUAL_TOPICS = {
  operator: [
    "Legal entity, operating base and organisation chart",
    "Accountable manager and delegated responsibilities",
    "Safety policy, stop-work authority and signed commitment",
  ],
  scope: [
    "Permitted work, locations and operating pathway",
    "Authorisation / certificate references, conditions and exclusions",
    "Contracted services and boundaries of responsibility",
  ],
  people: [
    "Named roles, deputies and responsibilities",
    "Qualifications, induction, training, currency and competency records",
    "Fitness, fatigue, medication and communication arrangements",
  ],
  fleet: [
    "Aircraft, payload and equipment register with identifiers",
    "Approved configurations, installation and loading references",
    "Manufacturer limits, weather limits, power systems and modifications",
  ],
  planning: [
    "Site feasibility, survey boundary and permissions",
    "Airspace briefing, weather review and third-party coordination",
    "Privacy, access, public protection, communications and remote-site arrangements",
  ],
  normal: [
    "Mobilisation, briefing and role allocation",
    "Pre-operation checks, ground access and exclusion controls",
    "Task monitoring, stop-work, post-operation checks and handover",
  ],
  maintenance: [
    "Maintenance responsibilities and approved references",
    "Inspection intervals, defects, quarantine and return to service",
    "Equipment care, logs, record ownership and retention",
  ],
  emergency: [
    "Emergency contacts, access coordinates and communications",
    "Operator-specific abnormal-event and emergency procedures",
    "Fire / injury response, overdue action and recovery coordination",
  ],
  risk: [
    "Risk assessment method, acceptance and escalation",
    "Insurance and contractor assurance evidence",
    "Incident / occurrence reporting, investigation and corrective actions",
  ],
  control: [
    "Document owner, review cycle and amendment approval",
    "Controlled distribution, briefing and withdrawal of obsolete copies",
    "Feasibility, site survey, briefing, debrief and occurrence forms",
  ],
};
const clone = (value) => JSON.parse(JSON.stringify(value));
const text = (value) => String(value ?? "").trim();
export function createCompanyManual(org, actor, regionCode, previous = null, at = new Date().toISOString()) {
  return {
    id: crypto.randomUUID(),
    format: "company-manual/1",
    title: previous?.title || (regionCode === "au" ? "Aerial survey coordination plan" : "Operations Manual"),
    regionCode: previous?.regionCode || regionCode,
    aircraftKind: previous?.aircraftKind || (regionCode === "au" ? "helicopter" : "drone"),
    version: previous ? `${previous.version} revised` : "0.1",
    sections: clone(previous?.sections || {}),
    sectionReviews: {},
    scope: previous?.scope || "",
    company: clone(
      previous?.company || {
        name: org.name === "My Organisation" ? "" : org.name || "",
        address: org.address || "",
        registrationNo: org.registrationNo || "",
        email: org.email || "",
        phone: org.phone || "",
      }
    ),
    documentCode: previous?.documentCode || "",
    documentOwner: previous?.documentOwner || actor.name,
    accountableManager: previous?.accountableManager || "",
    reviewDue: previous?.reviewDue || "",
    distribution: previous?.distribution || "",
    references: previous?.references || "",
    author: actor.name,
    sourceVersion: ruleVersion({ regionCode }),
    createdAt: at,
    updatedAt: at,
    previousId: previous?.id || null,
    changeNote: previous ? "" : "Initial draft",
  };
}
export function manualReview(manual, at = new Date().toISOString()) {
  const sections = manualSections(manual),
    issues = [];
  for (const [key, label] of [
    ["title", "title"],
    ["version", "version"],
    ["scope", "scope"],
    ["changeNote", "amendment record"],
  ])
    if (!text(manual[key])) issues.push({ key, text: `Complete the ${label}.` });
  if (manual.format === "company-manual/1") {
    if (!text(manual.company?.name)) issues.push({ key: "company", text: "Record the company legal name." });
    if (!text(manual.documentCode)) issues.push({ key: "documentCode", text: "Assign a document code." });
    if (!text(manual.documentOwner)) issues.push({ key: "documentOwner", text: "Assign a document owner." });
    const date = text(manual.reviewDue),
      epoch = Date.parse(`${date}T23:59:59.999Z`);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      !Number.isFinite(epoch) ||
      new Date(epoch).toISOString().slice(0, 10) !== date ||
      epoch < Date.parse(at)
    )
      issues.push({ key: "reviewDue", text: "Set a valid next review date that has not passed." });
  }
  let drafted = 0,
    reviewed = 0;
  for (const section of sections) {
    const content = text(manual.sections?.[section.id]),
      placeholder = /\[TO COMPLETE[:\]]/i.test(content);
    if (content && !placeholder) drafted++;
    else
      issues.push({
        key: section.id,
        text: `Complete ${section.title.toLowerCase()}${placeholder ? " and replace the drafting placeholders" : ""}.`,
      });
    const check = manual.sectionReviews?.[section.id];
    const valid =
      content &&
      !placeholder &&
      text(check?.by) &&
      Number.isFinite(Date.parse(check?.at)) &&
      Date.parse(check.at) <= Date.parse(at);
    if (valid) reviewed++;
    else if (manual.format === "company-manual/1")
      issues.push({ key: section.id, text: `Review the company procedure: ${section.title}.` });
  }
  return { issues, drafted, reviewed, total: sections.length, percent: Math.round((drafted / sections.length) * 100) };
}
export function manualOutline(manual) {
  const sections = { ...manual.sections };
  for (const section of manualSections(manual))
    if (!text(sections[section.id]))
      sections[section.id] =
        `${section.prompt}\n\n${MANUAL_TOPICS[section.id].map((topic) => `[TO COMPLETE: ${topic}]`).join("\n\n")}`;
  return { sections };
}
export function updateManual(manual, patch, at = new Date().toISOString()) {
  if (manual.approvedAt) throw new Error("This reviewed version is locked. Create a revision.");
  const sectionReviews = { ...(patch.sectionReviews || manual.sectionReviews || {}) };
  if (patch.company && JSON.stringify(patch.company) !== JSON.stringify(manual.company)) delete sectionReviews.operator;
  if (patch.sections)
    for (const key of Object.keys(patch.sections))
      if (patch.sections[key] !== manual.sections?.[key]) delete sectionReviews[key];
  if (patch.aircraftKind && patch.aircraftKind !== kindOf(manual))
    for (const key of Object.keys(sectionReviews)) delete sectionReviews[key];
  return { ...manual, ...patch, sectionReviews, updatedAt: at };
}
export function saveManualRows(rows, next, expected) {
  const current = rows.find((row) => row.id === next.id);
  if (current?.approvedAt) throw new Error("This reviewed version is locked. Create a revision.");
  if (
    (current && !expected) ||
    (!current && expected) ||
    (current && JSON.stringify(current) !== JSON.stringify(expected))
  )
    throw new Error("The saved manual changed. Reopen the current version before saving your changes.");
  if (next.approvedAt && manualReview(next, next.approvedAt).issues.length)
    throw new Error("Complete the scope, company details and every procedure review before locking this version.");
  return current ? rows.map((row) => (row.id === next.id ? next : row)) : [next, ...rows];
}
export function manualControlRows(manual) {
  return [
    ["Company", manual.company?.name || "Not recorded"],
    ["Document code", manual.documentCode || `OM-${manual.id?.slice(0, 8)}`],
    ["Version", manual.version],
    ["Applicability", `${manual.regionCode || "uk"} / ${kindOf(manual)}`],
    ["Document owner", manual.documentOwner || manual.author],
    ["Accountable manager", manual.accountableManager || "Not recorded"],
    ["Next review", manual.reviewDue || "Not recorded"],
    ["Review recorded by", manual.approvedBy || "Not reviewed"],
    ["Review recorded at", manual.approvedAt || "Not reviewed"],
  ];
}
