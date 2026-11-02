# Similar-error audit — 30 October 2026

Scope: follow-up to QA tickets 1–10. Changes are local; this audit did not commit or deploy the application, change billing, or modify production records.

## Fixes

- **People:** blank and whitespace-only names are rejected, with an inline message and focus on the name field. Valid names are trimmed. Invalid edits preserve the original person. Removal archives once outside React state updaters, checks both storage writes, preserves the live record on failure, and displays success only after persistence.
- **CDM:** jumping directly to Preview no longer bypasses the required project title. Failed validation returns to the field and focuses it.
- **RIDDOR:** the required incident date, location, work description and incident description are validated before leaving Incident details and again when saving. The first missing field receives focus.
- **Shared removal:** `softDeleteToRecycleBin` now archives the latest persisted record and saves its deletion tombstone before returning success. Its 48 callers still mirror the deletion in component state. Failure returns false, reports a warning and attempts to roll back the new Bin entry. If rollback also fails, the recovery copy remains; the original live record is preserved. Success reports the seven-day restore window.
- **Polish registers:** Forms, Instructions and Harmful Factors now pass the source storage key, respect a cancelled/failed deletion, and ask for confirmation once.
- **Project dropdowns:** a shared display helper uses trimmed name, then site, then ID. Applied in 52 component files, including RAMS, Permits, reports, registers and drone mission creation. IDs and stored project data are unchanged.
- **Search and form layout:** responsive Incident Actions filters; readable search placeholders in Permits, Induction and Help; shorter examples in Daily Briefing, COSHH, Inspections, Timesheets, Toolbox Talks, Training, Snags, CDM and RIDDOR.
- **Notifications:** the toast stack respects the workspace bottom inset so fixed navigation no longer covers messages. Existing header navigation/spacing and recovery-banner fixes remain covered by regression tests.

## Verification

- Functional regressions reproduced before fixes: People validation/removal, shared deletion failure handling, CDM/RIDDOR validation. New tests also exercise the three Polish registers, editing an existing person, duplicate deletion, rollback failure and organisation/country isolation.
- Final Vitest regression: **178 tests passed in 16 files** (`output/qa-similar-regression-final.log`).
- Browser scan: **24 views × 4 widths = 96 checks** (1440, 768, 390, 320 px). Final scan reports no page overflow, clipped visible search placeholders or runtime page errors in those views.
- Form scan: **14 forms × 3 widths = 42 checks** (1440, 390, 320 px). Final scan reports no measured input-placeholder clipping, blank legacy project options or panel overflow.
- Browser actions: People invalid/corrected save and removal; CDM Preview bypass attempt and corrected save; RIDDOR required-step validation and corrected save; Daily Briefing cancellation, simulated storage failure, retry, success notification and exactly one recovery copy. Toast clearance checked at 1280, 390 and 320 px.
- Browser evidence and scripts: `output/similar-ui-audit/`, `output/similar-ui-audit.mjs`, `output/similar-form-audit.mjs`, `output/similar-functional-qa.mjs`.
- Build: `output/qa-similar-build-final.log`. ESLint: no errors; existing hook/dependency warnings remain (`output/qa-similar-lint-final.log`). Scoped `git diff --check` passes.

Browser checks used local isolated test data and bundled Chromium, not production accounts. Edge and the originally reported Chrome 146 were not available. These checks cover the listed views and workflows, not every possible data combination or every screen in the application.
