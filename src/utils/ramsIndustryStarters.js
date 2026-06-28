/**
 * Trade RAMS starter packs — keyed by orgIndustryPacks.ramsStarterKey.
 * Surveying keys (e.g. utility_mapping_survey) are handled in RAMSTemplateBuilder SURVEYING_PACKS.
 */

import { getAppliedIndustryPackId, INDUSTRY_PACKS } from "./orgIndustryPacks";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";

/** @typedef {{ key: string, label: string, scope: string, method: string, hazardTokens: string[], categories?: string[] }} TradeRamsStarter */

/** @type {Record<string, TradeRamsStarter>} */
export const TRADE_RAMS_STARTERS = {
  general: {
    key: "general",
    label: "General construction",
    scope:
      "General construction and maintenance activities with CDM coordination, permit interfaces, and daily briefing before start.",
    method:
      "1. Pre-start briefing and permit checks.\n\n2. Set exclusion zones and pedestrian/plant segregation.\n\n3. Verify tools, PPE and competence for the task.\n\n4. Execute work under supervisor control with stop-work authority.\n\n5. Close-out inspection and handover notes.",
    hazardTokens: [
      "manual handling",
      "slips",
      "trip",
      "work at height",
      "moving plant",
      "pedestrian",
      "noise",
      "dust",
      "adverse weather",
    ],
    categories: ["General", "Groundworks", "Access"],
  },
  electrical: {
    key: "electrical",
    label: "Electrical & M&E",
    scope:
      "Electrical isolation, verification and controlled maintenance with LOTO, test-before-touch and permit interfaces.",
    method:
      "1. Confirm isolation plan and competent persons.\n\n2. Apply LOTO and verify dead before work.\n\n3. Test-before-touch and prove dead where required.\n\n4. Control hot work and fire watch interfaces.\n\n5. Re-energisation only under authorised procedure.",
    hazardTokens: [
      "electrical",
      "live cable",
      "switchgear",
      "isolation",
      "loto",
      "hot work",
      "arc",
      "test-before-touch",
      "manual handling",
    ],
    categories: ["Electrical", "Hot works", "General"],
  },
  refurb_build: {
    key: "refurb_build",
    label: "Building & refurbishment",
    scope:
      "Refurbishment and fit-out in occupied or live buildings — dust, noise, access, snagging and client interface controls.",
    method:
      "1. Walk-round and client/site induction.\n\n2. Set dust/noise controls and protected routes.\n\n3. Sequence intrusive works with isolation checks.\n\n4. Log snags and defects during progress inspections.\n\n5. Handover with snag close-out evidence.",
    hazardTokens: [
      "refurb",
      "fit-out",
      "dust",
      "noise",
      "manual handling",
      "work at height",
      "slips",
      "trip",
      "occupied",
      "hot work",
    ],
    categories: ["General", "Access", "Hot works"],
  },
  groundworks: {
    key: "groundworks",
    label: "Groundworks & excavation",
    scope:
      "Excavation, groundworks and demolition interfaces with permit-to-dig, buried services and temporary works controls.",
    method:
      "1. Verify utility records and scan proof before dig.\n\n2. Mark tolerance zones and establish banksman controls.\n\n3. Excavate in stages with edge protection.\n\n4. Record exposures and temporary works checks.\n\n5. Backfill/reinstate and close permit.",
    hazardTokens: [
      "excavation",
      "dig",
      "buried",
      "utility",
      "permit-to-dig",
      "plant",
      "collapse",
      "manual handling",
      "traffic",
    ],
    categories: ["Groundworks", "General", "Plant"],
  },
};

export const SURVEY_RAMS_STARTER_KEYS = new Set(["utility_mapping_survey"]);

/** @param {unknown} key */
export function isSurveyRamsStarterKey(key) {
  return typeof key === "string" && SURVEY_RAMS_STARTER_KEYS.has(key);
}

/** @param {unknown} key */
export function isValidTradeRamsStarterKey(key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(TRADE_RAMS_STARTERS, key);
}

/** @param {unknown} key @returns {TradeRamsStarter | null} */
export function findTradeStarterByKey(key) {
  if (!isValidTradeRamsStarterKey(key)) return null;
  return TRADE_RAMS_STARTERS[key];
}

/** @param {unknown} key */
export function getRamsStarterLabel(key) {
  if (isSurveyRamsStarterKey(key)) return "PAS128 utility mapping survey";
  const starter = findTradeStarterByKey(key);
  return starter?.label || "General construction";
}

/** Effective RAMS starter for new documents — saved key or profile default. */
export function getOrgRamsStarterKey() {
  const raw = loadOrgSettingsRaw();
  if (typeof raw.ramsStarterKey === "string" && raw.ramsStarterKey) {
    const saved = raw.ramsStarterKey;
    if (isValidTradeRamsStarterKey(saved) || isSurveyRamsStarterKey(saved)) return saved;
  }
  const packId = getAppliedIndustryPackId();
  const fromPack = packId && INDUSTRY_PACKS[packId]?.ramsStarterKey;
  if (fromPack === null) return null;
  if (typeof fromPack === "string" && fromPack) return fromPack;
  return "general";
}

/** Short AI / Help context line for the active starter. */
export function getRamsStarterAiHint(starterKey = getOrgRamsStarterKey()) {
  if (isSurveyRamsStarterKey(starterKey)) {
    return "Organisation profile: surveying / PAS128. Include utility strike, traffic, chamber and scan-validation hazards where relevant.";
  }
  const starter = findTradeStarterByKey(starterKey);
  if (!starter) return "Organisation profile: general construction. Use UK HSE RAMS conventions.";
  return `Organisation profile: ${starter.label}. Prioritise hazards matching: ${starter.hazardTokens.slice(0, 6).join(", ")}.`;
}

/** Match hazard library rows to starter tokens (shared with RAMS builder). */
export function hazardMatchesStarterTokens(h, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return true;
  const hay = `${h?.id || ""} ${h?.category || ""} ${h?.activity || ""} ${h?.hazard || ""}`.toLowerCase();
  return tokens.some((t) => hay.includes(String(t).toLowerCase()));
}

/** @param {string[]} tokens @param {object[]} hazardLibrary @param {number} [limit] */
export function findHazardsForStarterTokens(tokens, hazardLibrary, limit = 14) {
  if (!Array.isArray(hazardLibrary)) return [];
  const matched = hazardLibrary.filter((h) => hazardMatchesStarterTokens(h, tokens));
  return matched.slice(0, limit);
}
