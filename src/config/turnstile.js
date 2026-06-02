/**
 * Cloudflare Turnstile (public site key only — secret stays in Supabase Auth settings).
 * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

/** Always passes — use for local dev with matching secret in Supabase / supabase/config.toml */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

export function isTurnstileEnabled() {
  return Boolean(TURNSTILE_SITE_KEY);
}
