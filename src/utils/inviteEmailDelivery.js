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
  if (/domain is not verified|add and verify your domain on https:\/\/resend\.com\/domains/i.test(msg)) {
    return "mysafeops.com is not verified in Resend yet. Add the domain at resend.com/domains, paste the DNS records into GoDaddy, wait until status is Verified, then Retry. Until then share the invite link manually.";
  }
  if (/only send testing emails|verify a domain at resend\.com\/domains/i.test(msg)) {
    return "Resend is still in test mode. Verify mysafeops.com at resend.com/domains, then set INVITE_FROM_EMAIL to MySafeOps <support@mysafeops.com> and retry. Until then you can only email your Resend account address, or share the invite link manually.";
  }
  if (/<!DOCTYPE\s+html/i.test(msg) || /cf-error-details|Error code 5\d{2}|cloudflare/i.test(msg)) {
    const code = msg.match(/Error code\s+(5\d{2})/i)?.[1] || msg.match(/\b(520|521|522|523|524)\b/)?.[1] || "5xx";
    return `Resend API is temporarily unavailable (Cloudflare ${code}). Wait a minute and use Retry skipped emails, or share the invite link manually. Status: https://resend-status.com`;
  }
  // Avoid dumping long provider HTML/JSON blobs into the settings UI.
  if (msg.length > 280) {
    return `${msg.slice(0, 277)}…`;
  }
  return msg;
}
