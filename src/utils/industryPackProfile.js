/**
 * Industry pack profile — readiness gates, More pulse, site pack, and switch preview.
 */

import { INDUSTRY_PACKS, getWorkspacePack, getWorkspacePackLabel } from "./orgIndustryPacks";
import { getCustomWorkspaceProfile, resolveProfileBehaviorPackId, visibleModulesForProfile } from "./customWorkspaceProfiles";
import { getOrgIndustryPackId, isSurveyWorkflowEnabled } from "./projectHubIndustry";
import { getRamsStarterLabel } from "./ramsIndustryStarters";
import { isModuleVisible } from "./hiddenModules";
import { loadOrgScoped, asStorageArray } from "./orgStorage";
import { todayIsoDate } from "./projectDashboard";
import { evaluateSurveyFinalGate } from "./surveyCompletenessGates";

/** Surveying profiles share survey workflow behaviour (built-in or custom with surveyWorkflow). */
export function isSurveyGeospatialPackId(packId) {
  if (packId === "surveyingGeodesy") return true;
  const custom = getCustomWorkspaceProfile(packId);
  return Boolean(custom?.surveyWorkflow);
}

/** @typedef {{ pat: object[], hotWork: object[], gmp: object[], allergen: object[], surveys: object[], geoPhotos: object[], loto: object[], highCare: object[], inspections: object[], fireSafety: object[], firstAid: object[], cdm: object[], timesheets: object[] }} IndustryRegisterSnapshot */

/** Load org registers once per pulse/command-centre pass (avoids repeated localStorage reads). */
export function createIndustryRegisterSnapshot() {
  const loadList = (key) => loadOrgScoped(key, []);
  return {
    pat: loadList("electrical_pat_log"),
    hotWork: loadList("hot_work_register"),
    gmp: loadList("gmp_deviation_log"),
    allergen: loadList("allergen_changeover_windows"),
    surveys: loadList("survey_reports"),
    geoPhotos: loadList("geo_photos"),
    loto: loadList("loto_register"),
    highCare: loadList("high_care_access_register"),
    inspections: loadList("inspection_records"),
    fireSafety: loadList("fire_safety_log"),
    firstAid: loadList("first_aid_register"),
    cdm: loadList("cdm_packs"),
    timesheets: loadList("mysafeops_timesheets"),
  };
}

/** @param {IndustryRegisterSnapshot | null | undefined} registers */
function resolveRegisters(registers) {
  return registers || createIndustryRegisterSnapshot();
}

/** Site pack titles and audit focus areas per workspace profile. */
export const INDUSTRY_SITE_PACKS = {
  electricalContractor: {
    title: "Electrical & M&E site pack",
    focus: ["PAT / electrical", "Hot work register", "LOTO / isolation", "Inspections", "RAMS", "Permits (PTW)"],
  },
  generalContractor: {
    title: "Contractor site pack",
    focus: ["Daily briefing", "CDM pack", "RAMS", "Open snags", "Timesheets", "Permits (PTW)"],
  },
  buildingTrades: {
    title: "Building & refurb site pack",
    focus: ["Daily briefing", "RAMS", "Snag register", "Inspections", "Method statements", "PTW"],
  },
  surveyingGeodesy: {
    title: "Survey & geodesy site pack",
    focus: [
      "Survey reports",
      "PAS128 / AS5488 deliverables",
      "Aerial LiDAR & laser scan",
      "Method statements",
      "RAMS (surveying)",
      "Geo photos",
    ],
  },
  foodPharma: {
    title: "Food / pharma hygiene site pack",
    focus: ["Allergen changeovers", "GMP deviations", "High-care access", "RAMS", "Daily briefing", "PTW"],
  },
  showEverything: {
    title: "Full site pack",
    focus: ["CDM", "RAMS", "PTW", "Briefings", "Inspections or survey", "Linked documents"],
  },
  contractorPlusSurveying: {
    title: "Contractor + survey site pack",
    focus: ["Daily briefing", "RAMS", "Survey reports", "PAS128 deliverables", "Inspections or survey", "PTW"],
  },
  facilitiesMaintenance: {
    title: "Facilities & maintenance site pack",
    focus: ["Inspections", "PAT / electrical", "Plant register", "Daily briefing", "RAMS", "PTW"],
  },
  demolitionStripout: {
    title: "Demolition & strip-out site pack",
    focus: ["Excavation log", "Temporary works", "Gate book", "Asbestos register", "RAMS", "PTW"],
  },
};

