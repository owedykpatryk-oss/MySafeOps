# Company Operations Manual

User requested a polished company-saveable Operations Manual with complete information and useful automation. Continue on the existing branch and preserve unrelated work; no commit or deployment is requested.

Design: retain the ten region/aircraft-specific sections, add company identity and document control (code, owner, review date, distribution, references), per-section review and detailed drafting topics, progress and a next incomplete section action. Original drafting outlines may fill empty sections only; explicit TO COMPLETE placeholders block review. No invented operator facts, certifications, emergency contacts, limits or legal sign-off. Existing reviewed versions stay locked; revisions copy content/company data but reset review confirmations.

Save design: synchronous organisation-scoped persistence returns success before UI claims saved; enforce current-row comparison and reviewed-version immutability. A failed edit stays in the editor for retry/discard. Show local-device save separately from the existing cloud synchronization banner. Use the existing schema-flexible manual register, no new server service. Reviewed manual validation remains a company document review, not operator flight approval.

PDF design: reuse the proven navy/teal report renderer; add an actual manual cover, organisation identity, control register, interactive contents/bookmarks, completeness status, procedure chapters, distribution and reference appendices. Add optional cover wording to the shared renderer without changing mission defaults. Demonstration PDF must be fictional and clearly marked draft, not a production manual for a named real company.

Tasks: (1) tested pure company/manual helpers and save conflict/immutability rules; (2) company workspace UI and guarded save/retry; (3) manual PDF with tested content and existing report compatibility; (4) targeted tests, desktop/mobile manual scenarios plus existing aerial flows, lint/build, rendered PDF inspection and one fresh final review. User opted out of design questions; use existing React/Leaflet/jsPDF stack and current company settings.

Pre-flight interfaces: UI passes expected stored record to save helper; PDF consumes captured manual data and the same review/completeness helper. Historical manuals without the new format remain readable and reviewed versions immutable. New revisions adopt the richer company format.

Sources checked 2026-10-29: CASA AC 101-01 v6.1 (April 2026), https://www.casa.gov.au/remotely-piloted-aircraft-systems-licensing-and-operations ; UK CAA PDRA01 manual guidance, https://www.caa.co.uk/drones/specific-category/pdra01-operational-authorisation/pdra01-operations-manual/ . These inform drafting topics, not an automated assertion of regulatory compliance. CASA confirms operator-specific documented practices and procedures; sample manuals are starting points.

Status: implementation and verification complete. Skills already applied: brainstorming opt-out, writing-plans, executing-plans, TDD, frontend-design, PDF, verification. Keep this uncommitted plan as the durable ledger.

Task 1 complete: helpers and company review validation, RED missing helper → GREEN 5 helper tests. Server boundary RED admitted an incomplete new-format review → GREEN rejection. No schema migration; shared write guard must ship with the frontend.

Task 2 complete: company editor, chapter outlines and review, explicit synchronous save/retry, draft and locked states. Initial desktop/mobile manual review and revision flows passed; reload test had an overly exact implicit-label selector, corrected to the combobox's accessible role/name.

Task 3 complete: manual-specific cover options and PDF control/distribution/references, RED missing PDF builder → GREEN PDF content + layout tests. Fictional eight-page example rendered; all eight pages visually inspected, no off-page text, all 23 internal navigation links valid. Existing mission cover defaults retained.

Fresh final review: company_manual_final_review (gpt-6-astra, high, fresh context, read-only). Two important findings accepted and fixed:

- Final: fixed stale browser-tab saves overwriting the persisted register — `stale manual saves preserve another tab's reviewed version and new records` RED→GREEN. Save reloads current scoped storage; conflicts refresh stored rows while retaining attempted edits.
- Final: fixed failed-save edits disappearing on tab navigation — `failed company saves retain edits and only claim saved after retry` RED→GREEN. Recovery is kept in memory across SPA remounts, scoped by organisation/country/region/user and cleared on success/discard. Hard reload still requires successful save; beforeunload warns while editor is mounted.

Final: Ruling: shared synchronization-hook redesign remains outside this manual iteration — use its existing cloud version/conflict handling and add the concrete manual storage check — cloud concurrency still depends on the existing service and has not been verified against a production account in this iteration.

Final: Ruling: company procedure adequacy remains an operator responsibility — checks verify recorded fields and reviews, not substantive regulatory compliance — company-specific facts, limits and procedures must be verified before operational use.

Task 4 complete: 145 unit/integration tests in 24 files passed after the fixes (`output/company-manual-final-unit.log`); all 28 desktop/mobile aerial browser scenarios passed in 5.7 minutes (`output/company-manual-final-browser.log`), including both review regressions, approval-write failure, PDF download, reload, company isolation and existing maps/mission flows. Scoped ESLint and Prettier checks passed (existing React-version configuration warning only). Final Vite production build passed in 49.60 seconds with existing bundle-size/dynamic-import advisories (`output/company-manual-build.log`). Company workspace screenshots and all eight PDF pages inspected. No commits or deployment; production authenticated cloud persistence was not exercised.
