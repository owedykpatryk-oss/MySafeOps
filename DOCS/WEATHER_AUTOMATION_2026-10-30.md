# Weather workflow automation

The user asked why forecast retrieval requires so many clicks. Existing authorisation delegates routine implementation choices and deployment of improvements.

- Default automatic forecast retrieval while the weather panel is visible, online and editable. No request before a valid explicit flight area, date/time, regional coordinates and provider forecast horizon are available. Retains request coalescing, expiry refresh, cooldown, failure stop and stale-response rejection.
- Persist a user's opt-out on the mission; removing the forecast for manual evidence also pauses automation. Approval and operating-limit confirmation remain manual.
- Explain missing inputs before the request, disable the unavailable fetch action and offer direct navigation to Mission & map. No implicit conversion of a survey boundary into a flight area.
- Reuse complete saved weather limits only for a matching country, aircraft, equipment profile and payload configuration, with confirmation reset.
- Replace the unconditional “Commercial Open-Meteo connection required” message with actual workflow state. Provider connection errors appear only following a failed request.

Production environment metadata inspected without decrypting or displaying values: `OPENWEATHER_API_KEY` exists for preview and production. `DRONE_OPEN_METEO_API_KEY` and `DRONE_WEATHER_COMMERCIAL_LICENSE_CONFIRMED` are absent. Ordinary weather and detailed mission forecasts use separate integrations. These UI improvements do not establish a working commercial forecast connection; provider setup remains outstanding. No licence purchase or environment-secret change is part of this work.

Verification: 146 drone/API tests in 26 files passed, including automatic start, missing inputs, saved opt-out, provider failure, hidden/offline pause, late responses, horizon/region validation and unconfirmed reuse of equipment limits. Local desktop/mobile browser flows and lint passed. Production build completed successfully.

Published Vercel release: `dpl_ANzPzgfu5gQRZB4GNSULgQbJGG1i`, https://mysafeops-r4j4b9i6i-patryks-projects-12c8ccbe.vercel.app. Built from `output/deploy-weather-20261030`, checked READY and health 200, then promoted. Previous release for rollback: `dpl_62benSR6wCDTfgQTsRpXak222BqC`. No Cloudflare or Supabase source changes in this iteration.
