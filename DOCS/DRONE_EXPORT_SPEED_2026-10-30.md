# Faster planning and complete draft downloads

The user delegated further improvements and deployment. This increment reduces repeated map work and makes draft-package exports clearer.

- An explicit `Use survey boundary as flight area` action copies validated polygon-only boundaries, including holes. It does not overwrite an existing flight area, convert lines into polygons, grant approval or confirm weather limits. The normal mission mutation invalidates prior checks affected by the geometry change. Failed saves keep the action available.
- One export session shares the same satellite request and image between the full PDF and field sheet. Concurrent identical geometry requests coalesce; different extents and later exports use separate requests. No persistent or cross-account cache is introduced. An unavailable image produces one warning and a consistent schematic fallback across the package.
- Export progress identifies the document being generated. Completed exports report map warnings in the app and use mission / revision filenames.
- Draft ZIP format is now `mysafeops-draft-bundle/3`: seven PDFs, `09-airspace-briefing-request.txt`, `README.txt`, `manifest.json`, and `08-briefing-area.kml` where a valid mapped area is available. Every document and supplementary file has a SHA-256 manifest entry. Oversized or invalid combined KML is omitted with an explicit warning while retaining the PDF package. These are planning data; no live NOTAM feed was added.

Validation: 150 drone unit tests passed; additional bounded-KML regression passed after its change. Changed files pass ESLint. Browser QA verified a failed map save and retry, mobile layout, one image request for the entire real seven-PDF export, eleven ZIP files, embedded images in both mapped PDFs, readable progress and fallback feedback. The full and field maps were rendered with Poppler and visually checked. The original mission data remains unchanged during export.

Evidence: `output/drone-export-speed-tests.log`, `output/drone-bundle-final-tests.log`, `output/drone-export-speed-browser.log`, `output/drone-export-speed-lint.log`, `output/drone-export-speed/`.

All 12 targeted desktop/mobile Playwright scenarios for document preparation, map import, replacement, stale previews, provider failure and failed saves passed (`output/drone-export-speed-e2e.log`).

Release `dpl_FcVwtCE8KmeUDL8HyThEcgKmSQSP` was built from the isolated `output/deploy-export-speed-20261030` snapshot (1,632 files; external SHA-256 manifest), verified READY with protected health 200, and promoted. URL: https://mysafeops-qsk9egbb5-patryks-projects-12c8ccbe.vercel.app. All seven public production smoke checks passed. Previous release for rollback: `dpl_BeoTmjiCDHuYyDmGoU5zBYYAg5wu`. No Cloudflare, database or secret changes were needed.
