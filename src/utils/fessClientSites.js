/**
 * FESS Group — common client site project templates (from MC + Rams folders).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { isFessOrg } from "./fessOrg";
import { canUseFessExclusiveFeatures } from "./fessExclusive";

const genProjectId = () => `proj_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

/** Site template → default FESS playbook / job starter (MC reference mapping). */
const FESS_SITE_PLAYBOOK_MAP = {
  fess_site_2sfg_scunthorpe: { playbookId: "fess_dolav_meyn", jobStarterKey: "dolav_meyn" },
  fess_site_2sfg_flixton: { playbookId: "fess_grille_me", jobStarterKey: "grille_me" },
  fess_site_cranswick_lazenby: { playbookId: "fess_pipe_changeover", jobStarterKey: "pipe_changeover" },
  fess_site_quorn: { playbookId: "fess_unistrut_pipe_support", jobStarterKey: "unistrut_pipe_support" },
  fess_site_butternut: { playbookId: "fess_spiral_conveyor", jobStarterKey: "spiral_conveyor" },
  fess_site_dovecoat: { playbookId: "fess_machine_install", jobStarterKey: "machine_install" },
};

/** @param {string} siteTemplateId */
export function getFessSitePlaybookSuggestion(siteTemplateId) {
  if (!canUseFessExclusiveFeatures()) return null;
  return FESS_SITE_PLAYBOOK_MAP[String(siteTemplateId || "").trim()] || null;
}

/** @type {Array<{ id: string, name: string, client: string, location: string, site: string, address: string, nearestHospital: string, permitControllerHint?: string, permitDefaults: { requiredPermitTypes: string[] }, suggestedPlaybookId?: string, suggestedJobStarterKey?: string }>} */
export const FESS_CLIENT_SITE_TEMPLATES = [
  {
    id: "fess_site_2sfg_scunthorpe",
    name: "2SFG Scunthorpe — production lines",
    client: "2 Sisters Food Group",
    location: "2SFG Scunthorpe",
    site: "Production hall & FP1",
    address: "2SFG Scunthorpe, UK",
    nearestHospital: "Scunthorpe General Hospital, Lodge Road, DN15 7BH",
    permitControllerHint: "Site permit controller — confirm at FP1 induction",
    permitControllerContact: "2SFG Scunthorpe — permit controller",
    permitDefaults: { requiredPermitTypes: ["line_clearance", "hot_work", "cold_work", "loto"] },
    suggestedPlaybookId: "fess_dolav_meyn",
    suggestedJobStarterKey: "dolav_meyn",
    preferredBaselinePackId: "orgexclusive_fess_excel_baseline",
    extraHazardIds: ["fess_009", "fess_010"],
  },
  {
    id: "fess_site_2sfg_flixton",
    name: "2SFG Flixton — grille & lines",
    client: "2 Sisters Food Group",
    location: "2SFG Flixton",
    site: "Grille production",
    address: "2SFG Flixton, UK",
    nearestHospital: "Royal Bolton Hospital, Minerva Road, BL4 0JR",
    permitControllerHint: "Site permit controller — grille production zone",
    permitDefaults: { requiredPermitTypes: ["line_clearance", "cold_work", "hot_work"] },
    suggestedPlaybookId: "fess_grille_me",
    suggestedJobStarterKey: "grille_me",
    preferredBaselinePackId: "orgexclusive_fess_excel_baseline",
    extraHazardIds: ["fess_002", "fess_010"],
  },
  {
    id: "fess_site_cranswick_lazenby",
    name: "Cranswick Lazenby — wash stations",
    client: "Cranswick",
    location: "Cranswick Lazenby, Helsinki Road",
    site: "Wash stations / roof void",
    address: "Helsinki Road, Lazenby, UK",
    nearestHospital: "Diana Princess of Wales Hospital, Scartho Road, Grimsby, DN33 2BA",
    permitControllerHint: "Production permit controller — wash station area",
    permitDefaults: { requiredPermitTypes: ["line_clearance", "loto", "hot_work", "cold_work"] },
    suggestedPlaybookId: "fess_pipe_changeover",
    suggestedJobStarterKey: "pipe_changeover",
    preferredBaselinePackId: "orgexclusive_fess_me_site_baseline",
    extraHazardIds: ["fess_003", "fess_012", "fess_013"],
  },
  {
    id: "fess_site_quorn",
    name: "Quorn Foods — pipe & supports",
    client: "Quorn Foods",
    location: "Quorn Foods",
    site: "Evap tower / pipe supports",
    address: "Quorn Foods site, UK",
    nearestHospital: "Stoke Mandeville Hospital, Mandeville Road, Aylesbury, HP21 8AL",
    permitControllerHint: "Engineering permit controller — evap tower",
    permitDefaults: { requiredPermitTypes: ["work_at_height", "cold_work", "general"] },
    suggestedPlaybookId: "fess_unistrut_pipe_support",
    suggestedJobStarterKey: "unistrut_pipe_support",
    preferredBaselinePackId: "orgexclusive_fess_me_site_baseline",
    extraHazardIds: ["fess_001", "fess_010", "fess_011"],
  },
  {
    id: "fess_site_butternut",
    name: "Butternut Box — production",
    client: "Butternut Box",
    location: "Butternut Box",
    site: "Production & conveyors",
    address: "Butternut Box, UK",
    nearestHospital: "Nearest A&E — confirm on site induction",
    permitControllerHint: "Site permit controller — production hall",
    permitDefaults: { requiredPermitTypes: ["line_clearance", "hot_work", "cold_work"] },
    suggestedPlaybookId: "fess_spiral_conveyor",
    suggestedJobStarterKey: "spiral_conveyor",
    preferredBaselinePackId: "orgexclusive_fess_excel_baseline",
    extraHazardIds: ["fess_002", "fess_014"],
  },
  {
    id: "fess_site_dovecoat",
    name: "Dovecoat Park — machine installs",
    client: "Dovecoat Park Ltd",
    location: "Dovecoat Park, Pontefract",
    site: "Production hall",
    address: "Bank Wood Rd, Pontefract WF8 3DD",
    nearestHospital: "Pinderfields Hospital, Aberford Road, Wakefield, WF1 4DG",
    permitControllerHint: "Site permit controller — machine install handover",
    permitDefaults: { requiredPermitTypes: ["line_clearance", "lifting", "work_at_height", "loto"] },
    suggestedPlaybookId: "fess_machine_install",
    suggestedJobStarterKey: "machine_install",
    preferredBaselinePackId: "orgexclusive_fess_excel_baseline",
    extraHazardIds: ["fess_002", "fess_015", "lift_001"],
  },
];