/** Typical workflow copy for Help and Settings. */
export const PACK_WORKFLOW_HELP = {
  generalContractor: {
    summary: "CDM → RAMS → PTW → daily briefing → inspections. Snags tracked before handover.",
    steps: [
      "Create project with general or groundworks playbook",
      "Issue PTW before start",
      "Log daily briefing every shift",
      "Close snags before practical completion",
    ],
  },
  electricalContractor: {
    summary: "Electrical RAMS, hot work, PAT/LOTO and inspection evidence on every job.",
    steps: [
      "Apply electrical playbook on new projects",
      "Log PAT and LOTO before energisation",
      "Record hot work with fire watch",
      "Log inspections before energising circuits",
    ],
  },
  buildingTrades: {
    summary: "Refurb workflow — snagging, inspections and briefings drive readiness.",
    steps: [
      "Use refurb playbook for fit-out jobs",
      "Log snags during walk-rounds",
      "Keep daily briefing live on multi-day refurb",
      "Export site pack for client handover",
    ],
  },
  surveyingGeodesy: {
    summary: "Mobilisation MS → geospatial RAMS pack → PAS128/AS5488 survey deliverable.",
    steps: [
      "Create project with utility mapping playbook",
      "Seed geospatial quick packs (utility, aerial, marine, rail)",
      "Draft survey with QA checklist and calibration",
      "Finalise survey report before client issue",
    ],
  },
  contractorPlusSurveying: {
    summary: "Mostly contractor HSE — survey module for occasional PAS128 jobs.",
    steps: [
      "Default to general/refurb playbooks for site work",
      "Switch to utility mapping playbook for survey jobs",
      "Keep inspections on construction; survey for deliverables",
      "Apply profile once — no need for Show all modules",
    ],
  },
  facilitiesMaintenance: {
    summary: "PPM inspections and PAT — lighter CDM/survey emphasis.",
    steps: [
      "Log PPM inspections on schedule",
      "Keep PAT register current",
      "Use plant register for hired equipment",
      "Briefing + PTW for intrusive maintenance",
    ],
  },
  demolitionStripout: {
    summary: "Demolition HSE — excavation, temp works, gate book and asbestos.",
    steps: [
      "Groundworks/demolition playbook on new sites",
      "Log excavation and temp works before start",
      "Gate book for deliveries",
      "Asbestos register before intrusive work",
    ],
  },
  foodPharma: {
    summary: "Hygiene-critical workflow — allergen windows, GMP and high-care access.",
    steps: [
      "Schedule allergen changeover windows before runs",
      "Close GMP deviations before release",
      "High-care access sign-off for contractors",
      "Daily briefing in production areas",
    ],
  },
  showEverything: {
    summary: "Full module library — trim in Settings when you know your stack.",
    steps: [
      "Pick modules to hide under Organisation → Modules",
      "Choose a narrower profile when ready",
      "Use Project Hub playbooks to standardise new jobs",
    ],
  },
};

/** @param {string} [packId] */
export function getPackWorkflowHelp(packId = getOrgIndustryPackId()) {
  if (PACK_WORKFLOW_HELP[packId]) return PACK_WORKFLOW_HELP[packId];
  const custom = getCustomWorkspaceProfile(packId);
  if (custom) {
    return {
      summary: custom.hint,
      steps: [
        "Custom profile — modules tuned for your organisation only",
        "Apply profile to update More grid and Project Hub",
        "Trim individual modules in Settings if needed",
      ],
    };
  }
  return PACK_WORKFLOW_HELP.generalContractor;
}

const PACK_HIGHLIGHTS = {
  generalContractor: [
    "Project hub ends with Inspections (not survey reports)",
    "PAS128 playbooks hidden — core CDM / RAMS / PTW pipeline",
    "Readiness tracks CDM, briefing, RAMS and open snags",
  ],
  electricalContractor: [
    "Readiness gates: hot work, PAT, LOTO and inspections",
    "Inspections as deliverable step — no geodesy survey module",
    "Electrical site pack for audit exports",
  ],
  buildingTrades: [
    "Refurb & snagging focus — inspections over survey reports",
    "Snag tracking in readiness ring",
    "Refurb playbook featured",
  ],
  surveyingGeodesy: [
    "Survey completeness & PAS128 in readiness gates",
    "Geospatial quick packs (utility, aerial, marine, rail)",
    "Survey site pack with geo photos and drawings",
  ],
  foodPharma: [
    "Allergen, GMP and high-care gates in readiness",
    "Hygiene registers prioritised in More command centre",
    "Food/pharma site pack for audit",
  ],
  showEverything: [
    "Full module library visible",
    "Survey workflow when survey-report module is shown",
    "Trim individual modules in Settings below",
  ],
  contractorPlusSurveying: [
    "Construction-first hub with survey module for occasional PAS128 jobs",
    "Utility mapping playbook available without full geodesy layout",
    "Inspections pipeline when survey module hidden manually",
  ],
  facilitiesMaintenance: [
    "PPM inspections and PAT prioritised in hub pulse",
    "Plant register surfaced — less survey/CDM weight",
    "Facilities site pack for audit exports",
  ],
  demolitionStripout: [
    "Excavation, temp works, gate book and asbestos registers shown",
    "Groundworks playbook featured",
    "Demolition site pack for handover evidence",
  ],
};

