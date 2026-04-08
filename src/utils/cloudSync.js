import { collectBackupBundle, restoreBackupBundle, validateBackupBundle } from "./backup";

/**
 * Turn Supabase / network failures into short UI copy (Backup screen).
 * @param {unknown} err
 * @returns {string}
 */
export function formatCloudSyncError(err) {
  if (err == null) return "Unknown error.";
  const msg = typeof err === "object" && err !== null && "message" in err ? String(err.message) : String(err);
  const lower = msg.toLowerCase();
  if (lower.includes("jwt") || lower.includes("invalid refresh token") || lower.includes("session")) {
    return "Session expired or invalid. Sign in again under Settings.";
  }
  if (lower.includes("no cloud backup") || lower.includes("no rows") || msg.includes("PGRST116")) {
    return "No cloud backup for this organisation yet.";
  }
  if (lower.includes("permission denied") || lower.includes("rls") || lower.includes("42501") || lower.includes("row-level security")) {
    return "Permission denied. Check you are signed in and database policies allow app_sync for your account.";
  }
  if (lower.includes("failed to fetch") || lower.includes("networkerror") || lower.includes("load failed")) {
    return "Network error. Check your connection and try again.";
  }
  return msg.length > 180 ? `${msg.slice(0, 177)}…` : msg;
}

/**
 * Upload full localStorage bundle to Supabase table public.app_sync (requires migration + RLS).
 */
export async function uploadBackupToSupabase(supabase, orgSlug, { includeGeocodeCache = false, bundle: presetBundle } = {}) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error("Not signed in");

  const bundle = presetBundle ?? collectBackupBundle({ includeGeocodeCache });
  const { error } = await supabase.from("app_sync").upsert(
    {
      user_id: user.id,
      org_slug: orgSlug || "default",
      payload: bundle,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,org_slug" }
  );
  if (error) throw error;
  return bundle;
}

/**
 * Download bundle from Supabase and merge into localStorage (same rules as restoreBackupBundle).
 */
export async function downloadBackupFromSupabase(supabase, orgSlug, { merge = false } = {}) {
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr) throw userErr;
  if (!user) throw new Error("Not signed in");

  const { data, error } = await supabase
    .from("app_sync")
    .select("payload, updated_at")
    .eq("org_slug", orgSlug || "default")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw error;
  if (!data?.payload) throw new Error("No cloud backup for this organisation yet.");

  const v = validateBackupBundle(data.payload);
  if (!v.ok) throw new Error(v.message);

  return restoreBackupBundle(data.payload, { merge });
}

export async function getCloudBackupMeta(supabase, orgSlug) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("app_sync")
    .select("updated_at")
    .eq("org_slug", orgSlug || "default")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data) return null;
  return data.updated_at;
}
