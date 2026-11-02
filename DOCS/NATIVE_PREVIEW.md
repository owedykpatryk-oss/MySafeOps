# Android and iOS preview foundation — 2 November 2026

Follow-up: [iPhone photo and upload verification](IPHONE_UPLOAD_QA.md), including native privacy descriptions and the macOS/iOS simulator verification workflow. The native preview remains device-only.

## What exists

The existing React/Vite application is bundled locally using Capacitor 8.6.0. Both `android/` and `ios/` projects are checked in. The provisional identifier is `com.mysafeops.app`; confirm ownership and the final identifier before registering store records. Neither store has been configured or submitted to.

This is a **device-only preview**, with a visible test-data notice. It deliberately has no cloud session or synchronisation. The build script clears public Vite configuration inherited from local env files and shell variables, disables Sentry upload, and uses a non-routable API origin. Never enter client/site data. Preview data is not migrated automatically to the future signed application.

Native cold launch at `/` or `/index.html` opens Site workspace. Explicit routes, query parameters and auth fragments are preserved. Existing auth checks still govern `/app`. Web/PWA routing is unchanged. PWA service workers are not used in the native shell. Web push reports unsupported there until a native notification adapter exists.

The projects currently use template icons/splash screens. They are development scaffolding, not store artwork. Only Internet permission is declared on Android; camera/GPS integrations and their permission copy remain release work. Android targets API 36, blocks cleartext traffic and disables automatic application backup. This does not replace encrypted storage, an export/sync design or data-loss testing.

## Reproduce

Requires Node 22+. Run from the repository root:

```sh
npm ci
npm run native:build:preview
npm run native:sync
npm run native:open:android
# On a Mac with the compatible Xcode installed:
npm run native:open:ios
```

The separate `dist-native/` output prevents a normal web build being mistaken for the native preview. Generated web assets, build outputs, local SDK paths and signing keys are ignored by Git. Do not use a remote `server.url` or wildcard navigation to load the live website inside the app.

Android needs SDK 36 and JDK 21. The manually triggered **Native Android Preview** GitHub workflow builds a debug APK without production credentials or release signing. Its artifact expires after seven days; it is for internal device QA, not Google Play upload. iOS uses Swift Package Manager; compile and run it in Xcode on macOS. Generating/syncing an Xcode project on Windows is not evidence that it compiles.

Browser smoke checks against the actual preview bundle:

```sh
npx playwright install chromium webkit
npx playwright test --config playwright.native-preview.config.js
```

These simulate the native bridge in Android/iPhone browser profiles. They check startup, preview notice, site selection persistence, absent PWA worker and no production-service requests. They cannot test OS permissions, Android Back, process death or physical devices.

## Next implementation gates, in order

1. **Test backend and login:** exact native origins in API/D1/R2 CORS, server-side authentication, PKCE callback and password reset, verified links, logout and MFA on actual devices. Do not merely disable origin checks. Build a distinct authenticated QA variant after this works.
2. **Data safety:** owner/organisation/country isolation, durable files and local database, atomic outbox, migration/recovery, restart during save, two-device conflicts, verified upload acknowledgement. Keep local recovery available on failures.
3. **Device workflows:** camera/photos including HEIC and rotation, optional GPS with manual fallback, native PDF save/share, signatures, keyboard/safe areas and Android Back with dirty-form protection. Add permissions only with implemented features.
4. **Notifications and lifecycle:** native permission/subscription adapter, expiry reminders, background/resume handling. Browser push is deliberately unavailable in the current shell.
5. **Store release:** confirmed bundle/application IDs, company Apple Developer/Play Console accounts, protected signing keys, proper app icons/splash screens, privacy manifest and data disclosures, in-app account deletion, purchase-policy review, review account, accessibility and physical-device QA. Then TestFlight and Play internal testing, followed by submission.

## Official requirements checked on 2 November 2026

- [Capacitor environment](https://capacitorjs.com/docs/getting-started/environment-setup) and [configuration](https://capacitorjs.com/docs/config): native tooling requirements and bundled assets.
- [Google Play target API](https://support.google.com/googleplay/android-developer/answer/11926878): new phone apps/updates require Android 16 / API 36 from 31 August 2026. Recheck before submission.
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/): usable app functionality beyond a repackaged marketing site; account deletion when account creation is supported. Review all applicable payment/privacy requirements before release.

No store-readiness claim follows from a browser test or a successful debug build.

## Local verification

33 targeted unit tests passed (notification capability/scheduler regressions, native startup, API/public URLs and PWA exclusion). The three notification regression cases failed before the fix. Both normal web and isolated native-preview builds passed; lint reported no errors or warnings in changed JS files, and the production dependency audit gate passed. Capacitor sync completed for Android and iOS. Four built-preview browser scenarios passed across Android Chromium and iPhone WebKit profiles. The first WebKit attempt used port 4190, which WebKit blocks; using port 4189 resolved that test infrastructure failure. No physical-device or Xcode compilation result is implied.