/** @param {string} [packId] */
export function getIndustryPackLabel(packId = getOrgIndustryPackId()) {
  return getWorkspacePackLabel(packId) || INDUSTRY_PACKS.generalContractor.label;
}

/** @param {string} [packId] */
export function getIndustrySitePackTitle(packId = getOrgIndustryPackId()) {
  return INDUSTRY_SITE_PACKS[packId]?.title || INDUSTRY_SITE_PACKS.generalContractor.title;
}

/** @param {string} packId */
export function getPackHighlights(packId) {
  if (PACK_HIGHLIGHTS[packId]) return PACK_HIGHLIGHTS[packId];
  const custom = getCustomWorkspaceProfile(packId);
  if (custom) {
    const baseLabel = INDUSTRY_PACKS[custom.basedOn || "generalContractor"]?.label || "General";
    return [
      `Custom profile based on ${baseLabel}`,
      custom.surveyWorkflow ? "Survey workflow and PAS128/geospatial packs" : "Construction-first Project Hub",
      `${visibleModulesForProfile(custom).length} modules visible in More`,
    ];
  }
  return PACK_HIGHLIGHTS.generalContractor;
}

/**
 * Human-readable preview when switching workspace profile.
 * @param {string | null} fromId
 * @param {string} toId
 */
export function previewPackSwitch(fromId, toId) {
  if (!toId || fromId === toId) return { changes: [], pipelineLabel: null };
  const to = getWorkspacePack(toId) || INDUSTRY_PACKS.generalContractor;
  if (!to) return { changes: [], pipelineLabel: null };

  /** @type {string[]} */
  const changes = [];

  const surveyAfter = isSurveyGeospatialPackId(toId) || toId === "showEverything";
  const surveyBefore = isSurveyGeospatialPackId(fromId) || fromId === "showEverything";
  if (surveyAfter !== surveyBefore) {
    changes.push(
      surveyAfter
        ? "Project hub pipeline will show Survey (client deliverable)"
        : "Project hub pipeline will show Inspections instead of Survey"
    );
  }

  if (isSurveyGeospatialPackId(toId)) {
    changes.push("PAS128 / geospatial RAMS packs and survey report module will appear");
    changes.push("Survey report module will be shown");
    changes.push("Readiness will track survey completeness and mobilisation MS");
  } else if (toId !== "showEverything") {
    changes.push("PAS128 survey playbooks will be hidden");
    if (to.hiddenModules?.includes("survey-report")) {
      changes.push("Survey report module will be hidden (data kept on device)");
    }
  }

  if (toId === "foodPharma") {
    changes.push("Food/pharma RAMS sections and hygiene registers prioritised");
    changes.push("Readiness gates: allergen windows, GMP, high-care access");
  }
  if (toId === "electricalContractor") {
    changes.push("Readiness gates: hot work, PAT, LOTO and inspections");
  }
  if (toId === "generalContractor" || toId === "buildingTrades") {
    changes.push("Readiness emphasises CDM, briefing, RAMS and snags");
  }
  if (toId === "showEverything") {
    changes.push("All modules and RAMS packs restored to visible");
  }

  const fromStarter = fromId && INDUSTRY_PACKS[fromId]?.ramsStarterKey;
  const toStarter = to.ramsStarterKey;
  if (toStarter !== fromStarter) {
    if (toStarter) {
      changes.push(`RAMS builder suggests ${getRamsStarterLabel(toStarter)} starter pack`);
    } else if (fromStarter) {
      changes.push("RAMS builder profile starter cleared — pick packs manually");
    }
  }

  return {
    changes: [...new Set(changes)],
    pipelineLabel:
      surveyAfter && toId !== "showEverything" ? "Survey" : surveyAfter ? "Survey (if module visible)" : "Inspections",
    label: to.label,
    highlights: getPackHighlights(toId),
  };
}

function patchGate(gates, key, patch) {
  const idx = gates.findIndex((g) => g.key === key);
  if (idx < 0) return;
  const g = gates[idx];
  const max = patch.max ?? g.max;
  const ok = patch.ok ?? g.ok;
  gates[idx] = { ...g, ...patch, max, ok, points: ok ? max : 0 };
}

function replaceGate(gates, oldKey, nextGate) {
  const idx = gates.findIndex((g) => g.key === oldKey);
  if (idx < 0) {
    gates.push(nextGate);
    return;
  }
  gates[idx] = { ...nextGate, points: nextGate.ok ? nextGate.max : 0 };
}

