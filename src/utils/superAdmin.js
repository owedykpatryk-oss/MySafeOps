/**
 * Platform owner — Superadmin dashboard + unlimited client-side billing UX.
 *
 * Owner identity lives only in `public.platform_owner_email_allowlist` (server).
 * Call `user_is_platform_owner` via {@link refreshPlatformOwnerFromSupabase}; do not
 * embed emails in the Vite bundle (`VITE_PLATFORM_OWNER_EMAIL` is ignored).
 */
import { isSupabaseConfigured, supabase } from "../lib/supabase";

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
