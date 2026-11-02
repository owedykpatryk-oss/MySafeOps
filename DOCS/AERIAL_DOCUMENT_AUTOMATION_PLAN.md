# Aerial document automation implementation plan

> Use superpowers:executing-plans. User authorised autonomous implementation, visual improvements and no routine approval pauses. Preserve the dirty workspace; no commits or deployment.

**Goal:** Make document preparation a fast guided workflow with traceable reuse, conditional sections and source-assisted entry.
**Architecture:** Extend existing missions, country-scoped registers, shared readiness/server guard and immutable PDFs. Deterministic assembly runs locally. Imported files are data, never instructions. No new external accounts or AI service dependency.
**Tech stack:** React, existing CSS tokens, pdfjs, fflate, jsPDF, Vitest, Playwright.
**Spec:** User request in this chat and the design below.

## Design and scope

Add a three-step launch composer beside the existing blank mission action: project and aircraft, survey and conditions, preview. Reuse only selected project and explicitly chosen configuration; never reuse checks, dates or decisions. Show the resulting document contents before creation.

Add a Prepare documents mission section: a document workbench showing the assembled task plan, crew briefing, evidence register and full operational pack; reuse suggestions with source names; conditional working-context reviews; and bounded PDF/DOCX/TXT import. Extract only explicitly labelled candidate fields with exact excerpt/page and SHA-256 file fingerprint. User reviews each candidate before applying it. Scanned PDFs without text need manual transcription; no OCR capability is claimed. Sources remain unverified evidence until ordinary checks/review are completed.

Readiness covers selected scenarios, stale accepted values and expired source facts. Unknown scenario IDs cannot silently disappear. Approved exports use immutable snapshots. Provide separate draft task-plan/briefing/evidence PDFs from the same data, without suggesting they are statutory RAMS or aviation release. Existing approved issues remain immutable.

Visual direction: an aerial survey document desk. White #ffffff paper; deep blue #183348 ink; teal #0f766e actions; pale blue #edf4f8 workspace; amber #a35b0b unresolved information. Use existing DM Sans/Plus Jakarta typography. Left-aligned wide working area with a contrasting paper-stack preview, compact progress rail and quiet list rows. Avoid decorative metrics, invented compliance scores and repeated identical cards. Mobile stacks the preview below the controls, preserves 44px actions and keyboard focus. Reduced-motion preferences respected.

## Global constraints and boundaries

- Existing admin/supervisor, billing, organisation/country isolation and stale-edit protection apply.
- No new regulatory eligibility claims, invented limits, completed checks or operator signatures.
- External operator portal, live aviation APIs, paid OCR and scheduled external notifications require separate backend/access work; do not display working controls for unavailable services.
- Ordinary local changes persist through current mission storage. Legacy records remain usable.

## Review focus

- Imported documents containing commands, active links, ZIP expansion or malformed content must remain bounded untrusted data.
- Draft source proposals cannot become evidence approval or survive changed accepted field values unnoticed.
- Country/mode changes, copied missions, stale async reads and denied writes must not create apparently saved/approved documents.
- Unknown scenarios or deleted source registers must not silently make a mission ready.
- Issued exports must retain their historical sections despite later configuration edits.

## Tasks

1. Domain (`documentAutomation.js`, test): project reuse suggestions with provenance, scenario catalogue/checklist/readiness, bounded candidate parsing and accepted fact binding. RED tests for non-overwrite, unknown/unchecked scenarios, stale/expired facts, immutable snapshot metadata; implement shared helpers and GREEN. Integrate with `droneMission.js` and existing server assessment.
2. Import (`documentImport.js`, test): bounded TXT, PDF text pages, DOCX XML body; hash original file, explicit no-text outcome, reject unsupported/oversized/encrypted/unsafe archives. Test parser limits and malicious labels. No file contents sent to external APIs.
3. UI (`MissionComposer.jsx`, `DocumentWorkbench.jsx`, CSS, `DroneOperations.jsx`): guided creation, live preview, source suggestions, context checks, reviewed candidate application, section navigation and draft exports. Browser test desktop/mobile for wizard, preserve manual values, import/accept, scenario blocker, reload and keyboard/mobile layout.
4. PDF and verification (`dronePdf.js`, tests): shared source provenance/scenario sections and focused draft documents. Run module/server unit suite, all UK/AU regression browser flows, build and lint; render generated PDFs; independent final review and fix important findings.

