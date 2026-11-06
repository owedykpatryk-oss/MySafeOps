# MySafeOps — Cloud Agent instructions

UK construction H&S SaaS (RAMS, permits, surveys, Supabase).

## When fixing from mobile, Slack, webhook, or CI automation

1. Read `.cursor/rules/cloud-mobile-ops.mdc`.
2. Smallest correct diff; run targeted `npx vitest run` on touched tests.
3. Branch: `fix/ci-*`, `fix/mobile-*`, `fix/sentry-*`, `fix/health-*`, `fix/billing-*`.
4. Open PR with 3-bullet test plan. Never commit `.env` or secrets.
5. Do not force-push `main`. Do not commit unless the prompt explicitly asks.

Cloud automations (API + GitHub Actions): `.cursor/automations/README.md`.

## Key paths

- Permits: `src/modules/permits/` (incl. `permitGuidance/`)
- Survey: `src/modules/surveyReport/`, `src/utils/surveyContentCatalog.js`
- RAMS: `src/modules/rams/`
- Edge functions: `supabase/functions/`
- CI: `.github/workflows/ci.yml`

## Mobile / Slack ticket format

```
Problem: <one line>
Where: <module or URL>
Acceptance: <done looks like>
```

## Cursor Cloud specific instructions

React + Vite SPA (Node 22, npm). Startup runs `npm install` (see the VM update script). The app is offline-first: workspace data lives in browser `localStorage` (org-scoped via `src/utils/orgStorage.js`); Supabase is only for auth + optional cloud backup.

Standard commands (defined in `package.json`):
- Dev server: `npm run dev` → http://localhost:5173 (Vite auto-restarts on `.env.local` changes).
- Lint: `npm run lint` (0 errors expected; warnings are fine). Tests: `npm test` (vitest). Build: `npm run build` (its `prebuild` runs blog/sitemap generators — network-free).
- E2E: `npm run test:e2e` needs browsers first: `npx playwright install chromium` (the marketing specs run their own dev server with Turnstile disabled).

Non-obvious gotchas (these are the important ones):
- `src/lib/supabase.js` ships **baked-in fallback Supabase credentials** for the production project, so `isSupabaseConfigured()` is `true` even with no env vars. That means `/app` is gated behind sign-in, and the marketing routes (`/`, `/blog`, `/login`, `/status`, `/security`, `/docs`, legal pages) are the only ones reachable without auth.
- The production Supabase project has **server-side Turnstile captcha**, so signing in/up against it from localhost fails (`captcha_failed`). Do **not** try to log in against the bundled prod project locally.
- To exercise the workspace (`/app`: permits, RAMS, surveys) locally, run a **local Supabase** and point the app at it. Docker is NOT preinstalled on the VM, so this is a manual, per-session step:
  1. Install Docker (Docker 29 needs `/etc/docker/daemon.json` with `"storage-driver":"fuse-overlayfs"` and `"features":{"containerd-snapshotter":false}`), start `sudo dockerd`, then `sudo chmod 666 /var/run/docker.sock`.
  2. `npx supabase start` (applies `supabase/migrations`; `npx supabase status -o env` prints the local `ANON_KEY`/`SERVICE_ROLE_KEY`; API at http://127.0.0.1:54321, Studio 54323, Inbucket/Mailpit email UI 54324).
  3. Create a gitignored `.env.local` with `VITE_SUPABASE_URL=http://127.0.0.1:54321`, `VITE_SUPABASE_ANON_KEY=<local anon>`, and `VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA`. That Cloudflare **test** site key pairs with the test captcha secret in `supabase/config.toml`, so the login widget always passes locally.
  4. Local auth has email confirmation enabled, so create a confirmed user via the admin API (`POST /auth/v1/admin/users` with the service_role key and `{"email_confirm":true}`), or confirm via the Inbucket UI, then sign in.
- Permits list defaults to the **"Active" status filter**, which only shows permits whose status is `active` AND whose end date/time is in the future. Newly saved records default to `draft` — switch the Status dropdown to "Draft" to see them. Fully "issuing" a Hot Work permit requires signatures + all mandatory checklist/evidence items; use "Save as draft" (on the final Review step) for a quick create.
- Against local Supabase you may see console 403 / "permission denied" for `ensure_my_org` and `org_permit_audit`; these cloud-audit calls are fire-and-forget and do **not** block the (localStorage) record save.
