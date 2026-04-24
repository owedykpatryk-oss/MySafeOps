# Vercel i prawda operacyjna (checklista)

Ten plik zbiera to, o czym była **cała ostatnia iteracja** konwersacji: FESS, logowanie, wsparcie, bezpieczeństwo, podpowiedzi IT.

Nie da się wypełnić Vercel **za Ciebie z repozytorium** — musisz (lub ktoś z uprawnieniami) wkleić zmienne w **Vercel → Project → Settings → Environment Variables** dla **Production** (i osobno **Preview** tam, gdzie poniżej jest uwaga „Preview”).

---

## 0. Tabela — co dodać w Vercel (nazwy tylko; wartości z `.env.local` / Supabase)

Jeśli masz już tylko `VITE_STORAGE_API_URL` i `VITE_STORAGE_UPLOAD_TOKEN`, **dodaj poniższe** w tej samej sekcji (All / Production + Preview zgodnie z praktyką — patrz kolumna „Zakres”).

| # | Zmienna | Typ | Po co | Zakres typowy |
|---|---------|-----|--------|----------------|
| 1 | `VITE_SUPABASE_URL` | `VITE_*` | Auth + backup; **bez tego** w buildzie używane są fallbacke w kodzie | Production + Preview (ten sam Supabase co lokalnie, chyba że masz osobny projekt na dev) |
| 2 | `VITE_SUPABASE_ANON_KEY` | `VITE_*` | Para z URL (klucz **anon** z Supabase → API) | j.w. |
| 3 | `VITE_PUBLIC_SITE_URL` | `VITE_*` | OG, RSS, sitemap, linki kanoniczne (np. `https://mysafeops.com` — **bez** `/` na końcu) | **Production:** domena prod. **Preview:** osobno host preview, np. `https://<projekt>.vercel.app` |
| 4 | `VITE_BLOG_POSTS_BASE_URL` | `VITE_*` | Linki do wpisów bloga (np. `https://mysafeops.com/blog`) |jak `VITE_PUBLIC_SITE_URL` per środowisko |
| 5 | `VITE_R2_PUBLIC_BASE_URL` | `VITE_*` | Publiczne URL-e plików R2 (jeśli używasz R2) | Production + Preview |
| 6 | `VITE_VAPID_PUBLIC_KEY` | `VITE_*` | Web Push w przeglądarce (klucz **publiczny**; prywatny tylko w Supabase Edge) | Production + Preview |
| 7 | `VITE_OPENWEATHER_API_KEY` | `VITE_*` | RAMS „pogoda” (opcjonalne; brak = Open-Meteo) | Jeśli używasz lokalnie — ten sam w prod |
| 8 | `VITE_STRIPE_PUBLISHABLE_KEY` | `VITE_*` | Stripe tylko **publishable** w UI | Production + Preview (często `pk_test_` na Preview) |
| 9 | `VITE_SUPPORT_EMAIL` | `VITE_*` | E-mail w UI / mailto (opcjonalne; w kodzie domyślnie `support@mysafeops.com`) | Production + Preview |
| 10 | `VITE_PLATFORM_OWNER_EMAIL` | `VITE_*` | Superadmin / owner — zgodnie z migracjami | Production |
| 11 | `VITE_ANTHROPIC_PROXY_URL` | `VITE_*` | AI w prod **bez** wkładania `VITE_ANTHROPIC_API_KEY` do bundla: ustaw np. `/api/anthropic-messages` | Production + Preview |
| 12 | `ANTHROPIC_API_KEY` | serwer (bez `VITE_`) | Serwer `api/anthropic-messages` — **nigdy** jako `VITE_*` | Production + Preview (osobne klucze per env możliwe) |
| 13 | `AI_PROXY_SHARED_SECRET` | serwer | Opcjonalnie: zabezpieczenie proxy; para z `VITE_AI_PROXY_SECRET` | Jeśli używasz |
| 14 | `VITE_AI_PROXY_SECRET` | `VITE_*` | Musi = `AI_PROXY_SHARED_SECRET` jeśli włączysz | j.w. |
| 15 | `VITE_SHOW_LOGIN_ADMIN_HINTS` | `VITE_*` | `true` tylko gdy chcesz podpowiedzi IT na `/login` w **produkcyjnym** bundlu | Zwykle puste / false; opcjonalnie `true` na Preview |
| 16 | `VITE_D1_API_URL` | `VITE_*` | URL workera D1 (np. `https://mysafeops-d1-api.<konto>.workers.dev`, **bez** `/` na końcu) — patrz `DOCS/D1_SETUP.md` | Production + Preview (gdy używasz D1) |

**Już masz w Vercel (nie duplikuj inaczej):** `VITE_STORAGE_API_URL`, `VITE_STORAGE_UPLOAD_TOKEN`.

