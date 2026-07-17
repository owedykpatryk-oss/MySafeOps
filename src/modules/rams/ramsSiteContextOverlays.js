/**
 * Site-context overlays for surveying RAMS — location rules that layer on any activity pack.
 * Activity (PAS128 / topo / GPR) stays the same; overlays add treatment / substation / rail / highway / brownfield controls.
 */

/** @typedef {{
 *   key: string,
 *   label: string,
 *   shortLabel: string,
 *   description: string,
 *   scopeAddendum: string,
 *   briefingBullets: string[],
 *   hazardTokens: string[],
 *   hazardIds: string[],
 *   permitHints: string[],
 *   requiredCerts: string[],
 *   photoChecklist: string[],
 *   holdPoints: string[],
 * }} SiteContextOverlay */

/** @type {SiteContextOverlay[]} */
export const SITE_CONTEXT_OVERLAYS = [
  {
    key: "treatment_works",
    label: "Treatment works / WWTW / pumping station",
    shortLabel: "Treatment works",
    description: "Live process plant, wet wells, H₂S / chlorine interfaces and client escort controls.",
    scopeAddendum:
      "Site context — treatment works / WWTW / pumping station: works under client escort within live process areas. Atmospheric hazards (H₂S, chlorine, methane), wet-well and channel interfaces, and process-isolation rules apply in addition to the survey activity method.",
    briefingBullets: [
      "Client induction and escort confirmed before entry to process areas",
      "Gas monitor (H₂S / O₂ / LEL) on person; know alarm actions",
      "No chamber/wet-well entry without confined-space permit and rescue plan",
      "Stay clear of open channels, weirs and chemical dosing points",
      "Hygiene / wash-down and boot-clean stations used on exit",
    ],
    hazardTokens: ["treatment works", "wwtw", "h2s", "chlorine", "wet well", "process plant", "escort"],
    hazardIds: ["site_ctx_001", "site_ctx_002"],
    permitHints: ["Client site permit / escort", "Confined space (if wet-well/chamber entry)", "Hot work (if client requires)"],
    requiredCerts: ["Client site induction", "Confined space awareness", "Gas monitor competence"],
    photoChecklist: [
      "Site access / induction board",
      "Gas monitor bump-test evidence",
      "Work area cordon near channels / covers",
      "Open chambers supervised while lifted",
      "Hygiene / decontamination exit",
    ],
    holdPoints: [
      "HP-SC1 Client escort / induction complete",
      "HP-SC2 Gas monitor bump test before process-area entry",
      "HP-SC3 No open wet-well left unsupervised",
    ],
  },
  {
    key: "substation_hv",
    label: "Substation / HV compound",
    shortLabel: "Substation / HV",
    description: "DNO / IDNO compound — induction zones, EMI on GNSS/UAV, escort and no-go live apparatus.",
    scopeAddendum:
      "Site context — substation / HV compound: works only in authorised zones under DNO/IDNO or client electrical escort. Electromagnetic interference may degrade GNSS and UAV control; live apparatus and earthing rules apply in addition to the survey activity method.",
    briefingBullets: [
      "Authorised person / electrical escort briefing before compound entry",
      "Stay within marked safe walking routes; no climbing apparatus or fences",
      "Expect GNSS / UAV EMI near live plant — plan alternate control methods",
      "No metallic poles or rods near live HV without AP authorisation",
      "Report any unexpected apparatus or cable strike risk immediately",
    ],
    hazardTokens: ["substation", "hv", "high voltage", "emi", "dno", "arc", "electrical compound"],
    hazardIds: ["site_ctx_003", "site_ctx_004"],
    permitHints: ["Electrical / substation access permit", "Client escort authorisation", "Aerial survey coordination (if UAV)"],
    requiredCerts: ["Substation / HV induction", "Authorised person briefing", "Electrical safety awareness"],
    photoChecklist: [
      "Compound gate / induction evidence",
      "Marked safe route and exclusion zones",
      "Survey kit clear of live apparatus",
      "GNSS / control setup away from EMI sources",
      "Escort sign-out / handback",
    ],
    holdPoints: [
      "HP-SC1 Electrical escort / AP briefing complete",
      "HP-SC2 Safe walking routes confirmed",
      "HP-SC3 GNSS/UAV EMI contingency agreed",
    ],
  },
  {
    key: "rail_nr",
    label: "Rail / Network Rail corridor",
    shortLabel: "Rail / NR",
    description: "PTS, possession / line blockage, lookouts, red-zone rules and COSS briefing.",
    scopeAddendum:
      "Site context — rail / Network Rail corridor: survey only within authorised possession, line blockage or separated green zone under COSS / SWL control. PTS competency, lookout arrangements and red-zone rules apply in addition to the survey activity method.",
    briefingBullets: [
      "PTS cards and COSS / SWL briefing before trackside access",
      "Possession / line blockage / SSOW confirmed for the work window",
      "Know red-zone / green-zone boundaries and lookout positions",
      "No lone working trackside; radio check-in agreed",
      "Handback and clear line of sight before train movements resume",
    ],
    hazardTokens: ["rail", "network rail", "pts", "possession", "lookout", "trackside", "coss"],
    hazardIds: ["site_ctx_005", "site_ctx_006", "rail_001"],
    permitHints: ["Rail corridor access / SSOW", "Possession or line blockage", "Confined space (if tunnel/chamber)"],
    requiredCerts: ["PTS (Personal Track Safety)", "COSS / SWL briefing", "Site induction (NR / TOC)"],
    photoChecklist: [
      "PTS / induction board",
      "Possession / SSOW paperwork on site",
      "Lookout / safe system positions",
      "Kit clear of running line",
      "Handback evidence",
    ],
    holdPoints: [
      "HP-SC1 PTS + COSS briefing complete",
      "HP-SC2 Possession / SSOW window confirmed",
      "HP-SC3 Handback / clear before trains",
    ],
  },
  {
    key: "highway_tm",
    label: "Live highway / Chapter 8 TM",
    shortLabel: "Highway / TM",
    description: "Carriageway or verge survey with Chapter 8 controls, banksman and public segregation.",
    scopeAddendum:
      "Site context — live highway / public carriageway: Chapter 8 traffic management, banksman / spotter and pedestrian segregation apply in addition to the survey activity method. No work outside approved TM layout.",
    briefingBullets: [
      "TM layout / lane closure approved before mobilisation",
      "Banksman or spotter for scan vehicle and tripod setups",
      "Hi-vis Class 3; face traffic; no backs to live lanes",
      "Pedestrian routes maintained or diverted",
      "Demobilise TM and reopen carriageway on close-out",
    ],
    hazardTokens: ["highway", "chapter 8", "carriageway", "traffic", "banksman", "tm", "public"],
    hazardIds: ["site_ctx_007", "site_ctx_008"],
    permitHints: ["Temporary traffic management approval", "Lane / footway closure notice", "Night works (if applicable)"],
    requiredCerts: ["Chapter 8 / TM awareness", "Banksman / vehicle marshalling", "CSCS (where required)"],
    photoChecklist: [
      "TM layout / advance signs in place",
      "Banksman / exclusion zone",
      "Tripod / GPR clear of live lane",
      "Pedestrian segregation",
      "TM demobilisation complete",
    ],
    holdPoints: [
      "HP-SC1 TM layout approved and in place",
      "HP-SC2 Banksman briefed before first pass",
      "HP-SC3 Carriageway reopened / TM removed",
    ],
  },
  {
    key: "brownfield",
    label: "Brownfield / contaminated land",
    shortLabel: "Brownfield",
    description: "Made ground, asbestos in soils, VOC / ground gas and decontamination controls.",
    scopeAddendum:
      "Site context — brownfield / contaminated land: desk-study contamination and UXO caveats apply. RPE, hygiene and decontamination controls apply in addition to the survey activity method; intrusive works follow permit-to-dig and GI interfaces.",
    briefingBullets: [
      "Desk study / contamination status briefed before ground disturbance",
      "Avoid unnecessary soil contact; use gloves and wash stations",
      "Stop-work if unexpected odours, sheen, asbestos-suspect materials or UXO indicators",
      "RPE as assessed; no eating/drinking in work zone",
      "Decontaminate boots/kit before leaving site",
    ],
    hazardTokens: ["brownfield", "contamination", "asbestos", "voc", "ground gas", "uxo", "made ground"],
    hazardIds: ["site_ctx_009", "site_ctx_010"],
    permitHints: ["Excavation / permit-to-dig", "Ground disturbance / GI interface", "Asbestos awareness briefing (if ACM risk)"],
    requiredCerts: ["Asbestos awareness (where indicated)", "Contamination / hygiene briefing", "Gas monitor competence (where indicated)"],
    photoChecklist: [
      "Site condition / made ground evidence",
      "PPE / RPE issue",
      "Wash / decon station",
      "Unexpected finds logged with photo",
      "Kit decontamination before demob",
    ],
    holdPoints: [
      "HP-SC1 Contamination desk study briefed",
      "HP-SC2 Unexpected finds stop-work understood",
      "HP-SC3 Decontamination complete before demob",
    ],
  },
];

