# Local survey reference only — do not commit

This folder may contain **third-party or client-specific** documents (RAMS, reports, checklists, site names).

- **Not tracked in git** — see root `.gitignore` and `.cursorignore`
- **Not used at runtime** — the app uses generic templates in `src/modules/surveyReport/` and `src/utils/surveyContentCatalog.js`
- **Do not** copy into blog posts, PRs, screenshots, or cloud backups tied to the repo

If you need shared survey defaults, extend the code catalog — do not add proprietary `.docx` / `.pdf` here.
