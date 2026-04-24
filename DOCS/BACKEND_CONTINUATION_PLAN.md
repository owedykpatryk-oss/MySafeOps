# Plan kontynuacji — backend D1 / audyt / compliance (handoff na nowy chat)

Ten plik zbiera **to, co jeszcze nie jest zrobione** (lub zrobione tylko częściowo), w kolejności sensu zależności. Na start nowej rozmowy: wklej link do tego pliku + powiedz, od którego punktu chcesz zacząć.

---

## Ostatnia aktualizacja w repozytorium (cyber + backend, bez zmian w chmurze użytkownika)

- **Worker `d1-api`:** nagłówki odpowiedzi JSON rozszerzone o `Referrer-Policy: strict-origin-when-cross-origin` (obok istniejącego `X-Content-Type-Options`, `Cache-Control: no-store`, `X-Request-Id`).
- **Worker `d1-backup`:** odpowiedzi JSON z `nosniff`, `no-store`, `Referrer-Policy` (endpoint i tak zwraca 404 — cron jest główną ścieżką).
- **`public/_headers`:** HSTS + `X-Frame-Options: SAMEORIGIN` (wyrównanie z `vercel.json` dla SPA).
- **Cyber / dowód:** strona `/security` uzupełniona o subprocessory, patching/CI, D1 `X-Request-Id`; `SECURITY.md` — odsyłacze do `CYBER_ESSENTIALS_PLAN`, CI, backend ops; Playwright `tests/e2e/security.spec.js` + krok w `ci.yml`.
- **Klient D1:** `d1SyncClient` przy błędach HTTP zwraca też `request_id` (nagłówek `X-Request-Id`); błąd `fetch` → `{ ok: false, error: "fetch_failed" }`; `npm run d1:smoke` i **`npm run env:check`** ostrzegają, jeśli na `/v1/health` brakuje oczekiwanych nagłówków; hydratacja `useD1OrgArraySync` — do **3** prób GET; debounced **PUT** — jedna ponowiona próba przy `502/503/504/429`; **kolejka offline** `src/lib/d1SyncOutbox.js` + replay po hydratacji / `online` / interwał ~45 s; `d1Syncing` = hydratacja **lub** oczekujący outbox; baner modułu: `D1ModuleSyncBanner`.
- **Nadal poza commitem:** checklista sekcji C (Vercel env, `wrangler secret`, migracje Supabase na remote, schemat D1 na remote) — wykonuje operator produkcji.

**Dokumenty już istniejące (nie duplikuj treści — tylko odniesienia):**

- `DOCS/D1_SETUP.md` — kroki operacyjne D1, `VITE_D1_API_URL`, wrangler, schematy SQL (D1 = SQLite; **nie** Supabase SQL Editor dla `0002`).
- `DOCS/SERVER_SOURCE_OF_TRUTH.md` — krótki stan vs plan.
- `DOCS/VERCEL_ENV_CHECKLIST.md` — zmienne Vercel.
- `DOCS/architecture-current.md` — architektura aplikacji.
- `cloudflare/workers/d1-api/index.mjs` — API.
- `src/lib/d1SyncClient.js`, `src/lib/d1SyncOutbox.js`, `src/hooks/useD1OrgArraySync.js`, `src/components/D1ModuleSyncBanner.jsx` — klient.

---

## A. Stan na dziś (skrót, żeby nie cofać się w kod)

| Element | Stan typowy |
|--------|-------------|
| D1 `org_sync_kv` + `org_audit_log` | Schematy w `cloudflare/workers/d1-api/schema/`; zastosować na remote przez `wrangler d1 execute` (nie mylić z Postgres). |
| Worker `d1-api` | KV, health, audyt HMAC; wymaga `AUDIT_CHAIN_SECRET` + Supabase RPC `user_can_access_org_slug`. |
| Worker `d1-backup` | Cron → R2 `d1-snapshots/`; `npm run d1:deploy:backup`. |
| Front | `useD1OrgArraySync` (+ `useD1WorkersProjectsSync`) m.in.: **permits**, **RAMS**, **method statements**, **Workers & projects**, **toolbox talks**, **snags**, **incidents + actions**, **Incident Action Tracker**, **training matrix**, **Daily briefing**, **Gate book**, **Visitor log**, **Inspection register**, **Welfare checks**, **Ladder inspections**, **Water hygiene**, **Environmental log**, **Waste register**, **MEWP log**, **excavations**, **scaffold**, **electrical/PAT**, **plant register**, **safety observations**, **confined space**, **noise/vibration**, **lifting operations**, **DSEAR**, **asbestos**, **hot work** (bez syncu `loto_register` — tylko odczyt lokalny), **temporary works**, **lone working**, **GMP deviations**, **CIP sign-off**, **allergen changeovers**, **high-care access**, **COSHH**, **PPE** (workers + register), **LOTO** (`loto_register` + migracja przy zapisie), **project drawing editor** (tylko lista `mysafeops_projects`). |
| Audyt | `pushAudit` → mirror D1 (append: każdy członek org). **Odczyt** łańcucha D1: tylko **admin + supervisor** (RPC `user_can_read_org_audit` + Worker); `AuditLogViewer` pokazuje lokalnie wszystkim. |
| Supabase | `user_can_access_org_slug`, `user_can_read_org_audit`, fix overload `superadmin_recent_organisations` (`20260423120000_*.sql`, `20260424100000_*.sql`). |

