export function getEffectiveInviteStatus(invite, now = Date.now()) {
  const status = String(invite?.status || "");
  if (status !== "pending") return status;
  const expiresAt = new Date(invite?.expires_at || "").getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return "expired";
  return "pending";
}

/** Public invite pages: UK date, UTC calendar day (matches join-link SQL end-of-day). */
export function formatInviteExpiryEnGb(iso) {
  const ms = new Date(iso || "").getTime();
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleDateString("en-GB", {
    timeZone: "UTC",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
