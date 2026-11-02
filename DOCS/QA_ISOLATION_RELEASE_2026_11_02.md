# Operational data isolation and QA fixes — 2026-11-02

## Changes

- Cross-tab organisation/country changes invalidate the visible workspace synchronously. The D1 array hook rejects old React state before assigning a newly observed scope.
- GPR, survey, AI RAMS handoff and drawing-editor recovery are scoped to their originating account/workspace. Unowned legacy session data is preserved but never silently adopted.
- GPR/survey saves confirm durable local persistence before success, clearing recovery, or closing. Late operations from disposed/changed workspaces are rejected.
- RAMS import, rename and deletion check persistence. Issued/approved titles require a controlled revision; imported documents become unsigned drafts.
- Bulk deletion archives the complete selection before deleting, respects the originating workspace, and preserves recoverability on failed writes.
- Public RAMS snapshots contain publisher print context and only selected worker/project details. Recipient settings do not change the document. Existing public shares without print context require republishing.
- Cold work and Line break permits expose their required authorised-person field, including market overrides.
- Backup version 2 records organisation/country ownership. App and CLI imports validate ownership; D1 import preserves country routing. Unknown namespaces are reported and excluded instead of being guessed.
- Drawing export references and delayed uploads cannot migrate to another organisation after navigation.
- CI runs the operational desktop and Android suite and retains failure traces.

## Verification

Local verification: the full suite passed 2,491 tests in 434 files. A final focused run passed 84 tests in 14 files, including the last review fixes. All 103 runnable desktop/Android scenarios passed across the integrated run and targeted reruns; one Android print-fixture test is intentionally skipped. The initial cold-start timeout was resolved by a separate Vite workspace-readiness setup. A GPR fault-injection run interrupted by development HMR was repeated with stable sources and passed. The final cold-start run passed on both profiles. Production build and circular-chunk checks passed. ESLint passed with zero errors and 121 warnings. Tests use synthetic data; cloud permissions tests use controlled responses rather than customer accounts. Device profiles are browser emulation, not physical-device certification.

Commands:

```sh
npx vitest run --maxWorkers=2
npx playwright test --config=playwright.mobile.config.js --project=desktop --project=android
npm run lint
npm run build
node scripts/check-vite-circular-chunks.mjs qa-final-release-build.log
```

## Recovery and compatibility

Old unowned drafts remain in browser storage for explicit recovery; they are not automatically assigned to a new account. Older published RAMS links must be republished by their owner to enable an accurate print. Backup import rejects foreign or ambiguous keys before writing. Keep original backup files when an unsupported key is reported.

A passing local suite does not establish that every production workflow is defect-free. Production verification must check the deployed commit and read-only smoke tests after release.

