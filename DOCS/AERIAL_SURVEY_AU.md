# Aerial Survey Operations — Australian workflow

Implementation and source review: 29 October 2026. This extends the existing UK Drone Operations module. It does not change an organisation's country, create a new aircraft registry, purchase services or deploy anything.

## Open the module

Choose an existing **Australian country workspace**, then More → Insights & reports → **Aerial Survey Operations**. The stable view is `/app?view=drone-operations`. UK workspaces retain the Drone Operations title and UK workflow. Other markets remain disabled for this module.

New Australian missions default to crewed helicopter unless an organisation default drone setup exists. Choose **Drone / RPAS** or **Crewed helicopter** explicitly in Mission & map. Choose the actual operation time zone: Sydney, Melbourne, Brisbane, Adelaide, Darwin, Perth, Hobart, Lord Howe or Eucla. No Australian zone is silently assumed. Repeated local clock times require the earlier/later occurrence; nonexistent times are rejected. UTC remains explicit on check and decision evidence.

## Helicopter survey coordination

1. Link an existing project, import or draw the survey boundary, define the flight area and landing point with the operator, and set the date/window.
2. Choose **Contracted aviation operator** or **Our organisation is the aviation operator**. Both require the actual operator, certificate/scope reference, named pilot, aircraft registration/type, task specialists, sensor/installation details, operator manual reference and loading/fuel/maintenance confirmation.
3. Select the survey lead from People. Own-operator missions also link People and Plant records for the pilot and aircraft. Contracted aircraft and pilots are mission references; no duplicate company fleet/pilot register is created. A Plant inspection is not treated as an aircraft maintenance release.
4. Record operator-agreed landing/access, communications/stop-work, remote-area assistance and overdue-response arrangements. Link the existing survey-team RAMS/SWMS risk record. The application does not determine that every survey requires a statutory SWMS.
5. Obtain the actual operator/pilot aviation briefing, permissions, competence and equipment confirmations. Record source, reviewer, check time, validity, findings and an existing Document Library reference where available. Surface forecasts are supplementary site information, not helicopter flight minima or an aviation weather briefing.
6. Complete applicable planning/site coordination checks when actually performed. Later flight/debrief items remain available.
7. In Review & PDF, record the named operator/pilot decision, retrievable reference, UTC time, validity covering the complete window and conditions. This is an evidence record, not an electronic signature by the operator. A content fingerprint binds it to the mission, evidence and checklist; changing these or copying the mission requires the decision to be recorded again. Server readiness also checks that binding. It is a consistency check, not authentication of the external operator.
8. A named authorised user confirms site conditions and records **Survey coordination reviewed**. The resulting **Helicopter Survey Coordination Pack** is an immutable snapshot. Its header says **COORDINATION REVIEW**. Aircraft release, airworthiness and flight decisions remain with the operator and pilot in command.

The supported helicopter pathway is a reviewed CASA Part 138 aerial-work scope. Private/scenic/air-transport operations and their distinct requirements are not implemented. No flight performance, fuel, loading, separation or low-level approval limits are calculated or invented.

## Australian drones

The drone workflow retains catalogue compatibility, aircraft inspections, actual mass, pilot selection and conditional checklists, with CASA-specific evidence prompts and sources. Select a reviewed ReOC operation, reviewed excluded category, or another reviewed CASA approval. Registration/ARN references replace the UK Operator ID field. UK aircraft-class selection and CAA/SORA/PDRA prompts do not appear as Australian requirements.

A ReOC mission requires a reviewed Australian drone manual version. Excluded-category eligibility, registration, accreditation/licensing and operational conditions are explicitly reviewed; no rule infers that all paid drone work requires a ReOC. The UI does not automatically verify authenticity or eligibility from document names or dates.

## Manuals and shared improvements

The [document preparation workflow](AERIAL_DOCUMENT_AUTOMATION.md) adds guided creation, conditional planning sections, source-assisted entry from PDF/DOCX/TXT, provenance and focused draft exports. It also distinguishes locally recorded reviews from cloud-confirmed issued snapshots.

