# Aerial preparation workflow improvements

> Execute with superpowers:executing-plans. Autonomous implementation authorised; no commits, publication, external messages or paid services.

**Goal:** Reduce repeated entry and downloads while making reused information visibly current.
**Architecture:** Extend existing shared document automation/readiness, source review UI and PDF export. Preserve country/organisation scope, immutable issue snapshots and review invalidation. No new service dependency.
**Spec/design:** Three improvements plus a compact next-step summary. (1) Compare copied project/template values with current selected records; show differences and require an explicit update or manual-value decision before issue. Manual edits are preserved. (2) Extract explicitly labelled ISO expiry candidates with exact excerpts; require user selection, retain provenance, support applying multiple individually reviewed fields in one edit; ambiguous duplicate fields must not silently win. (3) Export the full draft, task plan, briefing and evidence register together in a ZIP with file hashes and a revision manifest. All PDFs derive from one captured snapshot. A focused next-step strip links outstanding actions to their editor sections without claiming compliance percentages.

## Tasks

- [x] Domain: add source comparison/resolution, strict expiry candidates and batch acceptance; failing unit tests first, then shared assessment integration. Test deleted/switched sources, manual edits, ambiguous values, malformed dates and expiry provenance.
- [x] UI: source-difference rows, verified expiry selection, multi-field action and grouped next-step navigation. Test actual desktop/mobile flow, preservation on reload and no operational approval from source acceptance.
- [x] Bundle: expose PDF builders and add bounded ZIP assembly/hash manifest; test contents/byte hashes and browser downloads. Render sample output and inspect all document types already covered by prior PDF checks.
- [x] Verification: targeted module/server tests, UK/AU desktop/mobile regression, lint/build, independent review and important fixes.

## Review focus

- Changes to selected project/template must never silently replace manual values or retain misleading provenance.
- Batch acceptance must use current mission state, preserve all accepted fields and reject duplicate conflicting values.
- Date strings and excerpts are untrusted; ambiguous or impossible dates cannot become asserted validity.
- ZIP contents must match a single revision, with accurate hashes, and remain draft documents even when the mission has an earlier approval.
- Failed saves, concurrent edits, scope changes and denied writes retain existing protection.

## Ledger

- Existing dirty non-main workspace retained; previous work preserved. Existing skills and native execution method reused. Tasks share pure domain helpers; UI and server use the same readiness checks. Bundle consumes a captured snapshot, never mutable live state during generation.
- Domain and ZIP tests observed RED for missing implementations, then GREEN (5 new tests); full module/server set 102/102. Desktop workflow passed: explicit expiry, two-field single revision, source comparison, real ZIP content and draft manifest.
- Independent final review: one Important finding (legacy project/template selectors overwrite manual fields); preparing selector regressions before correction. No declined judgments.
- Navigation minor included in the same fix pass under the user's instruction to complete the improvements: missing-template shortcut now targets Mission & map. Routing regression observed RED (setup), then corrected to overview.
- Final fix pass: actual Project and Survey type selector regressions observed RED for all five manually entered values. Both selectors now fill only empty fields and attach fresh attribution, preserving nonempty values for explicit review.

- PDF review: all 18 pages across full pack (6), task plan (4), crew briefing (5), and source register (3) rendered and visually inspected. Zero off-page text. Desktop and mobile workspace screenshots inspected; no horizontal document overflow in browser assertions.
- Final: fixed manual-value overwrite in both legacy selectors — actual desktop/mobile source workflow regression RED→GREEN for client, location, postcode, QA and deliverables; full unit/server suite 102/102, browser suite 10/10.
- Final: fixed template-action navigation — routes-next-actions regression RED→GREEN; full unit/server suite 102/102.
- Final verification: output/polish-unit-final.log (17 files, 102 tests); output/polish-browser-fixed.log (10/10, 4.2 minutes); output/polish-lint-final.log (no code errors/warnings; existing React version configuration notice); output/polish-build-final.log (production build 1m39s; existing large-chunk advisory). Touched files pass Prettier. All review findings addressed, none deferred, no declined judgments.
- Completion: local implementation and documentation complete. Existing dirty workspace preserved; no commit, push, merge, deployment or paid/external service action. No worktree cleanup applies. Live authenticated staging and external capabilities remain explicitly documented in the guide.
