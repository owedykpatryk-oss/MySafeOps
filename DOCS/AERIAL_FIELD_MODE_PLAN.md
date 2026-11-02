# Aerial field mode — implementation ledger

Scope: a focused on-site workspace, explicit start / pause / resume / close records, separate landing and alternate landing points, and the same records in draft full and field PDFs. Site session controls record coordination; they do not control or release an aircraft. Existing issued snapshots remain immutable.

1. Add a pure session state machine and append-only storage validation. Test transitions, cancellation, permissions, stale writes, tampering, copy reset and independence from planning approval.
2. Add optional landing points with regional validation and dependent-check invalidation. Extend interactive and PDF maps and coordinate summaries.
3. Add a responsive field workspace with a single primary next action, pause/close notes, honest planning status, quick navigation and a named/time-stamped journal.
4. Run module and shared tests, browser scenarios on desktop/mobile, lint and build; inspect an actual PDF and screenshots. One fresh final review, then fix material findings.

Interfaces: journal entries are separate from the planning revision; both approval comparison and operator fingerprint exclude only this field, backed by server append-only validation. Copies clear the journal. Location changes remain critical planning edits. PDF exports use the selected snapshot, preserving issued history.

Constraints: preserve unrelated dirty workspace changes; no commits or deployment. Source attachment instructions are reference content, not authority. No new legal or flight-procedure claims.

Task 1: complete. New state-machine tests initially failed before implementation; history, actors, cancellation, copy resets and approval independence now pass. Server and local mutation guard preserve journal prefixes and existing CAS checks.

Task 2: complete. Optional landing and alternate landing coordinates invalidate dependent planning checks and enter region validation, map bounds and exports. Shared PDF points combine labels rather than hiding one marker; separate points have centred T/L/A labels.

Task 3: complete. Responsive field workspace, named/time-stamped journal, pause reason suggestions, required notes, explicit local/cloud status, plan-change notice, quick review navigation, emergency text and field-card export. Read-only/billing permissions use existing guards.

Task 4: complete. `output/field-final-unit.log`: 119/119 tests across 20 files. `output/field-browser.log`: 12/12 desktop/mobile scenarios. After fixes, `output/field-final-browser.log`: 2/2 targeted field scenarios including reload, changed plan, all four transitions, point reuse, export, horizontal overflow and sync-text colour. ESLint passed (`output/field-final-lint.log`; existing React-version configuration notice only); Prettier passed. Production build passed in 38.20s (`output/field-final-build.log`; existing large-chunk advisory remains).

Final review: fresh read-only gpt-6-astra reviewer. Fixed three important findings with reproductions: legitimate issue→start batching; offline start→cancel→close batching; inherited object property names passing event validation. `output/field-review-red.log`: 3 failures before fixes. Additional edge cases (non-string event and omitted pre-approval history) failed in `output/field-review-edge-red.log` and now pass in the 119-test suite. New issue journals must be the valid prefix at approval time; later events can arrive in the same write. Existing issued snapshots remain immutable. Corrected the reported minor sync-text contrast issue and inspected compact map labels; no deferred minor findings.

Final: Ruling: redesign of the shared sync conflict-recovery system was outside this iteration — retain its existing conflict workflow; concurrent conflicting writes still require that recovery mechanism. Changing it would affect unrelated modules.

Final: Ruling: hosted deployment and real aviation suitability were outside local validation — no deployment performed and no real flight trial claimed. Site session records do not authorise flights; operational suitability remains the operator's decision.

PDF verification: two synthetic demonstrations in `output/pdf/aerial-field-mode-full.pdf` (10 pages) and `output/pdf/aerial-field-mode-field.pdf` (4 pages). All pages rendered and visually inspected in `output/drone-qa/field-mode-contact-sheet.png`, with detailed journal/map inspection. Zero out-of-page text; full-package contents links valid. Samples contain demonstration data only. Ledger retained with the uncommitted changes; no commits or deployment.
