# Aerial document preparation

Implemented locally on 29 October 2026. Open Aerial Survey Operations in an Australian workspace, or Drone Operations in a UK workspace.

## Fast start

Choose **Prepare a mission** from the mission list. The three steps select an existing project and aircraft type, the operation time zone, survey deliverable and working conditions, then show a package preview. Optional dates can be entered now or later. Creating the draft copies available client, site, postcode, deliverables and survey QA, with named project/template provenance. A valid existing project boundary is reused; the flight area and landing point remain separate checks. Existing blank mission and saved-setup workflows remain available.

## Prepare documents

- **Reuse records:** fill empty project/template fields in one action. Existing typed values are preserved. Expand the source details to see what was copied and whether a value was subsequently edited.
- **Changed sources:** copied fields are compared with the current selected project/template. A changed, switched or removed source creates an outstanding action. Choose the current source value or explicitly retain a manual value; no silent overwrite. Issue assessment uses the same check.
- **Conditional sections:** remote sites, road/rail interfaces, public access, water, night/reduced light, wires/infrastructure, environmental sensitivities and airspace coordination add focused planning reviews. Each needs site-specific arrangements and a named review. These are planning prompts, not a determination of legal eligibility. Changing conditions invalidates dependent operational checks.
- **Source documents:** import PDF, DOCX or TXT locally. Supported explicit labels include operator name, AWC number, helicopter registration/type, pilot, operator manual reference, drone Operator ID and ARN. Review the exact excerpt and original before applying each value. Existing values are visibly identified before replacement. Source extraction never creates completed checks, authorisations or operator decisions.
- **Provenance:** applied fields retain the filename, PDF page or text-block location, excerpt, SHA-256 of the input file, reviewer and review time. Optional expiry must be checked against the source. Keep the original in the existing Document Library; this importer does not upload it. A fingerprint establishes file identity for comparison, not authenticity or a signature.
- **Reviewed batch:** select each checked candidate, then apply the selected values together in one revision. Conflicting values for one field are rejected. Explicit `Document expiry`, `Expiry date` or `Valid until` labels with a real `YYYY-MM-DD` date appear as selectable candidates. Selecting one retains its excerpt/location; manual date changes clear that attribution and reset candidate review. The user must verify that the selected expiry applies to those fields.
- **Consistency checks:** edited accepted values, invalid/expired source facts, unknown conditions and missing templates create blocking actions. Source document expiry appears in the existing seven-day reminders. To correct a sourced value, reimport and review the correct value, or explicitly remove an obsolete source link and record current operational evidence.
- **Draft exports:** download a task plan, crew briefing, evidence register or complete package from the same mission. Every focused export is clearly a draft and includes outstanding actions. A draft briefing does not record that the crew was briefed. The existing review process creates the immutable issued package.
- **One download:** **Download all draft documents (ZIP)** captures one revision and produces seven PDFs plus `manifest.json`, recording mission, revision, generation time, outstanding actions and each PDF's SHA-256/byte count. It remains a draft even if the mission had an earlier approval. Source originals are not bundled. Grouped open-action buttons lead directly to the section needing work.

## PDF design and field documents

The full report now opens with a mission cover, key facts, linked contents and the operating-area schematic when geometry is available. Section bookmarks and footer links support navigation. Map layers use separate line patterns as well as colours, with a matching legend, north arrow and approximate scale. The map remains a WGS84 schematic without obstacle or aeronautical-chart coverage.

Checklists are grouped into before mobilisation, on site, during operation and after operation. Each item retains its responsible role, exact instructions, review identity/time, notes and source/version. A recorded-review label requires a done status, named reviewer and valid review time no later than export time; missing attribution remains review needed. Short items stay together; long text flows across pages with continuation labels. This is a display of recorded evidence, not automatic compliance or flight approval.

Two new draft documents are available individually and in the ZIP:

- **Field card:** compact mission facts, landing/access and communications arrangements, emergency information, recorded operator-decision reference where applicable, open actions, site-phase checks and map. Length follows the actual content; safety text is not cut to force a one-page result.
- **Operator review:** mission facts, task/aircraft/crew details, evidence to review, saved decision reference where applicable, open actions and planning-phase checks. It is a coordination reference for review, not the operator's aircraft-specific technical checklist, an authenticated signature or a flight release.

All seven exports use the same embedded Unicode fonts and document identifiers. The downloads remain static PDFs; printed marks do not update the application. Synthetic design samples are in `output/pdf/aerial-*-sample.pdf`.

## Saved versus confirmed

A failed local save does not create an approval audit or success message. In a cloud-configured workspace, a newly recorded review is **Awaiting cloud confirmation**. **Verify and download issued PDF** reads the server and requires the exact issued snapshot before producing an approved export. Offline, rejected, absent or different server records cannot pass this check. If a write is rejected, the local copy remains available for recovery; resolve the sync error or copy the mission to prepare a new review. Local development mode continues to support local test snapshots without claiming cloud confirmation.

## Import limits

