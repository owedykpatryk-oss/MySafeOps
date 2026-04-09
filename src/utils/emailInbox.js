/**
 * Best-effort inbox deep links for popular providers.
 * Falls back to generic mailto when provider is unknown.
 */
export function getInboxUrl(email) {
  const v = String(email || "").trim().toLowerCase();
  const domain = v.split("@")[1] || "";
  if (domain === "gmail.com" || domain === "googlemail.com") return "https://mail.google.com/";
  if (domain === "outlook.com" || domain === "hotmail.com" || domain === "live.com" || domain === "msn.com") {
    return "https://outlook.live.com/mail/";
  }
  if (domain === "yahoo.com" || domain === "yahoo.co.uk") return "https://mail.yahoo.com/";
  if (domain === "icloud.com" || domain === "me.com" || domain === "mac.com") return "https://www.icloud.com/mail/";
  if (domain === "proton.me" || domain === "protonmail.com") return "https://mail.proton.me/";
  if (domain) return `https://${domain}`;
  return "mailto:";
}
