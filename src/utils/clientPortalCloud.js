/**
 * Client portal cloud publish — share read-only compliance snapshots cross-device via Supabase.
 */
import { loadOrgScoped as load, asStorageArray } from "./orgStorage";
import { pushAudit } from "./auditLog";
import { genOpaqueToken } from "./opaqueToken";

export const PORTAL_DEFAULT_TTL_DAYS = 90;

/** @param {number} [days] */
export function defaultPortalExpiryIso(days = PORTAL_DEFAULT_TTL_DAYS) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

const SNAPSHOT_KEYS = {
  workers: "mysafeops_workers",
  rams: "rams_builder_docs",
  permits: "permits_v2",
  incidents: "mysafeops_incidents",
  snags: "snags",
};

/** Base keys that invalidate published portal cloud snapshots when saved. */
export const PORTAL_SNAPSHOT_BASE_KEYS = Object.values(SNAPSHOT_KEYS);

function filterByProject(rows, projectId) {
  const list = asStorageArray(rows);
  if (!projectId) return list;
  return list.filter((r) => {
    if (r.projectId === projectId) return true;
    if (Array.isArray(r.projectIds) && r.projectIds.includes(projectId)) return true;
    return false;
  });
}

/** Build scoped snapshot for a portal definition (local org data). */
export function buildPortalSnapshot(portal) {
  const projectId = portal?.projectId || "";
  return {
    workers: filterByProject(load(SNAPSHOT_KEYS.workers, []), projectId),
    rams: filterByProject(load(SNAPSHOT_KEYS.rams, []), projectId),
    permits: filterByProject(load(SNAPSHOT_KEYS.permits, []), projectId),
    incidents: filterByProject(load(SNAPSHOT_KEYS.incidents, []), projectId),
    snags: filterByProject(load(SNAPSHOT_KEYS.snags, []), projectId),
    publishedAt: new Date().toISOString(),
  };
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {object} portal
 * @param {string} orgSlug
 */
export async function publishPortalToCloud(supabase, portal, orgSlug) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error("Sign in to publish portal links for clients on any device.");

  const token = portal.token;
  if (!token) throw new Error("Portal token missing.");

  const snapshot = buildPortalSnapshot(portal);
  const expiresAt = portal.expiresAt
    ? new Date(portal.expiresAt).toISOString()
    : new Date(`${defaultPortalExpiryIso()}T23:59:59.999Z`).toISOString();

  const { error } = await supabase.from("client_portal_shares").upsert(
    {
      token,
      user_id: user.id,
      org_slug: orgSlug || "default",
      portal: {
        id: portal.id,
        clientName: portal.clientName,
        projectId: portal.projectId || "",
        projectName: portal.projectName || "All projects",
        sections: portal.sections || [],
        allowRamsApproval: portal.allowRamsApproval !== false,
        active: portal.active !== false,
        expiresAt: portal.expiresAt || defaultPortalExpiryIso(),
      },
      snapshot,
      active: portal.active !== false,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "token" }
  );
  if (error) throw error;
  pushAudit({
    action: "portal_publish",
    entity: "client_portal",
    detail: `${portal.clientName || "portal"} · ${String(token).slice(0, 8)}…`,
  });
  return { ok: true, token, publishedAt: snapshot.publishedAt };
}

/** Deactivate or refresh cloud row for a published portal. */
export async function syncPortalCloudState(supabase, portal, orgSlug) {
  return publishPortalToCloud(supabase, portal, orgSlug);
}

/** Remove cloud share when portal deleted. */
export async function deletePortalFromCloud(supabase, token) {
  if (!supabase || !token) return;
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) return;
  const { error } = await supabase.from("client_portal_shares").delete().eq("token", token).eq("user_id", user.id);
  if (error) throw error;
}

/** Fetch published portal for public ?portal= link (anon RPC — no row enumeration). */
export async function fetchPublishedPortal(supabase, token) {
  if (!supabase || !token) return null;
  const { data, error } = await supabase.rpc("fetch_client_portal_share", { p_token: token });
  if (error) {
    if (String(error.message || "").includes("fetch_client_portal_share")) return null;
    throw error;
  }
  if (!data || typeof data !== "object") return null;
  const portal = data.portal;
  const snapshot = data.snapshot;
  if (!portal || !snapshot) return null;
  if (portal.active === false) return null;
  if (portal.expiresAt && new Date(portal.expiresAt) < new Date()) return null;
  return { portal: { ...portal, token }, snapshot };
}

export function genPortalToken() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return genOpaqueToken("pt");
}
