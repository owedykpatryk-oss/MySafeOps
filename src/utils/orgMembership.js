import { pushAudit } from "./auditLog";
import { getOrgId, setOrgId } from "./orgStorage";
import { clearPendingInvite, peekPendingInvite } from "../lib/inviteToken";

export const ORG_BILLING_PLAN_KEY = "mysafeops_billing_plan";
export const ORG_SUBSCRIPTION_STATUS_KEY = "mysafeops_subscription_status";

export function persistOrgRow(row) {
  if (row.trial_ends_at) {
    localStorage.setItem("mysafeops_trial_ends_at", String(row.trial_ends_at));
  }
  if (row.billing_plan != null && row.billing_plan !== "") {
    localStorage.setItem(ORG_BILLING_PLAN_KEY, String(row.billing_plan));
  } else {
    localStorage.removeItem(ORG_BILLING_PLAN_KEY);
  }
  if (row.subscription_status) {
    localStorage.setItem(ORG_SUBSCRIPTION_STATUS_KEY, String(row.subscription_status));
  }
  window.dispatchEvent(new CustomEvent("mysafeops-org-updated"));
}

function ensureMyOrgArgs() {
  const invite = peekPendingInvite();
  const args = {};
  if (invite?.token) args.p_invite_token = invite.token;
  return args;
}

/**
 * When localStorage has no real org slug yet (`default` / empty), sync from Supabase via `ensure_my_org`.
 * Use before cloud backup, R2 paths, or any feature that keys data by org slug.
 * @returns {Promise<string>} org slug (may still be `default` if not signed in / RPC fails)
 */
export async function syncOrgSlugIfNeeded(supabase) {
  if (!supabase) return getOrgId();
  const slug = getOrgId();
  if (slug && slug !== "default") {
    return slug;
  }
  try {
    const row = await refreshOrgFromSupabase(supabase);
    if (row?.org_slug) return row.org_slug;
  } catch {
    /* keep last known slug */
  }
  return getOrgId();
}

export async function refreshOrgFromSupabase(supabase) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("ensure_my_org", ensureMyOrgArgs());
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.org_slug) throw new Error("No organisation returned by ensure_my_org.");
  setOrgId(row.org_slug);
  persistOrgRow(row);
  return row;
}

export async function ensureUserOrgContext(supabase) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("ensure_my_org", ensureMyOrgArgs());
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.org_slug) throw new Error("No organisation returned by ensure_my_org.");

  setOrgId(row.org_slug);
  clearPendingInvite();
  persistOrgRow(row);
  pushAudit({ action: "org_context_sync", entity: "org", detail: row.org_slug });
  return row;
}

export function getTrialStatus(now = Date.now()) {
  const raw = localStorage.getItem("mysafeops_trial_ends_at");
  if (!raw) return null;
  const endsAt = new Date(raw).getTime();
  if (!Number.isFinite(endsAt)) return null;
  const remainingMs = endsAt - now;
  const remainingDays = Math.max(0, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
  return {
    endsAtIso: new Date(endsAt).toISOString(),
    isActive: remainingMs > 0,
    remainingDays,
  };
}

export function getBillingEntitlements() {
  const sub = localStorage.getItem(ORG_SUBSCRIPTION_STATUS_KEY) || "none";
  const paid = localStorage.getItem(ORG_BILLING_PLAN_KEY);
  const paidPlanId = paid && ["starter", "team", "business"].includes(paid) ? paid : null;
  return { subscriptionStatus: sub, paidPlanId };
}
