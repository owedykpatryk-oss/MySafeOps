/**
 * Platform owner — Superadmin dashboard + unlimited client-side billing UX.
 * Set `VITE_PLATFORM_OWNER_EMAIL` to one address or comma-separated list (all treated as owners in the app).
 * Supabase: superadmin RPCs also require the JWT email to exist in `public.platform_owner_email_allowlist`
 * (see migration `20260422120000_platform_owner_email_allowlist.sql` — add rows in the SQL editor for each owner address).
 */
const LEGACY_OWNER = "mysafeops@gmail.com";

function ownerEmailSet() {
  const raw = (import.meta.env.VITE_PLATFORM_OWNER_EMAIL || "").trim();
  if (!raw) return new Set([LEGACY_OWNER.toLowerCase()]);
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(parts.length ? parts : [LEGACY_OWNER.toLowerCase()]);
}

export function isSuperAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  return ownerEmailSet().has(e);
}

/** @deprecated Prefer `isSuperAdminEmail`; kept for rare string comparisons. */
export const SUPERADMIN_EMAIL = LEGACY_OWNER;

/** Alias for billing bypass checks. */
export function isPlatformOwnerEmail(email) {
  return isSuperAdminEmail(email);
}
