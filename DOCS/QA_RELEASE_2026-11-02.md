# QA release — 2 November 2026

Scope: all pending application changes authorized for main, merged with origin/main 120f076. Local integration snapshot: 04d5b5e. Temporary outputs, client exports and credentials are excluded.

## QA checklist

| QA IDs | Resolution |
| --- | --- |
| 1, 3, 4 | Project required-field validation, readable examples, durable deletion and feedback; equivalent People/CDM/RIDDOR paths covered. |
| 2, 7, 10 | Header spacing and navigation controls. |
| 5, 6, 8, 11 | Briefing placeholders, project labels and topic checkbox alignment. |
| 9 | Dismissible sync recovery notice; recovery copies remain available and isolated by workspace. |
| 12, 16 | Permit input and checklist contrast on the light form surface. |
| 13 | Footer links verified in existing public-page coverage. |
| 14 | Full module descriptions retained and allowed to wrap. |
| 15 | Snag filters adapt their column widths. |
| 17, 26 | Wrapping permit checklist header and full-row height-control hierarchy selector. |
| 18 | RAMS snapshots published to Supabase; random links work outside the publishing browser, expire and can be revoked. QR codes require a current published snapshot. |
| 19 | Evidence upload confirmation shown after a successful save. |
| 20, 21 | Management gap finder and upcoming diary layouts wrap on narrow screens. |
| 22 | Plan opens the picker when no plan exists and switches to the uploaded plan after durable storage. |
| 23 | Account email wraps in the workspace UI. |
| 24 | RAMS mobile preview scrolls with the page. |
| 25 | Search palette follows the visible viewport when the keyboard opens. |
| 27 | Geo-photo success feedback follows durable persistence; failed saves preserve the draft for retry. |
| 28 | Bottom navigation items fit narrow mobile viewports. |

Existing broader QA evidence is documented in QA_SIMILAR_ERRORS_AUDIT_2026-10-30.md and WORKSPACE_DATA_RECOVERY_FIXES_2026-10-30.md.

## Integration and verification

- Preserved current main UK prices and market-specific PL/AU permit controls, alongside the pending DACH and GPR improvements.
- Full Vitest run: 427 files, 2454 tests; initially 2452 passed and two stale assertions failed (Germany is now supported, Polish permit label changed). Both affected files passed targeted reruns after correction; permit integration rerun passed 60 tests in four files.
- ESLint: zero errors, 121 existing warnings. Hooks and sensitive-survey-document guards pass.
- Production Vite build passes. Browser checks cover desktop Chromium, Android emulation and iPhone WebKit. An initial cold Vite startup exceeded the desktop test timeout; the isolated retry uses a longer startup allowance.
- Prior targeted checks also cover Plan upload/reload, navigation at 320 px, search viewport changes and RAMS sharing/revocation.
- Supabase RAMS migration applied as 20261102140516_rams_public_shares. Confirmed RLS, no anonymous table SELECT, public token RPC permission, authenticated publication, public retrieval, invalid-token rejection, expiry and revocation in a rolled-back transaction.
- permit-audit-export Edge Function deployed as version 31 with JWT verification enabled.
- Historical main migrations predating already-deployed October billing migrations were not replayed over the newer production billing implementation.
- Global Codex skill installed locally: retry-and-verify. Equivalent failed approaches are retried at most once before diagnosis; write outcomes require readback and user-visible behavior verification.

Tests use synthetic local data and device emulation. This report does not claim exhaustive coverage of every account, device or data combination.
