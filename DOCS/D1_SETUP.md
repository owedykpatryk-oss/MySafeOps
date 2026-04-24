# Cloudflare D1 + Worker — konfiguracja (MySafeOps)

## Stan (repozytorium / infrastruktura)

- **Baza D1** `mysafeops-d1` utworzona w Cloudflare (region EEUR), `database_id` wpisany w `cloudflare/workers/d1-api/wrangler.toml`.
- **Schemat** `org_sync_kv` wgrany na **remote** (`wrangler d1 execute … --remote`).
- **Worker** wdrożony: `https://mysafeops-d1-api.owedykpatryk.workers.dev` (subdomena zależna od konta Cloudflare).
- **Sekrety** workera: `SUPABASE_URL` + `SUPABASE_ANON_KEY` ustawione przez `npm run d1:secrets` (czyta `.env.local`, nie zapisuje ich w gicie).
- **Lokalnie** w `.env.local` (u Ciebie na dysku) ustaw: `VITE_D1_API_URL=https://mysafeops-d1-api.owedykpatryk.workers.dev` — *jeśli jeszcze nie ma, dodaj tę linię* (plik jest w `.gitignore`).

**Do zrobienia ręcznie (Vercel):**

1. **Supabase — RPC dla Workera (członkostwo w org)**  
   Z podlinkowanym projektem: w katalogu repo `npx supabase db push` (potwierdzenie: `"y" | npx supabase db push` w PowerShell).  
   Powinny wejść m.in. `user_can_access_org_slug` oraz migracja naprawcza `20260423120000_fix_superadmin_recent_orgs_overload.sql` (konflikt `superadmin_recent_organisations` + jawne `COMMENT ON …(int, int)`).  
   **Bez `user_can_access_org_slug`** Worker D1 zwróci błąd przy RPC.

2. **Vercel** — dodaj `VITE_D1_API_URL` = URL Twojego workera (np. `https://mysafeops-d1-api.<konto>.workers.dev`, **bez** `/` na końcu) w Production (+ Preview jeśli używasz D1 tam), potem **Redeploy**.

3. **Kod aplikacji** — **permity** i **RAMS** używają `d1SyncClient` (hydratacja D1 + cache w `localStorage`); dalsze moduły (rejestry) można doprowadzać tym samym wzorcem.

4. **Opcjonalnie** — `npm run d1:deploy` z katalogu głównego (wdrożenie workera po zmianach w `index.mjs`).

---

## Instrukcja krok po kroku (od zera)

**Co chcesz osiągnąć:** baza D1 w Cloudflare + Worker, który zapisuje/odczytuje JSON per organizacja, tylko dla zalogowanego użytkownika Supabase. Frontend dostanie zmienną `VITE_D1_API_URL` wskazującą na ten Worker.

**Czego potrzebujesz przed startem**
- Konto [Cloudflare](https://dash.cloudflare.com) (darmowe wystarczy na start) i zalogowany `npx wrangler` (`npx wrangler login`).
- Zainstalowany Node.js (masz, skoro `npm run dev` działa).
- W Supabase **wdrożona** migracja z funkcją `user_can_access_org_slug` (patrz krok 0).

---

### Krok 0 — Supabase (baza danych projektu, nie D1)

1. Otwórz swój projekt w [Supabase Dashboard](https://supabase.com/dashboard).
2. Wgraj SQL z pliku:  
   `supabase/migrations/20260422200000_d1_worker_org_access_rpc.sql`  
   (SQL Editor → wklej → **Run**), albo w terminalu w katalogu repo:  
   `npx supabase db push` (jeśli masz połączenie `supabase link`).

3. Dzięki temu Worker później może bezpiecznie sprawdzić: *„czy ten użytkownik należy do tej organizacji (slug)?”*.

4. **Odczyt audytu D1** (`GET /v1/audit`, `GET /v1/audit/verify`): migracja `20260424100000_user_can_read_org_audit.sql` dodaje RPC `user_can_read_org_audit` — tylko rola **admin** lub **supervisor** w `org_memberships`. **Append** audytu (`POST /v1/audit/append`) nadal wymaga tylko członkostwa w org (`user_can_access_org_slug`). Po `db push` zaktualizuj Worker (`npm run d1:deploy`).

**Bez kroku 3** Worker zwróci błąd przy zapisie/odczycie KV. **Bez kroku 4** przy wdrożonym Workerze z nowszym kodem odczyt audytu może zwracać 404 z RPC — Worker wtedy **fallbackuje** do starego zachowania (dowolny członek) dopóki migracja nie wejdzie.

---

### Krok 1 — Utworzenie bazy D1 w Cloudflare

1. Otwórz terminal w **Windows** (PowerShell).
2. Przejdź do folderu workera w repozytorium:

   ```text
   cd E:\MySafeOps\cloudflare\workers\d1-api
   ```

3. Utwórz pustą bazę D1 (nazwa może być taka sama jak w `wrangler.toml`, domyślnie `mysafeops-d1`):

   ```bash
   npx wrangler@3 d1 create mysafeops-d1
   ```

4. Wrangler wypisze w konsoli coś w stylu **database_id =** długi identyfikator (UUID) oraz przypomnienie o schemacie.

5. Otwórz w edytorze plik:  
   `E:\MySafeOps\cloudflare\workers\d1-api\wrangler.toml`

6. Znajdź linię:

   ```text
   database_id = "REPLACE_WITH_D1_DATABASE_ID"
   ```

7. **Usuń** `REPLACE_WITH_D1_DATABASE_ID` i **wklej** prawdziwy `database_id` z kroku 3 (w cudzysłowie, UUID).

8. Zapisz plik.

**Dlaczego:** Worker musi wiedzieć, *która* baza D1 w Twoim koncie Cloudflare ma być podpięta pod `binding = "DB"`.

---

### Krok 2 — Tabela w D1 (schemat SQL)

Masz dwa warianty — wystarczy zwykle **produkcja (remote)**.

**A) Tylko w chmurze (typowe, pierwsze uruchomienie)**

W tym samym folderze `d1-api` uruchom:

```bash
npx wrangler@3 d1 execute mysafeops-d1 --remote --file=./schema/0001_org_sync_kv.sql
```

**B) Opcjonalnie — lokalna baza u Ciebie na PC (dla `wrangler dev`)**

