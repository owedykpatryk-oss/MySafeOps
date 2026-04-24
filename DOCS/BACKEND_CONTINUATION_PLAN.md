# Plan kontynuacji — backend D1 / audyt / compliance (handoff na nowy chat)

Ten plik zbiera **to, co jeszcze nie jest zrobione** (lub zrobione tylko częściowo), w kolejności sensu zależności. Na start nowej rozmowy: wklej link do tego pliku + powiedz, od którego punktu chcesz zacząć.

**Dokumenty już istniejące (nie duplikuj treści — tylko odniesienia):**

- `DOCS/D1_SETUP.md` — kroki operacyjne D1, `VITE_D1_API_URL`, wrangler, schematy SQL (D1 = SQLite; **nie** Supabase SQL Editor dla `0002`).
- `DOCS/SERVER_SOURCE_OF_TRUTH.md` — krótki stan vs plan.
- `DOCS/VERCEL_ENV_CHECKLIST.md` — zmienne Vercel.
- `DOCS/architecture-current.md` — architektura aplikacji.
- `cloudflare/workers/d1-api/index.mjs` — API.
- `src/lib/d1SyncClient.js`, `src/hooks/useD1OrgArraySync.js` — klient.

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

**Częściowo:** `useD1OrgArraySync` — druga próba GET po ~1,2 s przy chwilowej awarii sieci / Workerze.

**Do zrobienia:** kolejka offline (IndexedDB), blokada edycji do `d1Ready`, lub jawny model konfliktów — wymaga decyzji produktowej.

**Pliki:** `src/hooks/useD1OrgArraySync.js` (retry); docelowo osobny moduł kolejki.

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
| Metryki / śledzenie | **Wdrożone w repo:** Worker `d1-api` — nagłówek `X-Request-Id` + `request_id` w JSON `/v1/health`. Worker `d1-backup` — `run_id` w logach i w `meta` zrzutu JSON. |
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
