import { pushAudit } from "./auditLog";
import { syncOrgMarketFromAuth } from "./orgMarket";
import { getOrgId, setOrgId } from "./orgId";
import {
  ORG_BILLING_PLAN_KEY,
  ORG_CANCEL_AT_PERIOD_END_KEY,
  ORG_CURRENT_PERIOD_END_KEY,
  ORG_PAST_DUE_SINCE_KEY,
  ORG_STRIPE_TRIAL_END_KEY,
  ORG_SUBSCRIPTION_STATUS_KEY,
  ORG_TRIAL_ENDS_AT_KEY,
  ORG_TRIAL_EXTENSION_COUNT_KEY,
  getBillingEntitlements,
  getTrialExtensionCount,
  getTrialStatus,
  isTrialUnlockActive,
  readScopedBilling,
  removeScopedBilling,
  writeScopedBilling,
} from "./billingState";

const MEMBERSHIP_ROLES = new Set(["admin", "supervisor", "operative"]);
import { clearPendingInvite, peekPendingInvite } from "../lib/inviteToken";
import { getCachedActiveCountryWorkspace } from "./countryWorkspaces";

let orgContextClient = null;
let orgContextPromise = null;
let orgContextUserId = null;

export function persistOrgRow(row, { billingScope = "organization" } = {}) {
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
  const activeCountry = getCachedActiveCountryWorkspace(slug);
  // Once a country is selected, its server-mode entitlement is authoritative,
  // including for the primary country. Legacy org fields describe live billing only.
  const shouldPersistBilling =
    billingScope === "workspace" || !activeCountry?.id;
  if (!shouldPersistBilling) {
    window.dispatchEvent(new CustomEvent("mysafeops-org-updated"));
    return;
  }
  if (row.billing_plan != null && row.billing_plan !== "") {
    writeScopedBilling(ORG_BILLING_PLAN_KEY, row.billing_plan, slug);
  } else {
    removeScopedBilling(ORG_BILLING_PLAN_KEY, slug);
  }
  if (row.subscription_status) {
    writeScopedBilling(ORG_SUBSCRIPTION_STATUS_KEY, row.subscription_status, slug);
  }
  if (row.subscription_status === "past_due") {
    const since =
      row.subscription_past_due_since ||
      readScopedBilling(ORG_PAST_DUE_SINCE_KEY, slug) ||
      new Date().toISOString();
    writeScopedBilling(ORG_PAST_DUE_SINCE_KEY, since, slug);
  } else {
    removeScopedBilling(ORG_PAST_DUE_SINCE_KEY, slug);
  }
  if (row.stripe_current_period_end) {
    writeScopedBilling(ORG_CURRENT_PERIOD_END_KEY, row.stripe_current_period_end, slug);
  } else {
    removeScopedBilling(ORG_CURRENT_PERIOD_END_KEY, slug);
  }
  if (row.stripe_cancel_at_period_end != null && row.stripe_cancel_at_period_end !== "") {
    writeScopedBilling(ORG_CANCEL_AT_PERIOD_END_KEY, row.stripe_cancel_at_period_end ? "true" : "false", slug);
  } else {
    removeScopedBilling(ORG_CANCEL_AT_PERIOD_END_KEY, slug);
  }
  if (row.stripe_trial_end) {
    writeScopedBilling(ORG_STRIPE_TRIAL_END_KEY, row.stripe_trial_end, slug);
  } else {
    removeScopedBilling(ORG_STRIPE_TRIAL_END_KEY, slug);
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
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  const expectedUserId = sessionData?.session?.user?.id;
  if (sessionError || !expectedUserId) throw new Error("session_changed");
  const { data, error } = await supabase.rpc("ensure_my_org", ensureMyOrgArgs());
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.org_slug) throw new Error("No organisation returned by ensure_my_org.");
  await assertCurrentOrgContextUser(supabase, expectedUserId);
  setOrgId(row.org_slug);

  // Enrich with Stripe renewal / past_due metadata (not yet on ensure_my_org return set).
  try {
    const { data: orgMeta } = await supabase
      .from("organizations")
      .select(
        "stripe_current_period_end, stripe_cancel_at_period_end, stripe_trial_end, subscription_past_due_since, billing_plan, subscription_status"
      )
      .eq("slug", row.org_slug)
      .limit(1)
      .maybeSingle();
    if (orgMeta) {
      Object.assign(row, orgMeta);
    }
  } catch {
    /* non-fatal — columns may not exist until migration applied */
  }

  await assertCurrentOrgContextUser(supabase, expectedUserId);
  persistOrgRow(row);
  try {
    const { loadOrgSettingsRaw, saveOrgSettingsRaw } = await import("./orgSettingsStorage");
    const local = loadOrgSettingsRaw(row.org_slug);
    const localName = String(local?.name || "").trim();
    const cloudOrgName = String(row.org_name || "").trim();
    if (cloudOrgName && (!localName || localName === "My Organisation")) {
      await assertCurrentOrgContextUser(supabase, expectedUserId);
      saveOrgSettingsRaw({ ...local, name: cloudOrgName }, row.org_slug);
    }
  } catch {
    /* non-fatal */
  }
  try {
    const { syncOrgBrandingFromCloud } = await import("./orgBrandingCloudSync");
    await assertCurrentOrgContextUser(supabase, expectedUserId);
    await syncOrgBrandingFromCloud(supabase, row.org_slug, {
      assertCurrent: () => assertCurrentOrgContextUser(supabase, expectedUserId),
    });
  } catch {
    /* non-fatal — local branding still works */
  }
  try {
    const { ensureUtilityMappingBranding } = await import("./utilityMappingBranding");
    let force = false;
    try {
      const { data: authData } = await supabase.auth.getUser();
      force = String(authData?.user?.email || "")
        .trim()
        .toLowerCase()
        .endsWith("@u-map.co.uk");
    } catch {
      /* ignore */
    }
    await assertCurrentOrgContextUser(supabase, expectedUserId);
    ensureUtilityMappingBranding(row.org_slug, { force });
  } catch {
    /* non-fatal */
  }
  try {
    const { ensureFessBranding } = await import("./fessBranding");
    const { ensureFessWorkspaceFocus } = await import("./ensureFessWorkspaceFocus");
    let forceFess = false;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const email = String(authData?.user?.email || "")
        .trim()
        .toLowerCase();
      forceFess = email.endsWith("@fessgroup.co.uk");
    } catch {
      /* ignore */
    }
    await assertCurrentOrgContextUser(supabase, expectedUserId);
    ensureFessBranding(row.org_slug, { force: forceFess });
    ensureFessWorkspaceFocus(row.org_slug, { force: forceFess });
  } catch {
    /* non-fatal */
  }
  try {
    await syncOrgMarketFromAuth(supabase, {
      assertCurrent: () => assertCurrentOrgContextUser(supabase, expectedUserId),
    });
  } catch {
    /* non-fatal */
  }
  await assertCurrentOrgContextUser(supabase, expectedUserId);
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

