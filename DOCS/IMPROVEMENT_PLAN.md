# Plan ulepszeń (niewdrożone z rozmów / kontekstu)

Skonsolidowana lista pomysłów wspomnianych przy budowie MySafeOps (RAMS, Workers, mapa, auth, UI, backup), które **nie zostały** zaimplementowane w tym wątku lub tylko częściowo. Służy jako backlog priorytetyzacji — nie jest obietnicą zakresu.

---

## Już zrobione (skrót — nie duplikować)

- RAMS: import JSON, mapowanie `operativeIds` po nazwach z eksportu, sort listy, share link, sekcje/druk, weather/map/hospital, `safeHttpUrl` na linkach.
- Workers: wybór ludzi z listy (briefing, toolbox, permits) zamiast `prompt()`.
- Google OAuth + PKCE, nagłówki Vercel, meta referrer, `PageHero` na wybranych ekranach, refresh `moduleStyles` / tła.
- **Site map** (Leaflet, presence, projekty z lat/lng, geokod).
- **Cache geokodowania** (30 dni, max 64 wpisy).
- **Backup**: klucze `_*orgId` obejmują m.in. `mysafeops_site_presence_*` (automatycznie).
- `getWorkspaceTitle`: poprawka tytułu przy wejściu z **More**.
- **A2**: Leaflet `invalidateSize()` po `resize` / `orientationchange` + `ResizeObserver` na kontenerze mapy (`SitePresenceMap.jsx`).
- **A1 (część)**: **PageHero** na Permits, CDM, Method statement, Emergency contacts, Help & about (`PageHero` + przyciski akcji w `right` gdzie były).
- **A4**: sekcja **What’s new** w Help / About (site map, Google login, RAMS import, share link + ograniczenia).
- **Reorganizacja (2026)**: wspólny [`src/utils/orgStorage.js`](src/utils/orgStorage.js) (`getOrgId`, `orgScopedKey`, `loadOrgScoped`, `saveOrgScoped`) zamiast setek linii `sk`/`load`/`save` w modułach.
- **PageHero** na **wszystkich** głównych widokach workspace (łącznie z rejestrami, AI, Settings: Cloud / Org / Notifications), spójny nagłówek jak Dashboard.

---

## Reorganizacja i jakość (backlog + status)

| Temat | Status / uwagi |
|-------|----------------|
| **More — grupy + filtr** | **Zrobione:** [`src/navigation/appModules.js`](src/navigation/appModules.js) (`MORE_SECTIONS`), [`src/layout/MainAppLayout.jsx`](src/layout/MainAppLayout.jsx) (render sekcji + pole „Filter modules…”). |
| **orgStorage** | **Zrobione** — jeden moduł, migracja plików w `src/`, bez zmiany formatu kluczy `_*orgId`. |
| **PageHero — pełne pokrycie** | **Zrobione** — wszystkie moduły z `VIEW_COMPONENTS` + bloki Settings; README: kanoniczny kod w `src/`, `DOCS/` tylko dokumentacja. |
| **README — Project layout** | Krótka sekcja w korzeniu repo: nie mylić `DOCS/*.jsx` ze źródłem aplikacji. |

**Bez zmiany zakresu w tej samej iteracji (nadal backlog):** **B2** (global search), **A3** (selektor okresu na dashboardzie), pełne **D1**, **C1–C3**.

---

## Priorytet A — szybkie, wysoki stosunek efekt / praca

| # | Pomysł | Uwagi |
|---|--------|--------|
| A1 | **PageHero** na pozostałych modułach (Permits, CDM, Method statement, Emergency, Help jako nagłówek, itd.) | ~~Zrobione: pełne pokrycie workspace + wcześniejsze PTW, CDM, MS, Emergency, Help.~~ |
| A2 | **Leaflet `invalidateSize()`** po resize okna / zmianie orientacji (Site map) | ~~Zrobione.~~ |
| A3 | **Dashboard: selektor okresu** (`period` był usunięty jako martwy kod) | Podpiąć pod wykresy/metryki tam, gdzie ma sens (np. incydenty). |
| A4 | **Help / About**: krótka sekcja nowych funkcji | ~~Zrobione (What’s new).~~ |
| A5 | **Opcjonalny eksport cache geokodu** w backupie | Klucz globalny `mysafeops_geocode_cache` — świadomie poza org; checkbox w Backup. |

