# Security practices — MySafeOps

This document supports procurement and internal review. It is not a legal warranty.

## What ships with the static app

- **Vercel (`vercel.json`)**: HSTS, X-Frame-Options, `X-Permitted-Cross-Domain-Policies`, stricter `Permissions-Policy` (e.g. `payment`/`usb` off), CSP, `no-store` for `/api/*` responses, long-cache for `/assets/*`.
- **`public/_headers`**: same class of headers for static hosts that apply it (e.g. Cloudflare Pages) — keep in sync with Vercel where possible.
- **`public/.well-known/security.txt`**: contact for responsible disclosure. Update the `Canonical` line to your production URL.
- **Password UX**: sign-up and password reset flows require at least **12 characters** in the UI (Supabase remains the source of truth for final acceptance).
- **Support contact**: `getSupportEmail()` reads **`VITE_SUPPORT_EMAIL`** (validated shape); default **`support@mysafeops.com`**. Invite emails from Edge Functions use secret **`SUPPORT_CONTACT_EMAIL`** (default `support@mysafeops.com`).
- **Platform owner**: **`VITE_PLATFORM_OWNER_EMAIL`** controls who sees the Owner dashboard in the app; database RPCs in `supabase/migrations/*superadmin*` must use the same allow-list after you migrate off the legacy address.
- **Optional error monitoring**: set **`VITE_SENTRY_DSN`** (browser DSN only) to load `@sentry/react` at startup; omit in environments where third-party reporting is not allowed. When set, `RouteErrorBoundary` also calls **`Sentry.captureException`** for lazy-route load failures.
- **CSP (Report-Only)**: `public/_headers` includes `Content-Security-Policy-Report-Only` for visibility into violations; tune `connect-src` to your real API hosts, then consider promoting to an enforced policy at the CDN.
- **Platform owner (DB)**: superadmin RPCs use `public.platform_owner_email_allowlist` — add each owner email in Supabase SQL (in addition to **`VITE_PLATFORM_OWNER_EMAIL`** in the app).

## What you must configure outside the repo

- **TLS**: terminate HTTPS at your CDN (e.g. Cloudflare) with TLS 1.2+; enable **HSTS** at the edge (preload only after a deliberate process).
- **Secrets**: never commit `.env` / API keys. `VITE_*` variables are exposed to the browser by design — only **anon** Supabase keys belong there; service role keys must never appear in the front-end bundle.
- **Supabase**: set password policy, MFA, and rate limits in the Supabase Dashboard; review RLS on every table.
- **Stripe**: use Edge Functions or server routes only for the secret key; Hosted Checkout / Customer Portal as implemented.
- **CSP**: a strict Content-Security-Policy with nonces is not in `_headers` yet because the app loads third-party APIs (maps, weather, optional AI proxy). Add a nonce-based CSP at the CDN or reverse proxy when you narrow `connect-src` to known origins.

## Reporting

Use the address in `security.txt`. Do not report through public GitHub issues if the finding is sensitive.
