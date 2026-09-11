/**
 * Platform owner — Superadmin dashboard + unlimited client-side billing UX.
 *
 * Owner identity lives only in `public.platform_owner_email_allowlist` (server).
 * Call `user_is_platform_owner` via {@link refreshPlatformOwnerFromSupabase}; do not
 * embed emails in the Vite bundle (`VITE_PLATFORM_OWNER_EMAIL` is ignored).
 */
import { isSupabaseConfigured, supabase } from "../lib/supabase";
import { getOrgId } from "./orgId";
import { ORG_TRIAL_ENDS_AT_KEY, writeScopedBilling } from "./billingState";

export const SUPERADMIN_EXTEND_TRIAL_DAYS = 14;

let platformOwnerFlag = false;

/** Last known server result — fail closed until RPC succeeds. */
export function isPlatformOwnerCached() {
  return platformOwnerFlag === true;
}

export function setPlatformOwnerCached(value) {
  platformOwnerFlag = value === true;
}

/**
 * Probe Supabase allowlist. Returns false when offline / unconfigured / error.
 * @param {import("@supabase/supabase-js").SupabaseClient | null} [client]
 */
export async function refreshPlatformOwnerFromSupabase(client = supabase) {
  if (!isSupabaseConfigured() || !client) {
    platformOwnerFlag = false;
    return false;
  }
  try {
    const { data, error } = await client.rpc("user_is_platform_owner");
    if (error) {
      platformOwnerFlag = false;
      return false;
    }
    platformOwnerFlag = data === true || data === "true";
    return platformOwnerFlag;
  } catch {
    platformOwnerFlag = false;
    return false;
  }
}

/**
 * Sync UI gate — uses server-cached flag only (never compares emails client-side).
 * Prefer `useApp().isPlatformOwner` when inside AppProvider.
 * @param {string} [_email] Ignored; kept for call-site compatibility.
 */
export function isSuperAdminEmail(_email) {
  return isPlatformOwnerCached();
}

/** @deprecated No longer expose an owner address in the client bundle. */
export const SUPERADMIN_EMAIL = "";

/** Alias for billing bypass checks. */
export function isPlatformOwnerEmail(_email) {
  return isPlatformOwnerCached();
}

function unwrapRpcRow(data) {
  if (Array.isArray(data)) return data[0] || null;
  return data || null;
}

/**
 * Platform-owner courtesy trial: set org trial_ends_at to now + days (server).
 * Does not consume the org's one-time self-serve trial_extension_count.
 * @param {import("@supabase/supabase-js").SupabaseClient | null} client
 * @param {string} orgSlug
 * @param {number} [days]
 */
export async function superadminExtendOrgTrial(client, orgSlug, days = SUPERADMIN_EXTEND_TRIAL_DAYS) {
  if (!client) throw new Error("Cloud sign-in required to extend trial.");
  const slug = String(orgSlug || "").trim();
  if (!slug) throw new Error("Organisation slug is required.");
  const pDays = Number(days);
  const { data, error } = await client.rpc("superadmin_extend_org_trial", {
    p_org_slug: slug,
    p_days: Number.isFinite(pDays) ? pDays : SUPERADMIN_EXTEND_TRIAL_DAYS,
  });
  if (error) throw error;
  const row = unwrapRpcRow(data);
  if (!row || row.ok === false) {
    const reason = String(row?.error || "forbidden");
    if (reason === "organisation_not_found") throw new Error("Organisation not found.");
    if (reason === "missing_slug") throw new Error("Organisation slug is required.");
    throw new Error(reason === "forbidden" ? "Forbidden (sign in as platform owner)." : reason);
  }
  if (row.trial_ends_at) {
    const current = String(getOrgId() || "")
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    const extended = String(row.org_slug || slug)
      .trim()
      .toLowerCase()
      .replace(/_/g, "-");
    if (current && current === extended) {
      writeScopedBilling(ORG_TRIAL_ENDS_AT_KEY, row.trial_ends_at, getOrgId());
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("mysafeops-org-updated"));
      }
    }
  }
  return row;
}
