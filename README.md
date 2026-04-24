# MySafeOps

UK-oriented construction safety and compliance workspace. **React + Vite** SPA: modules live under `src/modules/`, with **English UI** and **GB** defaults.

## Project layout

**Canonical application code lives under [`src/`](src/)** — roughly: **`modules/`** feature screens, **`components/`** shared UI, **`layout/`** app shell, **`navigation/`** route ids + lazy view map (`workspaceViews.js`) + More-menu sections, **`utils/`** storage/backup/search helpers, **`pages/`** marketing & login, **`offline/`** & **`context/`** as named.
The [`DOCS/`](DOCS/) folder is documentation, architecture notes, and may contain **historical or mirror files** — it is **not** the runtime source of truth; edit the matching files in `src/` when changing behaviour.

## Quick start

```bash
npm install
npm run dev
```

**Code quality:** `npm run lint` (ESLint 9 + React; runs in CI). Prettier is configured (`.prettierrc.json`); `npm run format:check` / `npm run format` are available — a full-repo format may touch many files, so treat it as an optional cleanup pass.

Open the URL Vite prints (usually `http://localhost:5173`). You should see the **landing page** first; use **Sign in** or **Get started** to reach **/login**, then open the **workspace** at **/app** (dashboard and modules).

| Route | Purpose |
|-------|---------|
| `/` | Landing / marketing |
| `/blog` | Blog index (guides from `src/blog/posts/*.md`) |
| `/blog/:slug` | Single guide |
| `/login` | Sign in / sign up (when Supabase is configured) |
| `/reset-password` | Set a new password from Supabase recovery link |
| `/accept-invite` | Public landing for an org invite (then continue to sign-in) |
| `/app` | Main app (bottom navigation, modules) — protected when `VITE_SUPABASE_*` is set |

Public client/subcontractor links still use query strings: `?portal=TOKEN`, `?subcontractor=TOKEN`.

For **Cloudflare Pages** (and similar static hosts), copy [public/_redirects](public/_redirects) into the publish root so client-side routes resolve.

```bash
npm run build    # production bundle → dist/
npm run preview  # serve dist locally
```

A minimal **web app manifest** is at [public/manifest.webmanifest](public/manifest.webmanifest) (linked from `index.html`) so browsers can offer “Add to Home Screen”. Replace `/vite.svg` with proper **192×192 / 512×512** icons when you have branded assets.

**Offline:** [public/service-worker.js](public/service-worker.js) precaches the app shell for Vite (`/`, `index.html`, `manifest.webmanifest`, etc.) and uses [public/offline.html](public/offline.html) as a fallback when navigation fails. Bump `SW_VERSION` in the worker after meaningful cache changes.

## Configuration

Copy [.env.local.example](.env.local.example) to **`.env.local`** in the project root and fill in any optional values. Never commit `.env.local`. After editing, run **`npm run env:check`** for a read-only checklist (no secret values printed). For **Vercel → Environment Variables** (co skopiować, Production vs Preview, Supabase redirect URLs), use **[DOCS/VERCEL_ENV_CHECKLIST.md](DOCS/VERCEL_ENV_CHECKLIST.md)**.

| Area | Purpose |
|------|---------|
| `VITE_SUPABASE_*` | Optional sign-in and JSON cloud backup (`app_sync` table) |
| `VITE_VAPID_PUBLIC_KEY` | Web Push in the browser; pair with Supabase Edge secrets `VAPID_*` |
| `VITE_ANTHROPIC_*` | Optional AI features (RAMS, toolbox, photo hazard) |
| `VITE_STORAGE_*` / `VITE_R2_PUBLIC_BASE_URL` | Optional document uploads via Cloudflare R2 Worker |
| `VITE_OPENWEATHER_API_KEY` | Optional override for RAMS weather (otherwise Open-Meteo) |
| `VITE_BLOG_POSTS_BASE_URL` / `VITE_PUBLIC_SITE_URL` | Optional canonical blog base and site origin for links, RSS, and Open Graph |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Optional Stripe **publishable** key if you add Stripe.js in the browser (never put secret keys in `VITE_*`) |

**Vercel Preview:** set `VITE_PUBLIC_SITE_URL` (and optionally `VITE_BLOG_POSTS_BASE_URL`) to your **preview** hostname so generated Open Graph / RSS URLs match the deployment you are testing.

**Blog analytics (optional):** [`src/utils/analytics.js`](src/utils/analytics.js) emits `blog_index_view` and `blog_article_view` to `window.gtag` (GA4) and/or `window.plausible` when those globals exist. Load your tag manager or Plausible snippet in `index.html` (or behind consent).

