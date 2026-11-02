/* global fetch, URLSearchParams */
// One source of truth for browser warnings and server quota enforcement.
export const BILLING_PLAN_LIMITS = Object.freeze({
  starter: { workers: 5, projects: 100, cloudBytes: 2_000_000_000 },
  team: { workers: 20, projects: 500, cloudBytes: 10_000_000_000 },
  business: { workers: 75, projects: 2_500, cloudBytes: 50_000_000_000 },
  enterprise: { workers: 200, projects: 10_000, cloudBytes: 200_000_000_000 },
  enterprise_plus: { workers: Number.MAX_SAFE_INTEGER, projects: Number.MAX_SAFE_INTEGER, cloudBytes: Number.MAX_SAFE_INTEGER },
  trial: { workers: 200, projects: 100, cloudBytes: 10_000_000_000 },
});

/** Called only after the server's membership, role and billing write gates approve. */
export async function readServerBillingLimits(env, authorization, orgSlug, dataKey = "main") {
  const base = String(env.SUPABASE_URL || "").replace(/\/+$/, "");
  const headers = { apikey: env.SUPABASE_ANON_KEY, Authorization: authorization, "Content-Type": "application/json" };
  try {
    const owner = await fetch(`${base}/rest/v1/rpc/user_is_platform_owner`, { method: "POST", headers, body: "{}" });
    if (owner.ok && (await owner.json()) === true) return { ok: true, limits: BILLING_PLAN_LIMITS.enterprise_plus };
    const country = /^country:([0-9a-fA-F-]{36}):/.exec(dataKey);
    let billing;
    if (country) {
      const workspaceQuery = new URLSearchParams({ select: "is_primary", id: `eq.${country[1]}`, limit: "1" });
      const workspaceResponse = await fetch(`${base}/rest/v1/org_country_workspaces?${workspaceQuery}`, { headers });
      if (!workspaceResponse.ok) return { ok: false, error: "billing_limits_unavailable" };
      const workspaces = await workspaceResponse.json();
      if (!Array.isArray(workspaces) || workspaces.length !== 1) return { ok: false, error: "billing_limits_unavailable" };
      if (workspaces[0].is_primary) return { ok: false, error: "invalid_register_key" };
      const response = await fetch(`${base}/rest/v1/rpc/get_my_country_workspace_entitlements`, {
        method: "POST", headers, body: JSON.stringify({ p_org_slug: orgSlug }),
      });
      if (!response.ok) return { ok: false, error: "billing_limits_unavailable" };
      const rows = await response.json();
      billing = Array.isArray(rows) ? rows.find((row) => row.workspace_id === country[1]) : null;
    } else {
      const response = await fetch(`${base}/rest/v1/rpc/get_my_org_billing`, {
        method: "POST", headers, body: JSON.stringify({ p_org_slug: orgSlug }),
      });
      if (!response.ok) return { ok: false, error: "billing_limits_unavailable" };
      const rows = await response.json();
      billing = Array.isArray(rows) ? rows[0] : null;
    }
    const paid = ["active", "trialing", "past_due"].includes(billing?.subscription_status)
      && Object.hasOwn(BILLING_PLAN_LIMITS, billing?.billing_plan) && billing.billing_plan !== "trial";
    const plan = paid ? billing.billing_plan : !country && new Date(billing?.trial_ends_at).getTime() > Date.now() ? "trial" : null;
    return plan ? { ok: true, limits: BILLING_PLAN_LIMITS[plan] } : { ok: false, error: "billing_limits_unavailable" };
  } catch {
    return { ok: false, error: "billing_limits_unavailable" };
  }
}
