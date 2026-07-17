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
  if (/only send testing emails|verify a domain at resend\.com\/domains/i.test(msg)) {
    return "Resend is still in test mode. Verify mysafeops.com at resend.com/domains, then set INVITE_FROM_EMAIL to MySafeOps <support@mysafeops.com> and retry. Until then you can only email your Resend account address, or share the invite link manually.";
  }
  return msg;
}
