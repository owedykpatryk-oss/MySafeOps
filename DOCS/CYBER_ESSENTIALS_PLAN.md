# Plan: przygotowanie i przejście Cyber Essentials (UK) + backend

Ten dokument łączy **proces certyfikacji** (IASME / NCSC Cyber Essentials) z **dowodami technicznymi** w repozytorium MySafeOps. Nie zastępuje porady prawnej ani instrukcji samego dostawcy certyfikacji — zawsze weryfikuj aktualny kwestionariusz u wybranego **CAB** (Certification Body).

**Powiązane pliki w repo:** `SECURITY.md`, `vercel.json`, `public/_headers`, `public/.well-known/security.txt`, `DOCS/SERVER_SOURCE_OF_TRUTH.md`, `DOCS/BACKEND_CONTINUATION_PLAN.md`, `DOCS/D1_SETUP.md`, `DOCS/VERCEL_ENV_CHECKLIST.md`, strona publiczna `/security`.

---

## 1. Czym jest Cyber Essentials (poziom podstawowy)

To **brytyjski** program oceny technicznej organizacji (nie „certyfikat samej aplikacji”). Typowo:

1. Wybierasz **zakres** (np. cała firma, albo wybrane biuro + usługi IT).
2. Wypełniasz **kwestionariusz** u certyfikatora (np. przez IASME / innego CAB).
3. Dostarczasz **dowody**: polityki, zrzuty ekranu z paneli (Supabase MFA, hasła), opisy backupów, lista subprocessorów itd.
4. Wariant **Cyber Essentials** — samoocena + weryfikacja deklaracji. **Cyber Essentials Plus** — dodatkowy test techniczny (skan / testy) — osobny budżet i harmonogram.

Pięć obszarów technicznych (uproszczenie do mapowania na MySafeOps):

| Obszar NCSC | Co oceniają | Gdzie to u Ciebie (produkt + organizacja) |
|-------------|-------------|-------------------------------------------|
| **Zapory sieciowe i bramy** | Granica sieci, domyślne „deny”, sensowne reguły | Hosting: **Vercel** (edge), **Cloudflare** (Worker, opcjonalnie WAF), brak własnego serwera VPS w klasycznym sensie — opisz to jako „usługi zarządzane przez dostawców z TLS”. |
| **Bezpieczna konfiguracja** | Usunięte domyślne konta, twarde nagłówki, TLS 1.2+ | `vercel.json`, `public/_headers`, HTTPS wszędzie; konfiguracja **Supabase** (polityka haseł, MFA); brak sekretów w bundlu frontu (`VITE_*` tylko klucz publiczny). |
| **Kontrola dostępu użytkowników** | Konta służbowe, role, wyłączenia, MFA tam gdzie trzeba | **Supabase Auth** (logowanie), org roles w aplikacji (`admin` / `supervisor` / `operative`), RPC `user_can_access_org_slug`, `user_can_read_org_audit`; zaproszenia; ewent. MFA wymuszane w Dashboard Supabase. |
| **Ochrona przed malware** | Antywirus na laptopach + sensownie na serwerach | **Stacja robocza:** Microsoft Defender / EDR (polityka firmy). **Chmura:** model serverless — opisz jako „brak tradycyjnego OS na serwerze aplikacji; aktualizacje platformy u dostawcy”. |
| **Zarządzanie aktualizacjami** | Patchowanie w 14 dni (krytyczne) | **npm / zależności:** `npm audit`, CI (np. tygodniowy job); **Vercel / Cloudflare / Supabase:** aktualizacje platformy u operatora — zrzuty z ustawień / deklaracja procesu. |

---

## 2. Fazy planu (kalendarz roboczy — dostosuj do CAB)

### Faza 0 — Scope i właściciel (1–2 tygodnie)

