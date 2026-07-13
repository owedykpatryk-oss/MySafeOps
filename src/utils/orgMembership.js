import { pushAudit } from "./auditLog";
import { syncOrgBrandingFromCloud } from "./orgBrandingCloudSync";
import { syncOrgMarketFromAuth } from "./orgMarket";
import { getOrgId, setOrgId } from "./orgStorage";

const MEMBERSHIP_ROLES = new Set(["admin", "supervisor", "operative"]);
import { clearPendingInvite, peekPendingInvite } from "../lib/inviteToken";

export const ORG_TRIAL_ENDS_AT_KEY = "mysafeops_trial_ends_at";
export const ORG_BILLING_PLAN_KEY = "mysafeops_billing_plan";
export const ORG_SUBSCRIPTION_STATUS_KEY = "mysafeops_subscription_status";
export const ORG_TRIAL_EXTENSION_COUNT_KEY = "mysafeops_trial_extension_count";

// Billing/trial state is scoped per org slug (like `mysafeops_role_${slug}`) so a shared
// device (e.g. a site tablet) switching between organisations can't show one org's trial
// countdown, plan, or read-only gate using another org's cached billing state. The
// unscoped legacy key is kept as a read fallback so upgrades don't lose current state.
function scopedBillingKey(baseKey, slug = getOrgId()) {
  return slug && slug !== "default" ? `${baseKey}_${slug}` : baseKey;
}

function readScopedBilling(baseKey, slug = getOrgId()) {
  try {
    const scoped = localStorage.getItem(scopedBillingKey(baseKey, slug));
    if (scoped != null) return scoped;
    return localStorage.getItem(baseKey);
  } catch {
    return null;
  }
}

function writeScopedBilling(baseKey, value, slug = getOrgId()) {
  try {
    localStorage.setItem(scopedBillingKey(baseKey, slug), String(value));
  } catch {
    /* ignore */
  }
}

function removeScopedBilling(baseKey, slug = getOrgId()) {
  try {
    localStorage.removeItem(scopedBillingKey(baseKey, slug));
  } catch {
    /* ignore */
  }
}

export function persistOrgRow(row) {
  const slug = getOrgId();
  const r = String(row?.role || "").trim().toLowerCase();
  if (slug && MEMBERSHIP_ROLES.has(r)) {
    try {
      localStorage.setItem(`mysafeops_role_${slug}`, r);
    } catch {
      /* ignore */
    }
  }
  if (row.trial_ends_at) {
    writeScopedBilling(ORG_TRIAL_ENDS_AT_KEY, row.trial_ends_at, slug);
  }
  if (row.trial_extension_count != null && row.trial_extension_count !== "") {
    writeScopedBilling(ORG_TRIAL_EXTENSION_COUNT_KEY, row.trial_extension_count, slug);
  }
  if (row.billing_plan != null && row.billing_plan !== "") {
    writeScopedBilling(ORG_BILLING_PLAN_KEY, row.billing_plan, slug);
  } else {
    removeScopedBilling(ORG_BILLING_PLAN_KEY, slug);
  }
  if (row.subscription_status) {
    writeScopedBilling(ORG_SUBSCRIPTION_STATUS_KEY, row.subscription_status, slug);
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
  try {
    await syncOrgBrandingFromCloud(supabase, row.org_slug);
  } catch {
    /* non-fatal — local branding still works */
  }
  try {
    await syncOrgMarketFromAuth(supabase);
  } catch {
    /* non-fatal */
  }
  return row;
}

/**
 * Lightweight role refresh from Postgres (no org auto-create). Defeats localStorage role tampering.
 * @returns {Promise<string | null>} role slug or null
 */
export async function refreshMembershipRoleFromSupabase(supabase) {
  if (!supabase) return null;
  const slug = getOrgId();
  if (!slug || slug === "default") return null;
  const { data, error } = await supabase.rpc("get_my_membership_role", { p_org_slug: slug });
  if (error) throw error;
  const r = String(data || "").trim().toLowerCase();
  if (!MEMBERSHIP_ROLES.has(r)) return null;
  try {
    localStorage.setItem(`mysafeops_role_${slug}`, r);
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent("mysafeops-org-updated"));
  return r;
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
  try {
    await syncOrgBrandingFromCloud(supabase, row.org_slug);
  } catch {
    /* non-fatal */
  }
  try {
    await syncOrgMarketFromAuth(supabase);
  } catch {
    /* non-fatal */
  }
  pushAudit({ action: "org_context_sync", entity: "org", detail: row.org_slug });
  return row;
}

export function getTrialExtensionCount() {
  const raw = readScopedBilling(ORG_TRIAL_EXTENSION_COUNT_KEY);
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

export async function extendOrgTrial(supabase) {
  if (!supabase) throw new Error("Cloud sign-in required to extend trial.");
  const { data, error } = await supabase.rpc("extend_org_trial");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.trial_ends_at) {
    writeScopedBilling(ORG_TRIAL_ENDS_AT_KEY, row.trial_ends_at);
  }
  if (row?.trial_extension_count != null) {
    writeScopedBilling(ORG_TRIAL_EXTENSION_COUNT_KEY, row.trial_extension_count);
  }
  window.dispatchEvent(new CustomEvent("mysafeops-org-updated"));
  return row;
}

export function getTrialStatus(now = Date.now()) {
  const raw = readScopedBilling(ORG_TRIAL_ENDS_AT_KEY);
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

/** Active 14-day org trial — unlocks all modules and premium feature flags in the UI. */
export function isTrialUnlockActive(now = Date.now()) {
  return Boolean(getTrialStatus(now)?.isActive);
}

export function getBillingEntitlements() {
  const sub = readScopedBilling(ORG_SUBSCRIPTION_STATUS_KEY) || "none";
  const paid = readScopedBilling(ORG_BILLING_PLAN_KEY);
  const paidPlanId =
    paid && ["starter", "team", "business", "enterprise", "enterprise_plus"].includes(paid) ? paid : null;
  return { subscriptionStatus: sub, paidPlanId };
}
