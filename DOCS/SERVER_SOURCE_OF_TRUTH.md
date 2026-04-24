# Serwer jako źródło prawdy (MySafeOps) — stan i plan

Ten dokument wiąże opis z **kodem w repozytorium** (D1, Worker, klient). Pełna zgodność z **IASME / Cyber Essentials** to osobna ścieżka procesowa (kwestionariusz, polityki, DPA) — zob. sekcja **Compliance poza repozytorium**.

## Co jest wdrożone w kodzie (D1 + Workers)

| Obszar | Implementacja |
|--------|----------------|
| Wspólna baza (D1) | Tabela `org_sync_kv` — JSON per `org_slug` + `namespace` + `data_key`, wersjonowanie, optymistyczna współbieżność (`ifVersion` / 409). |
| API HTTP | Worker `d1-api`: `GET/PUT/DELETE /v1/kv`, `GET /v1/health`, audyt: `POST /v1/audit/append`, `GET /v1/audit`, `GET /v1/audit/verify` (schemat `0002_org_audit_log.sql` + sekret `AUDIT_CHAIN_SECRET`). |
| Izolacja org | Nagłówek `X-Org-Slug` + Supabase RPC `user_can_access_org_slug` (JWT użytkownika). |
| Klient | `src/lib/d1SyncClient.js` — wywołania do Workera; hook `src/hooks/useD1OrgArraySync.js` (+ `useD1WorkersProjectsSync`) — wiele modułów/rejestrów (lista i wyjątki: [BACKEND_CONTINUATION_PLAN.md](./BACKEND_CONTINUATION_PLAN.md)): hydratacja z D1, zapis z debounce, `localStorage` jako cache; konflikt wersji → refetch z serwera. |
| Lokalny audit | `src/utils/auditLog.js` — pierścień w `localStorage` (max 500) + **mirror** do serwera (`d1AppendServerAudit`), gdy D1 + org ≠ `default`. |
| Backup D1 → R2 | Worker `d1-backup` (cron domyślnie 03:00 UTC), pliki JSON w R2 pod `d1-snapshots/`. Skrypt: `npm run d1:deploy:backup`. |
| Backup JSON → D1 (push) | W aplikacji: **Backup** — „Push current data to D1” (`src/utils/d1BackupPush.js`, allowlist `src/lib/d1ImportNamespaces.js`). CLI: `npm run d1:import-backup`. |

## Świadomie niewykonane (większa praca)

- **Prawda wyłącznie na serwerze**: aplikacja nadal inicjuje z `localStorage` i **natychmiast** zapisuje lokalnie; D1 jest autorytatywne po hydratacji, ale pełne „tylko API, zero zaufania do klienta” wymaga kolejnej fazy (kolejka offline, tryb tylko online, itp.).
- **Reguły ról w audycie** (serwer): zapis (`POST /v1/audit/append`) nadal po RPC `user_can_access_org_slug` (członek org). **Odczyt** łańcucha na Workerze (`GET /v1/audit`, `GET /v1/audit/verify`) wymaga RPC `user_can_read_org_audit` (w typowej konfiguracji **admin + supervisor**); front nie woła odczytu D1 dla roli **operative**. Osobne role (np. dedykowany audytor tylko-read) wymagałyby rozszerzenia RPC / claims.
- **CRDT / lock na dokumencie**: używane jest wersjonowanie i merge przy 409; nie ma edycji wieloużytkowniczej w czasie rzeczywistym.
- **Migracja terenowa**: eksport JSON z **Backup**, następnie **Push current data to D1** (przy włączonym `VITE_D1_API_URL`) lub `npm run d1:import-backup` — patrz `DOCS/D1_SETUP.md`.

## Wybór architektury: „tylko D1+Workers” vs Supabase Postgres

| Wariant | Zalety | Wastrzegi |
|---------|--------|-----------|
| **D1 + Worker (obecny kierunek)** | Niskie koszty, jeden model KV, łatwy backup JSON, zgodne z obecnym kodem. | SQL w D1; audyt i kv w jednej bazie — patrz retencja i limity. |
| **Postgres (Supabase) jako prawda** | RLS, relacje, zapytania, ekosystem Supabase. | Trzeba przenieść modele, możliwy duży refaktor; Worker tylko jako brama lub wcale. |

Główny **bloker merytoryczny** w obu: **jedna spójna, serwerowa baza** dla mutacji, którą respektują wszystkie klienty.

## Compliance poza repozytorium (IASME / Cyber Essentials)

- Zgłoszenie przez IASME, kwestionariusz, ewent. skan.
- Polityki: hasła, MFA, BYOD, incydenty, backup/restore (opis gdzie leżą kopie R2, kto ma dostęp), lista podwykonawców (Supabase, Cloudflare, Vercel, Stripe…), RODO.
- W repozytorium typowe **dowody techniczne** (gdy wdrożone w prod): `SECURITY.md`, nagłówki, HTTPS, brak sekretów w froncie, Sentry, MFA Supabase.
- Plan procesu + mapowanie backendu pod certyfikat: [CYBER_ESSENTIALS_PLAN.md](./CYBER_ESSENTIALS_PLAN.md); strona publiczna `/security`.
- **Billing (Stripe):** cztery ceny miesięczne GBP (`starter`→Solo, `team`, `business`, `enterprise`) + opcjonalny `enterprise_plus` tylko w DB (umowa); limity w `src/lib/billingPlans.js`; retry webhooków lokalnie: `npm run stripe:retry-webhooks` wymaga tych samych `STRIPE_PRICE_*` co Edge (patrz `scripts/stripe-retry-webhook-failures.mjs`).
- **Marketing / SEO:** `vite.config.js` wstrzykuje `og:image` / `twitter:image` (hero bloga PTW) przy buildzie z `VITE_PUBLIC_SITE_URL`; strona `/` ustawia też JSON-LD `@graph` (WebSite, Organization, SoftwareApplication) i meta z `useLandingHomeDocumentMeta`.

## Checklist operacyjna (krótko)

- [ ] `0001` + `0002` schemat na D1 **remote**
- [ ] `user_can_access_org_slug` w Supabase (SQL Editor, jeśli `db push` blokuje starsze migracje)
- [ ] `wrangler secret put AUDIT_CHAIN_SECRET` dla workera `d1-api`
- [ ] `VITE_D1_API_URL` w Vercel + Redeploy
- [ ] Worker `d1-backup`: `npm run d1:deploy:backup`; zrzuty w R2 pod `d1-snapshots/` (bucket w `cloudflare/workers/d1-backup/wrangler.toml`)

**Szczegółowy plan na dalsze prace (backlog, nowy chat):** [BACKEND_CONTINUATION_PLAN.md](./BACKEND_CONTINUATION_PLAN.md).
