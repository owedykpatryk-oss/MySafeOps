/**
 * Canonical Content-Security-Policy for MySafeOps static hosting.
 * Sync to vercel.json and public/_headers via: npm run csp:sync
 *
 * Browser calls third-party hosts only when no same-origin proxy exists
 * (e.g. Nominatim geocode, Open-Meteo weather fallback). Overpass and
 * postcodes.io are proxied at /api/overpass and /api/postcode in production.
 *
 * Worker hosts are pinned to named mysafeops Workers (not a wildcard workers.dev allowlist).
 * If you deploy Workers under a different Cloudflare account subdomain, update connect-src and re-run csp:sync.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
  "manifest-src 'self'",
  "script-src 'self' https://js.stripe.com https://*.hcaptcha.com https://challenges.cloudflare.com https://vercel.live",
  "style-src 'self' 'unsafe-inline'",
  [
    "img-src 'self' data: blob:",
    "https://*.supabase.co",
    "https://*.r2.dev",
    "https://*.cloudflarestorage.com",
    // Signed R2 preview URLs from the upload Worker (GET /signed) — pin host, not *.workers.dev
    "https://mysafeops-r2-upload.owedykpatryk.workers.dev",
    "https://*.tile.openstreetmap.org",
    "https://*.openstreetmap.org",
    "https://server.arcgisonline.com",
    "https://*.arcgisonline.com",
    "https://maps.google.com",
    "https://maps.gstatic.com",
    "https://*.googleapis.com",
    "https://api.qrserver.com",
    "https://quickchart.io",
    "https://*.stripe.com",
    "https://*.hcaptcha.com",
    "https://challenges.cloudflare.com",
  ].join(" "),
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
    "https://mysafeops-d1-api.owedykpatryk.workers.dev",
    "https://mysafeops-r2-upload.owedykpatryk.workers.dev",
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
  "img-src 'self' data: blob: https://*.supabase.co https://*.tile.openstreetmap.org https://*.openstreetmap.org",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.ingest.sentry.io http://127.0.0.1:* http://localhost:*",
].join("; ");