### Security: `VITE_*` variables

Anything prefixed with `VITE_` is **embedded in the browser bundle**. Do not put production secrets there. The example file warns that **Anthropic API keys in `VITE_` are visible to anyone who loads the app**; use only for local/dev or proxy AI calls through your own backend in production.

## Optional: Supabase (auth + backup)

1. Create a project at [Supabase](https://supabase.com/dashboard).
2. Enable **Email** (or other) auth under Authentication → Providers.
3. For Google OAuth, configure Google provider in Supabase with a Google Cloud **Client ID** and **Client Secret**.
   - Keep these server-side only (`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`) — never `VITE_*`.
4. Run SQL migrations on your project:
   - **Dashboard**: SQL Editor → paste and run [supabase/migrations/20260407120000_app_sync.sql](supabase/migrations/20260407120000_app_sync.sql), or  
   - **CLI**: `supabase db push` (if the project is linked).
   - Also apply [supabase/migrations/20260408193000_org_membership_trial.sql](supabase/migrations/20260408193000_org_membership_trial.sql) for org isolation + automatic 14-day trial.
   - Also apply [supabase/migrations/20260408203000_org_invites.sql](supabase/migrations/20260408203000_org_invites.sql) and [supabase/migrations/20260408214500_invite_token_acceptance.sql](supabase/migrations/20260408214500_invite_token_acceptance.sql) for invite links and token-safe org joining.
   - Apply [supabase/migrations/20260408220000_org_members_and_invite_preview.sql](supabase/migrations/20260408220000_org_members_and_invite_preview.sql) for member management RPCs and public invite preview (`/accept-invite`).
   - Apply [supabase/migrations/20260409140000_stripe_billing.sql](supabase/migrations/20260409140000_stripe_billing.sql) for Stripe customer/subscription columns on `organizations` and billing fields returned by `ensure_my_org`.
5. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env.local`.

**Optional: automatic invite email (Edge Function)**  
Deploy `send-org-invite` from [`supabase/functions/send-org-invite/`](supabase/functions/send-org-invite/) (`supabase functions deploy send-org-invite`). Set secrets: `RESEND_API_KEY`, `SITE_URL` (your production origin, no trailing slash), optionally `INVITE_FROM_EMAIL` (e.g. `MySafeOps <notifications@yourdomain.com>`), and optionally `SUPPORT_CONTACT_EMAIL` (shown in invite footer; default `support@mysafeops.com`). Without `RESEND_API_KEY`, the function returns success with `skipped: true` and invites still work via the copied link.

**Optional: Stripe subscriptions (Edge Functions)**  
1. **Products & prices:** either run `npm run stripe:seed-prices` (requires `STRIPE_SECRET_KEY` in `.env.local`; creates GBP monthly Solo £29 / Team £79 / Business £149 / Enterprise £399 and prints `STRIPE_PRICE_*` ids), or create four recurring prices manually in the [Stripe Dashboard](https://dashboard.stripe.com/).  
2. Deploy functions: `stripe-checkout`, `stripe-portal`, `stripe-webhook` from [`supabase/functions/`](supabase/functions/) (`supabase functions deploy stripe-checkout`, etc.).  
3. Set **Supabase secrets** (Dashboard → Edge Functions → Secrets, or `supabase secrets set`):  
   - `STRIPE_SECRET_KEY` — secret API key (`sk_...`)  
   - `STRIPE_WEBHOOK_SECRET` — signing secret from the webhook endpoint (`whsec_...`)  
   - `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_ENTERPRISE` — the four Price ids (internal plan ids remain `starter` / `team` / `business` / `enterprise`)  
   - `SITE_URL` — public app origin with no trailing slash (e.g. `https://your-domain.com`; local dev: `http://localhost:5173`)  
4. In Stripe → Developers → Webhooks, add endpoint: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook` and select events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Paste the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.  
5. Enable the [Stripe Customer Portal](https://dashboard.stripe.com/settings/billing/portal) for your account so **Manage billing** works.  
6. Run `npm run billing:doctor` to verify the Edge functions are deployed and configured from your current project URL (`VITE_SUPABASE_URL`).
7. If webhook failures are pending, run `npm run stripe:retry-webhooks` to replay failed events from Stripe using `event_id`.
Secrets stay on Supabase; nothing Stripe-sensitive is put in `VITE_*` env vars. After checkout, users return to `/app?checkout=success&settingsTab=billing` and the app refreshes entitlements from `ensure_my_org`.

### Billing smoke CI (optional but recommended)

- Workflow file: `.github/workflows/billing-smoke.yml`
- To enable pipeline checks, set repository secrets:
  - `E2E_SUPABASE_URL`
  - `E2E_SUPABASE_ANON_KEY`
  - `E2E_BASE_URL` (deployed app URL)
  - `E2E_BILLING_EMAIL`
  - `E2E_BILLING_PASSWORD`
- The workflow runs:
  - `npm run billing:doctor` (function deploy/config health gate),
  - `npm run test:e2e:billing` (browser smoke path for Billing page).

Cloud upload/restore is available from **Backup** after sign-in (see [src/utils/cloudSync.js](src/utils/cloudSync.js)).

## Auth readiness checklist

Use this before production go-live:

- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set for Production on the host.
- [ ] Supabase Auth providers configured (Email + Google if used).
- [ ] Supabase Redirect URLs include:
  - [ ] `https://<your-domain>/login`
  - [ ] `https://<your-domain>/accept-invite`
  - [ ] `https://<your-domain>/reset-password`
  - [ ] `https://<your-domain>/app`
- [ ] Google OAuth credentials configured server-side:
  - [ ] `GOOGLE_OAUTH_CLIENT_ID`
  - [ ] `GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] Confirmation email and reset email templates tested end-to-end.
- [ ] Login lockout UX verified (5 failed attempts => temporary lockout).
- [ ] First login auto-creates user organisation and starts 14-day trial.
- [ ] Each user is mapped to one organisation (`org_memberships`), and organisation data remains isolated.
- [ ] Admin can invite teammates from Settings → Invite users.
- [ ] Invite links use `/accept-invite?invite=...` (then sign-in) and are accepted only for the invited email.
- [ ] Optional Sentry: set `VITE_SENTRY_DSN` (browser DSN) to load `@sentry/react` at startup.
- [ ] Support contact: set `VITE_SUPPORT_EMAIL` on the host (default in app: `support@mysafeops.com`).
- [ ] Platform owner: `VITE_PLATFORM_OWNER_EMAIL` matches Supabase superadmin RPC allow-list (see `supabase/migrations/*superadmin*`).

## Billing transparency & limits

MySafeOps exposes **Billing & limits** in Settings with:

- current effective plan (Trial, Starter after trial, or **paid** Starter / Team / Business when Stripe reports an active subscription),
- clear plan matrix (price + workers + projects + cloud backup limit),
- live usage for the active organisation,
- cloud backup limit enforcement during upload,
- **Subscribe** buttons (organisation admins only) that start **Stripe Checkout** via Edge Functions when configured.

Default effective plans:

- **Trial**: £0 for 14 days (auto-created on first sign-in per organisation).
- **Starter**: default after trial if there is no active Stripe subscription.
- **Paid**: Team / Business limits apply when the organisation row has `subscription_status` active/trialing and a matching `billing_plan` from the webhook.

### Auth E2E tests (Playwright)

```bash
npm run test:e2e
```

Optional env vars for full auth coverage:

- `E2E_BASE_URL` (if testing deployed app instead of local dev server)
- `E2E_EXISTING_UNCONFIRMED_EMAIL`
- `E2E_RESET_EMAIL`
- `E2E_LOCKOUT_EMAIL`
- `E2E_LOCKOUT_WRONG_PASSWORD`
- `E2E_RUN_EXTERNAL_AUTH=1` (Google redirect test)

## Optional: R2 document uploads

Deploy the Worker under `cloudflare/workers/r2-upload` and set `VITE_STORAGE_API_URL` and `VITE_STORAGE_UPLOAD_TOKEN` as described in `.env.local.example`. More context: [DOCS/architecture-current.md](DOCS/architecture-current.md) and [DOCS/cloudflare-setup.md](DOCS/cloudflare-setup.md) (R2 / Pages sections).

## Documentation map

| Document | Use |
|----------|-----|
| [DOCS/architecture-current.md](DOCS/architecture-current.md) | How the app stores data today (localStorage + optional cloud) |
| [DOCS/PRODUCT_SCOPE.md](DOCS/PRODUCT_SCOPE.md) | Prototype vs current app feature gaps |
| [DOCS/brand-guide.md](DOCS/brand-guide.md) | Brand colours and voice |
| [DOCS/CURSOR_PROMPT.md](DOCS/CURSOR_PROMPT.md) | Product/technical context for contributors and AI assistants |
| [DOCS/FILE-INDEX.md](DOCS/FILE-INDEX.md), [DOCS/CURSOR-AI-GUIDE.md](DOCS/CURSOR-AI-GUIDE.md) | **Historical** prototype package notes (see banners in those files) |

In-app **Help** lists all modules available from the navigation.

## Licence

Private project (`"private": true` in [package.json](package.json)).
