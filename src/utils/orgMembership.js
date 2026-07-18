import { pushAudit } from "./auditLog";
import { syncOrgMarketFromAuth } from "./orgMarket";
import { getOrgId, setOrgId } from "./orgId";
import {
  ORG_BILLING_PLAN_KEY,
  ORG_SUBSCRIPTION_STATUS_KEY,
  ORG_TRIAL_ENDS_AT_KEY,
  ORG_TRIAL_EXTENSION_COUNT_KEY,
  getBillingEntitlements,
  getTrialExtensionCount,
  getTrialStatus,
  isTrialUnlockActive,
  removeScopedBilling,
  writeScopedBilling,
} from "./billingState";

const MEMBERSHIP_ROLES = new Set(["admin", "supervisor", "operative"]);
import { clearPendingInvite, peekPendingInvite } from "../lib/inviteToken";

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
    const { loadOrgSettingsRaw, saveOrgSettingsRaw } = await import("./orgSettingsStorage");
    const local = loadOrgSettingsRaw(row.org_slug);
    const localName = String(local?.name || "").trim();
    const cloudOrgName = String(row.org_name || "").trim();
    if (cloudOrgName && (!localName || localName === "My Organisation")) {
      saveOrgSettingsRaw({ ...local, name: cloudOrgName }, row.org_slug);
    }
  } catch {
    /* non-fatal */
  }
  try {
    const { syncOrgBrandingFromCloud } = await import("./orgBrandingCloudSync");
    await syncOrgBrandingFromCloud(supabase, row.org_slug);
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
    ensureFessBranding(row.org_slug, { force: forceFess });
    ensureFessWorkspaceFocus(row.org_slug, { force: forceFess });
  } catch {
    /* non-fatal */
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
    const { loadOrgSettingsRaw, saveOrgSettingsRaw } = await import("./orgSettingsStorage");
    const local = loadOrgSettingsRaw(row.org_slug);
    const localName = String(local?.name || "").trim();
    const cloudOrgName = String(row.org_name || "").trim();
    // Fresh org with empty / default local branding: seed display name from ensure_my_org,
    // never leave the door open for stale cross-org localStorage branding.
    if (cloudOrgName && (!localName || localName === "My Organisation")) {
      saveOrgSettingsRaw({ ...local, name: cloudOrgName }, row.org_slug);
    }
  } catch {
    /* non-fatal */
  }
  try {
    const { syncOrgBrandingFromCloud } = await import("./orgBrandingCloudSync");
    await syncOrgBrandingFromCloud(supabase, row.org_slug);
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
    ensureFessBranding(row.org_slug, { force: forceFess });
    ensureFessWorkspaceFocus(row.org_slug, { force: forceFess });
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
