# Australian aerial survey and operational improvements

> Execution: superpowers:executing-plans, with targeted test-first changes and one independent final review. User has authorised autonomous improvements and opted out of routine questions. No commit, deployment, purchase or external messages.

## Design / specification

Keep the existing module and tenant/country registers. UK legacy missions remain UK drone records. Expose the module in UK and AU only, with the AU title Aerial Survey Operations. Every new mission records jurisdiction, aircraft kind and an explicit local time zone. AU supports drone and helicopter workflows. No UK authorisation/class/Remote ID rules appear as Australian requirements.

Helicopter missions support own or contracted operators without inventing an aviation fleet catalogue. Record the named operator, certificate/scope reference, aircraft registration/type, pilot, task specialists, sensor configuration, operator manual reference, landing/site arrangements and a dated operator release covering the mission. The application's approval is survey-coordination review, not flight dispatch or operator certification. Reference existing People/Plant where relevant. Require genuine manual aviation briefing evidence; a surface weather forecast is not an aviation briefing.

Share bounded geometry import, separate operation areas, immutable issue snapshots, scoped storage, manual versions, documents and expiry checks. Region/mode changes invalidate evidence, physical checks, forecasts and approval. Time conversion handles AU half-hour zones and DST with explicit repeated-time choice; never silently assume Sydney. Operator release is cleared when copying a mission.

## Tasks and verification

1. Regional domain and time handling. Add `droneRegions.js`, `droneTime.js`, tests in `droneAustralia.test.js`; extend `droneMission.js`. RED: AU missionWindow conversion, ambiguous/nonexistent Sydney time, Adelaide/Darwin/Perth, UK regression, no UK categories in AU, helicopter approval blocked without release. GREEN: implement scoped rules, evidence/checklist sources and validity.
2. UI/manual/PDF. Add a focused `HelicopterSetup.jsx`; adapt overview, templates, evidence, manual and PDF to regional config. Preserve existing UK flow. Add market label/gating and optional date-expiry reminders derived from stored evidence. Browser: AU hired helicopter cannot approve incomplete records, dated operator release plus all evidence permits coordination review, PDF uses AU sources/time zone, copy clears release. Reviewed AU manual remains distinct from UK.
3. Weather and shared usability. Validate UK/AU provider request bounds; scope cache by region. AU helicopter surface data labelled supplementary. Add next-action shortcuts and an expiry/recheck overview without external notifications. Tests: cross-region coordinates rejected, unsupported regions rejected, no connected key remains Not connected.
4. Verification and documentation. Run targeted unit/server/market tests, browser desktop/mobile for UK and AU, build, PDF text/render checks, independent review and fixes. Update implementation/provider docs with configured versus unavailable capabilities.

## Review focus

- Imported or manipulated region/mode/time-zone must not bypass readiness or server validation.
- Contracted pilot and aircraft are not assumed to be members of the survey company's fleet; approval still requires current operator evidence.
- Old UK issued snapshots stay readable and immutable; source labels in new AU PDFs must never use CAA as the regulator.
- Async work, copy, date or equipment change must not retain operator flight release or approval.
- Manual/library applicability and country scope must not leak procedures between AU helicopter and UK drone operations.

## Ledger

- Planning: existing dirty branch reused to preserve user work and prior module changes. No commits authorised. Scope is local application improvements; external provider contracts and production staging remain unavailable.
- Pre-flight: time/domain interfaces feed UI, provider and PDF; use one shared missionTimeZone/missionWindow resolver. Regional evidence/checklist definitions must be shared with worker validation.
- Task 1 complete: initial 9 AU domain tests failed; regional resolver/time conversion/readiness implemented and passed. Expanded unit cases cover contracted and own helicopters, ReOC/excluded drone paths, expired release, foreign manuals and region geometry.
- Task 2 implemented: regional UI, operator evidence, manual applicability and PDF. PDF test initially failed on London/UK data, then passed with regional source/time/equipment sections. Contracted helicopter browser flow passed after fixing stale evaluation time at a minute boundary (observed real failure, repeated scenario green).
- Task 3 implemented: provider region validation/cache key, surface forecast caveat, scoped library checklists and in-app expiry reminders/next-action shortcuts. Cross-region provider and checklist tests observed RED then GREEN.
- Independent review: no Critical findings; three Important and one Minor finding accepted. One fix pass completed: bind operator decision evidence to mission/evidence/checklist content and enforce on server; validate derived metadata on new issued snapshots; clear hidden drone sensor references on mode change; include survey lead in draft PDF. Regression tests first reproduced six failures, then passed; an additional server payload regression also passed. This binding checks content consistency and is not an operator signature.
- Final unit/server verification: **84 tests passed across 11 files**, `output/drone-au-tests.log`. Tests include UK compatibility, AU time zones, release invalidation, manipulated snapshot metadata, provider region validation and existing billing/quota guards.
- Production build passed in **55.88 s**, `output/drone-au-build.log`; no deployment or source-map upload. ESLint passed for module/integration/browser files; API files are excluded by repository configuration, so a separate explicit Node-global lint run passed (`output/drone-au-api-lint.log`). Only the existing React-version configuration notice remains.
- PDF review: all **8 pages** of the AU helicopter pack and **2 pages** of the AU coordination manual rendered and visually inspected. No off-page text. Synthetic files and review JSON are in `output/drone-qa/`; final desktop/mobile screenshots were also inspected.
- Browser verification: **all 8 scenarios passed in 2.9 minutes** after the review fixes, covering UK/AU manual and mission flows on desktop and Pixel 7. Log: `output/drone-au-e2e-final.log`. Issuing, PDF download, copy invalidation, regional separation and horizontal-overflow checks passed. Targeted `git diff --check` passed. No commit, push or deployment performed.
