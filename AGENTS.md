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

Vite + React 19 SPA, npm, Node 22. Standard commands live in `README.md` and `package.json` scripts — use those (`npm run dev`, `npm run lint`, `npm test`, `npm run build`).

- **Dev server:** `npm run dev` serves on port 5173 and includes built-in Vite middleware that emulates the `/api/*` endpoints (`/api/health`, `/api/weather`, `/api/postcode`, `/api/overpass`). No separate API/backend process is needed for local dev.
- **`/app` is auth-gated against a shared remote Supabase.** `src/lib/supabase.js` hardcodes a fallback remote Supabase URL/anon key, so out of the box `isSupabaseConfigured()` is true and `/app` redirects to `/login`. That shared project has **server-side Turnstile bot protection enabled**, so you cannot sign up or log in against it locally (you'll get "Security check failed or expired"). Do not treat this as a bug.
- **To test `/app` core modules (RAMS / permits / surveys) locally without auth**, run in the app's built-in localStorage-only mode: create a gitignored `.env.local` with quoted-whitespace Supabase values so the fallback is overridden and trims to empty:
  ```
  VITE_SUPABASE_URL=" "
  VITE_SUPABASE_ANON_KEY=" "
  ```
  Then `isSupabaseConfigured()` is false, `/app` loads without login, and records persist to browser localStorage. This is config only — never edit `src/lib/supabase.js`. Restart `npm run dev` after changing `.env.local`.
- **To test real auth / cloud sync / billing**, point `VITE_SUPABASE_*` at your own Supabase (or run the local stack via `supabase start` — needs Docker + the Supabase CLI, neither preinstalled) and use the Turnstile test key (`VITE_TURNSTILE_SITE_KEY=1x00000000000000000000AA`, which pairs with the test secret already in `supabase/config.toml`).
- **Tests:** unit tests (`npm test`, Vitest) and marketing E2E (`npm run test:e2e:blog|landing|security`, Playwright — needs `npx playwright install chromium`) run with zero config. `npm run lint` passes with 0 errors (warnings only).
