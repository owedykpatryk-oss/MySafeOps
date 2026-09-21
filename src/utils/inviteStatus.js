export function getEffectiveInviteStatus(invite, now = Date.now()) {
  const status = String(invite?.status || "");
  if (status !== "pending") return status;
  const expiresAt = new Date(invite?.expires_at || "").getTime();
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return "expired";
  return "pending";
}