---

## B. Backlog produktowy (kod) — priorytet malejąco

### B1. Rozszerzyć D1 na kolejne moduły (taki sam wzorzec co MS/RAMS/PTW)

**Status (repo):** wdrożone moduły jak w tabeli sekcji A (m.in. `Workers.jsx`, `ToolboxTalkRegister.jsx`, `SnagRegister.jsx`, `IncidentNearMiss.jsx`, `IncidentActionTracker.jsx`, `TrainingMatrix.jsx`, `DailyBriefing.jsx`, `GateBook.jsx`, `VisitorLog.jsx`, `InspectionTracker.jsx`, `WelfareCheckLog.jsx`, `LadderInspection.jsx`, `WaterHygieneLog.jsx`, `EnvironmentalLog.jsx`, `WasteRegister.jsx`, `MEWPLog.jsx`, `ExcavationLog.jsx`, `ScaffoldRegister.jsx`, `ElectricalPATLog.jsx`, `PlantEquipmentRegister.jsx`, `SafetyObservations.jsx`, `ConfinedSpaceLog.jsx`, `NoiseVibrationLog.jsx`, `LiftingPlanRegister.jsx`, `DSEARLog.jsx`, `AsbestosRegister.jsx`, `HotWorkRegister.jsx`, `TemporaryWorksRegister.jsx`, `LoneWorkingLog.jsx`, `GMPDeviationLog.jsx`, `CIPSignoffRegister.jsx`, `AllergenChangeoverRegister.jsx`, `HighCareAccessRegister.jsx`, `COSHHRegister.jsx`, `PPERegister.jsx`, `LOTORegister.jsx`, `ProjectDrawingEditor.jsx` — projects; wspólne listy w `MethodStatement.jsx` przez `useD1WorkersProjectsSync.js`). **LOTO:** `setItems` normalizuje przez `migrateToWorkflow` przy każdym zapisie z D1 lub lokalnie.

**Cel:** Więcej danych org w jednej chmurze, mniej „tylko ten komputer”.

**Jak:** `useD1OrgArraySync` + pasek „Syncing…”; dla `mysafeops_workers` / `mysafeops_projects` → `useD1WorkersProjectsSync`.

**Pliki wzorcowe:** `src/hooks/useD1WorkersProjectsSync.js`, `src/modules/MethodStatement.jsx`.

**Ryzyka:** Limit ~4.5 MB JSON na PUT w Workerze.

---

### B2. Serwer jako *jedyna* prawda (faza twarda — duża praca)

**Częściowo (repo):** `useD1OrgArraySync` — do **3** prób GET (0 / 1,2 s / 2,8 s) przy hydratacji; jedna **ponowna próba PUT** po ~0,9 s przy `http_502`, `http_503`, `http_504`, `http_429`; **kolejka IndexedDB** (`d1SyncOutbox.js`) — enqueue po nieudanym PUT (z wyjątkiem ścieżki 409 → refetch), flush po hydratacji, `window` `online` oraz co ~45 s gdy pending; przy 409 na flush — serwer wygrywa (jak przy zwykłym PUT). **Retry ręczny:** `requestD1OutboxManualRetry()` (`d1OutboxRetryEvent.js`) + nasłuch w hooku; przycisk w `D1ModuleSyncBanner`. Hook zwraca `d1Hydrating`, `d1OutboxPending`, `d1Syncing`; moduły używają banera (hydratacja vs „upload queued”, a11y `role="status"`).

**Do zrobienia (opcjonalnie / produkt):** blokada edycji do `d1Ready` gdy skonfigurowano D1; jawny ekran konfliktów przy równoległej edycji.

**Pliki:** `src/hooks/useD1OrgArraySync.js`, `src/lib/d1SyncOutbox.js`, `src/lib/d1SyncOutbox.test.js`, `src/lib/d1OutboxRetryEvent.js`, `src/components/D1ModuleSyncBanner.jsx`.

---

### B3. Audyt serwerowy — role i odczyt

**Status (repo):** RPC `user_can_read_org_audit` (admin + supervisor); Worker `verifyOrgAuditRead` dla `GET /v1/audit` i `GET /v1/audit/verify`; **POST append** nadal `user_can_access_org_slug`. Fallback: jeśli RPC zwraca 404 (stary projekt), Worker dopuszcza każdego członka (jak wcześniej). Front: `AuditLogViewer` nie woła D1 dla roli `operative`.

**Pliki:** `supabase/migrations/20260424100000_user_can_read_org_audit.sql`, `cloudflare/workers/d1-api/index.mjs`, `src/modules/AuditLogViewer.jsx`, `DOCS/D1_SETUP.md`.

---

### B4. Migracja masowa z JSON (teren / import)

