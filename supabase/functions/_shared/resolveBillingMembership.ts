/**
 * Resolve the caller's org membership for Stripe checkout/portal.
 * Prefers body.orgSlug (validated) so multi-org users are not broken by maybeSingle().
 */
// deno-lint-ignore no-explicit-any
export async function resolveBillingMembership(
  supabase: any,
  userId: string,
  orgSlug?: string | null,
): Promise<{ org_id: string; role: string } | null> {
  const slug = String(orgSlug || "").trim();
  if (slug) {
    const { data: org, error: orgErr } = await supabase
      .from("organizations")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .maybeSingle();
    if (orgErr || !org?.id) return null;

    const { data: mem, error: memErr } = await supabase
      .from("org_memberships")
      .select("org_id, role")
      .eq("user_id", userId)
      .eq("org_id", org.id)
      .limit(1)
      .maybeSingle();
    if (memErr || !mem?.org_id) return null;
    return mem;
  }

  const { data: mem, error: memErr } = await supabase
    .from("org_memberships")
    .select("org_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (memErr || !mem?.org_id) return null;
  return mem;
}
