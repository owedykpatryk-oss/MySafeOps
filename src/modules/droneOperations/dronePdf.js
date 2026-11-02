import { createReportDocument as createDocument } from "./pdfLayout.js";
import { checklistGroups, focusedSections, missionFacts } from "./pdfPresentation.js";
import { downloadBlob } from "../../utils/downloadBlob.js";
import { fieldJournalText } from "./fieldSession.js";
import { closeoutSections, closeoutSummary, qualityText } from "./missionWorkflow.js";
import { manualReview, manualControlRows } from "./companyManual.js";
import { reviewTiming } from "./manualAutomation.js";
import { airspaceBriefing } from "./airspaceBriefing.js";
import { createPdfExportSession, missionExportFilename } from "./pdfExportSession.js";

import { evidenceKinds } from "./droneMission.js";
import {
  isHelicopter,
  regionOf,
  missionTimeZone,
  approvedStatus,
  packTitle,
  manualSections,
  regionalSources,
} from "./droneRegions.js";
import { evaluateForecast } from "./droneWeatherAssessment.js";
export function packMapGeometry(m) {
  return {
    type: "FeatureCollection",
    features: [
      ...["boundary", "flightArea", "contingencyArea", "safetyArea"].flatMap((k) => m[k]?.features || []),
      ...[
        ["takeoff", "Take-off / landing"],
        ["landing", "Landing"],
        ["alternateLanding", "Alternate landing"],
      ]
        .filter(([key]) => Array.isArray(m[key]) && m[key].length === 2 && m[key].every(Number.isFinite))
        .map(([key, name]) => ({
          type: "Feature",
          properties: { name },
          geometry: { type: "Point", coordinates: m[key] },
        })),
    ],
  };
}

