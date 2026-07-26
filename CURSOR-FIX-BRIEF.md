# MySafeOps — Cursor fix brief

Repo: `E:\MySafeOps` · Branch: `fix/audit-p0-p2-findings`

---

## Round 5c — remaining audit gaps (this pass)

1. **Print / PDF alerts** — call sites use `openPrintWindowOrWarn` / `notifyAppToast` (no duplicate `window.alert` after form pack).
2. **Stripe webhook contract** — pure helpers in `supabase/functions/_shared/stripeWebhookMapping.ts` + Vitest `src/utils/stripeWebhookMapping.test.js`.
3. **CI auth e2e** — credential-free `tests/e2e/auth.spec.js` (next= sanitization + reset-password page) runs with blog/landing/security; secret-gated tests self-skip.
4. **Document versioning** — immutable `versionHistory` snapshot on permit approve; RAMS snapshot when entering approved/issued (or content change while locked).
5. **Owner email docs** — removed stale `VITE_PLATFORM_OWNER_EMAIL` from `env-doctor` / README (RPC-only).
6. **Hooks JSX guard** — `check-hooks-no-jsx.mjs` recurses `src/hooks/**` (incl. `blog/`).

**Deploy still needed:** D1 worker redeploy (billing gate); Edge `schedule-org-deletion` + daily `run_maintenance` cron; optional `VITE_SENTRY_DSN` on Vercel.

### Still polish (not blocking)
Dark mode, CSS split, site-map clustering, skeletons, onboarding wizard polish, foreman phone mode, full visual PDF/geo/offline device testing.

---

## Round 5b — smoke coverage + print toast

1. **Print popup blocked** — `openPrintWindowOrWarn` dispatches in-app toast (`mysafeops-ops-toast`), no `window.alert`.
2. **Module smoke renders** — `src/modules/moduleSmokeRender.test.jsx` mounts every workspace view (heavy map/PDF views = import-only). Catches `liveItems`-class ReferenceErrors.
3. **CI guard** — `npm run check:hooks-jsx` fails if JSX lands in `src/hooks/**/*.js` (Vite white-screen class).
4. **verify:blog** — market-aware voice already green (0 warnings).

---

## Round 5 — compliance

1. **Idle logout** — `IdleSessionGuard` on `/app`: 30 min default / 15 min admin + 60s warning.
2. **GDPR org deletion** — migration + Edge `schedule-org-deletion` (30-day grace, cancel RPC) + Cloud account UI (admin).
3. **Retention** — local audit 7y purge + recycle on boot; `purge_expired_client_portal_shares` + `purge_orgs_past_deletion_grace` (service-role / cron via `action=run_maintenance`).
4. **D1 billing UX** — `billing_write_blocked` treated as forbidden with subscribe copy.
5. **SECURITY.md** — idle, deletion, retention, HSTS on Vercel, `audit:ci`, platform-owner RPC (no VITE email).

---

## Round 4 (done)

Sitemap/registers/lint regressions; D1 server paywall; storage polling → events; owner email via RPC.

---

## Round 3–1 (done)

See git history / prior brief sections. Apply Stripe + billing-gate + org-deletion migrations; redeploy Stripe + D1/R2 workers + `schedule-org-deletion`.
