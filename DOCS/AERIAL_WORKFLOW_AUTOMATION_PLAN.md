# Aerial workflow automation

User intent: make daily operation and document creation simpler and more complete; proceed autonomously and verify the result. Build on the existing React/Vite/Leaflet/jsPDF module and its English operator interface.

Design: a compact next-step panel prioritises cancelled/paused/closed states before planning actions. A derived close-out review summarises only recorded session events, pause time, closing notes, linked evidence references, post-operation checks and unresolved planning actions. No invented completed survey scope, flight duration or pilot sign-off. A pre-export review dialog presents document inconsistencies with links to fix them, preserves draft export, and prevents an out-of-date review from being used after edits. Issued snapshots remain unchanged.

Tasks:
1. Pure workflow, document-quality and close-out derivation with tests for lifecycle, missing attribution, invalid dates, cancellation, absent inputs and exact snapshot isolation.
2. Next-step panel, field close-out preview and accessible draft export review with focus restoration, current-version checks and existing role/billing guards.
3. Close-out PDF and quality findings in draft full/field documents; seven-document ZIP from one frozen snapshot with hashes.
4. Targeted tests, desktop/mobile browser coverage, actual PDF inspection, lint/build and one fresh final code review.

Interfaces: use existing mission/assessment/checklist data; derived output is not saved as new approved data. No database/schema changes or new runtime service. Export dialog captures mission token and linked assessment/context; changed inputs must trigger a new review. PDF and ZIP use the same selected snapshot and evaluation time.

Constraints: preserve other local changes, no commits; deployment is not part of this new implementation iteration. Existing production remains available. Skills already applied in this session: brainstorming (user opted out of questions), writing-plans/executing-plans, frontend-design, PDF and verification. Ledger retained here for uncommitted work.

Task 1: complete. Pure workflow and quality tests failed before implementation; current targeted suite passes 128 tests across 21 files (`output/workflow-review-green.log`). No separate external specification beyond the design above and user's authorised priorities.

Task 2: implemented. Native dialog traps focus and supports Escape; cancellation/editing never downloads. Confirmation checks fresh linked records and planning assessment before sending the captured snapshot to the asynchronous exporter. Browser tests cover changed linked projects, refreshed review, focus restoration, post-close panel and step changes.

Task 3: implemented. Seven PDFs plus manifest format/2; existing filenames preserved, new `07-close-out-draft.pdf`. Exact snapshot time determines calculated site minutes and quality findings. No flight duration or deliverable completion inferred. Full draft/field/close-out include quality findings; approved historical full packs bypass new draft sections.

Final review: one fresh read-only gpt-6-astra review. Fixed stale 30-second UI time (browser reproduction: valid close event hid summary), null journal entry crashes, absent event attribution/notes and cancelled mission omission. Three pure regression tests failed before fixes (`output/workflow-review-red.log`), then all 128 targeted tests passed. Fixed the associated contradictory missing-note wording too. No deferred minor findings.

Final: Ruling: authenticated pilot approval and regulatory correctness remain outside this derived workflow — documents explicitly separate site coordination from a flight decision. Treating the summary as a flight release would be incorrect.

Final: Ruling: production sync guarantees and unrelated dirty-tree work remain unchanged — this feature adds no server schema and uses existing persistence; this iteration is not a production acceptance test.

Final: Ruling: browser/PDF visual inspection is performed by the parent validation run rather than duplicated by the reviewer — completion requires those recorded results below.

Final: Ruling: a confirmed frozen snapshot remains the export source after later navigation — replacing it would silently export another mission; workspace scope is checked before starting the download.

Validation complete (2026-10-29): 128 tests across 21 files passed (`output/workflow-final-unit.log`); all 12 desktop/mobile browser scenarios passed in 4.0 minutes (`output/workflow-final-browser.log`). ESLint and Prettier checks passed. Production build passed in 46.06 seconds, retaining the existing large-chunk advisory (`output/workflow-final-build.log`). No commit or deployment was performed for this iteration.

Browser regression fixes: Escape restores focus to the export opener; refreshing a stale review scrolls to and focuses its heading so the changed-record warning is visible. Both were reproduced with failing browser assertions before correction. Final coverage includes immediate post-close summary, paused-session priority, changed linked project review, actual PDF/ZIP downloads, reload persistence, organisation isolation and mobile overflow checks.

PDF validation: rendered and visually inspected all 13 pages of the two synthetic workflow samples (2-page close-out, 11-page full pack), with zero off-page text and all 33 internal links valid. Inspected desktop/mobile export-review screenshots and the close-out layout. Samples: `output/pdf/aerial-workflow-closeout.pdf`, `output/pdf/aerial-workflow-full.pdf`; render evidence: `output/drone-qa/workflow-*-review.json`. The samples use fictional records and do not validate live aviation conditions.
