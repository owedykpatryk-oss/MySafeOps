# Projects required-field validation — 30 October 2026

Reported issue: Add Project allowed Save with blank Project name and Site / client, despite displaying a warning.

Root cause: step-one validation blocked Next, while both Save actions invoked persistence without checking those requirements.

Fix in `src/modules/Workers.jsx`:

- Both Save and Save + drawing editor use the existing required-field checks before persistence, playbook generation or navigation.
- The parent save handler also rejects incomplete values before billing and playbook side effects.
- Empty and whitespace-only values are rejected. Valid names and sites are trimmed.
- Invalid saves return to step one, retain entered data, show localized required-field messages linked to each input, and focus the first missing field.
- A failed parent save no longer clears the wizard draft.
- The separate quick field-project workflow retains its existing name-only behavior.

Verification:

- Reproduced the original behavior: six regression tests failed because incomplete projects were actually stored (`output/project-validation-red.log`).
- Final related unit/component suite: 38 tests passed, including missing fields independently, whitespace, both Save actions, corrected saves, restored step-five drafts and invalid edits preserving the existing record (`output/project-validation-regression.log`).
- Projects, Workers and People smoke renders: 3 passed (`output/project-validation-smoke.log`).
- Chrome 156.0.8078.79: both end-to-end scenarios passed, checking four invalid combinations per save action, one corrected record and persistence after reload (`output/project-validation-browser.log`).
- Edge scenarios could not launch because Edge is not installed. Chrome 146 from the report was not available. No claim of verification on either of those versions.
- Production build passed (`output/project-validation-build.log`); ESLint found no errors and one pre-existing Workers `liveWorkers` dependency warning. Diff whitespace check passed.

Run browser checks with `node node_modules/@playwright/test/cli.js test --config playwright.projects.config.js --project chrome` or `--project edge` on a machine with that browser installed. The test server has cloud connections disabled.

Changes remain in the working tree; no commit or deployment was performed. Unrelated existing edits were preserved. The supplied recording could not be loaded through the browsing tool; reproduction used the written steps and actual form/storage behavior.
