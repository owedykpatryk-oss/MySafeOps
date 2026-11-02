import { SOURCES, CHECKLIST, MANUAL_SECTIONS, LIBRARY_VERSION } from "./droneLibrary.js";

const source = (title, url, kind = "regulatory guidance") => ({ title, url, kind, verifiedOn: "2026-10-29" });
export const AU_SOURCES = {
  rpasp: source(
    "CASA RPAS licensing and operations — AC 101-01",
    "https://www.casa.gov.au/sites/default/files/2022-09/advisory-circular-101-01-remotely-piloted-aircraft-systems-licensing-and-operations.pdf"
  ),
  categories: source(
    "CASA drone weight categories and requirements",
    "https://www.casa.gov.au/drones/operator-accreditation-certificate/drone-weight-categories-and-requirements"
  ),
  aerial: source(
    "CASA Part 138 — aerial work operations",
    "https://www.casa.gov.au/rules/regulatory-framework/casr/part-138-casr-aerial-work-operations"
  ),
  photography: source(
    "CASA aerial photography from aircraft",
    "https://www.casa.gov.au/licences-and-certificates/air-operators/aerial-photography-aircraft"
  ),
  briefing: source(
    "Airservices Australia NAIPS briefing service",
    "https://www.airservices.gov.au/naips/Documents/About",
    "official briefing route"
  ),
};
export const AU_TIME_ZONES = [
  "Australia/Sydney",
  "Australia/Melbourne",
  "Australia/Brisbane",
  "Australia/Adelaide",
  "Australia/Darwin",
  "Australia/Perth",
  "Australia/Hobart",
  "Australia/Lord_Howe",
  "Australia/Eucla",
];
export const UK_PATHWAYS = [
  "Open A1",
  "Open A2",
  "Open A3",
  "Specific PDRA01",
  "Specific UK SORA",
  "Specific other authorisation",
];
export const AU_PATHWAYS = [
  "CASA ReOC operation",
  "CASA excluded category — reviewed",
  "CASA other approval — reviewed",
];
export const HELICOPTER_PATHWAYS = ["CASA Part 138 aerial work — scope verified"];
export const regionOf = (m) => m?.regionCode || "uk";
export const kindOf = (m) => m?.aircraftKind || "drone";
// Supported operating coverage, not a sovereign-border or airspace determination.
export function pointInRegion(point, region) {
  const b = region === "au" ? [112, -45, 155, -9] : region === "uk" ? [-9, 49, 3, 61] : null;
  return (
    Boolean(b) &&
    Array.isArray(point) &&
    point.length >= 2 &&
    point.slice(0, 2).every(Number.isFinite) &&
    point[0] >= b[0] &&
    point[0] <= b[2] &&
    point[1] >= b[1] &&
    point[1] <= b[3]
  );
}
export const isHelicopter = (m) => kindOf(m) === "helicopter";
export const ruleVersion = (m) => (regionOf(m) === "au" ? "au.2026.10.29.1" : LIBRARY_VERSION);
export function missionTimeZone(m) {
  const region = regionOf(m);
  if (!["uk", "au"].includes(region)) throw new Error("Unsupported operation region.");
  const zone = m?.timeZone || (region === "uk" ? "Europe/London" : "");
  if (!(region === "au" ? AU_TIME_ZONES : ["Europe/London"]).includes(zone))
    throw new Error("Choose a valid operation time zone for this region.");
  return zone;
}
export function regionalSources(m) {
  if (regionOf(m) === "uk") return Object.values(SOURCES);
  return isHelicopter(m)
    ? [AU_SOURCES.aerial, AU_SOURCES.photography, AU_SOURCES.briefing]
    : [
        AU_SOURCES.rpasp,
        AU_SOURCES.categories,
        AU_SOURCES.briefing,
        ...Object.values(SOURCES).filter((s) => s.kind === "manufacturer"),
      ];
}
export function regionalEvidence(m, base) {
  if (regionOf(m) === "uk") return base;
  const helicopter = isHelicopter(m);
  const descriptions = {
    airspace:
      "Review the entire operating volume, route, heights and time window using current Australian aviation briefing sources. Record restrictions, NOTAM applicability, contacts and any required permissions.",
    weather: helicopter
      ? "Record the operator/pilot aviation weather briefing, its coverage and validity. Review aircraft and operational limits. A surface forecast is supplementary site information."
      : "Review current weather, representative points and confirmed aircraft/payload/operator limits; record applicable warnings and local conditions.",
    pathway: helicopter
      ? "Verify the operator, Aerial Work Certificate scope, applicable Part 91/138 conditions and any additional approvals with the operator. Record the task classification and supporting reference."
      : "Confirm the applicable CASA pathway and actual operating conditions. Record registration, ARN, accreditation or RePL/ReOC as applicable; excluded-category eligibility requires review.",
    competence: helicopter
      ? "Record the pilot and task specialists, training/currency, fitness, briefing and operator confirmation for these duties."
      : "Confirm current pilot competence, currency and the accreditation or licence required by the chosen CASA pathway.",
    equipment: helicopter
      ? "Record aircraft registration, maintenance release, approved sensor installation, loading/mass and balance, fuel planning and operator confirmation. Do not infer airworthiness from a Plant inspection."
      : "Confirm aircraft registration/serial, actual mass, sensor compatibility, batteries, inspections and open defects.",
    manual: helicopter
      ? "Reference the actual operator manual and applicable procedures. A survey coordination plan does not replace the aviation operator manual."
      : "Confirm applicable operator procedures and the ReOC manual where required. Record whether the mission is covered.",
    rams: helicopter
      ? "Review survey-team risk controls, rotor and downwash hazards, landing/access arrangements, wires, loose objects, communications and remote-area emergency response."
      : "Review site risk controls, access, people, wires, lost link/GNSS, batteries, weather, privacy and emergency contacts.",
  };
  return base.map(([id, title, description]) => [id, title, descriptions[id] || description]);
}
const helicopterChecks = [
  [
    "operator",
    "Operator coordination",
    "Confirm the operator, aircraft, task classification, certificate scope and division of responsibilities.",
    "planning",
  ],
  [
    "aviation",
    "Aviation briefing",
    "Obtain the pilot/operator airspace, NOTAM and aviation weather review covering the complete operation.",
    "planning",
  ],
  [
    "installation",
    "Survey equipment and loading",
    "Obtain operator confirmation of sensor attachment, loose equipment, loading/mass and balance, maintenance and fuel arrangements.",
    "planning",
  ],
  [
    "task-crew",
    "Survey personnel",
    "Confirm task specialist duties, training, fitness, passenger/crew classification and operator briefing.",
    "planning",
  ],
  [
    "remote",
    "Remote site response",
    "Confirm communications coverage, check-in arrangements, overdue response, emergency contacts and access to assistance.",
    "planning",
  ],
  [
    "landing",
    "Landing and ground interface",
    "Inspect the agreed landing/access area with the operator; address wires, obstacles, public access, dust and loose materials.",
    "site",
  ],
  [
    "rotors",
    "Rotor and downwash briefing",
    "Follow operator directions for approach/departure, boarding, rotor hazards, loose items, hearing/eye protection and exclusion arrangements.",
    "site",
  ],
  [
    "communications",
    "Crew briefing and stop-work",
    "Confirm communications, task boundaries, abort/stop-work responsibilities and the operator decision to proceed.",
    "site",
  ],
  [
    "monitor",
    "During operation",
    "Monitor changes and communicate hazards under the agreed operator procedures.",
    "flight",
  ],
  [
    "debrief",
    "Debrief and data QA",
    "Record flight/task outcomes, data checks, incidents and required follow-up with the operator.",
    "post",
  ],
];
export function regionalChecklist(m) {
  if (regionOf(m) === "uk") return CHECKLIST;
  if (!isHelicopter(m)) return CHECKLIST.map((c) => ({ ...c, version: ruleVersion(m), source: AU_SOURCES.rpasp }));
  return helicopterChecks.map(([id, stage, text, phase]) => ({
    id: `heli-${id}`,
    stage,
    text,
    phase,
    role: "Survey lead with aviation operator",
    version: ruleVersion(m),
    source: AU_SOURCES.aerial,
    kind: "platform coordination prompt",
  }));
}
export function manualApplies(manual, m) {
  return regionOf(manual) === regionOf(m) && kindOf(manual) === kindOf(m);
}
export function manualSections(m) {
  if (regionOf(m) === "uk") return MANUAL_SECTIONS;
  if (!isHelicopter(m))
    return MANUAL_SECTIONS.map((s) => ({
      ...s,
      source: AU_SOURCES.rpasp,
      prompt:
        s.id === "scope"
          ? "Describe the CASA operating pathway, ReOC scope or reviewed excluded-category conditions and associated procedures."
          : s.prompt.replace("Operational Authorisation", "CASA authorisation"),
    }));
  const prompts = {
    operator:
      "Identify the survey organisation and aviation operator; define coordination responsibilities and safety commitments.",
    scope:
      "Describe the survey task, own or contracted aviation services, certificate scope verification and the boundaries of this coordination plan.",
    people:
      "Record survey lead and task specialist responsibilities, competence, fitness and operator briefing arrangements.",
    fleet:
      "Reference operator aircraft and approved survey equipment; describe how installation, loading and maintenance confirmations are obtained.",
    planning:
      "Describe site feasibility, operator liaison, aviation briefing evidence, permissions, privacy and access arrangements.",
    normal:
      "Define operator-led boarding and ground briefings, communications, task coordination and stop-work procedures.",
    maintenance:
      "Reference operator maintenance responsibility; define survey equipment care, defect escalation and record control.",
    emergency:
      "Define coordination with the operator emergency plan, remote-site assistance, overdue response and incident contacts.",
    risk: "Describe survey-team risk reviews, contractor assurance, insurance and escalation of operational changes.",
    control:
      "Control versions, approvals, review dates and appendices; link the actual aviation operator manuals without replacing them.",
  };
  return MANUAL_SECTIONS.map((s) => ({ ...s, prompt: prompts[s.id], source: AU_SOURCES.aerial }));
}
export const approvedStatus = (m) =>
  isHelicopter(m) ? "Survey coordination reviewed" : "Approved by responsible person";
export const packTitle = (m) =>
  isHelicopter(m) ? "Helicopter Survey Coordination Pack" : "Drone Survey Pre-flight Pack";
