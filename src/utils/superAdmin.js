/** Single platform owner — Superadmin / owner dashboard and unlimited client-side plan limits. */
export const SUPERADMIN_EMAIL = "mysafeops@gmail.com";

export function isSuperAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === SUPERADMIN_EMAIL;
}

/** Alias for readability at call sites (billing bypass, etc.). */
export function isPlatformOwnerEmail(email) {
  return isSuperAdminEmail(email);
}

