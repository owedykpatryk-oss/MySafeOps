# iPhone photo and upload verification — 2 November 2026

## Fixes and local evidence

- Uploads now require a non-empty object key in the server acknowledgement. A captive-portal HTML response or empty HTTP 200 response no longer becomes a falsely saved cloud document.
- A stalled upload, including a stalled response body, aborts after 120 seconds and reports a retryable error. Existing UI recovery keeps unsaved photo evidence; document upload can be retried with the same file. This timeout is not automatic background sync and cannot guarantee that the server did not receive bytes before the connection was lost.
- JPEG conversion bounds both dimensions before canvas allocation. Tall panoramas no longer create a canvas with an unbounded height on memory-constrained phones.
- The iOS project declares why camera, photo selection and foreground GPS access are requested. This enables OS permission prompts; it is not evidence of physical camera/GPS testing.

Three regressions were reproduced before the fix. Afterwards 41 targeted unit tests, 15 selected iPhone WebKit browser scenarios and the web production build passed. Changed JavaScript passed ESLint. Coverage includes gallery/camera file inputs, denied GPS, late GPS responses, signatures, failed/retried uploads, storage quota failure, reload recovery, organisation changes during upload, offline photo bytes and PDF availability. These local browser tests use synthetic files and mocked upload responses, not authenticated production uploads.

## Apple verification workflow

Manually run **iPhone Upload and iOS Preview** in GitHub Actions. It generates a synthetic HEIC using Apple's `sips` encoder, runs the iPhone photo/upload scenarios on macOS WebKit, builds the iOS simulator app with Xcode, launches it and records a screenshot. The HEIC case is explicitly skipped on machines without `HEIC_FIXTURE_PATH`; a skipped case must not be reported as passing.

The workflow uploads `iphone-verification` with the compiler log, screenshot, generated HEIC and failure traces where available. A simulator launch confirms the native shell can run; file inputs driven by Playwright do not exercise the OS photo picker or the physical camera.

## Remaining release blockers

The current native preview is still device-only. Native cloud authentication, callback/deep links, exact backend CORS origins and authenticated uploads must be integrated and tested before a native release. Do not label it fully working cloud upload on iPhone.

Required physical-device acceptance: Safari and Home Screen PWA, then the signed native app; camera and iCloud Photos, existing HEIC/JPEG/PNG and a large portrait/panorama, PDF from Files, cancelled/denied permissions, background/return, network interruption during upload, expired session after camera, restart, storage full and switching organisations. Verify the uploaded object under the correct user/company/country from a second signed-in device. Confirm its bytes open and that the first device retains recovery data until acknowledgement.

An untested device/OS combination or a missing native cloud integration is an open limitation, not a passed check.
