import { supabase } from "../lib/supabase";
import { getOrgId } from "./orgStorage";

/**
 * Best-effort mirror of permit rows for signed-in users (push-only; does not replace local data).
 */
export async function mirrorPermitsToSupabase(permits, orgSlug) {
  if (!supabase || !Array.isArray(permits) || permits.length === 0) return;
  const {
    data: { user },
    error: userErr,
  } = await supabase.auth.getUser();
  if (userErr || !user) return;

  const slug = String(orgSlug || getOrgId() || "default").slice(0, 200);
  const rows = permits.map((p) => ({
    user_id: user.id,
    org_slug: slug,
    permit_id: String(p.id),
    payload: p,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from("org_permits").upsert(rows, {
    onConflict: "user_id,org_slug,permit_id",
  });
  if (error) {
    console.warn("[permits] cloud mirror skipped:", error.message);
  }
}