/** Reallocate gate points from one key to a new industry-specific gate (keeps 100pt total). */
function stealGatePoints(gates, fromKey, { key, label, max, ok }) {
  const from = gates.find((g) => g.key === fromKey);
  if (!from || from.max < max) return false;
  from.max -= max;
  from.points = from.ok ? from.max : 0;
  gates.push({ key, label, max, ok, points: ok ? max : 0 });
  return true;
}

function projectRows(rows, pid) {
  if (!pid) return asStorageArray(rows);
  return asStorageArray(rows).filter((r) => r.projectId === pid);
}

function liveLotoForProject(loto, pid) {
  return projectRows(loto, pid).some(
    (r) => String(r.phase || r.status || "").toLowerCase() === "live" || r.status === "locked"
  );
}

function surveyCompletenessOk(surveys = []) {
  if (!surveys.length) return false;
  const latest = surveys.find((s) => s.status !== "final") || surveys[0];
  if (!latest) return false;
  if (latest.status === "final") return true;
  return evaluateSurveyFinalGate(latest).allowed;
}

function pas128SurveyOk(surveys = []) {
  const pas = surveys.find((s) => s.surveyType === "utility_mapping_survey" || s.surveyType === "eml_cat_survey");
  if (!pas) return surveys.some((s) => s.status === "final");
  return Boolean(String(pas.pas128Ql || "").trim()) && (pas.utilitiesTable || []).length > 0;
}

function activeAllergenWindows(windows, today) {
  return (windows || []).filter((w) => {
    const end = w.endAt || w.endDate;
    return !end || String(end).slice(0, 10) >= today;
  });
}

function surveysMissingCalibration(surveys) {
  return (surveys || []).filter((s) => s.status !== "final" && !(s.equipmentCalibration || []).length);
}

/**
 * Adjust readiness gates for the active workspace profile (keeps 100pt total).
 */
export function applyIndustryReadinessGates(gates, project, dash, packId = getOrgIndustryPackId(), registers) {
  const effectivePack = resolveProfileBehaviorPackId(packId);
  const pid = project?.id;
  const openSnags = dash?.totals?.openSnags || 0;
  const snags = dash?.snags || [];
  const reg = resolveRegisters(registers);
  const projectSurveys = dash?.surveys || [];
  const projectInspections = dash?.inspections || [];

  switch (effectivePack) {
    case "electricalContractor": {
      const hotWork = projectRows(reg.hotWork, pid).filter((r) => String(r.status || "active") !== "closed");
      const hasHotPermit = (dash?.permits || []).some(
        (p) => p.status === "active" && String(p.type || "").includes("hot")
      );
      replaceGate(gates, "plans", {
        key: "hotwork",
        label: "Hot work evidence",
        max: 5,
        ok: hotWork.length > 0 || hasHotPermit,
      });
      patchGate(gates, "inspections", {
        max: 15,
        ok: projectInspections.length > 0,
      });
      patchGate(gates, "rams", { max: 15, ok: (dash?.rams?.length || 0) > 0 });
      if (isModuleVisible("electrical-pat")) {
        const patOk = projectRows(reg.pat, pid).length > 0 || (reg.pat.length > 0 && projectInspections.length > 0);
        stealGatePoints(gates, "intel", {
          key: "pat",
          label: "PAT / electrical",
          max: 5,
          ok: patOk,
        });
      }
      if (isModuleVisible("loto")) {
        stealGatePoints(gates, "ms", {
          key: "loto",
          label: "LOTO / isolation",
          max: 5,
          ok: liveLotoForProject(reg.loto, pid) || projectRows(reg.loto, pid).length > 0,
        });
      }
      break;
    }
    case "buildingTrades":
    case "generalContractor": {
      replaceGate(gates, "plans", {
        key: "snags",
        label: openSnags > 0 ? "Snags (open)" : "Snag register",
        max: 5,
        ok: snags.length > 0 && openSnags === 0,
      });
      patchGate(gates, "cdm", { max: 12, ok: (dash?.cdmPacks?.length || 0) > 0 });
      patchGate(gates, "briefing", { max: 18, ok: Boolean(dash?.totals?.briefingToday) });
      break;
    }
    case "surveyingGeodesy": {
      if (gates.some((g) => g.key === "survey")) {
        patchGate(gates, "intel", { max: 5, ok: gates.find((g) => g.key === "intel")?.ok });
        patchGate(gates, "survey", {
          max: 12,
          ok: projectSurveys.length > 0,
        });
        stealGatePoints(gates, "ms", {
          key: "survey_qa",
          label: "Survey completeness",
          max: 8,
          ok: surveyCompletenessOk(projectSurveys),
        });
        stealGatePoints(gates, "plans", {
          key: "pas128",
          label: "PAS128 checklist",
          max: 5,
          ok: pas128SurveyOk(projectSurveys),
        });
      }
      patchGate(gates, "ms", {
        label: "Mobilisation MS",
        ok: (dash?.methodStatements?.length || 0) > 0,
      });
      break;
    }
    case "foodPharma": {
      const today = todayIsoDate();
      const allergenOk = activeAllergenWindows(reg.allergen, today).length > 0 || reg.allergen.length > 0;
      replaceGate(gates, "plans", {
        key: "allergen",
        label: "Allergen changeovers",
        max: 5,
        ok: allergenOk,
      });
      if (isModuleVisible("gmp-deviations")) {
        const gmpClear = !reg.gmp.some((r) => String(r.status || "open").toLowerCase() !== "closed");
        stealGatePoints(gates, "cdm", {
          key: "gmp",
          label: "GMP deviations clear",
          max: 5,
          ok: gmpClear && reg.gmp.length >= 0,
        });
      }
      if (isModuleVisible("high-care-access")) {
        stealGatePoints(gates, "location", {
          key: "highcare",
          label: "High-care access",
          max: 5,
          ok: reg.highCare.length > 0,
        });
      }
      break;
    }
    case "facilitiesMaintenance": {
      patchGate(gates, "cdm", { max: 5, ok: (dash?.cdmPacks?.length || 0) > 0 });
      patchGate(gates, "inspections", {
        max: 15,
        ok: projectInspections.length > 0 || reg.inspections.length > 0,
      });
      replaceGate(gates, "plans", {
        key: "plant",
        label: "Plant / PAT",
        max: 5,
        ok: reg.pat.length > 0 || (dash?.rams?.length || 0) > 0,
      });
      break;
    }
    case "demolitionStripout": {
      patchGate(gates, "ptw", { max: 18, ok: gates.find((g) => g.key === "ptw")?.ok });
      replaceGate(gates, "plans", {
        key: "excavation",
        label: "Excavation / temp works",
        max: 5,
        ok: isModuleVisible("excavation")
          ? reg.inspections.length > 0 || (dash?.permits?.length || 0) > 0
          : (dash?.permits?.length || 0) > 0,
      });
      break;
    }
    case "contractorPlusSurveying": {
      if (gates.some((g) => g.key === "survey")) {
        patchGate(gates, "survey", { max: 12, ok: projectSurveys.length > 0 });
      } else {
        patchGate(gates, "inspections", { max: 12, ok: projectInspections.length > 0 });
      }
      replaceGate(gates, "plans", {
        key: "snags",
        label: "Snag register",
        max: 5,
        ok: snags.length > 0 && openSnags === 0,
      });
      break;
    }
    default:
      break;
  }

  return gates;
}

