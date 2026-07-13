import { PERMIT_TYPES } from "./permitTypes";

/** Partial overrides for Australian WHS-aligned PTW checklists. */
export const AU_PERMIT_TYPE_OVERRIDES = {
  electrical: {
    checklist: [
      "Isolation point identified and confirmed",
      "Isolation carried out by authorised person",
      "Lock-out/tag-out device applied and padlock secured",
      "Warning notice posted at isolation point",
      "Voltage indicator tested on known live source",
      "System proved dead with approved voltage tester (AS/NZS 3012)",
      "Tester re-proved on known live source after proving dead",
      "All connected equipment confirmed de-energised",
      "Permit held by the person performing the work",
    ],
  },
  work_at_height: {
    checklist: [
      "Access equipment inspected and signed off before use",
      "Scaffold: handover / inspection tag reviewed and current",
      "EWP/MEWP: daily pre-use check; operator holds relevant EWPA or HRWL ticket",
      "Edge protection confirmed in place at all open edges",
      "Harness and lanyard inspected; attached to rated anchor point",
      "Exclusion zone established below work area",
      "Weather conditions assessed — not commenced in high winds or wet/icy conditions",
      "Rescue plan in place for EWP/rope access operations",
      "Overhead hazards (power lines, structures) identified and communicated",
    ],
  },
  confined_space: {
    checklist: [
      "Confined space risk assessment reviewed and current",
      "Atmospheric test completed: O₂ (19.5–23.5%), toxic gases within limits, LEL (<5% before entry)",
      "Continuous monitoring in use during occupation",
      "Mechanical ventilation provided and confirmed operational",
      "Stand-by person briefed and in position outside space",
      "Rescue equipment (tripod, winch, harness) rigged and ready",
      "Emergency rescue plan confirmed with stand-by person",
      "All energy sources isolated (LOTO) before entry",
      "Communication system tested between entrant and stand-by",
      "Maximum occupancy and time in space agreed",
    ],
  },
  excavation: {
    description: "Any excavation or ground disturbance — utility strike prevention (Dial Before You Dig)",
    checklist: [
      "Dial Before You Dig (DBYD) enquiry completed and plans on site",
      "Utility locators (EM + GPR) survey completed where required",
      "Survey results marked on ground before breaking (potholing if needed)",
      "Hand dig zone around marked services confirmed",
      "Excavation supervisor nominated and briefed",
      "Shoring / benching confirmed if depth exceeds safe angle (typically 1.5m+)",
      "Safe means of access and egress provided",
      "Spoil stored minimum 1m from excavation edge",
      "Barriers and covers in place over open excavation",
      "Adjacent structures assessed for undermining risk",
      "Emergency contact 000 and utility strike contacts briefed",
    ],
    extraFields: [
      { key: "catScanBy", label: "Utility locate carried out by", type: "text" },
      { key: "knownServices", label: "Known services in area", type: "text" },
      { key: "excavationDepth", label: "Maximum excavation depth (m)", type: "number" },
      { key: "dbydRef", label: "DBYD enquiry reference", type: "text" },
      { key: "surveyDrawingRef", label: "Utility survey / drawing reference", type: "text" },
      { key: "utilityStrikeContacts", label: "Utility strike emergency contacts", type: "text" },
    ],
  },
  lifting: {
    description: "Crane lifts, EWP lifts, rigging — WHS plant and lifting operations",
    checklist: [
      "Lift plan prepared by competent person",
      "Lifting plant within current inspection / registration requirements",
      "Dogman/rigger competent for the lift",
      "Rigging plan reviewed — correct sling type, rating and angle",
      "Load weight confirmed — does not exceed SWL of any component",
      "Exclusion zone established below and around lift",
      "Banksman / dogger in position with agreed signal system",
      "Ground conditions checked — stable, level, adequate bearing capacity",
      "Overhead hazards (power lines, structures) confirmed clear",
      "Weather / wind speed assessed and within limits",
    ],
  },
  ground_disturbance: {
    checklist: [
      "Ground investigation report reviewed — soil type, contamination, voids",
      "Dial Before You Dig (DBYD) enquiry completed",
      "Utility locators survey completed and marked",
      "Archaeological or heritage assessment completed where required",
      "Ground disturbance method approved by competent person",
      "Vibration monitoring on adjacent structures where required",
      "Pre-work condition survey of adjacent structures photographed",
      "Groundwater monitoring in place if dewatering required",
      "Environmental controls for waterways / sensitive areas confirmed",
    ],
  },
};

/**
 * @param {Record<string, import("./permitTypes").PermitTypeDef>} base
 * @param {Record<string, Partial<import("./permitTypes").PermitTypeDef>>} overrides
 */
export function mergePermitMarketOverrides(base, overrides) {
  const out = { ...base };
  for (const [key, patch] of Object.entries(overrides)) {
    if (!out[key]) continue;
    out[key] = {
      ...out[key],
      ...patch,
      extraFields: patch.extraFields ?? out[key].extraFields,
      checklist: patch.checklist ?? out[key].checklist,
    };
  }
  return out;
}

const PL_PERMIT_TYPE_OVERRIDES = {
  excavation: {
    description: "Wykop lub naruszenie gruntu — mapy uzbrojenia (CPD / geodeta)",
    checklist: [
      "Zlecenie mapy uzbrojenia terenu (geodeta / CPD)",
      "Wyniki zapisane na placu budowy przed rozpoczęciem wykopu",
      "Ręczne wykopy w strefach niepewnych",
      "Stabilizacja ścian wykopu / zabezpieczenie krawędzi",
      "Strefa wyłączona nad wykopem",
      "Koordynator BHP poinformowany przed startem",
    ],
  },
  work_at_height: {
    checklist: [
      "Sprawdzenie rusztowań / podestów — aktualna dopuszczalność",
      "Uprawnienia UDT dla podestów i żurawi",
      "Barierki na krawędziach",
      "Szelki i linki — kontrola przed użyciem",
      "Strefa pod robotami wyłączona",
      "Warunki wiatrowe ocenione",
    ],
  },
  electrical: {
    checklist: [
      "Punkt izolacji zidentyfikowany",
      "Izolacja przez osobę z uprawnieniami SEP",
      "Kłódka LOTO i tabliczka",
      "Potwierdzenie braku napięcia",
      "Pozwolenie u osoby wykonującej pracę",
    ],
  },
};

/** @param {import("../../config/markets").MarketId} marketId */
export function getPermitTypesForMarket(marketId = "uk") {
  if (marketId === "au") return mergePermitMarketOverrides(PERMIT_TYPES, AU_PERMIT_TYPE_OVERRIDES);
  if (marketId === "pl") return mergePermitMarketOverrides(PERMIT_TYPES, PL_PERMIT_TYPE_OVERRIDES);
  return PERMIT_TYPES;
}

/** @param {string} type @param {import("../../config/markets").MarketId} marketId */
export function checklistStringsForMarket(type, marketId = "uk") {
  return getPermitTypesForMarket(marketId)[type]?.checklist || [];
}
