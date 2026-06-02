import { isTurnstileEnabled } from "../config/turnstile";

/**
 * @param {string} token
 * @returns {string | null} User-facing error, or null if OK / captcha disabled
 */
export function requireCaptchaToken(token) {
  if (!isTurnstileEnabled()) return null;
  if (String(token || "").trim()) return null;
  return "Complete the security check before continuing.";
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
