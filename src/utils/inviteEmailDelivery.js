/**
 * Human-readable invite email delivery errors for admins.
 * @param {unknown} raw
 * @returns {string}
 */
export function formatInviteEmailDeliveryDetail(raw) {
  const msg = String(raw || "").trim();
  if (!msg) return "";
  if (/RESEND_API_KEY\s+not\s+set/i.test(msg)) {
    return "Invite email is not configured yet. Set RESEND_API_KEY (and preferably INVITE_FROM_EMAIL) in Supabase → Edge Functions → Secrets, then use Retry skipped emails. Until then, share the invite link manually.";
  }
  return msg;
}
