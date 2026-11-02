# Utility Mapping access follow-up — 30 October 2026

User request: fix reported errors, continue improvements, and extend Utility Mapping access through the end of 2026.

## Production access

Confirmed the exact Utility Mapping organisation, its sole enabled UK primary workspace, and its administrator membership. Updated only the organisation evaluation deadline, from 26 October 2026 to 1 January 2027 00:00 UTC (exclusive). Preserved roles, subscription state and extension count. No payment or subscription was created.

Verified as the existing administrator with transaction-local authenticated claims: membership true, platform owner false, cloud/manual/project write gates all true. This is database verification, not an authenticated browser test. Evidence is in `output/utility-mapping-access-{before,extension,after}.json`.

## Bounded implementation plan

1. Reproduce the primary country card ignoring the organisation evaluation deadline; expose that deadline only for primary country rows. Show active evaluation and its exact expiry; show unavailable billing separately from absent billing.
2. Reproduce a stale expired evaluation after an administrator extension. Reuse the existing country switcher's focus refresh to persist the newly fetched primary deadline, preserving secondary-country isolation and existing stale-response guards.
3. Run targeted billing, country and cloud regression tests, lint, production build, and one fresh final code review.

Shared interface: `loadCountryWorkspaces` returns `evaluation_trial_ends_at` only for the primary country. The billing card displays it; the existing switcher refresh persists it into the current organisation's trial cache. A non-primary country must never inherit this grant. A failed entitlement read must not imply subscription absence or grant evaluation fallback.

Review focus: secondary-country isolation, expired/invalid deadlines, non-none subscription states, unavailable billing, stale organisation responses, and ensuring UI-only changes cannot bypass server authorization.

No commit or application deployment requested for this follow-up. Existing unrelated working-tree changes are preserved.

## Progress

- Production access extension: complete; verified server write gates.
- Task 1 complete: primary evaluation status and UTC expiry displayed; billing-unavailable status cannot be mistaken for missing subscription. The server trial deadline is loaded only onto primary country rows.
- Task 2 complete: existing country refresh now picks up extensions and cleared deadlines, while secondary countries cannot overwrite or inherit the organisation trial.
- Regression evidence: 5 intended failures before implementation (`output/access-followup-red.log`), all 19 focused tests passed after (`output/access-followup-green.log`). Broader related suite: 13 files / 82 tests passed (`output/access-followup-regression.log`). Scoped ESLint and diff whitespace check passed.
- Public read-only health checks: app and API returned HTTP 200. No claim of authenticated browser end-to-end verification.
- Task 3 complete: scoped lint passed, production build exited 0 (existing large-chunk advisory), final read-only review found no Critical or Important issues. Build evidence: `output/access-followup-build.log`.
- Final: minor (deferred): add deferred-promise tests for old-organisation and overlapping focus responses in `CountryWorkspaceSwitcher.trial.test.jsx`. Existing revision and organisation guards were inspected and appear correct; these specific races have no new automated regression test.
- Final: Ruling: pre-existing unrelated working-tree changes excluded from this bounded review — preserve them and do not claim they were revalidated by this follow-up; cost if wrong is an unrelated regression remaining undetected.
- Final: Ruling: authenticated browser behavior after deployment is unverified — database role checks, component tests, lint, build and public health checks are the available evidence; no deployment or customer browser session was performed. Cost is that browser/session-specific behavior remains unverified until deployed and checked.
- Follow-up completed without commits or application deployment. The production database access extension is already effective; source improvements remain local.
