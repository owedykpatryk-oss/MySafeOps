# Security practices — MySafeOps

This document supports procurement and internal review. It is not a legal warranty.

## What ships with the static app

- **Public `/security` route**: customer-facing summary of transport, auth, secrets handling, optional Cloudflare D1/R2 components, subprocessors, and CI dependency scanning — complements this file for procurement questionnaires.
- **Vercel (`vercel.json`)**: HSTS, X-Frame-Options, `X-Permitted-Cross-Domain-Policies`, stricter `Permissions-Policy` (e.g. `payment`/`usb` off), CSP, `no-store` for `/api/*` responses, long-cache for `/assets/*`.
- **`public/_headers`**: same class of headers for static hosts that apply it (e.g. Cloudflare Pages) — keep in sync with Vercel where possible.
- **`public/.well-known/security.txt`**: contact for responsible disclosure. Update the `Canonical` line to your production URL.
- **Password UX**: sign-up and password reset flows require at least **12 characters** in the UI (Supabase remains the source of truth for final acceptance).
- **Turnstile (optional)**: when **`VITE_TURNSTILE_SITE_KEY`** is set, `/login` and Cloud account show Cloudflare Turnstile and send `captchaToken` to Supabase Auth. Configure the matching **secret** in Supabase Dashboard → Authentication → Bot and Abuse Protection (never in `VITE_*`).
- **Support contact**: `getSupportEmail()` reads **`VITE_SUPPORT_EMAIL`** (validated shape); default **`support@mysafeops.com`**. Invite emails from Edge Functions use secret **`SUPPORT_CONTACT_EMAIL`** (default `support@mysafeops.com`).
- **Platform owner**: **`VITE_PLATFORM_OWNER_EMAIL`** controls who sees the Owner dashboard in the app; database RPCs in `supabase/migrations/*superadmin*` must use the same allow-list after you migrate off the legacy address.
- **Optional error monitoring**: set **`VITE_SENTRY_DSN`** (browser DSN only) to load `@sentry/react` at startup; omit in environments where third-party reporting is not allowed. When set, `RouteErrorBoundary` also calls **`Sentry.captureException`** for lazy-route load failures.
- **CSP (enforced)**: canonical policy in `src/config/contentSecurityPolicy.js`; `npm run csp:sync` writes it to `vercel.json` and `public/_headers`. `npm run security:doctor` fails on drift. Browser calls to Overpass and postcodes.io go through same-origin `/api/*` proxies in production; `connect-src` omits those upstream hosts.
- **Platform owner (DB)**: superadmin RPCs use `public.platform_owner_email_allowlist` — add each owner email in Supabase SQL (in addition to **`VITE_PLATFORM_OWNER_EMAIL`** in the app).
- **Insider hardening (D1)**: `DELETE /v1/kv` requires admin or supervisor (`user_can_delete_org_kv`); `PUT /v1/kv` checks `user_can_write_org_kv` (operative cannot overwrite workers/projects/training/CDM/timesheets namespaces); audit append validates `action`/`entity` and rate-limits per user; cloud UI role refreshes from `get_my_membership_role` every focus / 5 min; workspace banner on D1 403 (`D1WriteForbiddenBanner`).
- **MFA gate**: accounts with TOTP enrolled must reach AAL2 before `/app` loads (`ProtectedAppRoute` + `mfaAal.js`) — not login-page only.
- **Platform owner UI**: `VITE_PLATFORM_OWNER_EMAIL` allowlist only (fail closed if unset). DB RPCs still use `platform_owner_email_allowlist`.
- **Invites**: `org_invites` SELECT is admin-only (migration `20260716150000_org_invites_select_admin_only`); accept/preview via security-definer RPCs.
- **Session revoke**: Edge Function `revoke-org-member-sessions` — admins sign out a member globally after role change or removal (`OrgMembers`).
- **Outbound webhooks**: PTW Slack/Teams/custom URLs are validated (`src/utils/webhookUrlValidation.js`) — HTTPS only, private IPs blocked before save or dispatch.
- **Edge CORS**: Supabase functions use `supabase/functions/_shared/corsHeaders.ts` (reflects `SITE_URL` / localhost dev — not `*`).
- **Client portal**: default cloud expiry 90 days; publish events go to audit log.
- **Diagnostics**: `npm run security:doctor` — migrations present, npm audit, deploy checklist.

## What you must configure outside the repo

- **TLS**: terminate HTTPS at your CDN (e.g. Cloudflare) with TLS 1.2+; enable **HSTS** at the edge (preload only after a deliberate process).
- **Secrets**: never commit `.env` / API keys. `VITE_*` variables are exposed to the browser by design — only **anon** Supabase keys belong there; service role keys must never appear in the front-end bundle.
- **Supabase**: set password policy, MFA, and rate limits in the Supabase Dashboard; review RLS on every table.
- **Stripe**: use Edge Functions or server routes only for the secret key; Hosted Checkout / Customer Portal as implemented.
- **CSP**: enforced policy is maintained in `src/config/contentSecurityPolicy.js` (sync with `npm run csp:sync`). A stricter nonce-based CSP at the CDN remains a future option when `connect-src` can shrink further.

## Reporting

Use the address in `security.txt`. Do not report through public GitHub issues if the finding is sensitive.

## Cyber Essentials (UK) — repository mapping

Process, evidence folders, and CAB questionnaire flow are described in **`DOCS/CYBER_ESSENTIALS_PLAN.md`**. That document is the single place for certification scope, policies outside the repo, and screenshot checklists.

## CI — automated supply-chain gate

GitHub Actions (`.github/workflows/ci.yml`) runs **`npm audit --audit-level=high`** on every push and pull request, then lint, unit tests, Playwright smoke (blog, landing, **public security.txt + `/security`**), and a production build. Keep the workflow green; treat `high` / `critical` advisories per your patch SLA.

## Backend operations (D1 + Workers)

Deployment secrets, remote D1 schema, Supabase RPCs for org isolation, and backup worker setup are summarised in **`DOCS/BACKEND_CONTINUATION_PLAN.md`** (section C checklist) and **`DOCS/SERVER_SOURCE_OF_TRUTH.md`**. The D1 API Worker attaches **`X-Request-Id`** to JSON responses (and `request_id` in `/v1/health`) for log correlation. The browser client (`src/lib/d1SyncClient.js`) copies that value into failed call results as **`request_id`** so support can match UI errors to Cloudflare Worker logs.
