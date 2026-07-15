/**
 * More tile intelligence — pre-built quick starts + smart one-liners for module grid.
 */
import { getOrgMarketId } from "./orgMarket";
import { getRegisterSmartTips } from "./registerModuleSmart";
import { getModuleLabel } from "./moduleRegisterStats";
import { isModuleAllowedForMarket } from "../config/marketModules";
import { MODULE_PDF_REGISTRY } from "../navigation/moduleCatalogMeta";
import { loadOrgScoped } from "./orgStorage";

function loadRegisterItems(moduleId) {
  const cfg = MODULE_PDF_REGISTRY[moduleId];
  if (!cfg) return [];
  const data = loadOrgScoped(cfg.key, []);
  return Array.isArray(data) ? data : [];
}

/** @typedef {{ shortLabel: string, label: string, viewId?: string, action?: string, seed?: boolean }} PrebuildDef */

/** @type {Record<string, PrebuildDef | ((stat?: object) => PrebuildDef)>} */
export const MODULE_PREBUILDS = {
  "daily-briefing": { shortLabel: "Today’s briefing", label: "Pre-built mobilisation briefing with weather + attendance", action: "create" },
  "method-statement": { shortLabel: "Mobilisation MS", label: "Pre-built method statement template", action: "create" },
  cdm: { shortLabel: "CPP starter", label: "Pre-built CDM 2015 compliance pack", action: "create" },
  "whs-plan": { shortLabel: "WHS plan", label: "Pre-built WHS management plan", action: "create" },
  "bhp-plan": { shortLabel: "Plan BHP", label: "Pre-built construction BHP plan", action: "create" },
  snags: { shortLabel: "New snag", label: "Pre-built snag with photo + priority", action: "create" },
  timesheets: { shortLabel: "This week", label: "Pre-built weekly timesheet grid", action: "create" },
  "geo-photos": { shortLabel: "Site photo", label: "Pre-built geo-tagged site photo", action: "capture" },
  induction: { shortLabel: "QR site", label: "Pre-built QR induction site + register", action: "create" },
  signatures: { shortLabel: "Sign-off", label: "In-app digital signature pad", action: "create" },
  coshh: { shortLabel: "Add substance", label: "Pre-built COSHH row with SDS checklist", action: "create" },
  inspections: { shortLabel: "LOLER check", label: "Pre-built thorough examination record", action: "create" },
  incidents: { shortLabel: "Near miss", label: "Pre-built incident / near-miss form", action: "create" },
  "incident-actions": { shortLabel: "Corrective action", label: "Pre-built CAPA with owner + due date", action: "create" },
  riddor: { shortLabel: "RIDDOR check", label: "Pre-built F2508 assessment wizard", action: "create" },
  "notifiable-incidents": { shortLabel: "Notifiable", label: "Pre-built WHS notifiable incident worksheet", action: "create" },
  emergency: { shortLabel: "Key contacts", label: "Pre-built emergency contact set", action: "create" },
  ppe: { shortLabel: "Issue PPE", label: "Pre-built PPE issue record", action: "create" },
  plant: { shortLabel: "Plant entry", label: "Pre-built PUWER plant register row", action: "create" },
  fire: { shortLabel: "Weekly check", label: "Pre-built fire extinguisher walk-round", action: "create" },
  "hot-work": { shortLabel: "Hot work log", label: "Pre-built hot work + fire watch record", action: "create" },
  training: { shortLabel: "CSCS row", label: "Pre-built training matrix entry", action: "create" },
  visitors: { shortLabel: "Visitor in", label: "Pre-built visitor induction log", action: "create" },
  "toolbox-reg": { shortLabel: "Toolbox talk", label: "Pre-built toolbox talk record", action: "create" },
  "first-aid": { shortLabel: "First aider", label: "Pre-built first aider register entry", action: "create" },
  "lone-working": { shortLabel: "Check-in", label: "Pre-built lone worker log", action: "create" },
  environmental: { shortLabel: "Spill log", label: "Pre-built environmental observation", action: "create" },
  observations: { shortLabel: "Good catch", label: "Pre-built positive safety observation", action: "create" },
  ladders: { shortLabel: "Ladder check", label: "Pre-built ladder inspection", action: "create" },
  mewp: { shortLabel: "MEWP log", label: "Pre-built MEWP pre-use check", action: "create" },
  gate: { shortLabel: "Gate entry", label: "Pre-built delivery / gate book entry", action: "create" },
  asbestos: { shortLabel: "ACM record", label: "Pre-built asbestos register location", action: "create" },
  "confined-space": { shortLabel: "Entry log", label: "Pre-built confined space entry", action: "create" },
  loto: { shortLabel: "Isolation", label: "Pre-built LOTO lock register", action: "create" },
  "electrical-pat": { shortLabel: "PAT test", label: "Pre-built PAT test record", action: "create" },
  lifting: { shortLabel: "Lift plan", label: "Pre-built LOLER lift plan", action: "create" },
  dsear: { shortLabel: "DSEAR zone", label: "Pre-built DSEAR / ATEX assessment", action: "create" },
  "high-care-access": { shortLabel: "Zone entry", label: "Pre-built high-care access log", action: "create" },
  "cip-signoff": { shortLabel: "CIP sign-off", label: "Pre-built CIP hygiene sign-off", action: "create" },
  "allergen-changeovers": { shortLabel: "Changeover", label: "Pre-built allergen changeover window", action: "create" },
  "gmp-deviations": { shortLabel: "Deviation", label: "Pre-built GMP deviation record", action: "create" },
  "ghp-register": { shortLabel: "G&HP item", label: "Pre-built glass & hard plastic entry", action: "create" },
  "dynamic-ra": { shortLabel: "Field DRA", label: "Pre-built dynamic risk assessment", action: "create" },
  legislation: { shortLabel: "UK library", label: "Pre-built UK HSE legislation register", action: "seed" },
  "hygiene-setup": { shortLabel: "F&P setup", label: "Food & pharma onboarding checklist", action: "open" },
  "fess-setup": { shortLabel: "FESS setup", label: "FESS workspace onboarding checklist", action: "open" },
  "fess-sites": { shortLabel: "FESS sites", label: "Client sites — one-click job pack per food factory", action: "open" },
  "construction-setup": { shortLabel: "GC wizard", label: "Pre-built construction setup checklist", action: "open" },
  noise: { shortLabel: "Noise survey", label: "Pre-built noise exposure record", action: "create" },
  scaffold: { shortLabel: "Scaffold tag", label: "Pre-built scaffold inspection tag", action: "create" },
  excavation: { shortLabel: "Trial hole", label: "Pre-built excavation / permit dig log", action: "create" },
  "temp-works": { shortLabel: "TW design", label: "Pre-built temporary works register", action: "create" },
  welfare: { shortLabel: "Welfare check", label: "Pre-built site welfare inspection", action: "create" },
  "water-hygiene": { shortLabel: "Legionella", label: "Pre-built water hygiene temperature log", action: "create" },
  waste: { shortLabel: "Waste note", label: "Pre-built waste transfer note", action: "create" },
  "survey-report": { shortLabel: "PAS128 report", label: "Pre-built PAS128 utility mapping report", action: "create" },
  "gpr-report": { shortLabel: "GPR report", label: "Advanced GPR report with BGS geology & weather impact", action: "create" },
  "monthly-report": { shortLabel: "Monthly HSE", label: "Pre-built monthly safety report", action: "create" },
  templates: { shortLabel: "Doc template", label: "Pre-built document template", action: "create" },
  "client-portal": { shortLabel: "Client link", label: "Pre-built read-only client portal", action: "create" },
  documents: { shortLabel: "Upload doc", label: "Pre-built document library folder", action: "create" },
  "project-drawings": { shortLabel: "Drawing", label: "Pre-built project drawing register", action: "create" },
  audit: { shortLabel: "Audit trail", label: "Export audit log snapshot to PDF", action: "export" },
  backup: { shortLabel: "Backup pack", label: "Pre-built org backup export", action: "export" },
  analytics: { shortLabel: "Dashboard PDF", label: "Pre-built analytics snapshot export", action: "export" },
  "client-acquisition": { shortLabel: "Playbook", label: "Pre-built client acquisition playbook", action: "open" },
  "sales-enablement": { shortLabel: "Sales kit", label: "Pre-built sales enablement hub", action: "open" },
  "enterprise-readiness": { shortLabel: "Readiness", label: "Pre-built enterprise readiness review", action: "open" },
  subcontractor: { shortLabel: "Sub portal", label: "Pre-built subcontractor compliance pack", action: "open" },
  "incident-map": { shortLabel: "Map view", label: "Pre-built incident heat map", action: "open" },
};

