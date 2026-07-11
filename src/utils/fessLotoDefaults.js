/**
 * FESS Group — starter LOTO register rows per client site (org-exclusive).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { isFessOrg } from "./fessOrg";
import { ensureFessSiteProject } from "./fessClientSites";

const KEY = "loto_register";
const genId = () => `loto_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`;

/** @type {Record<string, Array<{ equipmentName: string, isolationPoint: string, lockOwner?: string, status?: string }>>} */
export const FESS_SITE_LOTO_STARTERS = {
  fess_site_2sfg_scunthorpe: [
    { equipmentName: "Main compressor supply", isolationPoint: "Plant room isolator DB-2", status: "template" },
    { equipmentName: "DOLAV wash pump", isolationPoint: "FP1 local isolator", status: "template" },
  ],
  fess_site_2sfg_flixton: [
    { equipmentName: "Grille line conveyor drive", isolationPoint: "Grille MCC isolator", status: "template" },
  ],
  fess_site_cranswick_lazenby: [
    { equipmentName: "Wash station pump set", isolationPoint: "Wash area valve manifold", status: "template" },
    { equipmentName: "Roof void steam supply", isolationPoint: "Roof void isolation valve", status: "template" },
  ],
  fess_site_quorn: [
    { equipmentName: "Evap tower circulation pump", isolationPoint: "Evap plant isolator", status: "template" },
  ],
  fess_site_butternut: [
    { equipmentName: "Spiral conveyor drive", isolationPoint: "Production MCC", status: "template" },
  ],
  fess_site_dovecoat: [
    { equipmentName: "Production hall main air supply", isolationPoint: "Hall isolator valve", status: "template" },
    { equipmentName: "Vacuum pump set", isolationPoint: "Machine bay local isolator", status: "template" },
  ],
};

/**
 * @param {string} [siteTemplateId]
 * @returns {{ created: number, total: number }}
 */
export function seedFessLotoRegister(siteTemplateId = "") {
  if (!isFessOrg()) return { created: 0, total: 0 };

  const existing = Array.isArray(load(KEY, [])) ? [...load(KEY, [])] : [];
  const byKey = new Set(
    existing.map((r) => `${r.projectId || ""}|${String(r.equipmentName || "").toLowerCase()}`)
  );
  let created = 0;

  const siteIds = siteTemplateId ? [siteTemplateId] : Object.keys(FESS_SITE_LOTO_STARTERS);

  for (const siteId of siteIds) {
    const project = ensureFessSiteProject(siteId);
    if (!project) continue;
    const rows = FESS_SITE_LOTO_STARTERS[siteId] || [];
    for (const row of rows) {
      const dedupe = `${project.id}|${String(row.equipmentName || "").toLowerCase()}`;
      if (byKey.has(dedupe)) continue;
      existing.push({
        id: genId(),
        equipmentName: row.equipmentName,
        isolationPoint: row.isolationPoint,
        location: row.isolationPoint,
        lockOwner: row.lockOwner || "",
        status: row.status || "template",
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
