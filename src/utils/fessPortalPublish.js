/**
 * FESS Group — batch publish site portals to cloud (org-exclusive).
 */
import { loadOrgScoped as load } from "./orgStorage";
import { canUseFessExclusiveFeatures } from "./fessExclusive";
import { publishPortalToCloud } from "./clientPortalCloud";
import { loadPublishedPortalTokens, markPortalPublished } from "./clientPortalPublished";
import { syncOrgSlugIfNeeded } from "./orgMembership";

/**
 * @returns {{ total: number, published: number, unpublished: number, portals: object[] }}
 */
export function getFessPortalPublishStatus() {
  if (!canUseFessExclusiveFeatures()) {
    return { total: 0, published: 0, unpublished: 0, portals: [] };
  }
  const tokens = loadPublishedPortalTokens();
  const portals = (Array.isArray(load("client_portals", [])) ? load("client_portals", []) : []).filter(
    (p) => p.fessPortalPreset || p.fessSiteTemplateId
  );
  const enriched = portals.map((p) => ({
    ...p,
    cloudPublished: tokens.has(p.token),
  }));
  return {
    total: enriched.length,
    published: enriched.filter((p) => p.cloudPublished).length,
    unpublished: enriched.filter((p) => !p.cloudPublished).length,
    portals: enriched,
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabase
 * @param {object} portal
 */
export async function publishFessPortalToCloud(supabase, portal) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, reason: "not_fess", message: "FESS portals are org-exclusive." };
  }
  if (!supabase) {
    return { ok: false, reason: "no_supabase", message: "Sign in to publish portal links for clients on any device." };
  }
  if (!portal?.token) {
    return { ok: false, reason: "no_portal", message: "Portal token missing." };
  }
  try {
    const orgSlug = await syncOrgSlugIfNeeded(supabase);
    await publishPortalToCloud(supabase, portal, orgSlug);
    markPortalPublished(portal.token);
    return { ok: true, token: portal.token, message: `Published — ${portal.clientName || portal.projectName || "portal"}` };
  } catch (err) {
    return { ok: false, reason: "publish_failed", message: err?.message || "Could not publish portal to cloud." };
  }
}

/**
 * Publish all unpublished FESS site portals.
 * @param {import('@supabase/supabase-js').SupabaseClient | null | undefined} supabase
 */
export async function publishAllFessSitePortals(supabase) {
  if (!canUseFessExclusiveFeatures()) {
    return { ok: false, published: 0, failed: 0, skipped: 0, message: "FESS portals are org-exclusive." };
  }
  if (!supabase) {
    return { ok: false, published: 0, failed: 0, skipped: 0, message: "Sign in to publish FESS site portals to cloud." };
  }

  const status = getFessPortalPublishStatus();
  const targets = status.portals.filter((p) => !p.cloudPublished && p.active !== false);
  if (!targets.length) {
    return {
      ok: true,
      published: 0,
      failed: 0,
      skipped: status.published,
      message: status.published ? "All FESS site portals are already published to cloud." : "No FESS site portals — seed site portals first.",
    };
  }

  let published = 0;
  let failed = 0;
  const errors = [];

  for (const portal of targets) {
    const result = await publishFessPortalToCloud(supabase, portal);
    if (result.ok) published += 1;
    else {
      failed += 1;
      if (result.message) errors.push(result.message);
    }
  }

  return {
    ok: failed === 0,
    published,
    failed,
    skipped: status.published,
    message:
      failed === 0
        ? `Published ${published} FESS site portal(s) to cloud.`
        : `Published ${published}, failed ${failed}.${errors[0] ? ` ${errors[0]}` : ""}`,
  };
}
