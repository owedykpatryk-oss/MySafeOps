# MySafeOps — indeks repozytorium (stan na kwiecień 2026)

Ten plik **nie** jest już listą „18 plików z paczki prototypowej”. Opisuje **bieżące** repo: aplikacja **Vite + React** w `src/`, dokumentacja w `DOCS/`, backend opcjonalny (**Supabase**, **Stripe**, **Cloudflare D1 + Workers**, **R2**).

**Źródła prawdy (czytaj w tej kolejności):**

| Dokument | Rola |
|----------|--------|
| [README.md](../README.md) | Instalacja, env (`VITE_*`), Supabase, Stripe, skrypty npm, routing |
| [architecture-current.md](./architecture-current.md) | Architektura SPA, localStorage, opcje chmury (diagram) |
| [SERVER_SOURCE_OF_TRUTH.md](./SERVER_SOURCE_OF_TRUTH.md) | D1 KV, Worker, klient, kolejka offline, audyt |
| [D1_SETUP.md](./D1_SETUP.md) | Krok po kroku D1 + Worker + Supabase RPC + Vercel |
| [SECURITY.md](../SECURITY.md) | Nagłówki, sekrety, Sentry, CI, odsyłacze do cyber |
| [BACKEND_CONTINUATION_PLAN.md](./BACKEND_CONTINUATION_PLAN.md) | Backlog backendu / checklist operatora |

---

## 1. Aplikacja (frontend) — `src/`

| Obszar | Ścieżki (skrót) |
|--------|------------------|
| Moduły H&S / PTW / RAMS | `src/modules/` — m.in. `PermitSystem.jsx`, `RAMSTemplateBuilder.jsx`, rejestry (COSHH, LOTO, toolbox, incydenty, …) |
| Layout / nawigacja | `src/layout/`, `src/navigation/workspaceViews.js`, `src/App.jsx` |
| Wspólne komponenty | `src/components/` — m.in. `PageHero`, **`D1ModuleSyncBanner.jsx`** (status sync D1: hydratacja vs kolejka + **Retry now**) |
| Persystencja lokalna | `src/utils/orgStorage.js`, `localStorage` z prefiksem org (`mysafeops_orgId`) |
| Sync chmury (JSON) | `src/utils/cloudSync.js` → Supabase `app_sync` (**Backup** w aplikacji) |
| D1 (opcjonalnie) | `src/lib/d1SyncClient.js` — HTTP do Workera; **`src/lib/d1SyncOutbox.js`** — IndexedDB kolejka po nieudanym PUT; **`src/lib/d1OutboxRetryEvent.js`** — globalny retry; **`src/hooks/useD1OrgArraySync.js`**, **`useD1WorkersProjectsSync.js`** — hydratacja (do 3× GET), debounce PUT + retry na 502/503/504/429, flush przy `online` / ~45 s / ręcznym evencie |
| Billing (limity w UI) | `src/lib/billingPlans.js` — musi być zgodne z cenami Stripe Edge / seed |
| Blog (markdown) | `src/blog/posts/*.md`, build: `verify:blog`, RSS/sitemap |

**Język UI:** angielski; **domyślne formaty:** UK (GB) tam, gdzie dotyczy.

---

## 2. Ceny i plany (źródło: `src/lib/billingPlans.js`)

W aplikacji i tabeli porównawczej używane są **te** etykiety i limity (GB = przybliżenie z `cloudBytes`):

| Plan (id) | Nazwa w UI | Cena | Okres | Workers | Projekty | „Chmura” (limit bajtów) |
|-----------|------------|------|--------|---------|----------|------------------------|
| `free` | Free | £0 | forever | 5 | 2 | 500 MB |
| `starter` | Solo | **£29** | miesiąc | 5 | 3 | 2 GB |
| `team` | Team | **£79** | miesiąc | 20 | 10 | 10 GB |
| `business` | Business | **£149** | miesiąc | 75 | 40 | 50 GB |
| `enterprise` | Enterprise | **£399** | miesiąc | 150 | 80 | 200 GB |
| `enterprise_plus` | Enterprise Plus | Contact us | custom | bez limitu (w praktyce) | bez limitu | bez limitu |
| `trial` | Trial | £0 | 14 dni | 200 | 50 | 10 GB |

**Stripe:** cztery subskrybowalne plany to `starter` / `team` / `business` / `enterprise` — zmienne Edge: `STRIPE_PRICE_STARTER`, `STRIPE_PRICE_TEAM`, `STRIPE_PRICE_BUSINESS`, `STRIPE_PRICE_ENTERPRISE`. Seed: `npm run stripe:seed-prices` (README). **`enterprise_plus`** — umowa / ręcznie w DB, nie Checkout w standardowym flow.

**Uwaga:** starsze materiały marketingowe (np. Solo £19, Team £49) **nie** odpowiadają już `billingPlans.js` — przy audycie materiałów użyj tabeli powyżej.

---

## 3. Bezpieczeństwo i zgodność (skrót)

