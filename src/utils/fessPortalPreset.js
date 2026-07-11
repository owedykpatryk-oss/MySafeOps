/**
 * FESS Group — one-click client portal presets per food factory site (org-exclusive).
 */
import { loadOrgScoped as load, saveOrgScoped as save } from "./orgStorage";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { FESS_CLIENT_SITE_TEMPLATES, ensureFessSiteProject } from "./fessClientSites";
import { genPortalToken, defaultPortalExpiryIso } from "./clientPortalCloud";

const genRowId = () => `portal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

/**
 * Seed read-only portals for each FESS client site — RAMS approval enabled for permit controllers.
 * @returns {{ created: number, names: string[], total: number }}
 */
export function seedFessSitePortals() {
  if (!canUseFessExclusiveFeatures()) {
    return { created: 0, names: [], total: 0, message: "FESS site portals are only available for FESS Group workspace." };
  }

  const portals = Array.isArray(load("client_portals", [])) ? [...load("client_portals", [])] : [];
  const existingSites = new Set(
    portals.filter((p) => p.fessSiteTemplateId).map((p) => String(p.fessSiteTemplateId))
  );
  const createdNames = [];
  const now = new Date().toISOString();

  for (const tmpl of FESS_CLIENT_SITE_TEMPLATES) {
    if (existingSites.has(tmpl.id)) continue;
    const project = ensureFessSiteProject(tmpl.id);
    if (!project) continue;

    portals.unshift({
      id: genRowId(),
      token: genPortalToken(),
      clientName: `${tmpl.client} — ${tmpl.location} permit controller`,
      projectId: project.id,
      projectName: project.name,
      sections: ["workers", "rams", "permits"],
      allowRamsApproval: true,
      fessSiteTemplateId: tmpl.id,
      fessPortalPreset: true,
      expiresAt: defaultPortalExpiryIso(180),
      createdAt: now,
      active: true,
      notes: tmpl.permitControllerHint || "Site permit controller — approve RAMS before work starts.",
    });
    createdNames.push(tmpl.location);
    existingSites.add(tmpl.id);
  }

  if (createdNames.length) {
    save("client_portals", portals);
  }

  return { created: createdNames.length, names: createdNames, total: portals.length };
}

/** @param {string} siteTemplateId */
export function getFessPortalForSite(siteTemplateId) {
  if (!canUseFessExclusiveFeatures()) return null;
  const id = String(siteTemplateId || "").trim();
  if (!id) return null;
  const portals = load("client_portals", []);
  return (Array.isArray(portals) ? portals : []).find((p) => p.fessSiteTemplateId === id) || null;
}
