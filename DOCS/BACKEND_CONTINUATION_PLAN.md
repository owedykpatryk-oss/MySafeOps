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
| Front | `useD1OrgArraySync` dla **permits** (`permits_v2`), **RAMS** (`rams_builder_docs`), **method statements** (`method_statements`). |
| Audyt | `pushAudit` → mirror D1; `AuditLogViewer` łączy lokal + serwer. |
| Supabase | Migracje m.in. z `user_can_access_org_slug` + fix overload `superadmin_recent_organisations` (patrz `20260423120000_*.sql`). |

---

## B. Backlog produktowy (kod) — priorytet malejąco

### B1. Rozszerzyć D1 na kolejne moduły (taki sam wzorzec co MS/RAMS/PTW)

**Cel:** Więcej danych org w jednej chmurze, mniej „tylko ten komputer”.

**Jak:** W module z tablicą / dużym JSON w `orgStorage` dodać `useD1OrgArraySync({ storageKey, namespace, value, setValue, load, save })` + cienki pasek „Syncing…”, tak jak w `MethodStatement.jsx`. Namespace w D1 = czytelna nazwa (np. `incident_register` + `key: main`).

**Kandydaci (duży zasięg):** rejestry pod `load("…")` w `src/modules/*`, wspólne listy: `mysafeops_workers`, `mysafeops_projects`, backup/moduły z własnym kluczem.

**Pliki wzorcowe:** `src/modules/MethodStatement.jsx`, `src/hooks/useD1OrgArraySync.js`.

**Ukończone, gdy:** Dla wybranego modułu zapis w D1 widać w `org_sync_kv` i po odświeżeniu inna przeglądarka widzi te same dane (ta sama org, zalogowany user).

**Ryzyka:** Limit rozmiaru JSON w Workerze (~4.5 MB) — duże zbiory: tylko metadane w D1 + R2, albo shardowanie namespace.

---

### B2. Serwer jako *jedyna* prawda (faza twarda — duża praca)

**Cel:** Brak sytuacji, w której użytkownik myśli, że „zapisał”, a tylko `localStorage` ma dane, a D1 nie.

**Kierunki (wybrać jeden spójny):**

1. **Kolejka offline:** mutacje w IndexedDB/queue, retry do API; UI „pending sync”.
2. **Tylko online:** blokada edycji bez odpowiedzi D1.
3. **Weryfikacja przy starcie:** nie pozwalać na zapis lokalny zanim pierwszy GET D1 się nie uda (obecnie jest `d1Syncing` / `d1Ready`).

**Pliki:** hook `useD1OrgArraySync.js` + ewent. `src/utils/offlineQueue.js` (nowy).

**Ukończone, gdy:** Opisany model konfliktu (single writer, last-write z ostrzeżeniem, itd.) i zachowanie przy utracie sieci.

---

### B3. Audyt serwerowy — role i odczyt

**Cel:** Nie każdy członek org musi czytać pełny łańcuch; ewent. tylko rola compliance.

**Jak:** Rozszerzyć Worker (lub Supabase RLS + osobna tabela) o sprawdzenie roli przed `GET /v1/audit`. Wymaga modelu ról w JWT lub tabeli członkostw + RPC.

**Pliki:** `cloudflare/workers/d1-api/index.mjs`, migracje Supabase, ewent. `d1SyncClient.js` (`d1ListServerAudit`).

**Ukończone, gdy:** Zdefiniowane kto może `GET /v1/audit` / `verify` (testy manualne + opis w `D1_SETUP.md`).

---

### B4. Migracja masowa z JSON (teren / import)

**Cel:** Jednorazowy import wielu org/kluczy z eksportu backupu do D1 bez klikania w każdym kliencie.

**Jak:** Skrypt Node z `fetch` + Supabase user token (lub service path tylko po stronie serwera — **nie** osadzaj service role w repo). Alternatywa: rozszerzyć moduł **Backup** o „Upload to D1” krok po kroku.

**Nowe pliki (propozycja):** `scripts/d1-import-backup.mjs` (szkielet + README w komentarzu).

**Ukończone, gdy:** Opisany flow i minimalny skrypt albo ścieżka tylko-UI.

---

### B5. Spójność i obserwowalność

| Zadanie | Działanie |
|--------|-----------|
| Alerty z `d1-backup` | Cloudflare Notifications / email gdy cron fail (logi Workera, brak nowego pliku w R2). |
| Metryki Worker | Logi w dashboardzie; ewent. request id w odpowiedziach. |
| Testy obciążeniowe | K6/Artillery na `PUT /v1/kv` z limitem — poza standardowym scope małej aplikacji. |

---

### B6. Hook vs duplikacja (refaktor opcjonalny)

**Cel:** Wszystkie moduły D1 używają `useD1OrgArraySync` (już: PTW, RAMS, MS). Gdy jakiś moduł zostaje na ręcznym Kodzie — zrefaktorować.

---

## C. Operacje (poza commitem) — skrót checklisty

- [ ] **Vercel:** `VITE_D1_API_URL` w **Production** (i Preview jeśli używane) + **Redeploy** po każdej istotnej zmianie w `VITE_*`.
- [ ] **Supabase:** migracje na remocie (`npx supabase db push` z podlinkowanym projektem); w razie błędów — SQL z `supabase/migrations/` w SQL Editor (tylko Postgres).
- [ ] **Cloudflare:** `npm run d1:deploy`, `npm run d1:deploy:backup`, `wrangler secret` dla `AUDIT_CHAIN_SECRET`, R2 bucket zgodny z `d1-backup/wrangler.toml`.
- [ ] **Weryfikacja:** `npm run d1:smoke`, `npm run env:check` (health D1 na końcu gdy `VITE_D1_API_URL` w `.env.local`).

---

## D. Compliance (IASME / Cyber Essentials) — nie jest „funkcją w React”

- Zgłoszenie, kwestionariusz, ewent. skan (IASME).
- Dokumentacja: polityki (hasła, BYOD, incydenty, backup/restore, podwykonawcy, RODO).
- Mapowanie: gdzie leżą kopie D1 (R2 `d1-snapshots/`), kto ma dostęp, procedura odtwarzania — **wewnętrzny dokument**, nawet 1 strona A4.
- Powiązanie z kodem: `SECURITY.md`, HTTPS, MFA Supabase, brak sekretów w bundlu — tylko jeśli **wdrożone w produkcji** i opisane w audycie.

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