- Australian manuals have explicit applicability: drone operator procedures or helicopter survey coordination. Reviewed versions are locked. A coordination plan is separate from the aviation operator's actual manual. Sources and verification dates are included in its PDF.
- UK legacy records default to UK/drone applicability. New region/mode metadata is retained in snapshots; a manual for another region or aircraft kind cannot satisfy the mission's manual check.
- Custom checklists carry region and aircraft applicability. Manufacturer compatibility profiles remain separate from regulatory eligibility.
- Mission list now shows evidence, forecast and operator-decision expiry/recheck reminders for the next seven days. They update while the module is open; they are not a background monitoring service or external notifications.
- Next actions link directly to the relevant mission section.
- Evidence entered across a minute boundary is evaluated against the current clock, avoiding false future-date flags from the idle refresh timer.
- Newly issued snapshots have server-validated regional sources, checklist definitions, rule version and equipment catalogue. Existing immutable issues retain their historical content.

## Sources and external connections

| Function | Source / access | Implemented boundary |
| --- | --- | --- |
| Helicopter aerial work | [CASA Part 138](https://www.casa.gov.au/rules/regulatory-framework/casr/part-138-casr-aerial-work-operations), [aerial photography guidance](https://www.casa.gov.au/licences-and-certificates/air-operators/aerial-photography-aircraft) | Human verification of actual classification, certificate scope and applicable Part 91/138 conditions. No certificate-verification API claimed. |
| Australian RPAS | [CASA categories](https://www.casa.gov.au/drones/operator-accreditation-certificate/drone-weight-categories-and-requirements), [AC 101-01 licensing and operations](https://www.casa.gov.au/sites/default/files/2022-09/advisory-circular-101-01-remotely-piloted-aircraft-systems-licensing-and-operations.pdf) | Versioned review prompts. Actual aircraft/operation eligibility requires review. |
| Aviation briefing / NOTAM | [Airservices Australia NAIPS](https://www.airservices.gov.au/naips/Documents/About) | Official external briefing route and manual evidence. User access/terms required. No scraping, credentials stored by MySafeOps, automated NOTAM intersection or flight notification submission. |
| Surface weather | Existing commercial Open-Meteo adapter and server-only keys documented in `DRONE_OPERATIONS_PROVIDERS.md` | UK and Australian supported coordinate coverage validated separately; tenant cache includes region. Australia's supported box covers mainland/Tasmania/Lord Howe, not every external territory. No live paid call was made. |
| Location/maps | Existing OSM reference map, imported WGS84 geometry and project location | UK postcode lookup is not called for Australia. No fabricated Australian reverse-geocoding result. Terrain/obstacles and authoritative aviation map layers remain unconnected. |

No new account, key or licence is needed for the manual coordination workflow. Automatic weather requires the already documented commercial subscription. NAIPS access is obtained directly from Airservices under its applicable terms; no API price or redistribution licence has been inferred. Licensed automated airspace, terrain, obstacles, official warning feeds, background monitoring and authenticated staging acceptance remain external/unimplemented work.

## Verification

Final local verification: **84 unit/server tests and all 8 desktop/Pixel 7 browser scenarios passed**, and the production build passed. Tests cover regional time conversion, DST ambiguity/gaps, geographic scope, own versus contracted helicopter requirements, decision validity/content binding, manipulated snapshot metadata, manual/library applicability, Australian drone pathways, PDF source separation and expiry reminders. Browser tests exercise UK and AU manual review, approval blocking, issued PDF and copy reset. All 8 pages of the sample pack and 2 pages of the sample manual were rendered and visually inspected, with no off-page text. Independent review findings were fixed and covered by regression tests. Logs and limitations are recorded in [the implementation ledger](DRONE_AU_EXTENSION_PLAN.md).

All files under `output/drone-qa/` use synthetic QA data. They are not evidence for an actual operation.
