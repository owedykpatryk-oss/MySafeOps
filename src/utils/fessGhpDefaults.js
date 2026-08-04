/**
 * FESS Group — starter G&HP register rows per client site (org-exclusive).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { isFessOrg } from "./fessOrg";
import { ensureFessSiteProject } from "./fessClientSites";

import { todayLocalISO } from "./localDate";
const KEY = "ghp_register";
const genId = () => `ghp_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;
const today = todayLocalISO;

/** @type {Record<string, Array<{ itemDescription: string, zone: string, broughtBy: string }>>} */
export const FESS_SITE_GHP_STARTERS = {
  fess_site_2sfg_scunthorpe: [
    { itemDescription: "Cordless drill/driver set", zone: "FP1 production hall", broughtBy: "FESS supervisor" },
    { itemDescription: "Stainless stillson wrench", zone: "DOLAV wash area", broughtBy: "Lead engineer" },
    { itemDescription: "MEWP access key fob", zone: "Plant room", broughtBy: "Site permit controller" },
  ],
  fess_site_2sfg_flixton: [
    { itemDescription: "Grille line tool bag", zone: "Grille production", broughtBy: "FESS supervisor" },
    { itemDescription: "Aluminium step ladder (tagged)", zone: "Grille hall", broughtBy: "Lead engineer" },
  ],
  fess_site_cranswick_lazenby: [
    { itemDescription: "Pipe cutter & deburr tool", zone: "Wash station", broughtBy: "Lead engineer" },
    { itemDescription: "Roof void access torch", zone: "Roof void", broughtBy: "FESS supervisor" },
  ],
  fess_site_quorn: [
    { itemDescription: "Unistrut channel & fixings kit", zone: "Evap tower", broughtBy: "Lead engineer" },
    { itemDescription: "Height harness (inspected)", zone: "Evap tower", broughtBy: "FESS supervisor" },
  ],
  fess_site_butternut: [
    { itemDescription: "Production hall tool crate", zone: "Conveyor line", broughtBy: "FESS supervisor" },
    { itemDescription: "Magnetic sweep bar", zone: "Production hall", broughtBy: "Lead engineer" },
  ],
  fess_site_dovecoat: [
    { itemDescription: "Machine install spanner set", zone: "Production hall", broughtBy: "Lead engineer" },
    { itemDescription: "Vacuum line test gauge", zone: "Production hall", broughtBy: "FESS supervisor" },
  ],
};

/**
 * @param {string} [siteTemplateId]
 * @returns {{ created: number, total: number }}
 */
export function seedFessGhpRegister(siteTemplateId = "") {
  if (!isFessOrg()) return { created: 0, total: 0 };

  const existing = Array.isArray(load(KEY, [])) ? [...load(KEY, [])] : [];
  const byKey = new Set(
    existing.map((r) => `${r.projectId || ""}|${String(r.itemDescription || "").toLowerCase()}`)
  );
  let created = 0;

  const siteIds = siteTemplateId
    ? [siteTemplateId]
    : Object.keys(FESS_SITE_GHP_STARTERS);

  for (const siteId of siteIds) {
    const project = ensureFessSiteProject(siteId);
    if (!project) continue;
    const rows = FESS_SITE_GHP_STARTERS[siteId] || [];
    for (const row of rows) {
      const dedupe = `${project.id}|${String(row.itemDescription || "").toLowerCase()}`;
      if (byKey.has(dedupe)) continue;
      existing.push({
        id: genId(),
        itemDescription: row.itemDescription,
        zone: row.zone,
        broughtBy: row.broughtBy,
        dateIn: today(),
        projectId: project.id,
        fessSiteTemplateId: siteId,
        createdAt: new Date().toISOString(),
      });
      byKey.add(dedupe);
      created += 1;
    }
  }

  if (created) save(KEY, existing);
  return { created, total: existing.length };
}
