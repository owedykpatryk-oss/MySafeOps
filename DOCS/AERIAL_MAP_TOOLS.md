# Aerial map tools

The aerial survey workspace now uses the same Esri World Imagery tile service already used by other MySafeOps maps. **Streets**, **Satellite** and **Hybrid** change the background without editing the mission, moving saved points or resetting a drawing. Hybrid adds place/boundary labels. Attribution is displayed on the map. Imagery is a satellite/aerial mosaic: the acquisition date varies and is not verified by this screen. The app does not describe it as live imagery, an obstacle survey or an aviation briefing.

**Fit to areas** frames the visible geometry. The layer checkboxes hide or show survey, flight, contingency, safety and saved point layers without deleting anything. **Map tools → Go to coordinates** accepts decimal latitude, longitude and marks a temporary viewing location; it never assigns a take-off or landing point. **Download KML / GeoJSON** exports the selected saved layer at its current planning revision for GIS / Google Earth. It does not create an aircraft route. KML represents multipart polygons as a MultiGeometry; individual polygon geometry, holes and supported altitude modes are preserved. GeoJSON retains the original MultiPolygon structure.

## Import a boundary or operating layer

1. Choose a local KML, KMZ, GeoJSON or JSON file using **Import survey boundary**.
2. Review the feature names, geometry types, area/perimeter and selected geometry on the map. Basemap controls are available inside the preview.
3. Select the features to keep and an **Import into** destination. Survey boundaries accept polygons and lines; flight, contingency and safety areas require polygons. A take-off/landing destination accepts exactly one point and uses its horizontal coordinates.
4. When the destination already has geometry, explicitly check the replacement acknowledgement. Confirm **Import selected features**, or cancel without changing the mission.

Changing geometry goes through the existing planning edit flow: the revision advances and dependent checks/approval are reset. Import never copies a survey boundary into all operational areas automatically. A changed mission makes an open preview stale; reopen it before confirming. A failed save keeps the preview open with a retry/cancel message.

KML polygon holes and altitude coordinates remain in area geometry. Imported altitude does not define planned flight height; point destinations intentionally store only longitude and latitude. A line alone has zero area and still requires a separately reviewed corridor/flight area. Existing source limits apply: 2 MB file/expanded KMZ, up to 100 features, 2,000 vertices total and up to 500 coordinates per closed ring. WGS84 is required; map latitude is limited to -85…85 degrees. Projected coordinates, self intersections, malformed polygon shells, ambiguous point coordinates, NetworkLinks, entities, external overlays, models and tracks are rejected with a reason rather than silently fetched or approximated.

For UK missions, **Fill missing location from nearby postcode** is an optional lookup through the existing postcode API. It fills only blank location/postcode/country fields, respects a changed mission, and leaves existing text intact. Import itself has no postcode/network dependency.

If some map tiles cannot be loaded, the geometry remains visible and a retry control is shown. Downloaded geometry excludes basemap images. No new provider key, database schema, backend service or subscription was added. Live-provider availability and contractual usage rights remain separate from the local feature checks.

Technical sources: [Google KML reference](https://developers.google.com/kml/documentation/kmlreference), [Esri basemap attribution](https://support.esri.com/en-us/knowledge-base/what-is-the-correct-way-to-cite-an-arcgis-online-basema-000012040), [World Imagery service metadata](https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer?f=pjson). Checked 2026-10-29. Validation results and review decisions are recorded in `AERIAL_MAP_TOOLS_PLAN.md`.

## Validation

Completed locally on 2026-10-29: 138 targeted tests across 22 files, 22 desktop/mobile browser scenarios, lint, formatting and production build passed. Actual satellite/map and import screenshots were visually inspected. Review regressions cover coincident features with different names/altitude modes, 101-part multipart export/reimport, retained polygon drafts and point placement mode after failed saves. Existing build size/dynamic-import advisories remain. No production deployment or authenticated cloud acceptance test was performed for this iteration.