**Nie dodawaj do Vercel (sekrety tylko lokalnie / Supabase Edge / Stripe po stronie serwera):** `VAPID_PRIVATE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `GOOGLE_OAUTH_CLIENT_SECRET` w sensie **frontend bundle** — OAuth konfigurujesz w **Supabase**, nie jako `VITE_GOOGLE_SECRET`. `OPENAI_API_KEY` tylko jeśli kiedyś podłączysz serwer używający go na Vercel (osobna funkcja).

---

## 1. Warto ustawić w Vercel (produkcja)

| Zmienna | Dlaczego |
|--------|----------|
| `VITE_SUPABASE_URL` | Własny projekt Supabase; bez tego w produkcji używane są **fallbacke w bundlu** (ostrzega `npm run env:check` i `console` przy buildzie). |
| `VITE_SUPABASE_ANON_KEY` | Jeden zestaw z URL — ten sam klucz **publiczny (anon)** z Supabase → Settings → API. |
| `VITE_SUPPORT_EMAIL` | Adres w UI / mailto (domyślnie `support@mysafeops.com`). Ustaw oficjalną skrzynkę, **nie** prywatną, jeśli to ma być zgodne z RODO/umowami. |
| `VITE_PUBLIC_SITE_URL` | Kanoniczna domena, np. `https://mysafeops.com` (bez ukośnika) — RSS, OG, sitemap, linki. |
| `VITE_PLATFORM_OWNER_EMAIL` | Email(e) właściciela platformy (superadmin) — zgodne z migracjami / RPC. |

**Preview (branch / PR):** zwykle trzeba osobno: `VITE_PUBLIC_SITE_URL` = `https://twoj-projekt.vercel.app` (lub właściwy host preview), inaczej OG/RSS wskazują na produkcyjny host.

---

## 2. Opcjonalne (tylko jeśli używasz funkcji)

| Zmienna | Gdzie to działa |
|--------|------------------|
| `VITE_ANTHROPIC_PROXY_URL` | Ustaw np. `/api/anthropic-messages` w prod. |
| `ANTHROPIC_API_KEY` | **Tylko Vercel (nie `VITE_*`)** — serwer w `api/anthropic-messages.js`. |
| `AI_PROXY_SHARED_SECRET` + `VITE_AI_PROXY_SECRET` | Ten sam „sekret” w dwóch zmiennych, jeśli włączysz zabezpieczenie proxy AI. |
| `VITE_SHOW_LOGIN_ADMIN_HINTS` | `true` tylko gdy chcesz **pokazywać** w produkcji rozwinięte podpowiedzi IT (Supabase, redirect) na `/login` i w Cloud account. Domyślnie **puste/false** = czyściej pod audyt. |
| `VITE_STRIPE_PUBLISHABLE_KEY` | Tylko jeśli Stripe w przeglądarce. |
| `VITE_SENTRY_DSN` | Tylko publiczny DSN. |
| `VITE_VAPID_PUBLIC_KEY` + sekrety **Supabase Edge** | Web Push: klucze prywatne tylko w Supabase, nie w Vite. |
| R2: `VITE_STORAGE_API_URL`, `VITE_STORAGE_UPLOAD_TOKEN`, `VITE_R2_PUBLIC_BASE_URL` | O ile używacie workera R2. |

`api/web-vitals.js` i limity ciała nie wymagają **nowych** zmiennych — działają out of the box.

---

## 3. Supabase (poza Vercel — tego Vercel nie wypełni)

- **Authentication → URL Configuration:** Site URL + **Redirect URLs** (każda domena, na której działa apka, np. `https://domena/login`, `.../reset-password`, `.../app`, lokalny `http://localhost:5173/...`).

---

## 4. Co możesz zrobić lokalnie po edycji `.env.local`

```bash
npm run env:check
```

Bez wypisywania sekretów — tylko checklista obecności kluczy i ostrzeżeń (m.in. brak `VITE_SUPABASE_*` vs fallbacke).

---

## 5. Podsumowanie „z konwersacji” (już w kodzie)

- Lepszy copy logowania, stopka, cookies, opcjonalne `VITE_SHOW_LOGIN_ADMIN_HINTS`.
- Bezpieczniejsze `?next=` (`safeInternalPath`), limity ciała na serverless, testy E2E pod `data-login-next`.
- To **nie wymaga** ręcznego przełączania nic w Vercel poza normalnymi zmiennymi z tabel — chyba że chcecie własny Supabase / wsparcie / preview URL / opcjonalnie podpowiedzi IT.

Po dodaniu zmiennych: **zapisz w Vercel** i wyzwól **redeploy** (lub “Redeploy” ostatniego buildu), żeby `VITE_*` trafiły do bundla.
