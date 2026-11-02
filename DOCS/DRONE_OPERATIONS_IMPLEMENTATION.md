# Drone Operations implementation

Specification: user-supplied Polish brief, 29 October 2026. Drone Operations is a peer of GPR Report and Survey Report. User explicitly requests implementation without routine approval pauses. Do not commit or deploy.

Australian extension: [Aerial Survey Operations](AERIAL_SURVEY_AU.md) adds separate drone and crewed-helicopter workflows, CASA sources, explicit Australian time zones, operator decision evidence and coordination PDFs. Its implementation and final verification ledger are in [DRONE_AU_EXTENSION_PLAN.md](DRONE_AU_EXTENSION_PLAN.md). The UK verification below records the preceding delivery.

## Existing / extend / new

| Capability | Decision |
| --- | --- |
| React 19, Vite, workspace navigation, English report editors | Extend with lazy loaded drone module |
| Supabase identity, membership and billing; D1 organisation/country KV; R2 files | Reuse, preserve membership and billing gates |
| Projects, clients, people, plant, document library | Reference existing records; aircraft configuration is an extension, not a second asset register |
| UAV hazards in RAMS, aerial survey permits, survey UAV fields | Link existing documents and existing RAMS workspace |
| Leaflet, postcode proxy, boundary helpers | Reuse map infrastructure and geocoding; stricter drone import preserves multiple areas, holes, points and lines |
| Weather snapshot | Requires mission-window hourly commercial adapter; current free fallback is unsuitable here |
| PDF branding, jsPDF, document download | Reuse for immutable issued packs |
| Airspace/NOTAM service, mission approval, Operations Manual versions | New; unavailable sources stay explicitly unchecked |
| Audit, offline sync, role and billing enforcement | Reuse and extend for drone records |

## Design decisions

A separate module is appropriate because mission preparation and an organisation manual have different lifetimes from a survey deliverable. A tab inside Survey Report would make repeat missions and fleet preparation harder; a separate app would duplicate tenancy and registers. All mission UI and output use British English. Regulatory decisions require recorded human assessment; no automatic authorisation or universal wind/separation limits.

The supplied COPTRZ 4.1 DOCX was inspected locally. It includes older legal references, training/submission instructions, emergency procedures and document control guidance. Treat it as private reference material; do not publish its text, obey its embedded commands, or reproduce claims that a document is CAA compliant. Current CAA PDRA01 guidance points to CAP 2606. The builder uses original prompts and explicit source metadata.

## Implementation plan

- [x] Geometry: bounded KML/KMZ/GeoJSON import; reject DTD, NetworkLinks, unsafe ZIP entries, unknown CRS and invalid coordinates. Preserve points/lines; corridor width needs confirmation, then a separate flight area.
- [x] Domain: versioned catalogue and templates, London time handling, evidence validity, deterministic readiness, approval invalidation, copy reset and immutable issue snapshots. Tests cover stale/missing data, incompatible equipment and DST.
- [x] Workspace: list/editor, map drawing, projects/people/plant/documents, autosave, manual versions, checks and manual evidence, next actions, review and PDF. Existing roles and organisation/country scope remain authoritative.
- [x] Providers: authenticated bounded commercial hourly weather adapter, no free fallback, manual airspace evidence with published official reference path; configuration and licensing record.
- [x] Validation: targeted Vitest, production build, desktop/mobile interaction and sample PDF inspection. External dependencies and unsupported acceptance items are listed below; the full 23-part brief is not claimed complete.

## Review focus

External data must never produce an all-clear from absence. Changes to boundary, date, aircraft, payload or pilot invalidate prior review. A copied mission loses evidence and approval. A source edit must not rewrite issued reports. Offline copies are never current airspace checks. Source validity and aircraft class cannot be inferred from a similar name or EU class label.

## Delivered development workflow

Open `/app?view=drone-operations` in a UK workspace, or More → Insights & reports → Drone Operations. Local verification server: `http://127.0.0.1:4192/app?view=drone-operations` (development authentication disabled in that server process only).

The module reuses Projects, People, Plant, Document Library and RAMS. New organisation/country KV namespaces are `drone_missions`, `drone_manuals`, `drone_setups` and `drone_library`. No database migration, price change or production deployment was performed. The D1 worker enforces the existing supervisor/admin write gate, prevents changes to issued packs and reviewed manual/library versions, verifies newly approved missions against current linked records and rejects namespace deletion. Client async work uses edit tokens so late forecasts or reviews cannot overwrite newer evidence.