**Status:** `npm run d1:import-backup` — `scripts/d1-import-backup.mjs` (JWT użytkownika + `--file` + `D1_IMPORT_ORG_SLUG`); lista namespace w `src/lib/d1ImportNamespaces.js`. **UI:** Settings → Backup — przycisk „Push current data to D1” (`pushBackupBundleToD1` w `src/utils/d1BackupPush.js`), wymaga `VITE_D1_API_URL`, zalogowania i roli z importem backupu. **Testy:** `src/utils/d1BackupPush.test.js` (Vitest + mock `d1SyncClient`).

---

### B5. Spójność i obserwowalność

| Zadanie | Działanie |
|--------|-----------|
| Alerty z `d1-backup` | Nadal: Cloudflare Notifications (poza repo). |
| Metryki / śledzenie | **Wdrożone w repo:** Worker `d1-api` — nagłówek `X-Request-Id` + `request_id` w JSON `/v1/health`; `d1SyncClient` zwraca `request_id` przy błędach HTTP; `npm run env:check` / `d1:smoke` ostrzegają przy braku oczekiwanych nagłówków na `/v1/health`. Worker `d1-backup` — `run_id` w logach i w `meta` zrzutu JSON. |
| Testy obciążeniowe | K6/Artillery — opcjonalnie, poza domyślnym scope. |

---

### B6. Hook vs duplikacja (refaktor opcjonalny)

**Cel:** Wszystkie moduły z własnym stanem tablic używają hooków D1 zamiast tylko `useState(() => load(...))` bez syncu.

**Status:** `useD1WorkersProjectsSync` redukuje duplikację workers/projects; wiele modułów nadal czyta listy jednorazowo przy mount — akceptowalne do czasu edycji list w tym module.

---

## C. Operacje (poza commitem) — skrót checklisty

- [ ] **Vercel:** `VITE_D1_API_URL` w **Production** (i Preview jeśli używane) + **Redeploy** po każdej istotnej zmianie w `VITE_*`.
- [ ] **Supabase:** migracje na remocie (`npx supabase db push` z podlinkowanym projektem); w razie błędów — SQL z `supabase/migrations/` w SQL Editor (tylko Postgres).
- [ ] **Cloudflare:** `npm run d1:deploy`, `npm run d1:deploy:backup`, `wrangler secret` dla `AUDIT_CHAIN_SECRET`, R2 bucket zgodny z `d1-backup/wrangler.toml`.
- [ ] **Weryfikacja:** `npm run d1:smoke`, `npm run env:check` (health D1 na końcu gdy `VITE_D1_API_URL` w `.env.local`).

---

## D. Compliance (IASME / Cyber Essentials) — nie jest „funkcją w React”

**Pełny plan (proces + backend + dowody):** [CYBER_ESSENTIALS_PLAN.md](./CYBER_ESSENTIALS_PLAN.md)

Skrót:

- Zgłoszenie, kwestionariusz, ewent. skan (IASME / CAB).
- Dokumentacja: polityki (hasła, BYOD, incydenty, backup/restore, podwykonawcy, RODO).
- Mapowanie backendu: Supabase (Auth, RLS, RPC, Edge Functions), Cloudflare (Worker `d1-api`, `d1-backup` → R2), Vercel (hosting + nagłówki), Stripe (sekrety tylko server-side) — szczegóły w pliku powyżej.
- Mapowanie operacyjne: gdzie leżą kopie D1 (R2 `d1-snapshots/`), kto ma dostęp, procedura odtwarzania — **wewnętrzny dokument**, nawet 1 strona A4.
- Powiązanie z kodem: `SECURITY.md`, strona publiczna `/security`, `/.well-known/security.txt`, HTTPS, MFA Supabase, brak sekretów w bundlu — tylko jeśli **wdrożone w produkcji** i opisane w audycie.

---

## E. Decyzje architektoniczne (odłożone — wymagają spotkania / ADR)

1. **Czy długoterminowo wszystkie dane relacyjne idą do D1 (KV), czy do Supabase Postgres?** Obecny kod = KV w D1; `app_sync` w Supabase to inna ścieżka (backup użytkownika).
2. **Retencja:** jak długo trzymać `org_audit_log` w D1; czy archiwum do R2 (eksport tylko append).
3. **Wielo-organizacyjne izolowanie:** już jest po `org_slug` + RPC; czy potrzebne dodatkowe testy penetracyjne API.

---

## F. Szybki start w nowym chacie (prompt dla Ciebie)

Wklej mniej więcej:

> Kontynuuj `DOCS/BACKEND_CONTINUATION_PLAN.md`. Zaczynamy od sekcji **[B1 / B2 / …]** w repozytorium `E:\MySafeOps`. Trzymaj się istniejących wzorców (`useD1OrgArraySync`, `d1SyncClient`).

Dopisz konkret, np. „najpierw moduł X” albo „najpierw kolejka offline (B2)”.

---

*Ostatnia treść uzupełniona: plan backlogu, nie nadpisuje migracji SQL ani konfiguracji w chmurze użytkownika.*