Up to 8 MB per file, 40 PDF pages and 120,000 extracted text characters. DOCX accepts bounded ordinary ZIP bodies, checks directory/local metadata, counts actual streamed expansion and validates the document-body CRC. Encrypted, unsupported, malformed, excessive or unsafe archives are rejected. Text is displayed as text; embedded document instructions, links and macros are not executed. DOCX/TXT locations are labelled text blocks because stable original page numbering is unavailable.

Scanned PDFs without a text layer require manual transcription or a separately reviewed OCR service. The importer extracts supported labelled fields; it does not interpret an arbitrary legal document or certify its contents. No document is sent to an external AI provider.

## Remaining external work

An authenticated external operator portal, OCR for images, licensed live aviation data and scheduled external notifications are not implemented by this delivery. Existing live-provider and authenticated staging limitations in `AERIAL_SURVEY_AU.md` still apply. Neither the conditional library nor the generated pack claims to cover every aviation operation or jurisdiction. No commit, production deployment, subscription purchase or message to an operator was performed.

## Verification

Final local checks after the PDF redesign: **108 tests across 19 files**, **10 desktop/mobile browser scenarios (3.5 minutes)**, followed by **two additional desktop/mobile document-flow checks after layout review fixes**, lint and production build passed. Twenty-five pages across all six synthetic design samples were rendered and visually inspected, with no off-page text. All 27 links in the full sample resolve to valid pages and positions. Long-title and long-note stress export also retains all text within bounds; navigation labels are shortened while body content remains complete. Browser coverage includes batch acceptance in one revision, expiry excerpts, changed project data, actual six-document ZIP downloads, the two new individual sheets, reload persistence, and manual values retained when changing project or survey type. Independent review findings were fixed with failing-then-passing regressions. Earlier protections include refused local saves, exact cloud acknowledgement, stale imported values, missing templates and forged DOCX archive sizes/CRC. Cloud acknowledgement uses injected responses in tests; authenticated staging remains untested. Build retains the existing large-chunk advisory; lint retains the repository React-version configuration notice.

See `AERIAL_DOCUMENT_AUTOMATION_PLAN.md`, `AERIAL_AUTOMATION_POLISH_PLAN.md` and `AERIAL_PDF_DESIGN_PLAN.md` for implementation ledgers. Synthetic screenshots, PDFs and draft ZIPs under `output/drone-qa/`, and design samples under `output/pdf/`, demonstrate the workflow only.
# Field mode: site coordination

The mission's **Field mode** tab brings the current site session, planning actions, map, emergency text and recent journal into one view. Start opens a site session; Pause, Resume and Close require a note and record the current account, UTC timestamp and planning revision. A changed plan is highlighted until the next session entry. These are site coordination records, not aircraft controls, a pilot flight log, an authenticated pilot signature or permission to fly. Existing planning checks remain visible and independent.

Landing and alternate landing points are optional, explicit WGS84 locations. Draw them in **Mission & map**, or choose **Use take-off point** to explicitly reuse the launch location for landing. Changing a point resets dependent checks. No automatic landing suitability assessment is performed.

The full draft package and field card include the selected snapshot's journal and all three point types. Historical issued packages retain their original snapshot. Copies start with an empty journal. Local saves use the existing cloud outbox; offline records remain on the device until synchronization succeeds. The server enforces append-only journal history and the authenticated actor for newly added entries. Session activity does not change the planning revision or invalidate an otherwise-current planning approval.

## Guided workflow and close-out

The **What's next** panel uses the current plan and session state to select a useful action. Cancellation and paused sessions take priority; closed sessions lead to post-operation review and then a close-out draft. No action represents flight permission.

After closing a site session, **Bring the site record together** shows recorded site activity and pause minutes, closing notes and attributed post-operation checks. These durations are not flight time. The close-out PDF includes planned deliverables, recorded references, pauses, the journal and remaining document-review findings; it does not assert that deliverables were completed or accepted.

Every draft export opens **Review your draft export**. The checks cover identifying information, unresolved planning actions, checklist attribution, inconsistent evidence times, missing sources, invalid source expiry dates, malformed session history, missing event attribution/notes and cancellation. **Review item** navigates to the relevant section. **Export this draft** permits a draft with findings, retaining them in the full draft, field card and close-out record. The review refreshes if the mission or linked records change before confirmation. Escape / Keep editing closes the dialog without a download.

The ZIP now contains seven PDFs and `manifest.json` format `mysafeops-draft-bundle/2`; the new file is `07-close-out-draft.pdf`. All files use one captured snapshot. Existing issued snapshots still export their historical records, not current mission data. No new database migration or provider service is required.

Workflow verification (2026-10-29): 128 targeted tests across 21 files and all 12 desktop/mobile browser scenarios passed. Lint, formatting and production build passed; the existing large-chunk build advisory remains. Reviewed all 13 rendered pages of the two new synthetic PDF samples: no off-page text, all 33 internal links valid. Browser regressions cover focus restoration and visible refreshed-review warnings as well as actual close-out/field/full/ZIP exports. These workflow changes are local and have not been deployed; production synchronization and authenticated staging acceptance were not revalidated in this iteration. See `AERIAL_WORKFLOW_AUTOMATION_PLAN.md` for the review and validation ledger.