- **Strona publiczna** `/security` + **`public/.well-known/security.txt`** (Playwright w CI: `tests/e2e/security.spec.js`).
- **Nagłówki:** `vercel.json`, `public/_headers` — HSTS, frame options, CSP Report-Only, cache dla assetów, `no-store` tam gdzie trzeba (szczegóły w `SECURITY.md`).
- **Sekrety:** żadnych kluczy serwisowych w `VITE_*`; Supabase tylko **anon** w bundle; Stripe przez Edge Functions.
- **Hasła:** min. 12 znaków w UI (Supabase i tak waliduje).
- **Opcjonalnie:** `VITE_SENTRY_DSN`, MFA / polityki w Supabase Dashboard.
- **Cyber Essentials (proces):** `DOCS/CYBER_ESSENTIALS_PLAN.md`.
- **D1 API / backup Workers:** nagłówki JSON m.in. `X-Request-Id`, `X-Content-Type-Options`, `Referrer-Policy`; klient zwraca `request_id` przy błędach — korelacja z logami Workera (`SECURITY.md`, `SERVER_SOURCE_OF_TRUTH.md`).

---

## 4. Cloudflare D1 + Workers (opcjonalny sync JSON per org)

| Element | Lokalizacja / opis |
|---------|-------------------|
| API KV + audyt | `cloudflare/workers/d1-api/` — `GET/PUT/DELETE /v1/kv`, health, `POST /v1/audit/append`, `GET /v1/audit`, `GET /v1/audit/verify`; SQLite: `org_sync_kv`, `org_audit_log` (schemat w `cloudflare/workers/d1-api/schema/`) |
| Backup cron → R2 | `cloudflare/workers/d1-backup/` — zrzuty JSON do R2 (`d1-snapshots/`) |
| Wrangler | `npm run d1:deploy`, `npm run d1:deploy:backup`, `npm run d1:secrets`, `npm run d1:smoke` |
| Import JSON → D1 | UI: Backup — „Push current data to D1”; CLI: `npm run d1:import-backup`; allowlist: `src/lib/d1ImportNamespaces.js` |
| Supabase wymagane przez Worker | RPC **`user_can_access_org_slug`** (dostęp do org); odczyt łańcucha audytu: **`user_can_read_org_audit`** (admin + supervisor na Workerze) |

**Klient (przeglądarka):** przy `VITE_D1_API_URL` wiele modułów używa `useD1OrgArraySync` (permity, RAMS, method statements, workers/projects, rejestry z listą — pełna lista w `BACKEND_CONTINUATION_PLAN.md` sekcja A). **Kolejka offline** (`d1SyncOutbox`) + baner + **Retry now** (`d1OutboxRetryEvent`).

---

## 5. Supabase, Stripe, R2 (skrót)

| Usługa | Rola w repo |
|---------|-------------|
| **Supabase** | Auth; `app_sync`; org / trial / zaproszenia / billing kolumny; Edge: `stripe-*`, `send-org-invite`; migracje w `supabase/migrations/` |
| **Stripe** | Subskrypcje GBP (cztery ceny + portal); webhook retry: `npm run stripe:retry-webhooks`; weryfikacja: `npm run billing:doctor` |
| **R2 upload Worker** | `cloudflare/workers/r2-upload` — upload plików z przeglądarki bez sekretów R2 w kliencie |

---

## 6. CI i testy

| Skrypt | Opis |
|--------|------|
| `npm run lint` | ESLint |
| `npm test` | Vitest (m.in. `d1SyncClient`, `d1SyncOutbox`, `d1OutboxRetryEvent`, moduły permitów) |
| `npm run test:e2e:security` | Playwright: `security.txt`, `/security` |
| `npm run test:e2e:billing` | Smoke billing (wymaga sekretów repo — README) |
| `.github/workflows/ci.yml` | audit (high+), lint, test, Playwright security, build |

---

## 7. Materiały historyczne (nie = aktualny kod produkcyjny)

W `DOCS/` nadal mogą leżeć pliki z wczesnej paczki (np. **`DOCS/rams-pro.jsx`**, `data.js`, `utils.js` w kontekście starego opisu). **Nie uruchamiają** dzisiejszej aplikacji — produkt buduje się z **`src/`** po `npm run dev` / `npm run build`.

---

## 8. Szybka mapa katalogów repo (root)

```
MySafeOps/
├── src/                    ← aplikacja React
├── public/                 ← statyczne, SW, _headers, manifest
├── supabase/               ← migracje SQL, Edge Functions
├── cloudflare/workers/     ← d1-api, d1-backup, r2-upload
├── scripts/                ← m.in. d1-import-backup, env-doctor, stripe, blog
├── tests/e2e/              ← Playwright
├── DOCS/                   ← ten plik + architektura, D1, cyber, checklisty
├── README.md
├── SECURITY.md
└── package.json
```

Aktualizując **ceny**, **limity** lub **opisy planów**, zmieniaj **`src/lib/billingPlans.js`** i upewnij się, że Stripe / dokumentacja marketingowa z nimi zgadzają się.
