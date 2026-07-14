# Backlog — UX / performance / tech (wróć tutaj)

Krótka lista rzeczy **świadomie odłożonych** (nie zrobione w ostatnim refaktorze list). Oznacz datę przy odbiorze.

---

## Konwersacja 2026-07-14 — PTW, Project Drawing, security (zapis na później)

**Zrobione w PR [#5](https://github.com/owedykpatryk-oss/MySafeOps/pull/5)** (`fix/mobile-ptw-studio-perf-security`): PTW Configuration Studio, conflict matrix grid, live preview, first-run guide, audit dashboard, conditional rules board, workflow designer (SVG), role matrix, dependency flow chart, integracje Slack/Teams/webhook + walidacja URL, security (CORS, rate limits), performance (lazy studio, SIMOPS bucketing, `permits-studio` chunk).

### Ops / merge (nie kod)

- [ ] **Merge PR #5** i smoke na preview/prod.
- [ ] **Redeploy Supabase Edge Functions** z `_shared/corsHeaders.ts`; ustawić `SITE_URL`, opcjonalnie `EDGE_CORS_ALLOWED_ORIGINS`.
- [ ] **Turnstile prod** — `npm run setup:turnstile:all` (doctor nadal ostrzega o TEST secret w `config.toml`).
- [ ] **Osobny PR** dla niezacommitowanego WIP (~47 plików): Project Drawing, Workers, RAMS, `d1ArrayMerge`, demo SQL w `DOCS/FESS/Extra/_*` — **nie** wrzucać do main bez review.

### PTW — produkt (pozostało z roadmapy)

- [ ] **No-code dependency rules** — pełny builder (2 kliknięcia: „Confined space wymaga active LOTOTO”); dziś jest flow chart + JSON/engine, bez edytora reguł jak workflow.
- [ ] **Workflow designer z drag-and-drop** — dozwolone przejścia stanów jak BPM; dziś SVG + lista, bez przeciągania krawędzi.
- [ ] **AI assist widoczny w formularzu** — przycisk „Draft scope from RAMS/location” z loadingiem; `suggestPermitDescriptionText` istnieje, ale jest schowany.
- [ ] **Integracja kalendarzowa** — placeholder w adapterach; albo ukryć w UI, albo zrobić jedną realną (webhook `issued`/`blocked` już jest).
- [ ] **Readiness score na karcie listy** — `computePermitActivationReadiness` jest w szczegółach; rozszerzyć na każdą kartę permitu z „Fix N items to activate”.
- [ ] **TV wall — dopolerowanie kiosk** — auto-refresh co N sekund, jeszcze większe fonty, opcjonalny dźwięk przy nowym expired (część jest: fullscreen + sound toggle).
- [ ] **Supervisor spotlight tour** — guide ma skróconą ścieżkę supervisor; brak pełnego tour Quick issue → list → TV wall krok po kroku.
- [ ] **E2E Playwright** — guide + studio tabs (dziś głównie unit testy).

### PTW — tech debt

- [ ] **Wirtualizacja listy permitów** (`@tanstack/react-virtual` / `react-window` — brak w `package.json`).
- [ ] **Webhook dispatch po stronie Edge** — usunąć całkowicie SSRF z przeglądarki (test + fan-out tylko server-side).
- [ ] **Rozbicie `PermitSystem.jsx`** (~9k linii) → `usePermitAdmin`, `usePermitAudit`, `PermitOpsLayout`.

### Project Drawing — WIP lokalnie (pliki są, **nie** w PR #5)

Zaimplementowane lokalnie, niezacommitowane: escape routes panel, map layers, readiness score, site pack export, smart bar, emergency intel.

- [ ] **Commit + PR** dla powyższego WIP (osobna gałąź).
- [ ] **Przeciąganie punktów trasy** ewakuacyjnej na mapie/planie.
- [ ] **Narzędzie Route** dla `pedestrian_route` / `vehicle_route` (ujednolicić z escape route).
- [ ] **Pomiary poligonów** — powierzchnia m² (GPS) / przybliżona na planie.
- [ ] **PDF → plan** — „Convert to PNG and draw” lub viewer z nakładką (jak permit plan overlay).
- [ ] **Toggle Auto-find A&E** przy otwarciu mapy.
- [ ] **Smart snap** — rogi granicy, istniejące markery, opcjonalna siatka OS.
- [ ] **Panel obiektów** — filtr, sort, „jump to on map”, grupowanie po typie.
- [ ] **Mobile / tablet** — większe narzędzia, pinch zoom, tryb „place only”.
- [ ] **Legenda na eksporcie PNG** — mini-legenda kolorów/typów w rogu.
- [ ] **Rozbicie `ProjectDrawingEditor.jsx`** (~3500 linii).
- [ ] **Permits: pick from drawing** — wybór punktów/stref przy tworzeniu PTW.
- [ ] **Survey / geo photos na mapie** — te same warstwy co muster i A&E.
- [ ] **Audit trail edytora** — kto dodał boundary, kiedy zapisano trasę A&E.

### Inne z sesji (poza scope PR #5)

- [ ] **Persist nowych projektów** — wcześniejsza analiza flow `Workers.jsx` → `useD1WorkersProjectsSync` → D1 (smoke gdy user zgłasza brak zapisu).
- [ ] **Blog RSS** — build regeneruje `public/blog/rss.xml`; 3 ostrzeżenia `verify:blog` (PL artykuł IOR).

---

## Listy i render

- [ ] **Dostępność (a11y) przy „Show more”**: `aria-live="polite"` przy zmianie liczby widocznych wierszy; opcjonalnie przeniesienie fokusu / scroll do pierwszego nowo pokazanego wiersza.
- [ ] **Wirtualizacja** (@tanstack/react-virtual lub podobne) dla list rzadko ale potencjalnie bardzo długich (setki–tysiące wierszy w jednym widoku); „Show more” zostaje lub zamiana na nieskończony scroll.
- [ ] **Wspólny komponent stopki** (np. `RegisterListPagingFooter`) — jeden JSX zamiast powielania w wielu modułach.
- [ ] **Trwały rozmiar strony w sesji** — `sessionStorage` per moduł (opcjonalnie), żeby po odświeżeniu zachować „rozwinęliśmy listę”.

## Duże ekrany (osobna decyzja)

- [ ] `DailyBriefing.jsx` — długie `filtered.map` / karty: czy ten sam wzorzec paging + `content-visibility`.
- [ ] `PermitSystem.jsx` — bardzo duży plik; wyłącznie tam, gdzie lista jest rzeczywiście długa (profilowanie / realne dane).

## Backend / admin

- [x] Rozszerzony RPC `superadmin_platform_stats` + panel (trialing, past_due/unpaid, orgy bez członków, pending invites, anty-wyścig przy refresh, kopiowanie).
- [x] RPC `superadmin_recent_organisations` + tabela w panelu + indeks `org_invites_pending_expires_idx` + eksport CSV/JSON.
- [ ] **Superadmin dalej**: paginacja / „load more” dla setek org; healthcheck Edge Functions; eksport CSV samej chmury bez localStorage.
- [ ] Przegląd indeksów pod zapytania RPC (org_invites, org_memberships), RLS, smoke na stagingu.

## Jakość kodu

- [ ] Spójność **react-hooks/exhaustive-deps** tam, gdzie `useEffect` woła `listPg.reset()` — upewnić się, że reguły ESLint są zgodne z intencją (bez fałszywych pętli).

---

*Ostatnia aktualizacja: 2026-07-14 — backlog z konwersacji PTW / Project Drawing / security + wcześniejszy list paging.*