export function packSections(issue) {
  const m = issue.snapshot;
  const helicopter = isHelicopter(m),
    au = regionOf(m) === "au",
    EVIDENCE_KINDS = evidenceKinds(m);
  let zone;
  try {
    zone = missionTimeZone(m);
  } catch {
    zone = "Not confirmed";
  }
  const weatherAssessment = evaluateForecast(m.weather, m.limits);
  const pairs = (entries) => entries.map(([k, v]) => `${k}: ${v == null || v === "" ? "Not recorded" : v}`).join("\n");
  const sections = [
    [
      "Mission",
      pairs([
        ["Mission", m.title],
        ["Project", m.records?.project?.name || m.projectId],
        ["Client", m.client],
        ["Location", m.location],
        ["Nearby postcode (approximate)", m.postcode],
        ["Country / region", m.country],
        [`Start (${zone})`, m.start],
        [`End (${zone})`, m.end],
        ["Jurisdiction", au ? "Australia" : "United Kingdom"],
        ["Aircraft type", helicopter ? "Crewed helicopter" : "Drone / RPAS"],
        ["Clock-change occurrence", m.timeOccurrence || "Not applicable"],
        ["Revision", m.revision],
        ["Issued at", issue.issuedAt],
        ["Status", issue.kind === "approved" ? approvedStatus(m) : "DRAFT — unresolved checks may remain"],
      ]),
    ],
    [
      "Aircraft and crew",
      pairs(
        helicopter
          ? [
              ["Aviation service", m.helicopter?.relationship],
              ["Aviation operator", m.helicopter?.operatorName],
              ["AWC and scope reference", m.helicopter?.certificateReference],
              ["Pilot in command", m.helicopter?.pilotName],
              ["Aircraft registration", m.helicopter?.aircraftRegistration],
              ["Aircraft type", m.helicopter?.aircraftType],
              ["Sensor and installation", m.helicopter?.sensorDescription],
              ["Survey lead", m.records?.observer?.name],
              ["Task specialists", m.helicopter?.taskSpecialists],
              ["Operator manual", m.helicopter?.operatorManualReference],
              ["Loading, fuel and maintenance confirmation", m.helicopter?.loadingReference],
              ["Height", `${m.heightM || "Not recorded"} m ${m.heightReference}`],
              ["Pathway", m.category],
            ]
          : [
              ["Remote pilot", m.records?.pilot?.name],
              ["Observer", m.records?.observer?.name || m.observerId],
              ["Aircraft", m.records?.asset?.description],
              ["Asset reference", m.records?.asset?.assetRef],
              ["Model profile", m.catalogue?.profile?.name],
              ["Payload", m.catalogue?.payload?.name],
              ["Actual take-off mass (kg)", m.massKg],
              ...(!au ? [["Class / legacy status", m.classMark]] : []),
              [au ? "Operator ARN / registration references" : "Operator ID", m.operatorId],
              ["Mode", m.flightMode],
              ["Height", `${m.heightM || "Not recorded"} m ${m.heightReference}`],
              ["Pathway", m.category],
            ]
      ),
    ],
    [
      "Survey plan",
      pairs([
        ["Take-off / landing (WGS84 longitude, latitude)", m.takeoff?.join(", ")],
        ["Landing (WGS84 longitude, latitude)", m.landing?.join(", ")],
        ["Alternate landing (WGS84 longitude, latitude)", m.alternateLanding?.join(", ")],
        ["Deliverables", m.deliverables],
        ["Coordinate reference system", m.crs],
        ["Height datum", m.verticalDatum],
        ["QA / independent check points", m.qa],
      ]),
    ],
    ["Site session journal", fieldJournalText(m)],
    ["Airspace briefing request context", airspaceBriefing(m).text],
    [
      "Checks, airspace and permissions",
      (m.evidence || [])
        .map(
          (e) =>
            `${EVIDENCE_KINDS.find(([id]) => id === e.kind)?.[1] || e.kind}\nResult: ${e.result}\n${e.note}\nSource: ${e.source}\nChecked: ${e.checkedAt}; valid until: ${e.validUntil}\nReviewer: ${e.reviewer}; mission revision: ${e.missionRevision}; rule version: ${e.ruleVersion}\nEvidence file reference: ${e.documentId || "See source reference"}`
        )
        .join("\n\n") || "Not checked. No evidence recorded.",
    ],
    [
      "Weather",
      m.weather
        ? `${m.weather.source}\nFetched: ${m.weather.fetchedAt}; valid until: ${m.weather.validUntil}\nModel: ${m.weather.model}\n${m.weather.heightReference}\n${(m.weather.points || []).map((p, i) => `Point ${i + 1}: ${p.coordinate.join(", ")}\n${p.hours.map((h) => `${h.at}: wind ${h.wind}, gust ${h.gust} m/s; ${h.temp} °C; precipitation ${h.rain} mm; visibility ${h.visibility} m`).join("\n")}`).join("\n\n")}\nData © Open-Meteo and contributing providers, CC BY 4.0. Official warnings not connected.`
        : "Not connected / not checked automatically. See the manual weather assessment, if recorded.",
    ],
    ["Confirmed weather limits", pairs(Object.entries(m.limits || {}))],
    [
      "Automated weather comparison",
      `${m.weather ? weatherAssessment.status : "Not connected — see the recorded manual weather evidence."}\n${weatherAssessment.hours
        .filter((h) => h.warnings.length)
        .map((h) => `${h.at}, point ${h.point}: ${h.warnings.join("; ")}`)
        .join("\n")}`,
    ],
    ["Emergency procedures and contacts", m.emergency || "Not recorded — review required."],
    [
      "Checklist",
      (m.checklistDefinitions || [])
        .map(
          (i) =>
            `${i.stage} (${i.phase}) — ${m.checklist?.[i.id]?.status || "Pending"}\n${i.text}\n${m.checklist?.[i.id]?.by || "Unconfirmed"} · ${m.checklist?.[i.id]?.at || "No completion time"}\nNote / evidence: ${m.checklist?.[i.id]?.note || "None recorded"}\nBasis: ${i.source?.title}; version ${i.version}; responsible role: ${i.role}`
        )
        .join("\n\n"),
    ],
    [
      "Operations Manual",
      m.records?.manual
        ? `${m.records.manual.title} · version ${m.records.manual.version}\nReviewed by ${m.records.manual.approvedBy} at ${m.records.manual.approvedAt}\n${m.records.manual.scope}`
        : "No manual version linked. Review applicability.",
    ],
    [
      "Outstanding actions",
      (m.nextActions || []).map((a) => a.text).join("\n") ||
        (issue.kind === "approved"
          ? "No unresolved actions at the recorded approval time. Conditions must still be monitored."
          : "Readiness has not been certified."),
    ],
    [
      "Responsible person review",
      m.approval
        ? `${m.approval.name}\nRole: ${m.approval.role}\nRecorded: ${m.approval.at}\nMission revision: ${m.approval.revision}\nCurrent conditions on site confirmed: ${m.approval.onSiteConfirmed ? "Yes" : "No"}\nThis is a recorded review, not a handwritten signature or regulatory approval.${helicopter ? " Aviation flight decisions remain with the operator and pilot in command." : ""}`
        : "DRAFT — not approved.",
    ],
    [
      "Sources and limitations",
      (m.sources || [])
        .map(
          (s) =>
            `${s.title}\n${s.url}\nVerified ${s.verifiedOn}; basis: ${s.kind}${s.effectiveFrom ? `; effective from ${s.effectiveFrom}` : ""}`
        )
        .join("\n\n") +
        "\n\nA survey risk assessment does not replace aviation authorisation. A NOTAM is not permission to fly. Landowner consent does not replace required airspace permission. Surface forecasts do not replace aviation weather briefing or measurements at flight height. Missing map objects do not establish their absence.",
    ],
  ];
  if (m.records?.rams) sections.splice(6, 0, ["Linked RAMS snapshot", readableRecord(m.records.rams)]);
  if (m.workContexts?.length)
    sections.splice(3, 0, [
      "Working conditions and arrangements",
      (m.checklistDefinitions || [])
        .filter((c) => c.id.startsWith("context-"))
        .map(
          (c) =>
            `${c.stage}\n${c.text}\nArrangements: ${m.checklist?.[c.id]?.note || "Not recorded"}\nReview: ${m.checklist?.[c.id]?.status || "Pending"}; ${m.checklist?.[c.id]?.by || "No reviewer"}; ${m.checklist?.[c.id]?.at || "No review date"}`
        )
        .join("\n\n"),
    ]);
  if (m.sourceFacts?.length || Object.keys(m.fieldOrigins || {}).length)
    sections.splice(-2, 0, [
      "Document provenance",
      [
        ...Object.entries(m.fieldOrigins || {}).map(
          ([field, origin]) =>
            `${field}: ${m[field] || "Not recorded"}\nSource: ${origin.source}; copied by ${origin.by} at ${origin.at}\n${m[field] === origin.value ? "Matches copied value; confirm the source remains current." : "Edited since reuse; current value differs from the copied source."}`
        ),
        ...(m.sourceFacts || []).map(
          (f) =>
            `${f.label || f.field}: ${f.value}\nSource linked: ${f.sourceName}; ${f.locationUnit || "Page"} ${f.page}\nExcerpt: ${f.quote}\nFile SHA-256: ${f.hash}\nValue reviewed by ${f.by} at ${f.at}\nDocument expiry: ${f.expiresOn || "Not recorded; review applicability"}${f.expiryEvidence ? `\nExpiry excerpt: ${f.expiryEvidence.quote}; ${f.locationUnit || "Page"} ${f.expiryEvidence.page}` : ""}`
        ),
        "Source attribution records where a value came from. It does not authenticate the document, establish regulatory compliance or record a flight release.",
      ].join("\n\n"),
    ]);
  if (helicopter)
    sections.splice(
      3,
      0,
      [
        "Ground and remote-site coordination",
        pairs([
          ["Landing and access", m.helicopter?.landingPlan],
          ["Communications / stop-work", m.helicopter?.communications],
          ["Remote-area assistance / overdue response", m.helicopter?.remoteAreaPlan],
        ]),
      ],
      [
        "Aviation operator decision evidence",
        m.operatorRelease
          ? pairs([
              ["Named decision maker", m.operatorRelease.by],
              ["Evidence reference", m.operatorRelease.reference],
              ["Recorded (UTC)", m.operatorRelease.at],
              ["Valid until (UTC)", m.operatorRelease.validUntil],
              ["Mission revision", m.operatorRelease.missionRevision],
              ["Conditions", m.operatorRelease.conditions],
            ])
          : "Not recorded. This pack does not release the aircraft for flight.",
      ]
    );
  return sections;
}
function readableRecord(value, path = "", depth = 0) {
  if (depth > 7 || value == null) return "";
  if (typeof value !== "object") {
    const text = String(value);
    if (text.startsWith("data:") || text.length > 20000)
      return `${path}: [binary / large content retained in source record]`;
    return `${path}: ${text}`;
  }
  return Object.entries(value)
    .filter(([key]) => !["logo", "image", "dataUrl", "recordFingerprint", "signatureDataUrl"].includes(key))
    .map(([key, v]) => readableRecord(v, path ? `${path} / ${key}` : key, depth + 1))
    .filter(Boolean)
    .join("\n");
}
export async function buildDronePackPdf(issue, exportSession = {}) {
  const m = issue.snapshot;
  const doc = await createDocument(
    packTitle(m),
    m.branding || {},
    `${isHelicopter(m) ? "AIR" : "UAS"}-${m.id.slice(0, 8)} / R${m.revision}`,
    issue.kind === "approved" ? (isHelicopter(m) ? "COORDINATION REVIEW" : "APPROVED SNAPSHOT") : "DRAFT",
    issue.issuedAt,
    exportSession
  );
  doc.cover(m, missionFacts(m));
  doc.contents();
  doc.startBody();
  await doc.map(m, packMapGeometry(m), true);
  if (issue.kind !== "approved" && closeoutSummary(m, undefined, Date.parse(issue.issuedAt)).state === "closed") {
    const closeout = closeoutSections(issue);
    doc.section("Site close-out summary", closeout.find(([label]) => label === "Session at a glance")[1]);
    doc.section("Closing note and handover", closeout.find(([label]) => label === "Closing note and handover")[1]);
  }
  if (issue.kind !== "approved") doc.section("Document quality review", qualityText(m, Date.parse(issue.issuedAt)));
  for (const [label, text] of packSections(issue)) {
    if (label === "Checklist") doc.checklists(checklistGroups(m, Date.parse(issue.issuedAt)));
    else doc.section(label, text);
  }
  return doc.finish();
}
export async function downloadDronePack(issue, options = {}) {
  const session = createPdfExportSession(options);
  session.report("Preparing mission PDF…");
  const pdf = await buildDronePackPdf(issue, session);
  session.assertActive();
  downloadBlob(pdf.output("blob"), missionExportFilename(issue.snapshot, `${issue.kind}.pdf`));
  return { warnings: session.warnings };
}
const PREPARATION_DOCUMENTS = {
  closeout: { title: "Survey Site Close-out Record" },
  field: { title: "Survey Field Card" },
  operator: { title: "Operator Coordination Review" },
  task: {
    title: "Survey Task Plan",
    sections: [
      "Mission",
      "Survey plan",
      "Aircraft and crew",
      "Working conditions and arrangements",
      "Ground and remote-site coordination",
      "Emergency procedures and contacts",
      "Document provenance",
      "Outstanding actions",
      "Sources and limitations",
    ],
  },
  briefing: {
    title: "Survey Crew Briefing",
    sections: [
      "Mission",
      "Aircraft and crew",
      "Working conditions and arrangements",
      "Ground and remote-site coordination",
      "Emergency procedures and contacts",
      "Checklist",
      "Outstanding actions",
      "Sources and limitations",
    ],
  },
  sources: {
    title: "Survey Evidence Register",
    sections: [
      "Mission",
      "Checks, airspace and permissions",
      "Document provenance",
      "Aviation operator decision evidence",
      "Operations Manual",
      "Outstanding actions",
      "Sources and limitations",
    ],
  },
};
export function preparationSections(issue, kind) {
  if (kind === "closeout") return closeoutSections(issue);
  if (["field", "operator"].includes(kind)) return focusedSections(issue, kind);
  const definition = PREPARATION_DOCUMENTS[kind];
  if (!definition) throw new Error("Choose a supported preparation document.");
  return [
    [
      "Document status",
      "DRAFT — preparation only. This document does not record a completed briefing, replace a site-specific risk assessment or release an aircraft for flight.",
    ],
    ...packSections({ ...issue, kind: "draft" }).filter(([label]) => definition.sections.includes(label)),
  ];
}
export async function buildPreparationPdf(issue, kind, exportSession = {}) {
  const sections = preparationSections(issue, kind),
    m = issue.snapshot;
  const doc = await createDocument(
    PREPARATION_DOCUMENTS[kind].title,
    m.branding || {},
    `PREP-${m.id.slice(0, 8)} / R${m.revision}`,
    "DRAFT",
    issue.issuedAt,
    exportSession
  );
  if (kind === "closeout") {
    const summary = closeoutSummary(m, undefined, Date.parse(issue.issuedAt));
    doc.facts(
      [
        ["Site session", summary.state],
        ["Mission cancellation", m.cancelled ? "Cancelled" : "Not marked cancelled"],
        ["Active site minutes (not flight time)", summary.activeMinutes],
        ["Paused minutes", summary.pausedMinutes],
      ],
      true
    );
  }
  for (const [label, text] of sections) {
    if (label === "Checklist") doc.checklists(checklistGroups(m, Date.parse(issue.issuedAt)));
    else if (label === "Mission at a glance")
      doc.facts([["Mission", m.title], ...missionFacts(m), ["Mission revision", m.revision]], true);
    else doc.section(label, text);
  }
  if (["field", "operator"].includes(kind)) {
    const phases = kind === "field" ? ["site"] : ["planning"];
    const groups = checklistGroups(m, Date.parse(issue.issuedAt)).filter((g) => phases.includes(g.phase));
    if (groups.length) doc.checklists(groups);
    else
      doc.section(
        "Applicable checks",
        "No applicable checks are included in this snapshot. Review the full mission checklist."
      );
    if (kind === "field") await doc.map(m, packMapGeometry(m));
  }
  return doc.finish();
}
export async function downloadPreparationDocument(issue, kind, options = {}) {
  const session = createPdfExportSession(options);
  session.report("Preparing document PDF…");
  const pdf = await buildPreparationPdf(issue, kind, session);
  session.assertActive();
  downloadBlob(pdf.output("blob"), missionExportFilename(issue.snapshot, `${kind}-draft.pdf`));
  return { warnings: session.warnings };
}
export async function createCompanyManualPdf(manual, org) {
  const review = manualReview(manual);
  const branding = manual.branding || { ...org, name: manual.company?.name || org.name };
  const reference = `${String(manual.documentCode || `OM-${manual.id.slice(0, 8)}`).slice(0, 45)} / ${String(manual.version).slice(0, 30)}`;
  const doc = await createDocument(
    isHelicopter(manual) ? "Aerial Survey Coordination Plan" : "Drone Operations Manual",
    branding,
    reference,
    manual.approvedAt ? "REVIEWED VERSION" : "DRAFT",
    new Date().toISOString()
  );
  doc.cover(
    { title: manual.title, revision: manual.version },
    [
      ["Document code", manual.documentCode || `OM-${manual.id.slice(0, 8)}`],
      ["Document owner", manual.documentOwner || manual.author],
      ["Next review", manual.reviewDue || "Not recorded"],
      [
        "Applicability",
        `${regionOf(manual).toUpperCase()} / ${isHelicopter(manual) ? "Helicopter survey coordination" : "Drone operations"}`,
      ],
    ],
    {
      revisionLabel: "Version",
      fullTitleLabel: "Manual title",
      statusNote: manual.approvedAt
        ? "Controlled company version. Check the current document register before use."
        : `${review.drafted} of ${review.total} chapters drafted. ${review.reviewed} chapter reviews recorded.`,
      disclaimer:
        "Company procedures must reflect the actual operation. Document review does not grant aviation certification or permission to fly.",
    }
  );
  doc.contents();
  doc.startBody();
  doc.section(
    "Document control",
    "Use the company document register to confirm that this is the current applicable version. Printed or downloaded copies may become outdated."
  );
  doc.facts(manualControlRows(manual));
  doc.section(
    "Review schedule",
    `${reviewTiming(manual).label}. Status assessed on ${new Date().toISOString().slice(0, 10)} (UTC). Check the current company register before use.`
  );
  if (manual.previousId) {
    const comparison = manual.amendmentComparison;
    doc.section(
      "Revision comparison",
      comparison?.baseId === manual.previousId && Array.isArray(comparison.items)
        ? `Compared with version ${comparison.baseVersion}.\n${comparison.items.length ? comparison.items.map((item) => `- ${item.label}`).join("\n") : "No procedure or document-control changes recorded."}\nThis lists changed fields and chapters; consult the amendment record for the reasons and details.`
        : "The earlier version was not available for automatic comparison. Verify the amendment record against the controlled company register."
    );
  }
  doc.section(
    "Company identity",
    [
      manual.company?.name,
      manual.company?.address,
      manual.company?.registrationNo && `Registration / ABN: ${manual.company.registrationNo}`,
      manual.company?.email,
      manual.company?.phone,
    ]
      .filter(Boolean)
      .join("\n") || "Company identity not recorded."
  );
  doc.section(
    "Scope and amendment record",
    `Scope: ${manual.scope}\nAuthor: ${manual.author}\nChange record: ${manual.changeNote}\nReviewed by: ${manual.approvedBy || "Not reviewed"}\n${regionOf(manual) === "au" ? "Document review here does not grant CASA certification or operational privileges. A coordination plan does not replace the aviation operator manual." : "A manual is not an Operational Authorisation. Review against the current applicable operating pathway."}`
  );
  if (!manual.approvedAt)
    doc.section(
      "Draft completion review",
      review.issues.length
        ? review.issues.map((issue, i) => `${i + 1}. ${issue.text}`).join("\n")
        : "Recorded content and chapter reviews are complete. Responsible person review is still required."
    );
  for (const [index, section] of manualSections(manual).entries()) {
    const check = manual.sectionReviews?.[section.id];
    doc.section(
      `${String(index + 1).padStart(2, "0")}  ${section.title}`,
      `${manual.sections?.[section.id] || "Not drafted. Company-specific procedure required."}\n\nChapter review: ${check ? `${check.by} · ${check.at}` : "Not recorded"}`
    );
  }
  doc.section(
    "Controlled distribution",
    manual.distribution || "Record recipients, briefing arrangements and withdrawal of obsolete copies."
  );
  doc.section(
    "Supporting documents and appendices",
    manual.references ||
      "Record the applicable aircraft/operator manuals, authorisations, insurance, competence records and controlled forms."
  );
  doc.section(
    "Source references",
    regionalSources(manual)
      .filter((s) => s.kind !== "manufacturer")
      .map((s) => `${s.title}\n${s.url}\nVerified ${s.verifiedOn}`)
      .join("\n\n")
  );
  return doc.finish();
}
export async function downloadDroneManual(manual, org) {
  const pdf = await createCompanyManualPdf(JSON.parse(JSON.stringify(manual)), org);
  downloadBlob(pdf.output("blob"), `Operations-Manual-${manual.version.replace(/[^\w.-]/g, "_")}.pdf`);
}
