# Workspace data recovery fixes — 30 October 2026

Local follow-up to the similar-error audit. No deployment, commit, production data change or billing change was performed.

## Changes

- COSHH, Inspections, Snags, Daily Briefing, CDM, RIDDOR and Incidents check local persistence before closing/resetting an editor. A failed write retains the input and shows a warning. Retrying creates one record.
- Overlay forms write the latest draft before submitting and clear it only after successful persistence. This also retains a draft if a save callback unexpectedly throws.
- Draft keys now include the organisation and operational country. Switching workspace remounts the active module/settings editor; pending drafts are flushed to the original scope first. Quick incident capture follows the same rule.
- COSHH deletion uses the shared recoverable deletion flow and tombstones. Deleted substances are excluded from the list, search, statistics, CSV and print selections.
- Recycle Bin shows persistent, dismissible feedback after restore or permanent deletion. A restore message identifies the destination module. Restore failures keep the recovery copy and show an inline error. Messages clear on workspace changes.

## Draft compatibility

Old session drafts without organisation/country identity remain in session storage but are not automatically imported into the new scoped keys. Their owner cannot be safely inferred. This avoids loading another organisation's old draft into the current editor. No legacy session draft was deleted by the migration.

## Verification

- **146 Vitest tests passed in 11 files**, including workspace module smoke rendering, save failure/retry, draft isolation, Bin restoration, cloud sync regression and navigation tests. Log: `output/data-recovery-regression-final.log`.
- Chromium browser checks passed: inspection write failure → reload → draft recovery → successful retry; company/country switching with an open editor; immediate quick-incident draft flush on country change; COSHH → Bin → restore → COSHH. No runtime page errors. Script: `output/workspace-data-recovery-qa.mjs`; results and screenshots: `output/workspace-data-recovery/`; log: `output/data-recovery-browser.log`.
- Production build passed (`output/data-recovery-build.log`); existing large-chunk warnings remain.
- ESLint reports no errors; 10 existing hook dependency warnings remain (`output/data-recovery-lint.log`). Scoped `git diff --check` passes.

Tests used an isolated local browser workspace and simulated storage failures. They did not exercise a production account or Edge.
