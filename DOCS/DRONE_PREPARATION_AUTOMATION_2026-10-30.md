# Drone preparation automation

The user delegated implementation choices and asked to speed up existing drone workflows. Build on the current React module, saved missions and authenticated commercial weather endpoint.

Planned changes: reuse selected planning inputs from a previous mission in the same project and region; duration presets with timezone-aware end times and final validation; clearer weather freshness and optional refresh while reviewing a draft. Keep approvals, evidence, checklist confirmations and operational history independent for every mission. Recheck source versions before creating a prepared mission. Never substitute the site boundary for a confirmed flight area.

Verify with focused unit/component tests, existing drone/API regression tests, a production build and local browser scenarios. No deployment or production mission modification is part of this change.

## Implemented

- Mission preparation can reuse an existing mission from the same project, country and aircraft type. An explicit allowlist copies crew/equipment, geometry and planning inputs. A source-version check rejects a changed, deleted or cancelled source before saving. A changed survey template supplies new QA/deliverables instead of carrying incompatible text.
- Each prepared mission starts with fresh evidence, weather, approvals and field history. Weather-limit and corridor confirmations are reset. The source ID, revision and title are recorded as preparation provenance.
- Duration choices (30 minutes, 1, 2, 4 or 8 hours) calculate the end in the operation time zone. Users can override it manually. Partial, reversed, nonexistent or ambiguous local date/time entries are blocked; both dates can remain blank for an undated draft.
- The weather panel shows freshness and removes candidate windows when a forecast expires. Optional refresh runs only in an editable, unapproved draft while the panel is visible and online. Requests are coalesced with a one-minute retry floor, and provider/storage errors switch automatic refresh off. Late responses to edited missions are discarded. Existing authenticated provider routing, server cache and rate limits are preserved.
- Failed mission creation/copy stays in the current screen. A successful retry clears the previous save error. On mobile, the weather table scrolls inside its card instead of stretching and clipping the surrounding grid.

## Verification

- 138 passing tests across 24 drone and weather API test files, including 13 new preparation/freshness/UI cases. Covers UK and Australian DST, copy isolation, invalid schedules, forecast expiry, offline/hidden-tab refresh, provider/storage failure and late responses.
- ESLint: no errors or warnings in the eight changed JavaScript/JSX files.
- Vite production build passes; existing large-chunk advisory remains.
- Local Playwright Chromium: prepared-mission flow at 1365px and 390px, storage failure/retry, persisted reuse with fresh checks, expired-weather display and card-boundary checks. Screenshots reviewed; no runtime errors on valid fixtures. Browser script: `output/drone-preparation-qa.mjs`; results: `output/drone-preparation/results.json`.
- Browser and automated API scenarios use isolated local fixtures/mocks. This work does not verify live provider credentials, production deployment or Microsoft Edge.