/**
 * Extra compliance pulse cards for the project dashboard hero.
 */
export function buildIndustryCompliancePulse(dash, packId = getOrgIndustryPackId(), registers) {
  /** @type {Array<{ id: string, label: string, value: string, status: 'done'|'warn'|'todo', viewId?: string, action?: string }>} */
  const items = [];
  const today = todayIsoDate();
  const reg = resolveRegisters(registers);

  if (packId === "electricalContractor") {
    if (isModuleVisible("electrical-pat")) {
      const pat = reg.pat;
      const overdue = pat.filter((r) => r.nextTestDue && String(r.nextTestDue).slice(0, 10) < today);
      items.push({
        id: "pat",
        label: "PAT / electrical",
        value: overdue.length ? `${overdue.length} overdue` : pat.length ? `${pat.length} on file` : "No records",
        status: overdue.length ? "warn" : pat.length ? "done" : "todo",
        viewId: "electrical-pat",
      });
    }
    if (isModuleVisible("hot-work")) {
      const hw = reg.hotWork.filter((r) => String(r.status || "active") === "active");
      items.push({
        id: "hotwork",
        label: "Active hot work",
        value: hw.length ? String(hw.length) : "None",
        status: hw.length ? "warn" : "done",
        viewId: "hot-work",
      });
    }
    if (isModuleVisible("loto")) {
      const live = reg.loto.filter(
        (r) => String(r.phase || r.status || "").toLowerCase() === "live" || r.status === "locked"
      );
      items.push({
        id: "loto",
        label: "Live LOTO",
        value: live.length ? String(live.length) : "None active",
        status: live.length ? "warn" : "done",
        viewId: "loto",
      });
    }
    const insp = dash?.inspections || [];
    items.push({
      id: "inspections",
      label: "Inspections",
      value: insp.length ? `${insp.length} logged` : "Log inspection",
      status: insp.length ? "done" : "todo",
      viewId: "inspections",
      action: "create",
    });
  }

  if (packId === "buildingTrades" || packId === "generalContractor") {
    const open = dash?.totals?.openSnags || 0;
    items.push({
      id: "snags",
      label: "Open snags",
      value: open ? String(open) : "Clear",
      status: open > 0 ? "warn" : "done",
      viewId: "snags",
    });
  }

  if (isSurveyGeospatialPackId(packId) && isSurveyWorkflowEnabled()) {
    const surveys = dash?.surveys || [];
    const drafts = surveys.filter((s) => s.status !== "final").length;
    const complete = surveyCompletenessOk(surveys);
    items.push({
      id: "survey-draft",
      label: "Survey completeness",
      value: !surveys.length ? "None started" : complete ? "QA complete" : `${drafts || surveys.length} need work`,
      status: !surveys.length ? "todo" : complete ? "done" : "warn",
      viewId: "survey-report",
      action: "createReport",
    });
    if (surveys.some((s) => s.surveyType === "utility_mapping_survey" || s.surveyType === "eml_cat_survey")) {
      items.push({
        id: "pas128",
        label: "PAS128 QL",
        value: pas128SurveyOk(surveys) ? "On file" : "Incomplete",
        status: pas128SurveyOk(surveys) ? "done" : "warn",
        viewId: "survey-report",
      });
    }
  }

  if (packId === "foodPharma") {
    if (isModuleVisible("gmp-deviations")) {
      const open = reg.gmp.filter((r) => String(r.status || "open").toLowerCase() !== "closed");
      items.push({
        id: "gmp",
        label: "Open GMP deviations",
        value: open.length ? String(open.length) : "None",
        status: open.length ? "warn" : "done",
        viewId: "gmp-deviations",
      });
    }
    if (isModuleVisible("allergen-changeovers")) {
      const active = activeAllergenWindows(reg.allergen, today);
      items.push({
        id: "allergen",
        label: "Allergen windows",
        value: active.length ? `${active.length} active` : "None scheduled",
        status: active.length ? "warn" : "todo",
        viewId: "allergen-changeovers",
      });
    }
    if (isModuleVisible("high-care-access")) {
      items.push({
        id: "highcare",
        label: "High-care access",
        value: reg.highCare.length ? `${reg.highCare.length} record(s)` : "None logged",
        status: reg.highCare.length ? "done" : "todo",
        viewId: "high-care-access",
      });
    }
  }

  return items;
}