- [ ] **Właściciel certyfikacji** (jedna osoba + zastępca): kontakt z CAB, zbiór dowodów.
- [ ] **Granica zakresu:** czy certyfikujesz całą spółkę, czy tylko „zespół produktu + infrastruktura MySafeOps”.
- [ ] **Rejestr aktywów:** laptopy, telefony, domeny, konta admina (Supabase, Cloudflare, Vercel, Stripe, DNS), repozytoria Git.
- [ ] **Lista podwykonawców (subprocessors)** z krótkim opisem roli: Supabase, Vercel, Cloudflare, Stripe, ewent. Sentry, e-mail.

### Faza 1 — Polityki minimum (równolegle z Fazą 0)

Minimum, które CAB zwykle chce zobaczyć (wersje PDF z datą i właścicielem):

- [ ] Polityka haseł i uwierzytelniania (MFA dla adminów chmury i — jeśli deklarujesz — dla użytkowników aplikacji).
- [ ] Polityka urządzeń końcowych / BYOD (jeśli dotyczy).
- [ ] Procedura incydentów (kto reaguje, jak eskalować, 24h/48h).
- [ ] Backup i odtwarzanie: **gdzie są kopie D1** (R2 `d1-snapshots/`), **jak często** (cron `d1-backup`), **kto ma dostęp** do kont Cloudflare, **test odtworzenia** (np. kwartalnie — wpis w kalendarzu).
- [ ] RODO: DPA z kluczowymi procesorami (Supabase itd.) — często osobna teczka, nie w repo.

### Faza 2 — Dowody techniczne z produktu (2–4 tygodnie)

- [ ] Zrzuty: Supabase — Authentication settings, MFA, password policy, (jeśli jest) rate limiting.
- [ ] Zrzuty: Vercel / Cloudflare — TLS, ewent. WAF.
- [ ] Wynik zewnętrzny: `securityheaders.com` / SSL Labs (jak w `CURSOR_BRIEF_FESS_READINESS.md` — cele A / A+).
- [ ] **Żywe linki:** `https://…/.well-known/security.txt`, strona **`/security`** (postura dla procurement).
- [ ] Opis ścieżki kodu: `SECURITY.md` w repo + link z `/security`.

### Faza 3 — Kwestionariusz i luki (1–2 tygodnie)

- [ ] Wypełnienie kwestionariusza w portalu CAB.
- [ ] Lista luk → remediation (np. brak MFA na koncie X — włączyć w 48 h).
- [ ] Dopisanie **dowodu po naprawie** (nowy zrzut / data zmiany).

### Faza 4 — Złożenie i certyfikat

- [ ] Final review z CAB → **certyfikat** (ważność zwykle 12 miesięcy).
- [ ] **Renewal:** wpis w kalendarzu na 10–11 miesiąc + aktualizacja rejestru aktywów.

---

## 3. Backend i infrastruktura — mapa pod certyfikat

To jest sekcja „**co audytor rozumie jako backend**”, spójna z kodem w tym repo.

### 3.1 Warstwa aplikacji (klient)