```bash
npx wrangler@3 d1 execute mysafeops-d1 --file=./schema/0001_org_sync_kv.sql
```

Powinieneś zobaczyć sukces wykonania. W D1 powstanie tabela `org_sync_kv` (kolumny: `org_slug`, `namespace`, `data_key`, `value_json`, `version`, `updated_at`).

---

### Krok 3 — Dodać do Workera `SUPABASE_URL` i `SUPABASE_ANON_KEY`

Worker musi móc wywołać Supabase RPC `user_can_access_org_slug`. Użyje **tego samego publicznego adresu** co aplikacja i **tego samego klucza anon** (to nie jest tajne hasło do bazy; i tak ląduje w bundlu Vite — ale Worker nie używa *service role*).

1. Otwórz plik:  
   `E:\MySafeOps\cloudflare\workers\d1-api\wrangler.toml`

2. Odkomentuj (usuń `#`) sekcję `[vars]` i wypełnij **dokładnie** wartości z lokalnego `.env.local` (te same, co używane w aplikacji):
   - `VITE_SUPABASE_URL`  →  wpisz ją w Workera pod nazwą `SUPABASE_URL` (tylko https://….supabase.co, bez cudzysłowów w nazwie klucza).
   - `VITE_SUPABASE_ANON_KEY`  →  w Workera: `SUPABASE_ANON_KEY` (długi JWT zaczynający się `eyJ…`).

Przykład kształtu (WARTOŚCI SKOPIUJ SWOJE — nie używaj cudzych przykładowych):

```toml
[vars]
SUPABASE_URL = "https://WSTAW-REF-TWOJEGO-PROJEKTU.supabase.co"
SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."

# Ułatwia CORS: wpisz własne domeny, bez spacji. Przykład:
# ALLOWED_ORIGINS = "https://mysafeops.com,https://twoja-domena.vercel.app,http://localhost:5173"
```

3. Zapisz plik `wrangler.toml`.

**Uwaga:** jeśli nie chcesz trzymać tych stringów w repozytorium gita, użyj wyłącznie u siebie skopiowanego `wrangler.toml` (nie commituj) albo wklej [vars] w [Cloudflare Dashboard](https://dash.cloudflare.com) → Workers & Pages → Twój worker → **Settings** → **Variables** (dokumentacja Cloudflare: zmienne środowiskowe workera). Wtedy w `wrangler.toml` w repo zostaw same komentarze/placeholdery.

**Dlaczego:** w kodzie workera `index.mjs` czytane jest `env.SUPABASE_URL` i `env.SUPABASE_ANON_KEY`.

---

### Krok 4 — Wdrożenie (deploy) workera

W folderze `E:\MySafeOps\cloudflare\workers\d1-api`:

```bash
npx wrangler@3 deploy
```

- Pierwsze uruchomienie może zapytać o **Account ID** (wybierz konto Cloudflare).
- Na końcu wypisze **URL** workera, np. `https://mysafeops-d1-api.<twoj-sub>.workers.dev`.

**Skopiuj ten URL** (bez ukośnika na końcu) — wkleisz go w `.env.local` i w Vercelu.

---

### Krok 5 — `.env.local` w projekcie MySafeOps (Vite lokalnie)

1. Otwórz: `E:\MySafeOps\.env.local`
2. Odszukaj linię zaczynającą się od `VITE_D1_API_URL` (albo dodaną w komentarzu w sekcji D1).
3. Ustaw (jedna linia, **bez** końcowego `/`):

   ```env
   VITE_D1_API_URL=https://mysafeops-d1-api.<sub>.workers.dev
   ```

   (wklej swój dokładny adres z kroku 4).

4. Zapisz plik.
5. Zatrzymaj i uruchom ponownie `npm run dev` (Vite ładuje env przy starcie).

**Dopóki ta linia jest zakomentowana albo pusta,** biblioteka `d1SyncClient` uzna, że D1 nie jest skonfigurowany (`d1_not_configured`).

---

### Krok 6 — Vercel (produkcja / preview)

1. Wejdź: [Vercel](https://vercel.com) → **Twój projekt** (MySafeOps).
2. **Settings** → **Environment Variables**.
3. Dodaj (lub edytuj) zmienną:
   - **Name:** `VITE_D1_API_URL`
   - **Value:** ten sam URL workera co w `.env.local` (bez ukośnika).
   - Zaznacz: **Production**, i jeśli używasz preview: też **Preview** (żeby PR miały D1, jeśli chcesz).
4. Zapisz i wykonaj **Redeploy** ostatniego deploymentu (lub wypchnij nowy commit).

**Dlaczego osobno:** Vercel nie czyta Twojego lokalnego `.env.local` — musi dostać te same `VITE_*` w panelu.

---

### Krok 7 — Test „czy działa” (opcjonalnie, techniczny)

- **Bez logowania:** `npm run d1:smoke` (albo `npm run env:check` — na końcu próbuje `GET …/v1/health`) — oczekuj `ok: true`.
- Zalogowana sesja w aplikacji + ręczny `fetch` z tokenem — tylko gdy debugujesz RPC/KV.
- Po pierwszym zapisie z aplikacji: w [Cloudflare Dashboard](https://dash.cloudflare.com) → **D1** → `mysafeops-d1` → tabela `org_sync_kv` powinna mieć wiersze.
- Błąd 401/403: sprawdź nagłówek `X-Org-Slug` = dokładny `slug` organizacji z `ensure_my_org` (nie rób zapisu jako `default` gdy wymagana jest prawdziwa org).

---

### Szybka lista kontrolna

- [ ] Migracja Supabase `user_can_access_org_slug` wdrożona.  
- [ ] `d1 create` → `database_id` w `wrangler.toml`.  
- [ ] `d1 execute` z `--remote` wykonany.  
- [ ] `SUPABASE_URL` + `SUPABASE_ANON_KEY` w `[vars]` workera (lub w Dashboard).  
- [ ] `npx wrangler deploy` i skopiowany URL.  
- [ ] `VITE_D1_API_URL=...` w `.env.local` + restart `npm run dev`.  
- [ ] To samo `VITE_D1_API_URL` w Vercel + redeploy.

---

Szczegółowy opis roli D1 w architekturze: `DOCS/SERVER_SOURCE_OF_TRUTH.md`.

## Architektura (skrót)

- **D1** = SQLite w chmurze, tabela `org_sync_kv` (JSON na organizację + namespace + klucz).
- **Worker** = weryfikuje użytkownika przez **Supabase JWT** i sprawdza członkostwo w `org` przez RPC `user_can_access_org_slug` (migracja `20260422200000_d1_worker_org_access_rpc.sql`).
- **Aplikacja** = nadal Vite; zmienna `VITE_D1_API_URL` wskazuje na URL workera.

## 1. Supabase

1. Wdróż migrację: `supabase db push` lub wklej SQL z  
   `supabase/migrations/20260422200000_d1_worker_org_access_rpc.sql` w SQL Editor.
2. Upewnij się, że użytkownik jest w `org_memberships` i że `organizations.slug` zgadza się z tym, co w przeglądarce (`getOrgId()` / `mysafeops_orgId`).

## 2. Utworzenie bazy D1

W katalogu `cloudflare/workers/d1-api`:

```bash
cd cloudflare/workers/d1-api
npx wrangler@3 d1 create mysafeops-d1
```

Skopiuj `database_id` do `wrangler.toml` zamiast `REPLACE_WITH_D1_DATABASE_ID`.

## 3. Schemat tabeli

Lokalnie (opcjonalnie):

```bash
npx wrangler@3 d1 execute mysafeops-d1 --file=./schema/0001_org_sync_kv.sql
```

Produkcja (remote):

```bash
npx wrangler@3 d1 execute mysafeops-d1 --remote --file=./schema/0001_org_sync_kv.sql
```

## 4. Zmienne Workera

W `wrangler.toml` ustaw (lub użyj `wrangler secret` tylko dla sekretów — **anon key jest publiczny** jak w froncie):

- `SUPABASE_URL` = `https://<ref>.supabase.co`
- `SUPABASE_ANON_KEY` = ten sam co `VITE_SUPABASE_ANON_KEY`
- `ALLOWED_ORIGINS` = np. `https://mysafeops.com,https://<preview>.vercel.app,http://localhost:5173`  
  (puste = `*` w kodzie CORS — tylko do dev)

Przykład tymczasowo w `[vars]` w `wrangler.toml` (albo: `wrangler secret put` nie jest wymagany dla anon).

## 5. Wdrożenie

```bash
npx wrangler@3 deploy
```

Zanotuj URL workera, np. `https://mysafeops-d1-api.<konto>.workers.dev`.

## 6. Frontend (Vercel / lokalnie)

W `.env.local`:

```env
VITE_D1_API_URL=https://mysafeops-d1-api.<konto>.workers.dev
```

Przebuduj: `npm run build`.

## 6b. Schemat audytu w D1 (`org_audit_log`)

Po `0001` wykonaj na **remote** (ten sam katalog `d1-api` co wyżej):

```bash
npx wrangler@3 d1 execute mysafeops-d1 --remote --file=./schema/0002_org_audit_log.sql
```

Następnie ustaw sekret **tylko na serwerze** (Worker), min. 16 znaków losowych:

```bash
cd E:\MySafeOps\cloudflare\workers\d1-api
npx wrangler@3 secret put AUDIT_CHAIN_SECRET
```

Bez `AUDIT_CHAIN_SECRET` endpointy `POST /v1/audit/append` zwracają **503**; aplikacja dalej zapisuje tylko lokalny `mysafeops_audit` w pamięci przeglądarki.

## 6c. Backup zaplanowany D1 → R2

- Konfiguracja: `cloudflare/workers/d1-backup/wrangler.toml` — ujednolij `database_id` z `d1-api`, ustaw istniejący **bucket** R2 (`bucket_name`).
- Wdróż: z katalogu głównego repo: `npm run d1:deploy:backup`
- Pliki: `d1-snapshots/mysafeops-d1-<timestamp>.json` (tabele `org_sync_kv` i, jeśli skrypt wykonany, `org_audit_log`).

## 7. API (referencja)

| Metoda | Ścieżka | Opis |
|--------|---------|------|
| `GET` | `/v1/health` | `{ ok, service }` — bez autoryzacji. |
| `GET` | `/v1/kv?namespace=...&key=...` | Zwraca JSON `{ value, version, updated_at }` (value może być `null`). |
| `GET` | `/v1/kv?namespace=...&list=1` | Lista kluczy + metadane (bez pełnej treści). |
| `PUT` | `/v1/kv` | Ciało: `{ "namespace", "key", "value", "ifVersion"? }` — 409 przy konflikcie wersji. |
| `DELETE` | `/v1/kv?namespace=...&key=...` | Usuwa wiersz KV. |
| `POST` | `/v1/audit/append` | Ciało: `{ "action", "entity", "detail"?, "client_row_id"?, "extra"? }` — wymaga `AUDIT_CHAIN_SECRET`. |
| `GET` | `/v1/audit?limit=50&after_seq=0` | Lista wpisów audytu (schemat `0002`). |
| `GET` | `/v1/audit/verify` | Weryfikacja łańcucha HMAC w obrębie org. |

Nagłówki (poza `/v1/health`): `Authorization: Bearer <Supabase access token>`, `X-Org-Slug: <slug>`.

Limit ciała KV: ~4.5 MB; wpis audytu: ~32kB serializowanego payloadu. Większe załączniki: R2, w D1 tylko metadane.

## 8. Dalsze kroki (opcjonalne)

- Tryb „tylko serwer / kolejka offline” dla wszystkich modułów.
- Rozszerzenie audytu: role tylko do odczytu, eksport do narzędzi compliance.
- Więcej tabel w D1 lub przenoszenie części danych do Supabase Postgres — spójna decyzja architektoniczna, zob. `SERVER_SOURCE_OF_TRUTH.md`.
