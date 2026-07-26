import { isTurnstileEnabled } from "../config/turnstile";

/** Shown when Turnstile is configured but the widget failed to load (ad blocker, firewall, bad host). */
export const CAPTCHA_LOAD_FAILED_MSG =
  "Security check could not load. Disable ad blockers for this site or refresh the page.";

const CAPTCHA_REQUIRED_MSG = "Complete the security check before continuing.";

/**
 * Fail-closed gate: missing site key → skip; configured but unavailable → block; else require token.
 * @param {{ configured: boolean; unavailable?: boolean; token?: string }} state
 * @returns {string | null} User-facing error, or null if OK
 */
export function validateAuthCaptchaState({ configured, unavailable = false, token = "" }) {
  if (!configured) return null;
  if (unavailable) return CAPTCHA_LOAD_FAILED_MSG;
  if (String(token || "").trim()) return null;
  return CAPTCHA_REQUIRED_MSG;
}

/** True when auth actions must wait for a live Turnstile token. */
export function captchaBlocksAuthSubmit({ configured, unavailable = false, token = "" }) {
  return Boolean(configured && (unavailable || !String(token || "").trim()));
}

/**
 * Supabase / Cloudflare infrastructure failures — not credential failures.
 * Must not count toward browser lockout.
 * @param {unknown} error
 */
export function isAuthCaptchaInfrastructureError(error) {
  const m = String(
    (error && typeof error === "object" && "message" in error ? error.message : error) || ""
  ).toLowerCase();
  if (!m) return false;
  return (
    m.includes("captcha") ||
    m.includes("turnstile") ||
    m.includes("captcha_token") ||
    (m.includes("request disallowed") && (m.includes("captcha") || m.includes("token")))
  );
}

/**
 * @param {string} token
 * @returns {string | null} User-facing error, or null if OK / captcha disabled
 */
export function requireCaptchaToken(token) {
  return validateAuthCaptchaState({
    configured: isTurnstileEnabled(),
    unavailable: false,
    token,
  });
}

/**
 * @param {Record<string, unknown>} [baseOptions]
 * @param {string} [token]
 */
export function withCaptchaOptions(baseOptions = {}, token) {
  const t = String(token || "").trim();
  if (!t) return baseOptions;
  return { ...baseOptions, captchaToken: t };
}