/**
 * Org-level next action for More command centre (before generic site/HSE logic).
 */
export function pickIndustryMoreNextAction(packId = getOrgIndustryPackId(), registers) {
  const today = todayIsoDate();
  const reg = resolveRegisters(registers);

  if (packId === "electricalContractor") {
    if (isModuleVisible("electrical-pat")) {
      const overdue = reg.pat.filter((r) => r.nextTestDue && String(r.nextTestDue).slice(0, 10) < today);
      if (overdue.length) {
        return {
          viewId: "electrical-pat",
          label: "Clear overdue PAT tests",
          reason: `${overdue.length} electrical asset(s) past next test date`,
          tone: "warn",
        };
      }
    }
    if (isModuleVisible("hot-work")) {
      const active = reg.hotWork.filter((r) => String(r.status || "active") === "active");
      if (active.length) {
        return {
          viewId: "hot-work",
          label: "Review active hot work",
          reason: `${active.length} hot work record(s) still open`,
          tone: "warn",
        };
      }
    }
    if (isModuleVisible("loto")) {
      const live = reg.loto.filter(
        (r) => String(r.phase || r.status || "").toLowerCase() === "live" || r.status === "locked"
      );
      if (live.length) {
        return {
          viewId: "loto",
          label: "Review live LOTO",
          reason: `${live.length} isolation(s) still live on equipment`,
          tone: "warn",
        };
      }
    }
  }

  if (packId === "foodPharma") {
    if (isModuleVisible("gmp-deviations")) {
      const open = reg.gmp.filter((r) => String(r.status || "open").toLowerCase() !== "closed");
      if (open.length) {
        return {
          viewId: "gmp-deviations",
          label: "Close GMP deviations",
          reason: `${open.length} deviation(s) still open`,
          tone: "warn",
        };
      }
    }
    if (isModuleVisible("allergen-changeovers")) {
      const active = activeAllergenWindows(reg.allergen, today);
      if (active.length) {
        return {
          viewId: "allergen-changeovers",
          label: "Review allergen changeover window",
          reason: `${active.length} active changeover window(s) — confirm controls signed off`,
          tone: "warn",
        };
      }
      if (!reg.allergen.length) {
        return {
          viewId: "allergen-changeovers",
          label: "Schedule allergen changeover",
          reason: "No changeover windows on file for hygiene-critical runs",
          tone: "info",
        };
      }
    }
  }

  if (isSurveyGeospatialPackId(packId) && isModuleVisible("survey-report")) {
    const missingCal = surveysMissingCalibration(reg.surveys);
    if (missingCal.length) {
      return {
        viewId: "survey-report",
        label: "Add calibration records",
        reason: `${missingCal.length} survey draft(s) missing equipment calibration`,
        tone: "warn",
      };
    }
    const drafts = reg.surveys.filter((s) => s.status !== "final");
    if (drafts.length) {
      const incomplete = drafts.find((s) => !evaluateSurveyFinalGate(s).allowed);
      if (incomplete) {
        return {
          viewId: "survey-report",
          label: "Complete survey QA checklist",
          reason: "Draft report missing QA, photos or sign-off",
          tone: "warn",
        };
      }
      return {
        viewId: "survey-report",
        label: "Finalise survey drafts",
        reason: `${drafts.length} client report(s) still in draft`,
        tone: "info",
      };
    }
  }

  if (packId === "generalContractor" || packId === "buildingTrades") {
    const openSnags = loadOrgScoped("snags", []).filter((s) => s.status !== "closed" && s.status !== "resolved");
    if (openSnags.length > 5) {
      return {
        viewId: "snags",
        label: "Clear open snags",
        reason: `${openSnags.length} snag(s) still open across projects`,
        tone: "warn",
      };
    }
  }

  return null;
}

