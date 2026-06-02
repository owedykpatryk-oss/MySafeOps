/** Common disposable / throwaway domains — blocks automated sign-ups only (not exhaustive). */
const BLOCKED_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "guerrillamail.net",
  "sharklasers.com",
  "grr.la",
  "10minutemail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwaway.email",
  "yopmail.com",
  "trashmail.com",
  "getnada.com",
  "maildrop.cc",
  "dispostable.com",
  "fakeinbox.com",
  "mintemail.com",
]);

/**
 * @param {string} email
 * @returns {boolean}
 */
export function isDisposableSignupEmail(email) {
  const at = String(email || "").trim().toLowerCase().lastIndexOf("@");
  if (at < 1) return false;
  const domain = email.slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  if (BLOCKED_DOMAINS.has(domain)) return true;
  return [...BLOCKED_DOMAINS].some((d) => domain.endsWith(`.${d}`));
}
