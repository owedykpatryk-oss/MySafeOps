# Aerial map and boundary tools

Intent: implement the user's requested satellite preview and boundary import improvements autonomously in the existing aerial survey workspace. Keep React, Leaflet, existing validated KML/KMZ/GeoJSON parser and existing Esri World Imagery integration pattern. No paid account, new runtime dependency, database migration or deployment is required for this iteration.

Design choice: extend the current map instead of introducing a separate GIS editor. Streets / Satellite / Hybrid switch preserves overlays and drawing. Add layer visibility, fit-to-areas, explicit coordinate navigation, load-error feedback and selected-layer KML/GeoJSON downloads. Satellite tiles are contextual imagery, with attribution and an unknown capture-date notice; no live imagery or airspace assessment claim. Use existing CSP-approved Esri endpoints; do not copy imagery into PDFs.

Boundary import becomes a staged operation: parse locally, show features and measurements on a preview map, select objects and destination, explicitly confirm replacement. Polygon holes and altitude metadata remain in the geometry. Point destinations accept one point, polygon-only operational areas reject lines, and survey boundaries may include survey lines. Existing data is untouched on cancel, parse failure, invalid selection, failed save or a stale mission token. No implicit conversion from survey boundary to flight/safety area.

Tasks and interfaces:
1. Add pure `mapTools.js` helpers for selected-feature validation, destination patches and escaped KML/GeoJSON downloads. Tests cover holes/altitudes, mixed collections, incompatible destinations, XML escaping and geographic validation. Tighten malformed KML topology handling in `droneGeometry.js`. Run failing tests before implementation, then targeted Vitest.
2. Add `BoundaryImportDialog.jsx` and replace immediate import in `DroneOperations.jsx` with preview/confirm. Use existing `persist(editMission(...))`, exact mission edit token and workspace lifetime guard. Existing postcode lookup remains explicit post-import enrichment and must not overwrite entered location fields.
3. Extend `DroneMap.jsx` with provider switching, visibility controls, fit, coordinate navigation and layer export; add responsive styles. No basemap action mutates the mission. Add browser assertions before implementation and verify failures.
4. Update existing browser import flows; cover cancellation, real mixed KML/KMZ import, target replacement, stale preview, downloads, invalid file, satellite tile failure and map state on desktop/mobile. Run module tests, browser suite, lint, formatting, build, inspect screenshots, and obtain one fresh final reviewer as required by executing-plans.

Pre-flight: task 1 returns a validated patch consumed by task 2; task 3 uses the same destination labels and export helper. Preview map is read-only but permits basemap/navigation controls. Export never grants flight approval. No geometry schema change is needed.

Ruling: preserve the current uncommitted feature branch and unrelated dirty files — the requested work continues the existing module; copying only HEAD would discard prior work. No commits are authorised. Keep this plan as the durable ledger rather than commit-based task scripts.

Sources checked 2026-10-29: Google KML reference https://developers.google.com/kml/documentation/kmlreference ; Esri attribution https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basema-000012040 ; live World Imagery service metadata https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=json (copyright: Esri, Vantor, Earthstar Geographics, GIS User Community). This reuses the public service already used elsewhere in MySafeOps; it does not provision a new ArcGIS account or promise commercial usage entitlements.

Task 1 complete: 15 focused geometry/map tests passed, then 136 module/support tests across 22 files. The three malformed KML cases failed before the parser fixes (`output/map-parser-red.log`). Existing geometry import limits remain unchanged.

Tasks 2–3 complete: staged selectable import with explicit replacement, satellite/hybrid backgrounds, independent visibility, fit/coordinate navigation and per-layer KML/GeoJSON downloads. Postcode enrichment is now an explicit optional action and fills only empty fields. This avoids a network request on import and prevents overwriting manually entered site details.

Task 4 in progress: initial four map browser scenarios passed on desktop/mobile (42.4s); two additional stale-preview / failed-save / replacement scenarios passed (14.7s). Failed-save feedback originally appeared behind the modal; the regression failed first (`output/map-save-red.log`), then passed after adding an inline notice. Browser source coordinates are fictional test geometry; actual Esri tiles loaded in the satellite screenshot. Fresh final read-only review dispatched; full browser suite, lint/build and final visual inspection pending.

Final review: one fresh gpt-6-astra read-only review identified three important fixes: retain the drawn draft on failed persistence, preserve coincident features with distinct retained metadata, and reimport valid multipart KML without expanding beyond the feature limit. Regressions for the latter two reproduced the failures (`output/map-review-red.log`); one fix pass is in progress. No minor findings were deferred.

Final: Ruling: existing imagery service reuse does not establish commercial entitlement or production availability — this iteration adds no subscription and is verified locally; an unavailable provider shows a retry message while geometry remains usable. Production provider failure remains possible.

Final: Ruling: aviation permissions and operator decisions remain governed by the existing workflow — these are map and geometry tools, not flight-release controls; imagery cannot establish current site safety.

Final: Ruling: unrelated dirty files and broader cloud synchronization remain unchanged — using the existing persistence path avoids a new schema, but local tests do not establish authenticated production sync acceptance.

Final: Ruling: parent browser and visual checks are the acceptance evidence for appearance — the reviewer did not duplicate them; final results must be recorded after the fixes.

Final: fixed lost drawing draft — desktop regressions for both polygon and point saves failed (`output/map-drawing-red.log`), then all four desktop/mobile retry scenarios passed in 25.0s (`output/map-drawing-green.log`). Polygon corners remain available and point placement mode stays active when persistence fails; completion occurs only after a saved mission is returned.

Final: fixed metadata deduplication and multipart round-trip — both pure regressions failed first, then the complete targeted suite passed 138 tests across 22 files (`output/map-review-green.log`). Deduplication now compares retained feature metadata as well as coordinates; polygon-only multipart placemarks with one altitude interpretation stay MultiPolygon within existing limits. Mixed altitude interpretations remain separate.

Before the final review fixes, all 18 end-to-end scenarios passed in 4.6m. A final 22-scenario run, including drawing retries, is now in progress. No second reviewer was dispatched.

Completed 2026-10-29: final 22 desktop/mobile browser scenarios passed in 4.8 minutes (`output/map-final-browser.log`). All 138 targeted tests across 22 files passed after the review fixes. ESLint and Prettier passed; production build passed in 38.37s (`output/map-final-build.log`), retaining existing dynamic-import/large-chunk advisories. Reviewed the updated desktop/mobile import dialog and satellite-map screenshots, including real Esri imagery, holes, landing marker, attribution and responsive controls. Browser downloads verified KML/GeoJSON content and hole preservation. Existing issued/draft PDF, seven-document ZIP, Australia/operator, field-session and organisation-isolation browser flows passed as part of the final suite.

All planned tasks complete locally. No new account, subscription, credentials, schema, commit or deployment. Final review findings all fixed; no deferred minor findings. Existing production is unchanged by this iteration. Feature guide: `AERIAL_MAP_TOOLS.md`.