| Element | Rola w bezpieczeństwie |
|---------|-------------------------|
| Vite + React SPA | Brak trzymania **sekretów** serwera w JS; tylko `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, itd. |
| `localStorage` | Dane org na urządzeniu — w kwestionariuszu opisz jako „cache / offline”; **źródło prawdy w chmurze** tam, gdzie włączone D1 sync (patrz D1). |
| `pushAudit` + D1 | Ślad działań; odczyt łańcucha audytu na serwerze wg RPC (admin/supervisor). |

### 3.2 Supabase (Postgres, Auth, Edge Functions)

| Element | Dowód / działanie |
|---------|-------------------|
| Auth | Logowanie email/hasło, OAuth; **wymusz MFA** w Dashboard dla zespołu operacyjnego. |
| RLS | Tabele z danymi użytkowników — polityki w migracjach `supabase/migrations/`. |
| RPC | `user_can_access_org_slug`, `user_can_read_org_audit`, `ensure_my_org` — izolacja org. |
| Edge Functions | `stripe-checkout`, `stripe-portal`, `stripe-webhook` — **sekret Stripe tylko po stronie funkcji**, nie w przeglądarce. |
| Sekrety | Wyłącznie w Supabase Secrets / nie w repozytorium. |

### 3.3 Cloudflare (D1 API + backup)

| Element | Dowód / działanie |
|---------|-------------------|
| Worker `d1-api` | JWT → Supabase RPC przed dostępem do KV/audytu; `AUDIT_CHAIN_SECRET` w `wrangler secret`. |
| Worker `d1-backup` | Cron → zrzuty JSON do **R2** (`d1-snapshots/`); procedura odtwarzania opisana w polityce backupu (Faza 1). |
| D1 | SQLite — schematy w `cloudflare/workers/d1-api/schema/`; wykonanie na remote przez `wrangler d1 execute` (patrz `DOCS/D1_SETUP.md`). |

### 3.4 Stripe

| Element | Dowód / działanie |
|---------|-------------------|
| Billing | Checkout / Portal przez Edge Functions; brak `sk_live_*` w froncie. |

### 3.5 Vercel

| Element | Dowód / działanie |
|---------|-------------------|
| Hosting SPA | `vercel.json` — HSTS, CSP, cache; zmienne środowiskowe tylko build-time dla `VITE_*`. |

### 3.6 Proces (nie kod)

| Element | Sugestia |
|---------|----------|
| `npm audit` | Job w GitHub Actions (np. co tydzień) + reakcja na high/critical w SLA 14 dni. |
| Dostęp admina | 2 osoby, MFA, recenzja co kwartał (lista w arkuszu). |

---

## 4. Backlog techniczny powiązany z CE (priorytet)

Wiele pozycji jest już w `DOCS/FESS/CURSOR_BRIEF_FESS_READINESS.md` (Phase 2). Skrót:

1. **Już w repo:** nagłówki (`vercel.json`, `public/_headers`), `security.txt`, `SECURITY.md`, strona `/security` (trust + subprocessory + CI), E2E: `tests/e2e/security.spec.js` (Playwright w `.github/workflows/ci.yml`).
2. **Supabase:** MFA dla wszystkich kont operacyjnych; polityka haseł; ewent. rate limit na logowanie (jeśli CAB pyta o brute-force).
3. **CI:** na każdym push/PR: `npm audit --audit-level=high`, lint, testy Vitest, Playwright (blog, landing, **security**), `npm run build` — plik `.github/workflows/ci.yml`. Utrzymuj zieloność; na critical reaguj w SLA z kwestionariusza (zwykle 14 dni).
4. **Monitoring:** Sentry (`VITE_SENTRY_DSN`), uptime (np. Better Stack / UptimeRobot) — zrzut konfiguracji jako dowód.
5. **Backup:** potwierdzenie w R2 + **jeden** udokumentowany test restore (nawet na staging).

---

## 5. Co robić w pierwszym tygodniu „wdrożenia”

1. Przeczytaj aktualny **self-assessment** u wybranego CAB (IASME lub inny).
2. Utwórz folder (poza repo lub prywatny drive): `CE-2026-evidence/` z podfolderami `firewalls`, `config`, `access`, `malware`, `patching`.
3. Wypełnij **Rejestr aktywów** jednym arkuszem.
4. W repozytorium: trzymaj `SECURITY.md` aktualnym; po deploy sprawdź **`/.well-known/security.txt`** i **`/security`** na produkcji.
5. Backend: dokończ checklistę z `DOCS/BACKEND_CONTINUATION_PLAN.md` sekcja C (D1 remote, secrets, migracje Supabase) — to są **twarde** dowody działającej izolacji i backupu.

---

*Dokument roboczy — aktualizuj po wyborze CAB i po audycie wewnętrznym.*