/**
 * Industry-specific project next action — return non-null to override default chain.
 */
export function pickIndustryProjectNextAction(project, ctx, packId = getOrgIndustryPackId()) {
  if (!project?.id || project.closed) return null;
  const pid = project.id;
  const inspections = ctx.inspectionsByProject?.[pid] || [];
  const surveys = ctx.surveysByProject?.[pid] || [];
  const snags = ctx.snagsByProject?.[pid] || [];
  const rams = ctx.ramsByProject?.[pid] || [];
  const permits = ctx.permitsByProject?.[pid] || [];
  const methodStatements = ctx.methodStatementsByProject?.[pid] || [];

  if (packId === "electricalContractor") {
    if (rams.length && permits.length && !inspections.length) {
      return {
        label: "Log electrical inspection",
        viewId: "inspections",
        action: "create",
        projectId: pid,
        tone: "info",
      };
    }
    if (rams.length && permits.length && isModuleVisible("loto")) {
      const loto = loadOrgScoped("loto_register", []);
      if (!projectRows(loto, pid).length) {
        return {
          label: "Record LOTO / isolation",
          viewId: "loto",
          action: "create",
          projectId: pid,
          tone: "info",
        };
      }
    }
  }

  if (packId === "buildingTrades" || packId === "generalContractor") {
    if (rams.length && snags.length === 0) {
      return {
        label: "Log first snag",
        viewId: "snags",
        action: "create",
        projectId: pid,
        tone: "info",
      };
    }
    const open = snags.filter((s) => s.status !== "closed" && s.status !== "resolved");
    if (open.length > 0) {
      return {
        label: `Close ${open.length} open snag(s)`,
        viewId: "snags",
        projectId: pid,
        tone: "warn",
      };
    }
  }

  if (isSurveyGeospatialPackId(packId) && isSurveyWorkflowEnabled()) {
    if (surveys.length && !surveyCompletenessOk(surveys)) {
      const draft = surveys.find((s) => s.status !== "final") || surveys[0];
      return {
        label: "Complete survey QA checklist",
        viewId: "survey-report",
        action: "edit",
        projectId: pid,
        reportId: draft?.id,
        tone: "warn",
      };
    }
    if (!methodStatements.length && rams.length) {
      return {
        label: "Add mobilisation method statement",
        viewId: "method-statement",
        action: "create",
        projectId: pid,
        tone: "info",
      };
    }
  }

  if (packId === "foodPharma") {
    const today = todayIsoDate();
    const active = activeAllergenWindows(loadOrgScoped("allergen_changeover_windows", []), today);
    if (active.length) {
      return {
        label: "Confirm allergen changeover controls",
        viewId: "allergen-changeovers",
        projectId: pid,
        tone: "warn",
      };
    }
  }

  return null;
}

