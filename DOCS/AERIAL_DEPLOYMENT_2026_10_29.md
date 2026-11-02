# Production deployment — 29 October 2026

User explicitly requested `deploy` after completion of the field-mode iteration, superseding the previous no-deployment scope. No commit or push performed.

Application: https://www.mysafeops.com

- Vercel project: `prj_kSJ9pCk5wCSEDvTgLaMVtUyLXUFN`, team `team_xxXwWYf9fffoszZX1eVxVEL1`.
- New release: `dpl_C6nryr9MMM8FiF2uT9pJosAJ3VHB`, `https://mysafeops-6ejot67hc-patryks-projects-12c8ccbe.vercel.app`.
- Built from a local application-source snapshot (`output/deploy-aerial-20261029-155030`), using production environment configuration. Included current application code in src/public/api/shared/scripts and build manifests; excluded local environment files, workspace documents and QA output. This is a local-source deployment, not a Git commit deployment.
- Built with `--prod --skip-domain`, checked the protected release, then promoted using Vercel's connected API.
- Previous production rollback candidate: `dpl_68ToT55s8LWqYph6K8bApsUucdPU`.

Cloudflare D1 API:

- Worker: `mysafeops-d1-api`, account `18efbdd5472a2d731ef6fe63b0df2c9b`.
- New version: `91cbcc82-31aa-401f-a564-3f53697974a7`.
- Previous version: `4a0fd2e9-24ba-4011-a41e-951f25250bcf`.
- Existing binding/database and compatibility date verified; deployed using the repository's Wrangler 3 version with `--keep-vars`. Secret values preserved. No database migrations or record writes performed.
- Connected Cloudflare plugin targets another account; used the existing authenticated CLI for the verified MySafeOps account.

Verification:

- Full source suite: 384 files / 2181 tests passed (`output/deploy-source-unit.log`).
- Critical module and D1 server tests: 118 passed (`output/deploy-critical-tests.log`; navigation tests were in the preceding 119-test suite).
- Vercel deployment READY; exact deployed DroneOperations asset contains Field mode, Start site session and Alternate landing.
- Before/after production smoke: all 7 checks passed (`output/deploy-before-smoke.log`, `output/deploy-after-smoke.log`): health, postcode, weather by coordinates/postcode, login Turnstile configuration, security headers on root/login.
- D1 health HTTP 200; unauthenticated D1 access rejected HTTP 403; new weather endpoint rejects unauthenticated requests HTTP 401.
- Read-only desktop/mobile production browser checks reach the sign-in page without JavaScript errors (`output/deploy-browser-smoke.json`). No authenticated customer workflow or real flight was performed in production.
