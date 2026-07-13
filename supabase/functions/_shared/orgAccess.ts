// Shared helper for edge functions that receive a client-supplied org slug alongside a
// service-role Supabase client. Resolves the slug to an org_id and confirms the calling
// user is actually a member before any service-role read/write scoped by that slug —
// closes the "trusts client orgSlug" gap flagged across push-subscription,
// send-permit-web-push, and permit-audit-export.

/**
 * @param {import("https://esm.sh/@supabase/supabase-js@2.49.1").SupabaseClient} supabase
 * @param {string} userId
 * @param {string} orgSlug
 * @returns {Promise<string | null>} org_id if the user is a member, otherwise null
 */
export async function resolveVerifiedOrgId(
  supabase: { from: (table: string) => any },
  userId: string,
  orgSlug: string
): Promise<string | null> {
  if (!userId || !orgSlug) return null;

  const { data: org, error: orgErr } = await supabase
    .from("organizations")
    .select("id")
    .eq("slug", orgSlug)
    .maybeSingle();
  if (orgErr || !org?.id) return null;

  const { data: mem, error: memErr } = await supabase
    .from("org_memberships")
    .select("org_id")
    .eq("user_id", userId)
    .eq("org_id", org.id)
    .maybeSingle();
  if (memErr || !mem?.org_id) return null;

  return String(mem.org_id);
}

/**
 * Verifies the caller belongs to the org identified by `orgSlug` before a service-role
 * query is scoped by that slug. The sentinel "default" slug (used by solo accounts with
 * no `organizations` row) is allowed through unverified since it carries no cross-tenant
 * data of its own — everything under it is already isolated by `user_id`. Any other slug
 * must resolve to a real membership, otherwise the request is rejected.
 * @returns {Promise<{ ok: true } | { ok: false; status: number; error: string }>}
 */
export async function assertOrgSlugAccess(
  supabase: { from: (table: string) => any },
  userId: string,
  orgSlug: string
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (orgSlug === "default") return { ok: true };
  const orgId = await resolveVerifiedOrgId(supabase, userId, orgSlug);
  if (!orgId) {
    return { ok: false, status: 403, error: "Forbidden: not a member of this organisation" };
  }
  return { ok: true };
}