/** Pack-specific document count rows for site pack PDF. */
export function getIndustrySitePackRows(packId = getOrgIndustryPackId(), registers, dash) {
  /** @type {Array<{ label: string, value: string }>} */
  const rows = [];
  const reg = resolveRegisters(registers);

  switch (packId) {
    case "electricalContractor":
      rows.push({ label: "PAT / electrical records", value: String(reg.pat.length) });
      rows.push({ label: "Hot work register", value: String(reg.hotWork.length) });
      rows.push({ label: "LOTO register", value: String(reg.loto.length) });
      rows.push({ label: "Inspections (project)", value: String(dash?.inspections?.length || 0) });
      break;
    case "generalContractor":
    case "buildingTrades":
      rows.push({ label: "Open snags", value: String(dash?.totals?.openSnags || 0) });
      rows.push({ label: "Timesheet hours (week)", value: `${dash?.timesheetSummary?.hoursThisWeek || 0}h` });
      rows.push({ label: "CDM packs", value: String(dash?.cdmPacks?.length || 0) });
      break;
    case "surveyingGeodesy":
      rows.push({ label: "Survey reports", value: String(dash?.surveys?.length || 0) });
      rows.push({
        label: "Survey drafts",
        value: String((dash?.surveys || []).filter((s) => s.status !== "final").length),
      });
      rows.push({ label: "Drawings / plans", value: String(dash?.plans?.length || 0) });
      rows.push({ label: "Geo photos", value: String(reg.geoPhotos.length) });
      break;
    case "contractorPlusSurveying":
      rows.push({ label: "Survey reports", value: String(dash?.surveys?.length || 0) });
      rows.push({ label: "Open snags", value: String(dash?.totals?.openSnags || 0) });
      rows.push({ label: "Inspections (project)", value: String(dash?.inspections?.length || 0) });
      break;
    case "facilitiesMaintenance":
      rows.push({ label: "PAT / electrical records", value: String(reg.pat.length) });
      rows.push({ label: "Org inspections", value: String(reg.inspections.length) });
      rows.push({ label: "Inspections (project)", value: String(dash?.inspections?.length || 0) });
      break;
    case "demolitionStripout":
      rows.push({ label: "Active PTW", value: String(dash?.totals?.activePermits || 0) });
      rows.push({ label: "RAMS documents", value: String(dash?.rams?.length || 0) });
      rows.push({ label: "CDM packs", value: String(dash?.cdmPacks?.length || 0) });
      break;
    case "foodPharma":
      rows.push({
        label: "GMP deviations (open)",
        value: String(reg.gmp.filter((r) => String(r.status || "open").toLowerCase() !== "closed").length),
      });
      rows.push({ label: "Allergen changeover windows", value: String(reg.allergen.length) });
      rows.push({ label: "High-care access records", value: String(reg.highCare.length) });
      break;
    default:
      break;
  }

  return rows;
}

/**
 * HTML fragment: industry audit focus list for site pack print.
 * @param {(s: string) => string} escapeFn
 */
export function buildIndustrySitePackFocusHtml(packId, dash, registers, escapeFn) {
  const config = INDUSTRY_SITE_PACKS[packId] || INDUSTRY_SITE_PACKS.generalContractor;
  const reg = resolveRegisters(registers);
  const counts = {
    "PAT / electrical": reg.pat.length,
    "Hot work register": reg.hotWork.length,
    "LOTO / isolation": reg.loto.length,
    Inspections: dash?.inspections?.length || 0,
    RAMS: dash?.rams?.length || 0,
    "Permits (PTW)": dash?.permits?.length || 0,
    "Daily briefing": dash?.totals?.briefingToday ? "today" : dash?.dailyBriefings?.length || 0,
    "CDM pack": dash?.cdmPacks?.length || 0,
    "Open snags": dash?.totals?.openSnags || 0,
    Timesheets: dash?.timesheetSummary?.hoursThisWeek || 0,
    "Snag register": dash?.snags?.length || 0,
    "Method statements": dash?.methodStatements?.length || 0,
    "Survey reports": dash?.surveys?.length || 0,
    "PAS128 deliverables": (dash?.surveys || []).filter((s) => s.pas128Ql).length,
    "RAMS (surveying)": dash?.rams?.length || 0,
    Drawings: dash?.plans?.length || 0,
    "Geo photos": reg.geoPhotos.length,
    "Allergen changeovers": reg.allergen.length,
    "GMP deviations": reg.gmp.length,
    "High-care access": reg.highCare.length,
    "Inspections or survey": isSurveyWorkflowEnabled() ? dash?.surveys?.length || 0 : dash?.inspections?.length || 0,
    "Linked documents": dash?.totals?.documents || 0,
    PTW: dash?.permits?.length || 0,
  };

  const items = config.focus.map((label) => {
    const val = counts[label];
    let detail = "";
    if (label === "Daily briefing" && val === "today") detail = " — recorded today";
    else if (label === "Timesheets" && val != null) detail = ` — ${val}h this week`;
    else if (val != null && val !== "") detail = ` — ${val}`;
    return `<li>${escapeFn(label)}${escapeFn(detail)}</li>`;
  });

  return `<div class="section">${escapeFn(config.title)} — audit focus</div><ul>${items.join("")}</ul>`;
}
