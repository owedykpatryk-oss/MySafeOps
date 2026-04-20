# Backlog — UX / performance / tech (wróć tutaj)

Krótka lista rzeczy **świadomie odłożonych** (nie zrobione w ostatnim refaktorze list). Oznacz datę przy odbiorze.

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

*Ostatnia aktualizacja: list paging refaktor + SuperAdmin RPC extend + UI.*