const BY_KEY = Object.fromEntries(SITE_CONTEXT_OVERLAYS.map((o) => [o.key, o]));

/** @param {string} key */
export function getSiteContextOverlay(key) {
  const k = String(key || "").trim();
  return BY_KEY[k] || null;
}

/** @returns {{ key: string, label: string }[]} */
export function listSiteContextOverlayOptions() {
  return SITE_CONTEXT_OVERLAYS.map((o) => ({ key: o.key, label: o.label }));
}

/**
 * Merge overlay hazard tokens with an activity pack's tokens (deduped).
 * @param {string[]} packTokens
 * @param {SiteContextOverlay | null | undefined} overlay
 */
export function mergeSiteContextHazardTokens(packTokens = [], overlay) {
  const out = [];
  const seen = new Set();
  for (const t of [...(packTokens || []), ...(overlay?.hazardTokens || [])]) {
    const k = String(t || "").trim().toLowerCase();
    if (!k || seen.has(k)) continue;
    seen.add(k);
    out.push(String(t).trim());
  }
  return out;
}

/**
 * Append overlay scope addendum once (idempotent by overlay key marker).
 * @param {string} existingScope
 * @param {SiteContextOverlay} overlay
 */
export function appendSiteContextScope(existingScope, overlay) {
  if (!overlay) return String(existingScope || "");
  const scoped = String(existingScope || "").trim();
  const marker = `Site context — ${overlay.shortLabel}`;
  if (scoped.includes(marker) || scoped.includes(overlay.scopeAddendum)) return scoped;
  return scoped ? `${scoped}\n\n${overlay.scopeAddendum}` : overlay.scopeAddendum;
}

