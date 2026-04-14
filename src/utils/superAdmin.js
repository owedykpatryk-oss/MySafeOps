export const SUPERADMIN_EMAIL = "mysafeops@gmail.com";

export function isSuperAdminEmail(email) {
  return String(email || "").trim().toLowerCase() === SUPERADMIN_EMAIL;
}