/**
 * Seed missing FESS client site projects (idempotent).
 * @returns {{ created: number, total: number, names: string[] }}
 */
export function seedFessClientSiteProjects() {
  if (!isFessOrg()) {
    return { created: 0, total: 0, names: [] };
  }
  const key = "mysafeops_projects";
  const existing = load(key, []);
  const list = Array.isArray(existing) ? [...existing] : [];
  const byName = new Set(list.map((p) => String(p.name || "").trim().toLowerCase()));
  const createdNames = [];
  const now = new Date().toISOString();

  for (const tmpl of FESS_CLIENT_SITE_TEMPLATES) {
    if (byName.has(tmpl.name.toLowerCase())) continue;
    list.push({
      id: genProjectId(),
      name: tmpl.name,
      client: tmpl.client,
      location: tmpl.location,
      site: tmpl.site,
      address: tmpl.address,
      status: "active",
      nearestHospital: tmpl.nearestHospital,
      permitDefaults: tmpl.permitDefaults,
      fessSiteTemplateId: tmpl.id,
      playbookId: tmpl.suggestedPlaybookId || "",
      fessSuggestedJobStarterKey: tmpl.suggestedJobStarterKey || "",
      createdAt: now,
      updatedAt: now,
    });
    createdNames.push(tmpl.name);
    byName.add(tmpl.name.toLowerCase());
  }

  if (createdNames.length) {
    save(key, list);
  }
  return { created: createdNames.length, total: list.length, names: createdNames };
}

export function listFessClientSiteTemplates() {
  if (!canUseFessExclusiveFeatures()) return [];
  return FESS_CLIENT_SITE_TEMPLATES;
}

/** @param {string} siteTemplateId */
export function getFessClientSiteTemplate(siteTemplateId) {
  if (!canUseFessExclusiveFeatures()) return null;
  return FESS_CLIENT_SITE_TEMPLATES.find((t) => t.id === siteTemplateId) || null;
}

/** @param {string} [siteTemplateId] */
export function getFessPreferredBaselinePackId(siteTemplateId) {
  const tmpl = getFessClientSiteTemplate(siteTemplateId);
  return tmpl?.preferredBaselinePackId || "orgexclusive_fess_me_site_baseline";
}

/** @param {string} [siteTemplateId] */
export function getFessSiteExtraHazardIds(siteTemplateId) {
  const tmpl = getFessClientSiteTemplate(siteTemplateId);
  return [...new Set(tmpl?.extraHazardIds || [])];
}

/**
 * Ensure a single FESS site project exists (creates if missing).
 * @param {string} siteTemplateId
 * @returns {object | null}
 */
export function ensureFessSiteProject(siteTemplateId) {
  if (!isFessOrg()) return null;
  const tmpl = FESS_CLIENT_SITE_TEMPLATES.find((t) => t.id === siteTemplateId);
  if (!tmpl) return null;

  const key = "mysafeops_projects";
  const existing = load(key, []);
  const list = Array.isArray(existing) ? [...existing] : [];
  const found =
    list.find((p) => p.fessSiteTemplateId === tmpl.id) ||
    list.find((p) => String(p.name || "").trim().toLowerCase() === tmpl.name.toLowerCase());
  if (found) return found;

  const now = new Date().toISOString();
  const project = {
    id: genProjectId(),
    name: tmpl.name,
    client: tmpl.client,
    location: tmpl.location,
    site: tmpl.site,
    address: tmpl.address,
    status: "active",
    nearestHospital: tmpl.nearestHospital,
    permitDefaults: tmpl.permitDefaults,
    fessSiteTemplateId: tmpl.id,
    playbookId: tmpl.suggestedPlaybookId || "",
    fessSuggestedJobStarterKey: tmpl.suggestedJobStarterKey || "",
    createdAt: now,
    updatedAt: now,
  };
  list.unshift(project);
  save(key, list);
  return project;
}
