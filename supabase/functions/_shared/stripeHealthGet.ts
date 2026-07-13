import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

/** Org admin/owner only — used to gate detailed Stripe diagnostics on GET. */
export async function getBillingAdminUser(req: Request, supabaseUrl: string, serviceKey: string) {
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ") || !supabaseUrl || !serviceKey) return null;
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(auth.slice(7));
  if (!user?.id) return null;
  const { data: mem } = await supabase
    .from("org_memberships")
    .select("role")
    .eq("user_id", user.id)
    .maybeSingle();
  const role = String(mem?.role || "").toLowerCase();
  if (role !== "admin" && role !== "owner") return null;
  return user;
}

export function publicStripeHealthBody(fnName: string, liveReady: boolean, testReady: boolean, requestId: string) {
  return {
    function: fnName,
    deployed: true,
    liveReady,
    testReady,
    requestId,
  };
}
