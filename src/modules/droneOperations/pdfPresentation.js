import { isHelicopter, missionTimeZone } from "./droneRegions.js";
import { fieldJournalText } from "./fieldSession.js";
import { qualityText } from "./missionWorkflow.js";

const text = (value) => String(value ?? "").trim() || "Not recorded";
const pairs = (rows) => rows.map(([label, value]) => `${label}: ${text(value)}`).join("\n");
export function checklistGroups(m, at = Date.now()) {
  const phases = {
    planning: "Before mobilisation",
    site: "On site / before work",
    flight: "During the operation",
    post: "After the operation",
  };
  const definitions = m.checklistDefinitions || [];
  return [...Object.keys(phases), ...new Set(definitions.map((d) => d.phase || "unassigned").filter((p) => !phases[p]))]
    .map((phase) => ({
      phase,
      title: phases[phase] || "Other checks",
      items: definitions
        .filter((d) => (d.phase || "unassigned") === phase)
        .map((d) => {
          const check = m.checklist?.[d.id];
          const recorded =
            check?.status === "done" &&
            String(check.by || "").trim() &&
            Number.isFinite(Date.parse(check.at)) &&
            Date.parse(check.at) <= at;
          return {
            id: d.id,
            title: d.stage || "Checklist item",
            role: d.role || "Role not recorded",
            status: recorded ? "Review recorded" : "Review needed",
            detail: [
              text(d.text),
              `Responsible role: ${text(d.role)}`,
              `Recorded by: ${text(check?.by)} | Time: ${text(check?.at)}`,
              `Note / evidence: ${text(check?.note)}`,
              `Basis: ${text(d.source?.title)} | Version: ${text(d.version)}`,
            ].join("\n"),
          };
        }),
    }))
    .filter((g) => g.items.length);
}
export function missionFacts(m) {
  let zone;
  try {
    zone = missionTimeZone(m);
  } catch {
    zone = "Time zone not confirmed";
  }
  return [
    ["Project", m.records?.project?.name || m.projectId],
    ["Client", m.client],
    ["Location", m.location],
    ["Operation window", `${text(m.start)} to ${text(m.end)} (${zone})`],
    [
      isHelicopter(m) ? "Aviation operator" : "Remote pilot",
      isHelicopter(m) ? m.helicopter?.operatorName : m.records?.pilot?.name,
    ],
    ["Aircraft", isHelicopter(m) ? m.helicopter?.aircraftRegistration : m.records?.asset?.description],
  ];
}
export function focusedSections(issue, kind) {
  if (!["field", "operator"].includes(kind)) throw new Error("Choose a supported field document.");
  const m = issue.snapshot,
    helicopter = isHelicopter(m);
  const sections = [
    [
      "Document status",
      "DRAFT - coordination reference only. This sheet does not replace the operator's aircraft-specific checklist, procedures, briefing or flight decision. Use the full mission package for all evidence and limitations.",
    ],
    [
      "Mission at a glance",
      pairs([...missionFacts(m), ["Mission revision", m.revision], ["Generated at (UTC)", issue.issuedAt]]),
    ],
  ];
  if (kind === "field")
    sections.push(
      [
        "Site arrangements",
        pairs([
          ["Take-off / landing coordinates (WGS84 longitude, latitude)", m.takeoff?.join(", ")],
          ["Landing coordinates (WGS84 longitude, latitude)", m.landing?.join(", ")],
          ["Alternate landing coordinates (WGS84 longitude, latitude)", m.alternateLanding?.join(", ")],
          ["Landing and access", helicopter ? m.helicopter?.landingPlan : "See mission map and site checklist"],
          ["Communications / stop-work", helicopter ? m.helicopter?.communications : m.emergency],
          ["Remote-area assistance", helicopter ? m.helicopter?.remoteAreaPlan : "See emergency plan"],
        ]),
      ],
      ["Emergency procedures and contacts", text(m.emergency)],
      ["Site session journal", fieldJournalText(m)],
      ["Document quality review", qualityText(m, Date.parse(issue.issuedAt))]
    );
  else
    sections.push(
      [
        "Task and aircraft coordination",
        pairs([
          ["Task", m.deliverables],
          ["Aircraft type", helicopter ? m.helicopter?.aircraftType : m.catalogue?.profile?.name],
          ["Pilot in command", helicopter ? m.helicopter?.pilotName : m.records?.pilot?.name],
          ["Survey lead", m.records?.observer?.name],
          ["Equipment / loading reference", helicopter ? m.helicopter?.loadingReference : m.records?.asset?.assetRef],
          ["Operator manual reference", helicopter ? m.helicopter?.operatorManualReference : m.records?.manual?.title],
        ]),
      ],
      [
        "Evidence to review",
        (m.evidence || [])
          .map(
            (e) =>
              `${text(e.kind)}: ${text(e.result)}\n${text(e.note)}\nSource: ${text(e.source)}\nChecked: ${text(e.checkedAt)} | Valid until: ${text(e.validUntil)}`
          )
          .join("\n\n") || "No evidence recorded. Review the full package before a decision.",
      ]
    );
  if (helicopter)
    sections.push([
      "Recorded operator decision",
      m.operatorRelease
        ? pairs([
            ["Named decision maker", m.operatorRelease.by],
            ["Reference", m.operatorRelease.reference],
            ["Conditions", m.operatorRelease.conditions],
            ["Valid until (UTC)", m.operatorRelease.validUntil],
            ["Decision mission revision", m.operatorRelease.missionRevision],
          ]) + "\nThis is a saved evidence reference, not a new flight release or an authenticated signature."
        : "No operator decision recorded. This sheet does not release the aircraft for flight.",
    ]);
  sections.push([
    "Outstanding actions",
    (m.nextActions || []).map((a) => a.text).join("\n") ||
      "No action list supplied. This draft does not certify readiness.",
  ]);
  return sections;
}
