# Satellite PDF and area briefing preparation

PDF maps previously drew vector geometry only, independently of the interactive satellite switch. The pack and field sheet now await one bounded Esri World Imagery static-map request. Operating geometry and imagery share Web Mercator bounds and aspect ratio; all operating layers and landing points fit inside the frame. Retrieval time, source attribution and the unverified acquisition date appear beside the image. New imagery is explicitly not historical approval evidence. The immutable mission snapshot remains unchanged. Provider failure, offline use or timeout produces a labelled geometry-only map, not a failed document or a claim that satellite imagery was included.

Checks and permissions now automatically prepares a briefing request from the flight / contingency / safety areas, landing points, operation UTC window and height reference. Survey boundaries are explicitly provisional if no separate flight area exists. Users can copy the request or download a combined named KML. The same request context appears in the full PDF. Nothing in this preparation marks a NOTAM check complete or grants clearance. A failed evidence save now retains the entered fields for retry.

Live NOTAM and restriction data are **not connected**. Public map imagery and a KML do not supply these data. Official sources reviewed on 30 October 2026:

- [NATS AIS](https://www.nats.aero/do-it-online/ais/): official UK aeronautical information and briefing access.
- [CAA airspace restrictions](https://www.caa.co.uk/drones/open-category/moving-on-to-more-advanced-flying/airspace/airspace-restrictions/): coverage of apps and required permissions must be understood.
- [Airservices flight briefing](https://www.airservices.gov.au/industry-info/flight-briefing/): NAIPS provides NOTAM briefing products.
- [Airservices RPAS integration](https://www.airservicesaustralia.com/industry-info/unmanned-aerial-systems-in-controlled-airspace/): FIMS currently does not provide NOTAM or AIP SUP data.
- [NAIPS access terms](https://www.airservices.gov.au/naips/Account/Logon): commercial reuse / redistribution requires prior written consent.
- [Altitude Angel](https://www.altitudeangel.com/cloud-resource): potential contracted airspace / area-report integration; no credentials or commercial coverage agreement available in this task.
- [Esri static-map use](https://doc.arcgis.com/en/arcgis-online/reference/static-maps.htm): reports with appropriate attribution are supported.

Validation: 144 drone tests passed across 27 files, plus the evidence save/retry regression test. Lint passed. Real Chromium export included an embedded satellite image in the full pack and field sheet; request failure produced a valid schematic PDF. Both map PDFs were rendered with Poppler and visually inspected. Local desktop/mobile checks verified derived context, KML download and no page overflow / JavaScript errors. Samples and scripts are under `output/pdf/` and `output/*imagery*` / `output/airspace-ui-qa.mjs` (excluded from deployment).

Published Vercel release: `dpl_BeoTmjiCDHuYyDmGoU5zBYYAg5wu`, https://mysafeops-ha69lwhz2-patryks-projects-12c8ccbe.vercel.app. Production build READY, protected health 200, then promoted to the public domain; all seven public ops smoke checks passed. Release source snapshot: `output/deploy-imagery-20261030` (1,630 files with an external SHA-256 manifest). Previous release for rollback: `dpl_ANzPzgfu5gQRZB4GNSULgQbJGG1i`. No database, Cloudflare or secret changes were required.
