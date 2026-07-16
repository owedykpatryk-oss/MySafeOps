/**
 * Platform owner — Superadmin dashboard + unlimited client-side billing UX.
 * Set `VITE_PLATFORM_OWNER_EMAIL` to one address or comma-separated list.
 * Fail closed: with no env allowlist, nobody is treated as platform owner in the UI.
 * Supabase superadmin RPCs also require `public.platform_owner_email_allowlist`.
 */
function ownerEmailSet() {
  const raw = (import.meta.env.VITE_PLATFORM_OWNER_EMAIL || "").trim();
  if (!raw) return new Set();
  const parts = raw
    .split(/[,;\s]+/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(parts);
}

export function isSuperAdminEmail(email) {
  const e = String(email || "").trim().toLowerCase();
  if (!e) return false;
  return ownerEmailSet().has(e);
}

/** First configured owner email, or empty string when unset. */
export const SUPERADMIN_EMAIL = [...ownerEmailSet()][0] || "";

/** Alias for billing bypass checks. */
export function isPlatformOwnerEmail(email) {
  return isSuperAdminEmail(email);
}
