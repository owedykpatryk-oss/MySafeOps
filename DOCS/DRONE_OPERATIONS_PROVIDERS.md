# Drone Operations sources and provider setup

Verified 29 October 2026. No subscription was purchased, no production environment changed and no provider credentials were copied into source code.

Australia uses a separate [CASA / Airservices source register and workflow](AERIAL_SURVEY_AU.md). NATS, CAA and GB location products below apply to the UK workflow. The commercial surface-weather adapter supports the documented UK/Australian coordinate bounds, displays timestamps in the selected operation time zone and separates its cache by region. It does not provide an aviation briefing or flight authorisation. AU helicopter decisions remain with the actual operator and pilot.

## Operational and course sources

- [CAA PDRA01](https://www.caa.co.uk/drones/specific-category/pdra01-operational-authorisation/) distinguishes an Operational Authorisation from supporting documents.
- [CAA Operations Manual guidance](https://www.caa.co.uk/drones/specific-category/pdra01-operational-authorisation/pdra01-operations-manual/) currently recommends CAP 2606 and describes the content expected of an operator manual.
- [CAA Remote ID guidance](https://www.caa.co.uk/drones/open-category/moving-on-to-more-advanced-flying/remote-id-rid/) has class-dependent transition dates. Do not assign a UK class from an EU class label. The application records a human review of the actual aircraft and operation rather than guessing applicability.
- [UK SORA AMC1 Article 11, October 2026](https://regulatorylibrary.caa.co.uk/2019-947/Content/Phase%202%20Magenta/Oct26Magenta_AMC1%20Article%2011%20Conducting%20a%20UK%20Specific%20Operation%20Risk%20Assessment%20%28UK%20SORA%29.htm) is an acceptable means of compliance; commercial operation is not, by itself, a reason to demand SORA.
- The private `BLANK OPERATIONS_MANUAL_TEMPLATE_ 4.1.docx` supplied by the user was inspected. It contains older references and course submission instructions. None of its instructions were executed, no email was sent and its protected text was not added to the shared commercial catalogue. The module uses original prompts.

## Provider matrix

| Function | Provider and current implementation | Coverage and limitations | Access / cost / rights |
| --- | --- | --- | --- |
| Hourly mission weather | Commercial Open-Meteo adapter at `/api/drone-weather`; upstream `https://customer-api.open-meteo.com/v1/forecast` | Up to three representative points; UTC hourly data, displayed in Europe/London; conservative 15-day request horizon; strict missing-value validation. Wind/gusts at 10 m. Exact model run unavailable in this endpoint response. Official warning feed not connected. | Paid commercial account and API key required. [Pricing](https://open-meteo.com/en/pricing), [API documentation](https://open-meteo.com/en/docs). Numeric subscription price was not established in the retrieved page: confirm current checkout price / quotation. Data attribution retained under CC BY 4.0. |
| Official aviation briefing | [NATS AIS](https://www.nats.aero/do-it-online/ais/), user opens the service and records evidence | Full route/area/height/time review remains the operator's task. No automatic NOTAM extraction or clearance inference. | No invented public API or scraping. User access and applicable AIS terms must be checked. |
| Licensed airspace / permissions candidate | [Altitude Angel GuardianUTM Cloud](https://www.altitudeangel.com/cloud-resource) | Product documentation advertises airspace layers, area reports and a flight gateway. Authority-specific availability applies. No contracted API is connected. | Requires quotation and an agreed API contract, coverage, cache and PDF redistribution rights. Do not configure guessed endpoints. |
| Existing location lookup | Existing MySafeOps postcode proxy and `reverseUkPostcode` | A nearest postcode is approximate; null results remain null, including unsupported or unresolvable locations. No address/ownership inference. | Reuses current app provider; production use must retain its existing licensing assessment. No additional key introduced. |
| Optional GB gazetteer | [OS Names API](https://www.ordnancesurvey.co.uk/products/os-names-api), evaluated but not connected | Great Britain, not complete UK coverage; not a full-address product; quarterly data updates. | OS OpenData plan advertised free; [terms](https://osdatahub.os.uk/legal/termsConditions) still govern use. Northern Ireland needs a separate supported source. |
| Weather alternative | [Met Office DataHub](https://datahub.metoffice.gov.uk/docs/getting-started), evaluated but not connected | Site-specific forecast and warning products; warning coverage includes Northern Ireland. | [Published pricing](https://datahub.metoffice.gov.uk/pricing/site-specific): Global Spot 900 calls/day £9/month; 3,600 calls/day £32/month, excluding VAT. Product-specific account, credentials and terms required. No automatic fallback. |
| Interactive map and PDF | Leaflet streets / Esri World Imagery; PDF retrieves a bounded World Imagery static map with operating geometry overlaid in Web Mercator | Visual reference only. Capture date unverified; no authoritative airspace, obstacle or terrain layer. PDF records retrieval time and falls back visibly to a vector schematic on failure. | Attribution retained. [Esri static-map terms](https://doc.arcgis.com/en/arcgis-online/reference/static-maps.htm) permit static maps in customer reports with attribution; other uses, including direct resale of maps, require separate assessment. OSM tile policy still applies to interactive streets. |
| Terrain / obstacles | Not connected | No AGL/AMSL/FL conversion inferred and no assertion that missing obstacles are absent. | Requires verified coverage, resolution, licence and cost before integration. |

## Weather configuration

1. Obtain a commercial Open-Meteo subscription suitable for the intended SaaS usage and confirm storage/export terms. No free endpoint fallback exists in this module.
2. Configure server-only `DRONE_OPEN_METEO_API_KEY` and `DRONE_WEATHER_COMMERCIAL_LICENSE_CONFIRMED=true` in the API hosting environment. Never prefix these with `VITE_`.
3. Optionally set `DRONE_WEATHER_INSTANCE_DAILY_LIMIT` (default 100, maximum 1000 upstream attempts per server instance per day). This is not a durable global quota. Configure provider-account spending controls and a durable shared budget before scaling to multiple instances.
4. Reuse the existing server Supabase URL and anonymous/publishable key configuration (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, or existing server fallbacks). Requests verify the user token and the current organisation/country role and billing through the existing RPC. No service-role credential is needed.
5. Fetch a forecast from a mission with a flight area and valid operating window. Test missing key, expired session, invalid request, missing data, 429, timeout and upstream failure. Missing credentials must display Not connected.

The adapter makes at most two attempts with 8-second timeouts, bounds response and request size, limits points and variables, separates tenant cache keys, caches for 15 minutes and never logs tokens or provider URLs containing keys. Its local cache and rate limits are per process; the provider account remains the global billing boundary. No SLA is promised by MySafeOps. Open-Meteo advertises a 99.9% uptime target for paid plans, not a guarantee made by this module.

## Aircraft evidence

- [Matrice 350 RTK specifications](https://enterprise.dji.com/matrice-350-rtk/specs): supported DJI payloads and environmental specification; the catalogue does not turn published maximum wind resistance into a mission permission.
- [M300 / M350 accessory matrix](https://dl.djicdn.com/downloads/matrice-300/20241016/Accessory_Compatibility_List_for_M300_RTK_and_M350_RTK_ENIIII.pdf): controller and firmware restrictions.
- [Mavic 3 Enterprise specifications](https://enterprise.dji.com/mavic-3-enterprise/specs): 3E RGB/photogrammetry and 3T thermal are separate profiles.
- [Zenmuse L2 support](https://www.dji.com/support/product/zenmuse-l2): supported aircraft, controller and mounting conditions.

The starter set has four aircraft model profiles and five payload profiles. It is deliberately not a complete manufacturer catalogue. Organisation administrators can add independently reviewed versions with explicit sources. Existing mission snapshots retain the profiles used at issue time.

## First local test mission

Open `/app?view=drone-operations` or More → Insights & reports → Drone Operations in a UK workspace. Create project/person/aircraft/RAMS records in the existing registers first. Create a mission, import a self-contained KML/KMZ/GeoJSON, draw a separate flight area and mark the take-off point. Choose the window, survey type, actual aircraft, compatible model/payload and pilot. Confirm the actual class, take-off mass, height and pathway.

Complete the survey QA and emergency arrangements, link RAMS and the reviewed manual where applicable. Fetch available commercial weather or record a current manual weather assessment. Record every evidence category with source, reviewer, UTC check time and expiry covering the whole window. Complete planning and physical site checklists only when actually performed. A named admin/supervisor confirms current on-site conditions, issues a snapshot and downloads the PDF. A draft PDF remains available while actions are outstanding.

For dev QA, use synthetic evidence only in an isolated local browser. Never use test evidence for an actual flight. The implementation does not create flight-controller files, autonomous flight plans, CAA certificates or external notifications.
