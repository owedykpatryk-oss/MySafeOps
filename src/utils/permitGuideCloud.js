import { getOrgId, loadOrgScoped, saveOrgScoped } from "./orgStorage";
import { PERMIT_GUIDE_STORAGE_KEY } from "./permitGuideStorage";

export const PERMIT_GUIDE_MODULE = "permits";

function guideRowToLocal(row) {
  const prefs = row?.prefs && typeof row.prefs === "object" ? row.prefs : {};
  return {
    completed: Boolean(row?.completed),
    completedAt: row?.completed_at || prefs.completedAt || null,
    role: prefs.role ?? null,
    preferQuickView: Boolean(prefs.preferQuickView),
  };
}

function localToGuidePrefs(local) {
  return {
    role: local?.role ?? null,
    preferQuickView: Boolean(local?.preferQuickView),
    completedAt: local?.completedAt ?? null,
  };
}

/**
 * Merge cloud guide state into localStorage (cloud wins when completed).
 */
export async function hydratePermitGuideFromCloud(supabase, userId) {
  if (!supabase || !userId) return { synced: false };
  const orgSlug = getOrgId();
  const { data, error } = await supabase
    .from("user_module_guides")
    .select("completed, completed_at, prefs")
    .eq("user_id", userId)
    .eq("org_slug", orgSlug)
    .eq("module", PERMIT_GUIDE_MODULE)
    .maybeSingle();

  if (error) {
    return { synced: false, error: error.message };
  }

  const local = loadOrgScoped(PERMIT_GUIDE_STORAGE_KEY, null) || {};

  if (data?.completed) {
    saveOrgScoped(PERMIT_GUIDE_STORAGE_KEY, guideRowToLocal(data));
    return { synced: true, source: "cloud" };
  }

  if (local.completed) {
    await syncPermitGuideToCloud(supabase, userId, local);
    return { synced: true, source: "local" };
  }

  return { synced: true, source: "none" };
}

export async function syncPermitGuideToCloud(supabase, userId, localOverride = null) {
  if (!supabase || !userId) return { ok: false };
  const orgSlug = getOrgId();
  const local = localOverride || loadOrgScoped(PERMIT_GUIDE_STORAGE_KEY, null) || {};
  const completed = Boolean(local.completed);
  const payload = {
    user_id: userId,
    org_slug: orgSlug,
    module: PERMIT_GUIDE_MODULE,
    completed,
    completed_at: completed ? local.completedAt || new Date().toISOString() : null,
    prefs: localToGuidePrefs(local),
  };

  const { error } = await supabase.from("user_module_guides").upsert(payload, {
    onConflict: "user_id,org_slug,module",
  });

  return { ok: !error, error: error?.message };
}
