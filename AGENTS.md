# MySafeOps — Cloud Agent instructions

UK construction H&S SaaS (RAMS, permits, surveys, Supabase).

## When fixing from mobile, Slack, webhook, or CI automation

1. Read `.cursor/rules/cloud-mobile-ops.mdc`.
2. Smallest correct diff; run targeted `npx vitest run` on touched tests.
3. Branch: `fix/ci-*`, `fix/mobile-*`, `fix/sentry-*`, `fix/slack-*`.
4. Open PR with 3-bullet test plan. Never commit `.env` or secrets.
5. Do not force-push `main`. Do not commit unless the prompt explicitly asks.

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
