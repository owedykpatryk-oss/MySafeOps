/**
 * In-app guide copy for workspace profiles — Help, onboarding, and Settings.
 */

import { INDUSTRY_PACKS } from "./orgIndustryPacks";
import { getOrgIndustryPackId } from "./projectHubIndustry";
import { getIndustryPackLabel, getPackWorkflowHelp, getIndustrySitePackTitle } from "./industryPackProfile";
import { getRamsStarterLabel } from "./ramsIndustryStarters";
import { getOrgMarketId } from "./orgMarket";
import { localizeIndustryTerminology } from "./marketLabels";

function locGuide(text, marketId = getOrgMarketId()) {
  return localizeIndustryTerminology(String(text || ""), marketId);
}

/** @typedef {{ tagline: string, whoFor: string, adjusts: string[], hubFocus: string, ramsNote: string }} ProfileGuideEntry */

export const WORKSPACE_PROFILE_OVERVIEW = {
  title: "Workspace profiles",
  lead:
    "A workspace profile tailors MySafeOps to how your organisation actually works — without deleting any data. Pick once during setup or change later under Settings → Organisation.",
  whatItDoes: [
    "Shows or hides modules in More and Search so your team sees relevant registers first.",
    "Adjusts Project Hub readiness gates, next actions, and the final pipeline step (Inspections vs Survey deliverable).",
    "Surfaces the right project playbooks when you create a new site or job.",
    "Shapes the More command centre pulse and industry site pack PDF exports.",
    "Suggests a RAMS hazard starter in the builder (Step 2) matched to your trade.",
  ],
  whatItDoesNot:
    "Switching profile never deletes projects, RAMS, permits, or register rows. Hidden modules stay on the device — unhide them anytime under Organisation → Modules.",
  previewTitle: "Preview mode (session only)",
  previewBody:
    "Before you apply a new profile, use Preview in Project Hub to see readiness copy and gates for that profile. Module layout only updates when you click Apply. Preview clears when you close the browser tab.",
  changeSteps: [
    "Open More → Settings → Organisation → Workspace profile.",
    "Select the profile that matches your work.",
    "Optionally tick Seed empty registers to add starter rows in key modules.",
    "Click Preview in Project Hub if you want to try before applying.",
    "Click Apply workspace profile — admins only.",
  ],
};

/** Market-localized copy for Help and onboarding (RAMS/CDM → SWMS/WHS etc.). */
export function getWorkspaceProfileOverview(marketId = getOrgMarketId()) {
  const loc = (text) => locGuide(text, marketId);
  return {
    title: WORKSPACE_PROFILE_OVERVIEW.title,
    lead: loc(WORKSPACE_PROFILE_OVERVIEW.lead),
    whatItDoes: WORKSPACE_PROFILE_OVERVIEW.whatItDoes.map(loc),
    whatItDoesNot: loc(WORKSPACE_PROFILE_OVERVIEW.whatItDoesNot),
    previewTitle: WORKSPACE_PROFILE_OVERVIEW.previewTitle,
    previewBody: loc(WORKSPACE_PROFILE_OVERVIEW.previewBody),
    changeSteps: WORKSPACE_PROFILE_OVERVIEW.changeSteps.map(loc),
  };
}