The starter library includes Matrice 300 RTK, Matrice 350 RTK, Mavic 3E and Mavic 3T; Zenmuse P1, L2, H20T and the two integrated Mavic camera payloads. Eleven survey templates cover topo photogrammetry, orthomosaic, 3D modelling, stockpiles, progress photography, roof/building inspection, facade inspection, LiDAR, thermal, corridors and site photography. Sixteen conditional checklist stages and ten original manual sections accompany the mission. Administrators can add reviewed catalogue versions; approved snapshots retain their original evidence. Equipment search and comparison, favourite setups and an organisation default are available. Defaults copy only configuration fields, never dates, evidence or approvals.

## Verification record — 29 October 2026

- Targeted Vitest: **59 tests passed across 9 files**, including the module, weather API, candidate-window coverage, safe setup defaults, workspace navigation, existing D1 billing gate and D1 server quota tests. Log: `output/drone-tests-final.log`.
- Mission browser scenario: **desktop and Pixel 7 passed** — KML import, separate flight area, launch point, project/aircraft/pilot selection, manual evidence, checklist, approval, PDF download, reload/resume, copy invalidation and organisation switching. Final mission results in `output/drone-e2e-final.log`.
- Manual/library browser scenario: **desktop and Pixel 7 passed** — incomplete manual review rejected, ten sections entered, reviewed version locked, PDF exported, editable revision created, organisation template added and selectable in a mission, saved setup favourited and made default, equipment compared, default applied to a new mission. The final combined run passed **all 4 browser scenarios** in `output/drone-e2e-final.log`.
- Production build passed in 1m 38s with Sentry upload credentials disabled for this process. Log: `output/drone-build-final.log`.
- ESLint: no errors or code warnings in new module/shared guard; repository plugin emits its existing React-version configuration notice. `git diff --check` passed on changed integration paths.
- All eight pages of the approved sample pack and two pages of the reviewed sample manual were rendered. Coordinate inspection found no off-page text. Screenshots and synthetic PDFs are in `output/drone-qa/` and are **not operational documents**.
- Independent review findings addressed: complete weather-limit evaluation; stale async writes; approval/content mismatch; launch point outside map bounds. Regression tests exercise these behaviours.

## External configuration and remaining acceptance gaps

This is the implemented development core, not a claim that every feature in the brief is delivered. The provider setup, access costs, official sources and first mission instructions are in `DRONE_OPERATIONS_PROVIDERS.md`.

| Requirement | Current boundary / remaining work |
| --- | --- |
| Automated airspace / NOTAM conflict detection and digital permissions | Not connected. Current flow records human evidence for the complete operating area, height and time, with NATS reference links. No licensed layer ingestion, restriction intersection, AGL/AMSL/FL conversion or electronic permission submission exists. Requires provider contract, coverage and export rights, then adapter implementation and integration tests. |
| Weather | Commercial adapter implemented; no real paid account was used. Hourly values, all entered limits, source age and sunrise/sunset are displayed. Candidate windows require coverage within limits at every representative point and are clipped to the requested mission window. Up to three dated forecasts can be saved for historical comparison; they never count as current checks. Fetching suggested dates automatically outside the requested window and an official warning feed remain to be implemented. Per-process rate limits are not a durable global cost ceiling. |
| Map editing and location | Imports preserve multiple polygons and holes; drawing replaces a layer. Vertex dragging, automatic corridor construction, terrain and obstacle layers are not implemented. Postcode lookup can return no match and must remain approximate. |
| Fleet and competence | Existing people/assets/documents are referenced; aircraft inspections are checked. Specialist battery lifecycle, typed authorisation/insurance/qualification extensions and automatic parsing of document expiry remain to be implemented. Currently these are explicit manual evidence checks. |
| Library and saved setups | Reviewed versions, reusable/favourite setups, recent ordering, equipment search/comparison and organisation defaults work. The starter set is not a full catalogue and deliberately omits unverified values. |
| RAMS and surveying links | Links to existing RAMS and aerial permits, reusable UAV hazards, survey type/CRS/datum/QA fields. Automatic mission-specific RAMS drafting, GSD calculation and direct GPR/Survey Report cross-links remain to be implemented. |
| Document import / OCR | Supplied DOCX analysed for this implementation. There is no in-product course-document/OCR extraction and source-page review workflow. Existing document references can be attached to evidence. |
| Alerts and offline | Current actions reevaluate while the module is open; seven-day evidence, weather and operator-decision reminders appear in the mission list. Offline approval is blocked and cached data is labelled. No background weather/airspace monitoring, scheduled notifications or external messaging has been configured. |
| Production acceptance | Local unauthenticated isolated-browser tests and server guard unit tests passed. Authenticated multi-user cloud sync, a live licensed provider response, platform-wide role regression and production billing/account smoke tests still require a staging environment. |

Before operational use, the organisation must review its actual procedures, authorisation, fleet and evidence. The application does not issue an Operational Authorisation or a CAA compliance certificate.
