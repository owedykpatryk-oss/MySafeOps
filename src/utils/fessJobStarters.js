/**
 * FESS Group job starters — derived from DOCS/FESS/Rams/MC (22 reference PDFs).
 * Org-exclusive: only surfaced when isFessOrg() is true.
 */
import {
  FESS_ME_SITE_BASELINE_PACK_DEF,
  getFessOrgExclusivePackDef,
} from "../modules/rams/orgExclusiveQuickPacks.js";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import {
  getFessPreferredBaselinePackId,
  getFessSiteExtraHazardIds,
} from "./fessClientSites.js";

/** @typedef {{
 *   key: string,
 *   label: string,
 *   client: string,
 *   siteHint: string,
 *   jobRefPrefix: string,
 *   title: string,
 *   scope: string,
 *   methodStatement: string,
 *   supplementalHazardIds: string[],
 *   hazardTokens: string[],
 *   permitTypes: string[],
 *   msTemplate: string,
 *   sourceFiles: string[],
 * }} FessJobStarter */

/** @type {FessJobStarter[]} */
export const FESS_JOB_STARTERS = [
  {
    key: "dolav_meyn",
    label: "DOLAV & MEYN station works",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Scunthorpe",
    jobRefPrefix: "FP1-DOLAV",
    title: "RAMS — DOLAV & MEYN station M&E services",
    scope:
      "Mechanical and electrical services for DOLAV wash stations and MEYN equipment on production lines — cable supplies, ring mains (Mapress), air drops, enabling works, test and validation.",
    methodStatement:
      "1. Run in supply cables for new DOLAV stations.\n\n2. Carry out ring mains on site using Mapress and agreed routes.\n\n3. Support MEYN on site with air supplies to drops and interfaces.\n\n4. Complete enabling works so production can restart safely.\n\n5. Test and validate all services and controls.\n\n6. Hand over to site permit controller with close-out evidence.\n\n7. Ensure all areas are clean and production-ready before demobilisation.",
    supplementalHazardIds: ["food_001", "food_002", "fess_002", "fess_003", "mach_001", "elec_002", "mech_001", "mh_001"],
    hazardTokens: ["dolav", "meyn", "food", "production", "pipe", "air", "water", "line"],
    permitTypes: ["line_clearance", "cold_work", "hot_work", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: [
      "2SFG SCUNTHORPE DOLAV STATIONS AND MEYN WORKS.pdf",
      "2SFG SCUNTHORPE MEYN AND DOLAV STATION WORKS.pdf",
    ],
  },
  {
    key: "machine_install",
    label: "Machine installation / placement",
    client: "Various food sites",
    siteHint: "Dovecoat Park / Butternut Box",
    jobRefPrefix: "MACH-INST",
    title: "RAMS — production machine installation",
    scope:
      "Installation or placement of production machinery — services (air, water, vacuum), containment, MEWP access, isolation, test and client handover.",
    methodStatement:
      "1. Isolate existing services and verify dead before intrusive work.\n\n2. Position machine and secure to frame / floor fixings.\n\n3. Run services (air, water, vacuum) with isolation valves at completion points.\n\n4. Use MEWP for ceiling-height supplies where required.\n\n5. Patch penetrations and remove foreign-body risk before line restart.\n\n6. Test, validate and obtain production sign-off.\n\n7. Hand over to client with RAMS and permit close-out.",
    supplementalHazardIds: ["mach_002", "food_001", "food_002", "lift_001", "mh_001", "wah_001", "fess_002", "elec_002"],
    hazardTokens: ["machine", "installation", "mewp", "height", "foreign", "product", "lift"],
    permitTypes: ["line_clearance", "lifting", "work_at_height", "loto", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: [
      "DOVECOAT PARK MACHINE INSTALLATION 140226.pdf",
      "DOVECOAT PARK MACHINE INSTALLATION 140326.pdf",
      "DOVECOAT PARK MACHINE PLACEMENT 130626.pdf",
      "DOVECOAT PARK MACHINE PLACEMENT 140326.pdf",
      "RA BUTTERNUT BOX INSTALLATION OF 1 X VARIOVAC MACHINE.pdf",
    ],
  },
  {
    key: "spiral_conveyor",
    label: "Spiral conveyor repair / rebuild",
    client: "Butternut Box",
    siteHint: "Butternut Box",
    jobRefPrefix: "SPIRAL-CO",
    title: "RAMS — spiral conveyor repair and rebuild",
    scope:
      "Removal, repair and reinstatement of spiral conveyor — hot works on housing, debris control, production area isolation and validation.",
    methodStatement:
      "1. Confirm 110V tools and charged cordless equipment ready.\n\n2. Remove and repair spiral conveyor on site under line clearance.\n\n3. Execute controlled hot works to repair shaft housing with fire watch.\n\n4. Reinstate conveyor and ancillary equipment.\n\n5. Clean debris, magnetic sweep and visual inspection before restart.\n\n6. Validate with client before production handback.",
    supplementalHazardIds: ["mach_001", "weld_003", "food_001", "fess_002", "fess_003", "wh_003"],
    hazardTokens: ["conveyor", "spiral", "hot work", "weld", "foreign", "food"],
    permitTypes: ["line_clearance", "hot_work", "cold_work", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: [
      "BUTTERNUT BOX SPIRAL CONVEYOR CALLOUT WORKS.pdf",
      "RA BUTTERNUT BOX SPIRAL CONVEYOR REPAIR.pdf",
    ],
  },
  {
    key: "pipe_changeover",
    label: "Roof void pipe changeover",
    client: "Cranswick / Foodclean",
    siteHint: "Cranswick Lazenby",
    jobRefPrefix: "PIPE-CO",
    title: "RAMS — roof void pipe changeover",
    scope:
      "Changeover of pipework within roof void — material handling, isolation valves, LOTO, welding/brazing interfaces, validation and reinstatement.",
    methodStatement:
      "1. Bring materials into roof void via agreed access route.\n\n2. Isolate relevant valves and apply LOTO before breaking into pipework.\n\n3. Install and complete pipe changes per specification.\n\n4. Validate joints, pressure tests and leak checks as required.\n\n5. Remove padlocks and reinstate valves under supervisor hold point.\n\n6. Communicate progress to site permit controller throughout.\n\n7. Clean debris, sign off RAMS and demobilise.",
    supplementalHazardIds: ["mech_001", "mech_003", "weld_001", "cs_001", "food_003", "wah_001", "fess_003"],
    hazardTokens: ["pipe", "roof void", "isolation", "loto", "weld", "confined", "height"],
    permitTypes: ["loto", "hot_work", "cold_work", "line_clearance", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: [
      "FOODCLEAN LAZENBY PIPE CHANGEOVER.pdf",
      "RA CRANSWICK LAZENBY PIPE CHANGE OVER.pdf",
    ],
  },
  {
    key: "tank_relocation",
    label: "Tank removal & relocation",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Scunthorpe",
    jobRefPrefix: "KFC-TANK",
    title: "RAMS — tank removal and relocation",
    scope:
      "Disconnect, remove and relocate production tanks and associated equipment — levelling, new containment, terminations, test and handover.",
    methodStatement:
      "1. Disconnect existing supplies and remove redundant tank.\n\n2. Relocate production line equipment to agreed positions.\n\n3. Level and secure relocated plant.\n\n4. Install new containment and services on site.\n\n5. Terminate equipment and carry out functional tests.\n\n6. Test, validate and hand over to site.\n\n7. Clean all areas before production restart.",
    supplementalHazardIds: ["mh_001", "mach_002", "mech_002", "food_001", "elec_002", "lift_001"],
    hazardTokens: ["tank", "manual handling", "lift", "relocation", "production"],
    permitTypes: ["line_clearance", "lifting", "loto", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE TANK RELOCATION.pdf", "2SFG SCUNTHORPE KETTLETANK REMOVAL.pdf"],
  },
  {
    key: "ro_installation",
    label: "RO room / water treatment works",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Scunthorpe",
    jobRefPrefix: "RO-ROOM",
    title: "RAMS — RO installation and room works",
    scope:
      "Reverse-osmosis and water treatment installation within designated plant room — pipework, electrical supplies, pressure testing and commissioning.",
    methodStatement:
      "1. Confirm isolation and LOTO on all connected services.\n\n2. Install pipework and electrical supplies per design.\n\n3. Pressure test and commission RO equipment.\n\n4. Record test results and obtain supervisor sign-off.\n\n5. Hand over to site with operating instructions.",
    supplementalHazardIds: ["mech_001", "mech_002", "cs_001", "food_001", "elec_002", "elec_006"],
    hazardTokens: ["ro", "water", "pressure", "pipe", "commission", "chemical"],
    permitTypes: ["cold_work", "loto", "confined_space", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE RO INSTALLATION.pdf", "2SFG SCUNTHORPE RO ROOM WORKS.pdf"],
  },
  {
    key: "grille_me",
    label: "Grille M&E works",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Flixton",
    jobRefPrefix: "GRILLS",
    title: "RAMS — grille mechanical & electrical works",
    scope:
      "Mechanical and electrical works on grille production equipment within controlled factory area — services, containment and validation.",
    methodStatement:
      "1. Mobilise under food factory pre-start controls.\n\n2. Isolate services and confirm permit and line clearance.\n\n3. Execute M&E works within controlled area under supervision.\n\n4. Test and validate equipment operation.\n\n5. Hand over to site permit controller.",
    supplementalHazardIds: ["food_001", "elec_004", "drill_004", "mach_001", "elec_002"],
    hazardTokens: ["grille", "food", "electrical", "production"],
    permitTypes: ["line_clearance", "cold_work", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG FLIXTON GRILLE M&E.pdf", "2SFG RA 2SFG FLIXTON GRILLS MECHANICAL AND ELECTRICAL WORKS.pdf"],
  },
  {
    key: "unistrut_pipe_support",
    label: "Unistrut / pipe support frame",
    client: "Quorn Foods",
    siteHint: "Quorn Foods",
    jobRefPrefix: "QUORN-PIPE",
    title: "RAMS — unistrut pipe support and evap tower works",
    scope:
      "Fabrication and installation of unistrut pipe support frames and water pipework supports adjacent to evaporation tower.",
    methodStatement:
      "1. Mark out support positions and confirm no clash with live services.\n\n2. Install unistrut framework and fixings at height.\n\n3. Fit pipe supports and brackets per drawing.\n\n4. Inspect fixings and torque checks before handover.\n\n5. Remove waste and demobilise.",
    supplementalHazardIds: ["mech_002", "wah_001", "drill_001", "mh_001", "food_001"],
    hazardTokens: ["unistrut", "pipe", "support", "height", "frame"],
    permitTypes: ["work_at_height", "cold_work", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: [
      "QUORN UNISTRUT PIPE SUPPORT FRAME.pdf",
      "QUORN WATER PIPE WORK SUPPORT EVAP TOWER.pdf",
    ],
  },
  {
    key: "enabling_works",
    label: "Enabling works (production restart)",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Scunthorpe / Flixton",
    jobRefPrefix: "ENAB",
    title: "RAMS — enabling works before production restart",
    scope:
      "Temporary enabling works to restore production — cable routes, containment, minor M&E alterations and validation before line handback.",
    methodStatement:
      "1. Confirm line clearance and allergen briefing.\n\n2. Isolate services and apply LOTO on intrusive work.\n\n3. Execute enabling works within controlled production zones.\n\n4. Remove debris, magnetic sweep and hygiene clean-down.\n\n5. Test services and obtain permit controller sign-off.\n\n6. Demobilise only when production-ready confirmation received.",
    supplementalHazardIds: ["food_001", "food_002", "fess_002", "fess_009", "elec_002", "gen_001"],
    hazardTokens: ["enabling", "production", "restart", "food", "line"],
    permitTypes: ["line_clearance", "cold_work", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE ENABLING WORKS.pdf"],
  },
  {
    key: "mapress_ring_main",
    label: "Mapress ring main installation",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Scunthorpe",
    jobRefPrefix: "MAPRESS",
    title: "RAMS — Mapress ring main installation",
    scope:
      "Installation of Mapress ring mains for water services on production lines — routing, supports, pressure test and commissioning.",
    methodStatement:
      "1. Mark routes and confirm no clash with live services.\n\n2. Install supports and Mapress pipework per specification.\n\n3. Pressure test joints and record results.\n\n4. Commission and validate flow/pressure.\n\n5. Hand over to site with test certificates.",
    supplementalHazardIds: ["mech_001", "mech_002", "food_001", "fess_003", "mh_001", "elec_002"],
    hazardTokens: ["mapress", "pipe", "ring main", "water", "pressure"],
    permitTypes: ["cold_work", "line_clearance", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE MAPRESS RING MAIN.pdf"],
  },
  {
    key: "wash_station_upgrade",
    label: "Wash station upgrade",
    client: "Cranswick / Foodclean",
    siteHint: "Cranswick Lazenby",
    jobRefPrefix: "WASH-ST",
    title: "RAMS — wash station upgrade works",
    scope:
      "Upgrade or modification of wash stations — pipework, electrical supplies, hygiene interfaces and validation in production wash areas.",
    methodStatement:
      "1. Coordinate with production for wash station isolation.\n\n2. Apply LOTO and confirm dead before breaking into services.\n\n3. Install/modify pipework and electrical supplies.\n\n4. Hygiene clean-down and debris removal.\n\n5. Test, validate and obtain production sign-off.",
    supplementalHazardIds: ["mech_001", "food_003", "fess_003", "fess_012", "elec_002", "cs_001"],
    hazardTokens: ["wash", "station", "hygiene", "pipe", "cip"],
    permitTypes: ["line_clearance", "loto", "cold_work", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["FOODCLEAN LAZENBY WASH STATION UPGRADE.pdf"],
  },
  {
    key: "compressor_air_drops",
    label: "Compressor air drops (MEYN)",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Scunthorpe",
    jobRefPrefix: "AIR-DROP",
    title: "RAMS — compressor air drops to MEYN equipment",
    scope:
      "Installation of compressed air drops from main header to MEYN and production equipment — routing, isolation valves and leak testing.",
    methodStatement:
      "1. Isolate compressor header and depressurise lines.\n\n2. Route pipework and install drops with isolation valves.\n\n3. Pressure test and leak check all joints.\n\n4. Reinstate and validate air supply to equipment.\n\n5. Record test results and hand over.",
    supplementalHazardIds: ["mech_001", "mech_002", "mach_001", "food_001", "fess_003", "elec_002"],
    hazardTokens: ["compressor", "air", "meyn", "pressure", "pipe"],
    permitTypes: ["cold_work", "loto", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE COMPRESSOR AIR DROPS.pdf"],
  },
  {
    key: "vacuum_line_install",
    label: "Vacuum line installation",
    client: "Various food sites",
    siteHint: "Dovecoat Park / Butternut Box",
    jobRefPrefix: "VAC-LINE",
    title: "RAMS — production vacuum line installation",
    scope:
      "Installation of vacuum lines to production equipment — routing, supports, penetrations and validation in food production zones.",
    methodStatement:
      "1. Confirm line clearance and foreign-body controls.\n\n2. Route vacuum pipework with agreed supports and containment.\n\n3. Seal penetrations and remove debris risk.\n\n4. Test vacuum pressure and equipment operation.\n\n5. Hand over with validation records.",
    supplementalHazardIds: ["mech_001", "food_001", "food_002", "fess_002", "mach_002", "elec_002"],
    hazardTokens: ["vacuum", "line", "production", "foreign", "pipe"],
    permitTypes: ["line_clearance", "cold_work", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["RA BUTTERNUT BOX VACUUM LINE INSTALLATION.pdf"],
  },
  {
    key: "cable_containment_run",
    label: "Cable containment run",
    client: "Various food sites",
    siteHint: "2SFG / Cranswick",
    jobRefPrefix: "CABLE-CT",
    title: "RAMS — cable containment installation",
    scope:
      "Installation of cable containment (tray, basket, conduit) for new or modified electrical supplies in food factory areas.",
    methodStatement:
      "1. Confirm isolation and permit requirements.\n\n2. Install containment along agreed routes.\n\n3. Pull cables with appropriate segregation from process pipework.\n\n4. Terminate and test circuits before energisation.\n\n5. Remove waste and confirm area production-ready.",
    supplementalHazardIds: ["elec_002", "elec_004", "drill_001", "wah_001", "food_001", "fess_002"],
    hazardTokens: ["cable", "containment", "tray", "electrical", "height"],
    permitTypes: ["cold_work", "work_at_height", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE CABLE CONTAINMENT.pdf"],
  },
  {
    key: "cold_room_services",
    label: "Cold room services works",
    client: "Various food sites",
    siteHint: "2SFG / Cranswick",
    jobRefPrefix: "COLD-RM",
    title: "RAMS — cold room M&E services",
    scope:
      "Mechanical and electrical services within cold rooms and chilled areas — pipework, electrical supplies, insulation and commissioning.",
    methodStatement:
      "1. Confirm cold room access and PPE (thermal gloves, hi-vis).\n\n2. Isolate refrigeration circuits and apply LOTO.\n\n3. Install services with agreed penetration sealing.\n\n4. Test and commission before reinstatement.\n\n5. Record temperatures and hand over to site.",
    supplementalHazardIds: ["cs_001", "mech_001", "elec_002", "food_001", "fess_003", "mh_001"],
    hazardTokens: ["cold room", "chilled", "refrigeration", "pipe", "thermal"],
    permitTypes: ["cold_work", "loto", "confined_space", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE COLD ROOM SERVICES.pdf"],
  },
  {
    key: "panel_and_lighting",
    label: "Panel & lighting replacement",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Flixton",
    jobRefPrefix: "PANEL-LT",
    title: "RAMS — electrical panel and lighting replacement",
    scope:
      "Replacement of distribution panels and production-area lighting — isolation, working at height, test and energisation.",
    methodStatement:
      "1. Isolate circuits and prove dead before work.\n\n2. Remove existing panels/lighting and install replacements.\n\n3. Use MEWP or safe access for high-level fittings.\n\n4. Test and energise under supervisor hold point.\n\n5. Update labelling and hand over.",
    supplementalHazardIds: ["elec_001", "elec_002", "elec_003", "wah_001", "food_001", "drill_004"],
    hazardTokens: ["panel", "lighting", "electrical", "height", "isolation"],
    permitTypes: ["cold_work", "work_at_height", "loto", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG FLIXTON PANEL AND LIGHTING REPLACEMENT.pdf"],
  },
  {
    key: "fp1_works",
    label: "FP1 works on site",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Scunthorpe — FP1",
    jobRefPrefix: "FP1-WORKS",
    title: "RAMS — FP1 production line works on site",
    scope:
      "Mechanical and electrical works on FP1 production lines — services, containment, interfaces and validation within live food factory controls.",
    methodStatement:
      "1. Confirm line clearance and allergen briefing for FP1 zone.\n\n2. Isolate services and apply LOTO before intrusive work.\n\n3. Execute M&E works under site permit controller supervision.\n\n4. Test and validate equipment and services.\n\n5. Clean down, debris removal and production handback sign-off.",
    supplementalHazardIds: ["food_001", "food_002", "fess_002", "fess_009", "elec_002", "mach_001"],
    hazardTokens: ["fp1", "production", "line", "food", "m&e"],
    permitTypes: ["line_clearance", "cold_work", "hot_work", "loto", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE FP1 WORKS ON SITE.pdf"],
  },
  {
    key: "various_supplies",
    label: "Various supplies (ring main / services)",
    client: "2 Sisters Food Group",
    siteHint: "2SFG Scunthorpe",
    jobRefPrefix: "VAR-SUP",
    title: "RAMS — various supplies to production equipment",
    scope:
      "Installation of various service supplies (water, air, electrical) to production equipment — routing, isolation, test and handover.",
    methodStatement:
      "1. Review equipment schedule and confirm isolation points.\n\n2. Route supplies with agreed containment and segregation from product zones.\n\n3. Install isolation valves and terminations at completion points.\n\n4. Pressure/flow test and energise under supervisor hold point.\n\n5. Hand over with test records to site permit controller.",
    supplementalHazardIds: ["mech_001", "elec_002", "food_001", "fess_003", "mh_001"],
    hazardTokens: ["supplies", "services", "pipe", "electrical", "production"],
    permitTypes: ["cold_work", "line_clearance", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["2SFG SCUNTHORPE VARIOUS SUPPLIES.pdf"],
  },
  {
    key: "butternut_install",
    label: "Butternut production equipment install",
    client: "Butternut Box",
    siteHint: "Butternut Box",
    jobRefPrefix: "BB-INST",
    title: "RAMS — Butternut Box production equipment installation",
    scope:
      "Installation of production equipment at Butternut Box — positioning, services, hygiene interfaces and validation before line restart.",
    methodStatement:
      "1. Confirm line clearance and foreign-body controls.\n\n2. Position equipment and secure fixings.\n\n3. Connect services with isolation valves at completion points.\n\n4. Hygiene clean-down and magnetic sweep before restart.\n\n5. Test, validate and obtain production sign-off.",
    supplementalHazardIds: ["mach_002", "food_001", "food_002", "fess_002", "fess_014", "lift_001"],
    hazardTokens: ["butternut", "installation", "production", "foreign", "lift"],
    permitTypes: ["line_clearance", "lifting", "cold_work", "general"],
    msTemplate: "foodFactoryMobilisation",
    sourceFiles: ["BUTTERNUT BOX INSTALLATION 251125.pdf"],
  },
];

export function listFessJobStarters() {
  if (!canUseFessExclusiveFeatures()) return [];
  return FESS_JOB_STARTERS;
}

/** @param {string} key */
export function getFessJobStarter(key) {
  if (!canUseFessExclusiveFeatures()) return null;
  return FESS_JOB_STARTERS.find((s) => s.key === key) || null;
}

/**
 * Baseline hazard ids for a site (preferred pack + site extras).
 * @param {string} [siteTemplateId]
 */
export function getFessBaselineHazardIds(siteTemplateId = "") {
  const packId = getFessPreferredBaselinePackId(siteTemplateId);
  const pack = getFessOrgExclusivePackDef(packId) || FESS_ME_SITE_BASELINE_PACK_DEF;
  const baseline = pack.hazardIds || [];
  const siteExtra = getFessSiteExtraHazardIds(siteTemplateId);
  return [...new Set([...baseline, ...siteExtra])];
}

/**
 * Baseline + job-specific hazard ids (deduped).
 * @param {string} starterKey
 * @param {string} [siteTemplateId]
 */
export function getFessStarterHazardIds(starterKey, siteTemplateId = "") {
  const starter = getFessJobStarter(starterKey);
  const baseline = getFessBaselineHazardIds(siteTemplateId);
  const extra = starter?.supplementalHazardIds || [];
  return [...new Set([...baseline, ...extra])];
}

/**
 * Resolve hazard rows from library for a starter.
 * @param {string} starterKey
 * @param {object[]} library
 * @param {string} [siteTemplateId]
 */
export function resolveFessStarterHazards(starterKey, library, siteTemplateId = "") {
  const ids = new Set(getFessStarterHazardIds(starterKey, siteTemplateId));
  return (library || []).filter((h) => ids.has(h.id));
}