---

## Priorytet B — produkt / dane

| # | Pomysł | Uwagi |
|---|--------|--------|
| B1 | **Daily briefing → Site map**: jednym przyciskiem zasugerować / wypełnić presence z dzisiejszego briefingu (lokalizacja + obecni) | Wymaga uzgodnienia reguł (np. tylko „present + sig”). |
| B2 | **Jedno wyszukiwanie globalne** | Skan localStorage / lekkie indeksy: workers, RAMS meta, permits, projekty (wspomniane w backlogu produktu). |
| B3 | **Import RAMS**: dodatkowe dopasowanie operatives po emailu / nazwie** gdy brak `_mysafeops_export`** | Obecnie tylko ID lub eksport z nazwami. |
| B4 | **Offline queue** dla zapisów RAMS / krytycznych akcji | Trudniejsze przy czystym localStorage; ewentualnie kolejka do sync. |

---

## Priorytet C — bezpieczeństwo i produkcja

| # | Pomysł | Uwagi |
|---|--------|--------|
| C1 | **Klucze AI** (`VITE_ANTHROPIC_*`) tylko przez backend / Worker proxy | Nie w bundlu przeglądarki. |
| C2 | **MFA** dla kont Supabase (hasło) | Włączenie w projekcie Supabase + ewentualny komunikat w UI. |
| C3 | **CSP (Content-Security-Policy)** | Wymaga listy domen (Supabase, OSM tiles, Nominatim, fonty); stopniowo lub report-only. |
| C4 | **Rate limiting** po stronie własnego proxy dla Nominatim | Jeśli ruch rośnie; cache już ogranicza część zapytań. |

---

## Priorytet D — chmura i synchronizacja

| # | Pomysł | Uwagi |
|---|--------|--------|
| D1 | **Pełne spięcie Backup ↔ `app_sync`** (upload/pobranie JSON przy zalogowanym użytkowniku) | Migracja SQL już istnieje; UI cloud częściowo — dopiąć edge cases i komunikaty. |
| D2 | **Udostępnianie RAMS między urządzeniami** bez tego samego profilu przeglądarki | Wymaga backendu lub sync; share link obecnie = ten sam localStorage. |
| D3 | **Szyfrowanie payloadu backupu** przed zapisem w `app_sync` + klucz użytkownika | Większy zakres kryptograficzny. |

---

## Priorytet E — „Processing-tracker parity” / duży zakres

| # | Pomysł | Uwagi |
|---|--------|--------|
| E1 | Pełniejsza mapa (KML, warstwy, historia) | Poza obecną Site map. |
| E2 | Historia wersji RAMS w bazie | Obecnie głównie dokument + hash w localStorage. |
| E3 | Stripe / PDF lib / search jak w prototypie | Zob. `DOCS/PRODUCT_SCOPE.md`. |
| E4 | **GPS / „kto jest tu teraz” w czasie rzeczywistym** | Wymaga aplikacji mobilnej lub integracji — nie da się wiarygodnie tylko z przeglądarką desktop. |

---

## Sugerowana kolejność realizacji (subiektywnie)

1. ~~A2 → A1 → A4~~ (wykonane dla wymienionych ekranów)  
2. B1 lub B2 (zależnie od tego, czy ważniejsza jest mapa czy discoverability)  
3. D1  
4. C1 / C2 wg potrzeb wdrożenia produkcyjnego  
5. Pozostałe wg czasu

---

*Ostatnia aktualizacja: zebrał asystent z kontekstu konwersacji o MySafeOps (2026).*