export function ensureUserOrgContext(supabase, userId) {
  if (!supabase) return Promise.resolve(null);
  const expectedUserId = String(userId || "").trim();
  if (!expectedUserId) return Promise.reject(new Error("missing_user_id"));
  if (orgContextPromise && orgContextClient === supabase && orgContextUserId === expectedUserId) return orgContextPromise;

  const sharedPromise = ensureUserOrgContextOnce(supabase, expectedUserId).finally(() => {
    if (orgContextPromise === sharedPromise) {
      orgContextPromise = null;
      orgContextClient = null;
      orgContextUserId = null;
    }
  });
  orgContextClient = supabase;
  orgContextUserId = expectedUserId;
  orgContextPromise = sharedPromise;
  return sharedPromise;
}

async function assertCurrentOrgContextUser(supabase, expectedUserId) {
  const { data, error } = await supabase.auth.getSession();
  if (error || data?.session?.user?.id !== expectedUserId) throw new Error("session_changed");
}

async function ensureUserOrgContextOnce(supabase, expectedUserId) {
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("ensure_my_org", ensureMyOrgArgs());
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.org_slug) throw new Error("No organisation returned by ensure_my_org.");

  // The RPC can outlive sign-out. Never apply an old user's org or consume an
  // invite after a different account has become the active Supabase session.
  await assertCurrentOrgContextUser(supabase, expectedUserId);
  setOrgId(row.org_slug);
  clearPendingInvite();
  persistOrgRow(row);
  try {
    const { loadOrgSettingsRaw, saveOrgSettingsRaw } = await import("./orgSettingsStorage");
    const local = loadOrgSettingsRaw(row.org_slug);
    const localName = String(local?.name || "").trim();
    const cloudOrgName = String(row.org_name || "").trim();
    // Fresh org with empty / default local branding: seed display name from ensure_my_org,
    // never leave the door open for stale cross-org localStorage branding.
    if (cloudOrgName && (!localName || localName === "My Organisation")) {
      await assertCurrentOrgContextUser(supabase, expectedUserId);
      saveOrgSettingsRaw({ ...local, name: cloudOrgName }, row.org_slug);
    }
  } catch {
    /* non-fatal */
  }
  try {
    const { syncOrgBrandingFromCloud } = await import("./orgBrandingCloudSync");
    await assertCurrentOrgContextUser(supabase, expectedUserId);
    await syncOrgBrandingFromCloud(supabase, row.org_slug, {
      assertCurrent: () => assertCurrentOrgContextUser(supabase, expectedUserId),
    });
  } catch {
    /* non-fatal */
  }
  try {
    const { ensureUtilityMappingBranding } = await import("./utilityMappingBranding");
    let force = false;
    try {
      const { data: authData } = await supabase.auth.getUser();
      force = String(authData?.user?.email || "")
        .trim()
        .toLowerCase()
        .endsWith("@u-map.co.uk");
    } catch {
      /* ignore */
    }
    await assertCurrentOrgContextUser(supabase, expectedUserId);
    ensureUtilityMappingBranding(row.org_slug, { force });
  } catch {
    /* non-fatal */
  }
  try {
    const { ensureFessBranding } = await import("./fessBranding");
    const { ensureFessWorkspaceFocus } = await import("./ensureFessWorkspaceFocus");
    let forceFess = false;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const email = String(authData?.user?.email || "")
        .trim()
        .toLowerCase();
      forceFess = email.endsWith("@fessgroup.co.uk");
    } catch {
      /* ignore */
    }
    await assertCurrentOrgContextUser(supabase, expectedUserId);
    ensureFessBranding(row.org_slug, { force: forceFess });
    ensureFessWorkspaceFocus(row.org_slug, { force: forceFess });
  } catch {
    /* non-fatal */
  }
  try {
    await syncOrgMarketFromAuth(supabase, {
      assertCurrent: () => assertCurrentOrgContextUser(supabase, expectedUserId),
    });
  } catch {
    /* non-fatal */
  }
  await assertCurrentOrgContextUser(supabase, expectedUserId);
  pushAudit({ action: "org_context_sync", entity: "org", detail: row.org_slug });
  return row;
}

export async function extendOrgTrial(supabase) {
  if (!supabase) throw new Error("Cloud sign-in required to extend trial.");
  const slug = getOrgId();
  const { data, error } = await supabase.rpc("extend_org_trial", { p_org_slug: slug });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (row?.trial_ends_at) {
    writeScopedBilling(ORG_TRIAL_ENDS_AT_KEY, row.trial_ends_at, slug);
  }
  if (row?.trial_extension_count != null) {
    writeScopedBilling(ORG_TRIAL_EXTENSION_COUNT_KEY, row.trial_extension_count, slug);
  }
  window.dispatchEvent(new CustomEvent("mysafeops-org-updated"));
  return row;
}

export {
  ORG_BILLING_PLAN_KEY,
  ORG_SUBSCRIPTION_STATUS_KEY,
  ORG_TRIAL_ENDS_AT_KEY,
  ORG_TRIAL_EXTENSION_COUNT_KEY,
  getBillingEntitlements,
  getTrialExtensionCount,
  getTrialStatus,
  isTrialUnlockActive,
};