## Ledger

- Setup: existing non-main dirty branch retained; user work and preceding module changes must stay in place. No commits authorised. Native implementation with one final independent review.
- Pre-flight: scenario checklist definitions must be shared by UI, assessment and snapshot guard; document fields need the same stale-binding helper in browser and server; PDF reads snapshots. No interface conflict found.
- Task 1: domain tests observed RED then GREEN. Project/template suggestions fill empty fields only; context reviews and accepted-source consistency run in the shared server/client assessment. Unknown conditions, impossible expiry dates, invalid page locations and changed values block issue. Source expiries appear in existing reminders.
- Task 2: importer tests observed RED then GREEN for bounded text and DOCX, unsupported formats, oversized input, unsafe paths and XML entities. PDF extraction uses the bundled pdfjs worker with evaluation disabled. Original files stay on the user's device; provenance stores only reviewed excerpts and SHA-256.
- Task 3: guided composer and document workbench implemented, preserving the existing blank mission path. Initial browser failures identified exact-text selectors including nested option/source text; corrected selectors to use accessible roles and scoped content. Actual desktop/mobile workflows are now being verified, including PDF and DOCX inputs.
- Task 4: focused draft exports and source/context sections implemented after a failing PDF section test. Legacy module/server regression run passed 91 tests before additional date/reminder cases. Build, rendered PDF and independent review pending.
- Final independent review: accepted four findings. Local denied-save and stale imported-value UI regressions both failed for the reported reason before the fixes. Approval now checks local persistence before audit/success; cloud-configured workspaces label reviews pending and read back the exact server snapshot before an approved PDF can be downloaded. Pure acknowledgement tests reject unavailable, absent and changed server snapshots.
- Import hardening regression reproduced silent truncation with forged ZIP sizes and bad CRC. Replaced header-trusting unzip with bounded streamed body inflation, local/directory consistency and actual CRC/length checks. Malformed input regressions now pass.
- Missing/deleted template regression failed before the fix. Shared assessment now requires an available template and excludes deleted catalogue records; source-dependent approval cannot bypass capability validation this way.
- Review limits: legal completeness and live authenticated backend behaviour remain outside the local test environment. No legal completeness claim is made; the cloud acknowledgement path has injected-response tests, while authenticated staging acceptance remains outstanding. Browser layout is checked by the main agent.
- Current final verification: 97 tests across 15 files pass; lint has no code warnings/errors; production build passes (31.56 s) with the standard large-chunk advisory. Five draft briefing pages rendered and visually inspected with zero off-page text. Final browser regression run follows the fixes.
- Final browser result: **10/10 passed in 4.8 minutes**, UK and AU on desktop and Pixel 7 (`output/document-e2e-final.log`). This includes source reapplication after edits, simulated storage-quota failure before issue, actual PDF/DOCX/TXT reads, all three focused PDF downloads, reload persistence, copy reset and organisation isolation. Earlier interrupted runs encountered a temporary JSX error during UI editing; the syntax was corrected before this complete final run.
- Final PDF review: **12 pages** across task plan (4), crew briefing (5) and evidence register (3) rendered; all inspected, zero off-page text. Final composer and desktop/mobile workspace screenshots inspected. Synthetic artifacts: `output/drone-qa/*document-*`.
- Completion: all four implementation tasks and important review fixes complete. Targeted diff check passed. Changes retained on the existing working branch without commit, push, merge or deployment, as authorised. No worktree cleanup applies. External portal, OCR, live aviation data and authenticated staging are explicitly listed as remaining capabilities in the usage guide, not presented as implemented.
