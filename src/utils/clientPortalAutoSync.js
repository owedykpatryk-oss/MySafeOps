/**
 * Debounced auto re-publish for cloud client portals when org compliance data changes.
 */
import { loadOrgScoped, ORG_CHANGED_EVENT, ORG_DATA_CHANGED_EVENT } from "./orgStorage";
import { loadPublishedPortalTokens } from "./clientPortalPublished";
import { publishPortalToCloud, PORTAL_SNAPSHOT_BASE_KEYS } from "./clientPortalCloud";
import { syncOrgSlugIfNeeded } from "./orgMembership";

const DEBOUNCE_MS = 4000;

export const PORTAL_CLOUD_SYNC_EVENT = "mysafeops-portal-cloud-sync";

let debounceTimer = null;
let inflight = false;

function isPortalPublishable(portal) {
  if (!portal?.token || portal.active === false) return false;
  if (portal.expiresAt && new Date(portal.expiresAt) < new Date()) return false;
  return true;
}

/** Re-publish all active cloud portals for the current org (silent — no UI toasts). */
export async function republishPublishedPortals(supabase) {
  if (!supabase || inflight) return { count: 0 };

  const tokens = loadPublishedPortalTokens();
  if (!tokens.size) return { count: 0 };

  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return { count: 0 };

  const portals = loadOrgScoped("client_portals", []);
  const toPublish = portals.filter((p) => tokens.has(p.token) && isPortalPublishable(p));
  if (!toPublish.length) return { count: 0 };

  inflight = true;
  try {
    const orgSlug = await syncOrgSlugIfNeeded(supabase);
    for (const portal of toPublish) {
      await publishPortalToCloud(supabase, portal, orgSlug);
    }
    if (typeof window !== "undefined" && toPublish.length) {
      window.dispatchEvent(
        new CustomEvent(PORTAL_CLOUD_SYNC_EVENT, {
          detail: { count: toPublish.length, at: new Date().toISOString(), silent: true },
        })
      );
    }
    return { count: toPublish.length };
  } finally {
    inflight = false;
  }
}

function scheduleRepublish(supabase) {
  if (!supabase) return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    republishPublishedPortals(supabase).catch(() => {
      /* silent — manual Re-publish remains available */
    });
  }, DEBOUNCE_MS);
}

/**
 * Listen for org data saves and re-publish cloud portals after a debounce.
 * @returns cleanup function
 */
export function initPortalCloudAutoSync(supabase) {
  if (!supabase || typeof window === "undefined") return () => {};

  const onDataChanged = (event) => {
    const baseKey = event?.detail?.baseKey;
    if (!baseKey || !PORTAL_SNAPSHOT_BASE_KEYS.includes(baseKey)) return;
    scheduleRepublish(supabase);
  };

  const onOrgChanged = () => scheduleRepublish(supabase);

  window.addEventListener(ORG_DATA_CHANGED_EVENT, onDataChanged);
  window.addEventListener(ORG_CHANGED_EVENT, onOrgChanged);

  return () => {
    clearTimeout(debounceTimer);
    window.removeEventListener(ORG_DATA_CHANGED_EVENT, onDataChanged);
    window.removeEventListener(ORG_CHANGED_EVENT, onOrgChanged);
  };
}