/** Per-profile guide entries keyed like INDUSTRY_PACKS. */
export const PROFILE_GUIDE_ENTRIES = {
  generalContractor: {
    tagline: "Core site HSE for builders, civils, and trade contractors.",
    whoFor: "Main contractors, subcontractors, and multi-trade sites that need CDM, RAMS, PTW, and daily briefings — not PAS128 survey deliverables.",
    adjusts: [
      "Hides Survey report module and surveying RAMS packs.",
      "Project Hub ends with Inspections; readiness tracks CDM, briefing, RAMS, and open snags.",
      "Features general and groundworks playbooks.",
    ],
    hubFocus: "Contractor site pack — briefings, CDM, RAMS, snags, timesheets, PTW.",
    ramsNote: "General construction starter — manual handling, height, plant, and site interface hazards.",
  },
  electricalContractor: {
    tagline: "Electrical and M&E maintenance with isolation and hot-work evidence.",
    whoFor: "Electrical contractors, M&E firms, and maintenance teams working on live services, distribution boards, and controlled energisation.",
    adjusts: [
      "Readiness gates emphasise hot work, PAT, LOTO, and inspections.",
      "Survey report module hidden; electrical site pack for audit exports.",
      "Electrical playbook featured on new projects.",
    ],
    hubFocus: "Electrical & M&E site pack — PAT, hot work, LOTO, inspections, RAMS, PTW.",
    ramsNote: "Electrical starter — isolation, LOTO, test-before-touch, and arc-flash style hazards.",
  },
  buildingTrades: {
    tagline: "Refurbishment, fit-out, and snagging before handover.",
    whoFor: "Building trades, interior fit-out, and refurbishment teams in occupied or live buildings.",
    adjusts: [
      "Snag register weighted in readiness; inspections over survey reports.",
      "Refurb playbook featured; surveying modules hidden.",
    ],
    hubFocus: "Building & refurb site pack — briefings, RAMS, snags, inspections, method statements.",
    ramsNote: "Refurb starter — dust, noise, occupied building interfaces, and fit-out hazards.",
  },
  surveyingGeodesy: {
    tagline: "PAS128 / AS5488 utility mapping, aerial LiDAR, laser scan and full survey deliverable workflow.",
    whoFor: "Utility surveyors, geospatial firms, and drainage/CCTV specialists issuing PAS128 or topo deliverables.",
    adjusts: [
      "Survey report module shown; surveying and geospatial RAMS packs available in Step 2.",
      "Project Hub pipeline ends with Survey (client deliverable).",
      "Readiness tracks mobilisation MS, survey QA, and PAS128 completeness.",
    ],
    hubFocus: "Survey & geodesy site pack — survey reports, PAS128, geo photos, drawings, surveying RAMS.",
    ramsNote: "Geospatial & surveying starter — utility strike, NDD, aerial, marine and rail hazards.",
  },
  contractorPlusSurveying: {
    tagline: "Mostly construction with occasional PAS128 or survey jobs.",
    whoFor: "Contractors who mainly build or refurb but sometimes run utility mapping or survey commissions.",
    adjusts: [
      "Survey module available without full geodesy module layout.",
      "Both construction and utility mapping playbooks shown.",
      "Hub uses survey step when survey workflow is active.",
    ],
    hubFocus: "Contractor + survey site pack — briefings, RAMS, survey reports, PAS128, PTW.",
    ramsNote: "General construction starter by default; switch to PAS128 pack in Step 2 for survey jobs.",
  },
  facilitiesMaintenance: {
    tagline: "PPM, PAT, and plant — lighter CDM and survey emphasis.",
    whoFor: "Facilities management, estates teams, and maintenance contractors running planned inspections.",
    adjusts: [
      "Inspections, PAT, and plant registers prioritised in More pulse.",
      "Survey and heavy CDM modules de-emphasised.",
    ],
    hubFocus: "Facilities site pack — inspections, PAT, plant, briefings, RAMS, PTW.",
    ramsNote: "General maintenance starter — access, isolation, and public interface hazards.",
  },
  demolitionStripout: {
    tagline: "Demolition, strip-out, excavation, and temporary works.",
    whoFor: "Demolition contractors, strip-out specialists, and civils teams with permit-to-dig and asbestos interfaces.",
    adjusts: [
      "Excavation, temp works, gate book, and asbestos registers surfaced.",
      "Groundworks playbook featured; readiness tracks intrusive works evidence.",
    ],
    hubFocus: "Demolition site pack — excavation, temp works, gate book, asbestos, RAMS, PTW.",
    ramsNote: "Groundworks starter — excavation, buried services, plant, and collapse hazards.",
  },
  civilEarthworks: {
    tagline: "Civil engineering, utilities, and earthworks sites.",
    whoFor: "Civils contractors, utility installers, and groundworks teams with permit-to-dig and temporary works.",
    adjusts: [
      "Excavation and temp works registers surfaced in More.",
      "Groundworks RAMS starter suggested in builder.",
      "Readiness emphasises PTW and excavation evidence.",
    ],
    hubFocus: "Civil & earthworks site pack — excavation, temp works, briefings, RAMS, PTW.",
    ramsNote: "Groundworks starter — buried services, plant, collapse, and permit-to-dig hazards.",
  },
  foodPharma: {
    tagline: "Hygiene-critical manufacturing and contractor access controls.",
    whoFor: "Food, beverage, pharma, and pet food sites with allergen, GMP, and high-care requirements.",
    adjusts: [
      "Allergen changeovers, GMP deviations, high-care access, and CIP registers shown.",
      "Readiness gates track hygiene windows and deviation close-out.",
      "Survey modules hidden; food/pharma RAMS sections available.",
    ],
    hubFocus: "Food / pharma site pack — allergen windows, GMP, high-care access, briefings, PTW.",
    ramsNote: "General starter with hygiene addendum fields in RAMS — use allergen and high-care registers on site.",
  },
  showEverything: {
    tagline: "Full module library — explore first, narrow later.",
    whoFor: "New organisations, multi-discipline teams, or admins evaluating the full product before trimming.",
    adjusts: [
      "All modules visible including Survey report and surveying RAMS.",
      "No default RAMS starter — pick packs manually.",
      "Survey workflow available when the survey module stays visible.",
    ],
    hubFocus: "Full site pack — CDM, RAMS, PTW, briefings, inspections or survey.",
    ramsNote: "No profile starter — use surveying packs or trade starters manually in RAMS Step 2.",
  },
};

