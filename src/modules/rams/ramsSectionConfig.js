/**
 * RAMS document sections — order matches suggested print flow (cover → context → risk → signatures).
 * printSections[sectionId] === false omits that block from PDF/print HTML.
 */

export const RAMS_SECTION_IDS = {
  COVER: "cover",
  WEATHER: "weather",
  MAP: "map",
  HOSPITAL: "hospital",
  OPERATIVE_CERTS: "operative_certs",
  HAZARDS: "hazards",
  SIGNATURES: "signatures",
  INTEGRITY: "integrity",
};

export const RAMS_PRINT_SECTIONS = [
  { id: RAMS_SECTION_IDS.COVER, title: "Cover & details", short: "Cover", defaultInPrint: true, locked: true },
  { id: RAMS_SECTION_IDS.WEATHER, title: "Site weather", short: "Weather", defaultInPrint: true },
  { id: RAMS_SECTION_IDS.MAP, title: "Map / location link", short: "Map", defaultInPrint: true },
  { id: RAMS_SECTION_IDS.HOSPITAL, title: "Nearest A&E / hospital", short: "A&E", defaultInPrint: true },
  { id: RAMS_SECTION_IDS.OPERATIVE_CERTS, title: "Operative competencies", short: "Certs", defaultInPrint: false, optIn: true },
  { id: RAMS_SECTION_IDS.HAZARDS, title: "Risk assessment matrix", short: "Risks", defaultInPrint: true, locked: true },
  { id: RAMS_SECTION_IDS.SIGNATURES, title: "Operative signatures", short: "Signatures", defaultInPrint: true, locked: true },
  { id: RAMS_SECTION_IDS.INTEGRITY, title: "Document integrity", short: "Integrity", defaultInPrint: true },
];

export function normalizePrintSections(raw) {
  const out = {};
  for (const s of RAMS_PRINT_SECTIONS) {
    if (s.locked) out[s.id] = true;
    else if (s.optIn) out[s.id] = raw?.[s.id] === true;
    else out[s.id] = raw?.[s.id] !== false;
  }
  return out;
}

/** Whether a section is included for preview/print (handles opt-in vs default-on). */
export function isSectionIncluded(sectionMeta, printFlags) {
  if (sectionMeta.locked) return true;
  if (sectionMeta.optIn) return printFlags[sectionMeta.id] === true;
  return printFlags[sectionMeta.id] !== false;
}

export function previewAnchorId(sectionId) {
  return `rams-prev-${sectionId}`;
}

/** Lightweight fingerprint for “document integrity” line (not cryptographic). */
export function documentContentHash(obj) {
  const str = JSON.stringify(obj);
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}
