/**
 * Canonical Content-Security-Policy for MySafeOps static hosting.
 * Sync to vercel.json and public/_headers via: npm run csp:sync
 *
 * Browser calls third-party hosts only when no same-origin proxy exists
 * (e.g. Nominatim geocode, Open-Meteo weather fallback). Overpass and
 * postcodes.io are proxied at /api/overpass and /api/postcode in production.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
  "manifest-src 'self'",
  "script-src 'self' https://js.stripe.com https://*.hcaptcha.com https://challenges.cloudflare.com https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "media-src 'self' data: blob:",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "frame-src 'self' https://js.stripe.com https://hooks.stripe.com https://m.stripe.network https://checkout.stripe.com https://*.hcaptcha.com https://challenges.cloudflare.com https://vercel.live",
  "frame-ancestors 'self'",
  [
    "connect-src 'self'",
    "https://*.supabase.co",
    "wss://*.supabase.co",
    "https://*.stripe.com",
    "https://api.open-meteo.com",
    "https://nominatim.openstreetmap.org",
    "https://api.qrserver.com",
    "https://quickchart.io",
    "https://*.tile.openstreetmap.org",
    "https://*.openstreetmap.org",
    "https://server.arcgisonline.com",
    "https://*.arcgisonline.com",
    "https://*.workers.dev",
    "https://www.google.com",
    "https://maps.googleapis.com",
    "https://*.hcaptcha.com",
    "https://challenges.cloudflare.com",
    "https://vercel.live",
    "https://*.ingest.sentry.io",
    "https://*.sentry.io",
  ].join(" "),
  "form-action 'self' https://*.supabase.co",
].join("; ");

/** Looser policy for Vite dev / Playwright (inline scripts, smaller connect-src). */
export const CONTENT_SECURITY_POLICY_DEV = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io",
].join("; ");