/** @param {string} [packId] @param {import("../config/markets").MarketId} [marketId] */
export function getProfileGuideEntry(packId = getOrgIndustryPackId(), marketId = getOrgMarketId()) {
  const id = packId && INDUSTRY_PACKS[packId] ? packId : "generalContractor";
  const pack = INDUSTRY_PACKS[id];
  const guide = PROFILE_GUIDE_ENTRIES[id] || PROFILE_GUIDE_ENTRIES.generalContractor;
  const loc = (text) => locGuide(text, marketId);
  return {
    id,
    label: pack.label,
    hint: loc(pack.hint),
    tagline: loc(guide.tagline),
    whoFor: loc(guide.whoFor),
    adjusts: guide.adjusts.map(loc),
    hubFocus: loc(guide.hubFocus),
    ramsNote: loc(guide.ramsNote),
  };
}

/** Active profile summary for Help and Settings headers. */
export function getActiveProfileGuideSummary(marketId = getOrgMarketId()) {
  const id = getOrgIndustryPackId();
  const entry = getProfileGuideEntry(id, marketId);
  const workflow = getPackWorkflowHelp(id, marketId);
  const pack = INDUSTRY_PACKS[id];
  const ramsStarter =
    pack?.ramsStarterKey === null ? null : getRamsStarterLabel(pack?.ramsStarterKey || "general");
  return {
    packId: id,
    label: getIndustryPackLabel(id),
    tagline: entry.tagline,
    summary: workflow.summary,
    steps: workflow.steps,
    sitePackTitle: getIndustrySitePackTitle(id),
    ramsStarter,
    hubFocus: entry.hubFocus,
  };
}

/** All profiles for catalogue rendering (stable order). */
export function listProfileGuideCatalogue(marketId = getOrgMarketId()) {
  return Object.keys(INDUSTRY_PACKS).map((id) => getProfileGuideEntry(id, marketId));
}
