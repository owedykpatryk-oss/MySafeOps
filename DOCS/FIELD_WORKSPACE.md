# Site workspace

The field entry point is `/app?view=field-home`, available from the workspace shortcut and More → Site operations. It reuses existing registers and permissions. It does not introduce AI or duplicate project records.

## Implemented flow

- Choose a site from the active organisation/country's synced project register.
- Today, Site, Add and Documents organise the most common actions into touch-sized cards.
- Survey, GPR and photo capture receive the selected project through the existing navigation targets.
- Site opens the existing project profile and project drawings.
- RAMS, permits, briefings and emergency contacts open existing workspace registers; these cards explicitly do not claim to filter by the selected site.
- Drone opens the existing mission register and field workspace flow; select the mission/site there.
- Missing project details use the existing deterministic completeness checks.
- Site selection survives returning to the page in the same browser session and is scoped by account, organisation and country. Deleted/missing projects cannot be used for new reports.
- Existing module visibility, country restrictions and server authorisation remain in effect.

## Connectivity and limits

The connectivity badge reports browser connectivity only. The project register uses the existing D1 synchronisation banner. Individual report editors remain responsible for save/recovery/upload status. This change does not claim a new whole-application offline guarantee or implement native Android/iOS applications.

## Verification

`npx playwright test --config playwright.mobile.config.js tests/e2e/field-workspace.spec.js --project=desktop --project=android`

Coverage includes responsive layout, project handoff to Survey, site profile navigation, reload, hidden modules, offline messaging, and organisation/country isolation including changes in another browser tab.

Verified 2026-11-02: all 18 browser scenarios passed across desktop Chromium, Android emulation and iPhone WebKit emulation. All 17 targeted unit tests passed. Production build passed. Targeted ESLint found no errors (one pre-existing `registerStatsTick` dependency warning in MainAppLayout). The first cold-server browser attempt timed out before scenarios started; the later complete run passed. An initial country-test expectation was corrected to require UK-only Survey to be hidden in Poland, preserving the existing market restriction.