/**
 * Build briefing block for communication plan / toolbox talk.
 * @param {SiteContextOverlay} overlay
 */
export function formatSiteContextBriefing(overlay) {
  if (!overlay) return "";
  return [`Site context briefing (${overlay.shortLabel}):`, ...overlay.briefingBullets.map((b) => `- ${b}`)].join("\n");
}

/**
 * Filter hazard library rows for a site overlay (by id first, then token match).
 * @param {SiteContextOverlay} overlay
 * @param {object[]} hazardLibrary
 * @param {number} [limit]
 */
export function findHazardsForSiteContext(overlay, hazardLibrary, limit = 10) {
  if (!overlay || !Array.isArray(hazardLibrary)) return [];
  const byId = new Set(overlay.hazardIds || []);
  const toks = (overlay.hazardTokens || []).map((t) => String(t).toLowerCase());
  const preferred = hazardLibrary.filter((h) => byId.has(h.id));
  const matched = hazardLibrary.filter((h) => {
    if (byId.has(h.id)) return false;
    const hay = `${h.id} ${h.category} ${h.activity} ${h.hazard}`.toLowerCase();
    return toks.some((t) => hay.includes(t));
  });
  return [...preferred, ...matched].slice(0, limit);
}

/**
 * Merge unique string lists.
 * @param {string[]} a
 * @param {string[]} b
 */
export function mergeUniqueStrings(a = [], b = []) {
  const out = [];
  const seen = new Set();
  for (const x of [...(a || []), ...(b || [])]) {
    const s = String(x || "").trim();
    if (!s || seen.has(s.toLowerCase())) continue;
    seen.add(s.toLowerCase());
    out.push(s);
  }
  return out;
}