function resolvePrebuild(moduleId, stat) {
  const marketId = getOrgMarketId();
  if (!isModuleAllowedForMarket(moduleId, marketId)) return null;
  const def = MODULE_PREBUILDS[moduleId];
  if (moduleId === "legislation") {
    const libLabel =
      marketId === "au"
        ? "WHS legislation register"
        : marketId === "pl"
          ? "Rejestr przepisów BHP"
          : "UK HSE legislation register";
    return {
      shortLabel: marketId === "au" ? "WHS library" : marketId === "pl" ? "BHP library" : "UK library",
      label: `Pre-built ${libLabel}`,
      viewId: "legislation",
      action: "seed",
    };
  }
  if (marketId === "au") {
    const auOverrides = {
      coshh: { shortLabel: "Add substance", label: "Pre-built hazardous substance row with SDS checklist", action: "create" },
      inspections: { shortLabel: "Plant check", label: "Pre-built plant inspection record", action: "create" },
      training: { shortLabel: "White Card", label: "Pre-built competency / White Card entry", action: "create" },
      plant: { shortLabel: "Plant entry", label: "Pre-built WHS plant register row", action: "create" },
      lifting: { shortLabel: "Lift plan", label: "Pre-built crane / lifting plan", action: "create" },
      "electrical-pat": null,
    };
    if (auOverrides[moduleId] === null) return null;
    if (auOverrides[moduleId]) return { ...auOverrides[moduleId], viewId: moduleId };
  }
  if (marketId === "pl") {
    const plOverrides = {
      coshh: { shortLabel: "Substancja", label: "Wiersz substancji niebezpiecznej z checklistą SDS", action: "create" },
      inspections: { shortLabel: "Inspekcja", label: "Rekord inspekcji urządzenia / placu", action: "create" },
      training: { shortLabel: "BHP", label: "Szkolenie BHP / uprawnienia", action: "create" },
      plant: { shortLabel: "Urządzenie", label: "Wiersz rejestru urządzeń", action: "create" },
      lifting: { shortLabel: "Plan podnoszenia", label: "Plan pracy żurawia / podnoszenia", action: "create" },
      "electrical-pat": null,
    };
    if (plOverrides[moduleId] === null) return null;
    if (plOverrides[moduleId]) return { ...plOverrides[moduleId], viewId: moduleId };
  }
  if (typeof def === "function") return def(stat);
  if (def) return { ...def, viewId: def.viewId || moduleId };
  if (stat?.status === "empty") {
    return {
      shortLabel: "Quick start",
      label: `Pre-built ${getModuleLabel(moduleId)} starter`,
      viewId: moduleId,
      action: "create",
    };
  }
  return {
    shortLabel: "Open",
    label: `Open ${getModuleLabel(moduleId)}`,
    viewId: moduleId,
    action: "open",
  };
}

/**
 * @param {string} moduleId
 * @param {object} [stat]
 */
export function getModuleTilePresentation(moduleId, stat) {
  const prebuild = resolvePrebuild(moduleId, stat);
  if (!prebuild) {
    return { prebuild: null, smartText: "", smartTone: "info", smartAction: null };
  }
  const items = loadRegisterItems(moduleId);
  const tips = getRegisterSmartTips(moduleId, {
    count: stat?.count ?? items.length,
    attentionCount: stat?.attentionCount ?? 0,
    items,
  });
  const tip = tips[0];
  return {
    prebuild,
    smartText: tip?.text || "",
    smartTone: tip?.tone || "info",
    smartAction: tip?.actionLabel
      ? { label: tip.actionLabel, viewId: tip.viewId || moduleId, action: tip.action }
      : null,
  };
}

/** One-line smart hint for tile (truncated). */
export function tileSmartLine(presentation) {
  if (!presentation?.smartText) return "";
  const t = String(presentation.smartText);
  return t.length > 72 ? `${t.slice(0, 69)}…` : t;
}
