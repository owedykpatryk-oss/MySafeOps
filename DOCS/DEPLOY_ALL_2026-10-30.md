# Release — 30 October 2026

The user requested further fixes followed by deployment of all pending changes. Application and Cloudflare releases are deployed. After the user restored Supabase CLI access, production migrations and function source were compared with the workspace: all relevant Supabase changes were already deployed. Cross-service release verification is complete.

## Additional fixes

- Copying a mission now resets weather-limit and corridor confirmations, retaining the entered planning values for review.
- Malformed stored take-off/landing coordinates show a review message instead of crashing the mission screen. Invalid take-off coordinates cannot be reused as a landing point.
- Updated the direct DOMPurify dependency and its override from 3.4.16 to 3.4.17. The npm production audit gate initially failed, then passed after this patch. Upstream advisory: https://github.com/cure53/DOMPurify/security/advisories/GHSA-cg2g-xh64-v4q7.
- The map browser-test startup assertion now waits up to 30 seconds for module readiness. The initial failure occurred on the Loading screen before any map action; the same desktop scenario passed after the bounded readiness fix. Other behavioral assertions are unchanged.

## Application release

- URL: https://www.mysafeops.com
- Project: `prj_kSJ9pCk5wCSEDvTgLaMVtUyLXUFN`; team: `team_xxXwWYf9fffoszZX1eVxVEL1`.
- Deployment: `dpl_62benSR6wCDTfgQTsRpXak222BqC` — https://mysafeops-6upwc0acp-patryks-projects-12c8ccbe.vercel.app.
- Source snapshot: `output/deploy-all-20261030`; 1,623 files with hashes in `output/deploy-all-source-manifest-20261030.json`. Includes all current application code and assets in src/public/api/shared/scripts plus build manifests. Local environment files, documents and QA output excluded.
- Source hashes rechecked against the workspace before promotion; no application differences after the snapshot. No commit or push was made.
- Built with production settings and `--skip-domain`, checked via protected deployment fetch, then promoted through the connected Vercel API. Alias status confirmed completed for both custom domains.
- Verified production `/app` and `/login` load `/assets/index-DI2lzt0l.js`. The first immediate post-promotion fetch still saw the previous asset during propagation; the final version check passed.
- Verified exact deployed `DroneOperations-DuhPelr_.js` contains mission reuse, weather auto-refresh and the invalid-coordinate review message; deployed DOMPurify reports 3.4.17.
- Previous production rollback candidate: `dpl_C6nryr9MMM8FiF2uT9pJosAJ3VHB`.

## Cloudflare releases

Verified account: `18efbdd5472a2d731ef6fe63b0df2c9b`. Used existing authenticated Wrangler 3.114.17 and `--keep-vars`; preserved secrets and resource bindings. Dry-run bundles passed before deployment. No customer records or databases were reset.

- D1 API: `mysafeops-d1-api`, new version `3c2205cd-f3ef-42aa-81e0-9ce0c6816cc9`; previous `91cbcc82-31aa-401f-a564-3f53697974a7`.
- R2 uploads: `mysafeops-r2-upload`, new version `dfb9b197-8a61-43e7-80ec-69219a8e7d21`; previous `318da6ea-5465-4244-ba87-90f20a0bc266`.
- D1 health returns 200. Requests for a valid scoped KV route without authorization return 403; a valid R2 object route without authorization returns 401.

## Verification

- Full source suite after dependency patch: 407 files, 2,304 tests passed (`output/deploy-all-unit-final-20261030.log`).
- Drone browser suite: 29 passed initially; one desktop startup timeout, then the corrected readiness test passed. All 30 distinct desktop/mobile scenarios covered, including AU helicopters, company manuals, map import, field mode, review/PDF and copy reset.
- Preparation and data-recovery browser scenarios passed: reuse isolation, DST, save-failure retry, forecast expiry, mobile layout, organisation/country drafts and recycle-bin recovery.
- Full ESLint: zero errors, 127 existing warnings within the configured limit. Changed follow-up files: no lint findings.
- Hooks JSX and survey-document guards passed. Production npm audit gate and security doctor passed after the DOMPurify update; npm still reports four moderate dependency advisories.
- Vercel production build and circular-chunk check passed. Existing large-chunk advisory remains.
- Public smoke checks: seven passed before and after deployment (health, postcode, weather by coordinates/postcode, Turnstile setup, security headers). Production desktop/mobile visits reach sign-in without runtime errors; no authenticated customer operation was performed.
- New weather API rejects unauthenticated POST with 401. Provider credentials were not changed.

## Supabase access restored and release verified

Target: `burgpzankkqvpcmdkhro`. Connected app tools require an unavailable connection identifier. The existing CLI account lists other projects and `supabase migration list --linked` returns 403 insufficient privileges. The user was asked to log the CLI into an account with MySafeOps access; no token was requested in chat.

After the user's browser login, the CLI confirmed access to the linked MySafeOps project. All 68 migration versions match between local and remote; there are no pending migrations (`output/deploy-supabase-migrations-restored.log`).

Downloaded the three affected production functions into isolated local snapshots, preserving workspace sources. Compared the entrypoints and all downloaded shared TypeScript dependencies with local files, normalising only CRLF/LF: no differences. Versions: `stripe-checkout` 58 (8 files), `stripe-portal` 56 (8 files), `stripe-webhook` 50 (7 files). All are ACTIVE and retain their existing `verify_jwt=false` configuration; application-level JWT/signature checks remain in place. Comparison evidence: `output/supabase-release-20261030/comparison.json`.

No Supabase redeployment or migration execution was necessary. Checkout and portal health endpoints return 200 with active test mode ready. Unauthenticated checkout/portal POSTs are rejected; unsigned webhook POST is rejected before event processing. No payments, customer records, secrets or billing-mode settings were changed.
