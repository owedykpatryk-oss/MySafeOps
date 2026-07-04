/**
 * Cloudflare Turnstile (public site key only — secret stays in Supabase Auth settings).
 * @see https://developers.cloudflare.com/turnstile/troubleshooting/testing/
 */
export const TURNSTILE_SITE_KEY = String(import.meta.env.VITE_TURNSTILE_SITE_KEY || "").trim();

/** Always passes — use for local dev with matching secret in Supabase / supabase/config.toml */
export const TURNSTILE_TEST_SITE_KEY = "1x00000000000000000000AA";

export function isTurnstileEnabled() {
  if (!TURNSTILE_SITE_KEY) return false;
  // Cloudflare test keys only work on localhost — skip on preview/production to avoid 404 + blocked login.
  if (typeof window !== "undefined" && isTurnstileTestKey() && isTurnstileTestKeyOnProductionHost()) {
    return false;
  }
  return true;
}

export function isTurnstileTestKey() {
  return TURNSTILE_SITE_KEY === TURNSTILE_TEST_SITE_KEY;
}

/** Test keys are for localhost only — production needs a real Cloudflare widget key. */
export function isTurnstileTestKeyOnProductionHost() {
  if (typeof window === "undefined" || !isTurnstileTestKey()) return false;
  return !isLocalDevHost();
}

export function isLocalDevHost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".local");
}
