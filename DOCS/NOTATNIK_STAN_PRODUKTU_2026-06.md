# MySafeOps — notatnik stanu produktu (czerwiec 2026)

Dokument wewnętrzny: **co aplikacja ma dziś**, moduł po module, jakie obszary regulacyjne obejmuje i jak moduły się łączą.  
Źródło prawdy: kod w `src/`, `api/`, konfiguracja nawigacji (`src/navigation/appModules.js`).  
Produkcja: **https://mysafeops.com** · aplikacja: **/app**

---

## 1. Czym jest MySafeOps (jednym zdaniem)

Platforma H&S / compliance dla UK construction, surveying i food/pharma — **RAMS, permit to work, rejestry HSE, projekty, dokumenty, offline, opcjonalna chmura (Supabase + Cloudflare D1/R2), portale klienta i podwykonawcy**.

**Nie jest:** pełnym ERP, CRM, job costing, księgowością, harmonogramem zasobów ani systemem board KPI dla całej grupy kapitałowej.

---

## 2. Nawigacja — jak użytkownik widzi produkt

### Dolny pasek (główne zakładki)

| Zakładka | Moduł | Rola |
|----------|-------|------|
| **Dashboard** | Analytics / KPI | Start dnia, alerty, wykresy, onboarding |
| **Projects** | Projekty / place budowy | Hub — wszystko przypięte do projektu |
| **Permits** | Permit to Work (PTW) | 15 typów permitów, workflow, tablice |
| **RAMS** | Risk Assessment & Method Statement | Macierz ryzyka, druk A4, pakiety surveying |
| **People** | Pracownicy / kompetencje | Certyfikaty, ważność, przypisanie do RAMS |
| **Bin** | Kosz | Przywracanie soft-delete z rejestrów |
| **More** | Siatka ~60+ modułów | Reszta funkcji pogrupowana tematycznie |

### More — sekcje

1. **Site operations** — rysunki, method statement, CDM, briefing, induction, podpisy, timesheety, snagi, geo-zdjęcia, dokumenty, portale, sprzedaż  
2. **Health, safety & environment** — ~30 rejestrów HSE (COSHH, incydenty, PPE, fire, LOTO, food/pharma…)  
3. **Insights & reports** — analityka, raport miesięczny, survey report, szablony  
4. **Data & app** — enterprise readiness, backup, audit, superadmin, pomoc, ustawienia  

### Ukryte trasy (deep link)

- `site-map` — mapa obecności / site presence  
- `ai-rams`, `ai-toolbox`, `ai-photo` — generatory AI (trasy istnieją; w More często ukryte do czasu „Assist”)  
- `?portal=TOKEN` — **client portal** (publiczny, read-only)  
- `?subcontractor=TOKEN` — **portal podwykonawcy** (RAMS + upload certów)  

### Ustawienia (Settings centre)

Cloud account · Billing (Stripe) · Invites · Members · Organisation (branding, moduły) · Automation · Notifications · Developer (feature flags)

---

## 3. Projekty (Projects) — centralny hub

**Co robi:** tworzenie i prowadzenie place budowy / kontraktów.

**Funkcje:**
- Kreator projektu (wieloetapowy), adres, współrzędne mapy, notatki dostępu  
- **Playbooki** przy tworzeniu projektu (deterministyczne, bez AI): utility mapping PAS128, groundworks, electrical, refurb, confined space, general — auto-szkice RAMS, survey, PTW, method statement  
- Readiness / score projektu (brakujące RAMS, permit, briefing, CDM itd.)  
- Powiązania: RAMS, permitty, survey, geo-photos, snagi, timesheety, CDM pack  
- Profile workspace (surveying, food/pharma, demolition…) — pokazują/ukrywają moduły  

**Areas covered:** organizacja pracy na budowie, nie rozliczenia finansowe.

---

## 4. RAMS — pełny zakres

**Wejście:** zakładka RAMS → `RAMSTemplateBuilder`

### Cykl życia dokumentu
- Statusy: `draft` → `internal_review` → `approved` → `issued`  
- Auto numer dokumentu (`RAMS-YYYY-xxxxx`), autosave szkiców  
- QA score (ocena A–E), tryb strict QA (min. kontrole, hold points, role)  
- Duplikacja, batch do wielu projektów, import/export JSON, kosz  
- Sync D1 (opcjonalnie)

### Macierz ryzyka
- Biblioteka zagrożeń (core + extended + Pro deep library)  
- Macierz 5×5 (L×S), ryzyko początkowe i resztkowe  
- Środki kontroli, PPE, odniesienia do przepisów UK per wiersz  
- Szablony aktywności organizacji, quick packs (surveying, hot works, electrical)  
- Kontrole fazowe: pre-start / during / close-out, hold points, przypisanie ról  

### Sekcje druku A4 / PDF
Okładka i dane · Pogoda na budowie · Mapa/lokalizacja · Najbliższy A&E · Kompetencje operative (opcjonalnie) · Macierz ryzyka · Podpisy · Hash integralności dokumentu  

### Kontekst placu
- Pogoda (Open-Meteo domyślnie; OpenWeather opcjonalnie)  
- Geokodowanie, link Google Maps  
- Najbliższy szpital / A&E  
- Certyfikaty operative z People (stan ważności)

### Pakiety branżowe RAMS
**Trade:** general, electrical, refurb/build, groundworks  

**Surveying / geodezja (15+ starterów):** PAS128 utility mapping, topo, GPR, CCTV drainage, jetting/HPWJ, wejście do studni, trial holes, window sampling, borehole/GI, foundation exposure, soakaway, vacuum excavation, korytarz drogowy, revalidacja utilities, naprawa kanalizacji, rail/public infrastructure  

**Food/pharma (sekcje opcjonalne):** allergen & food-production, surveying PAS128  

### Integracje RAMS
- Projekt · propagacja między projektami  
- Survey report (cross-link)  
- Automatyzacja: PTW wymaga site RAMS (reguła org)  
- AI prefill (`ai-rams` → builder) gdy skonfigurowany Anthropic proxy  

**Areas covered:** CDM (RAMS jako dowód planowania), HSE risk assessment, method statement content, surveying method statements, LOLER/height themes w wierszach ryzyka (nie zastępuje formalnego PTW).

---

## 5. Permity (Permit to Work) — pełny zakres

### 15 typów permitów (`permitTypes.js`)

| Klucz | Nazwa (EN) | Typowy use case |
|-------|------------|-----------------|
| `hot_work` | Hot work | Spawanie, szlifowanie, iskry |
| `electrical` | Electrical isolation | Praca przy instalacji, LOTO |
| `work_at_height` | Work at height | >2 m, rusztowania, drabiny |
| `confined_space` | Confined space | Studnie, zbiorniki, kanały |
| `excavation` | Permit to dig | Wykopy, core, utility strike prevention |
| `lifting` | Lifting operations | Dźwigi, LOLER |
| `cold_work` | Cold work | Konserwacja bez gorącej pracy |
| `line_break` | Line break | Otwarcie rurociągu pod ciśnieniem |
| `roof_access` | Roof access | Dach płaski/skuty |
| `night_works` | Night / OOH works | Prace nocne/weekend |
| `valve_isolation` | Valve isolation | Procesowe zawory (food/chem) |
| `visitor_access` | Visitor access | Audytorzy, klienci na site |
| `radiography` | Radiography | RTG / źródła jonizujące |
| `ground_disturbance` | Ground disturbance | Pale, kotwy, głębsze niż CAT |
| `general` | General PTW | Prace ogólne |

Każdy typ: checklist UK, pola dodatkowe, kolor/ikona, powiązania compliance matrix.

### Workflow
- Stany: `draft` → `ready_for_review` / `pending_review` → `approved` → `issued` / `active` → `suspended` / `closed` / `expired`  
- Role: admin, supervisor — przejścia zależne od roli  
- SLA review/activation, przypomnienia, eskalacje  
- Quality gates przed wydaniem; hard-stopy prawne (CDM, SHE, LOLER, PUWER, WAHR)

### Widoki UX
- Lista · **Board** · **Timeline** · **Live Wall** (flagi)  
- Builder krokowy, katalog szablonów per typ (wersjonowane checklisty)  
- Podgląd A4 na żywo (PrintPreviewFrame)  
- Export PDF, evidence pack (CSV + struktura)

### Dowody i dokumenty
- Checklist z wymaganymi punktami  
- Notatki dowodowe, zdjęcie (URL lub R2 bucket `permit-evidence`)  
- Site pack export (RAMS + permitty jednego projektu)  
- Audit export (Supabase Edge, gdy wdrożony)

### Inteligencja bezpieczeństwa
- **SIMOPS** — konflikty nakładających się permitów (lokalizacja/czas)  
- Reguły zależności (np. confined space → aktywny LOTO)  
- Rejestr incydentów permitowych → główny moduł incydentów  
- Shift handover (ack supervisorów)

### Integracje permitów
- Projekt, RAMS, rysunki (plan overlay na site plan)  
- Powiadomienia (email, web push; adaptery Slack/Teams — stuby)  
- Sync D1  

**Areas covered:** Permit to Work (HSE), hot work, isolation, height, confined space, excavation (HSG47 themes), lifting (LOLER), radiography (IRR themes), visitor control.

---

## 6. Survey Report (raport geodezyjny / PAS128)

**Typy survey:** utility mapping (PAS128), topo, GPR, EML/CAT, CCTV drainage, GNSS control, laser scanning, UAV, setting out, general  

**PAS128:** poziomy jakości B4–B0, harmonogram utilities, statystyki QL, bramki kompletności przed final/export  

**Funkcje:**
- Okładka A4, scope, methodology, equipment, weather, findings, limitations  
- Import geo-photos, snapshoty site plan z markup  
- Import CAD/DXF — długości linii, wykresy utility, donut QL  
- Revision control, historia rewizji  
- Live preview dock, druk/PDF, batch export pack  
- **Smart assist:** auto-fill, weather, templates, **AI polish** sekcji (Anthropic proxy)  
- Sync D1  

**Areas covered:** PAS 128 (utility survey reporting), HSG47 / safe digging narrative, powiązanie z RAMS surveying packs.

---

## 7. Site operations — moduły szczegółowo

### Drawings (project-drawings)
- Upload planów (PDF/raster), markup: trasy ewakuacji, strefy, zasoby awaryjne  
- Geo anchor, eksport KML/GPX  
- Integracja: permit location overlay, site map  

### Method statement
- Osobny dokument MS powiązany z projektem, szablony org, druk  

### CDM compliance
- Checklist duty holders (Client, PD, PC, Designer, Contractor)  
- Kalkulator notifiable (person-days, workers, faza) + F10  
- **14 sekcji Construction Phase Plan** (welfare, fire, asbestos, services, traffic…)  
- PCI / H&S file summary, notatki CDM 2026  
- Sync D1  

### Daily briefing
- Briefing dzienny: pogoda, tematy, zakres, obecność, podpis canvas  
- Zasila **site presence map**  
- Sync D1  

### QR induction
- Strony induction z kodem QR  
- Flow pracownika: dane → checklist → podpis  
- Rejestr sign-on  

### Signatures (Digital signature)
- Przechwytywanie podpisu na dokumentach  

### Timesheets
- Godziny per worker per projekt, siatka tygodnia ISO  
- **Nie:** job costing, stawki, faktury — tylko rejestr czasu  
- Sync D1  

### Snags
- Lista usterek: ref, tytuł, status, priorytet, zdjęcia, projekt  
- Geo-photo → draft snaga  
- Sync D1  

### Geo-photos
- Zdjęcia GPS z presetami (dostęp, hazard, utility, trial pit, manhole…)  
- Mapa, bearing overlay, checklist mobilizacji  
- Push do survey report, GeoJSON, snag draft  
- Sync D1  

### Documents
- Przeglądarka folderów lokalnych; opcjonalny upload R2  

### Client portal
- Link tokenowy `?portal=TOKEN` — **read-only** dla klienta  
- Widok: compliance score, workers, aktywne permitty, RAMS, snagi, wygasłe certy  
- Scope: per projekt  

### Subcontractor portal
- Link `?subcontractor=TOKEN`  
- Podsumowanie RAMS + upload certyfikatów  

### Client acquisition / Sales enablement
- Playbooki sprzedażowe (flagi growth) — nie CRM  

### Site map (ukryta trasa)
- Projekty na mapie, obecność z briefingów, granice, trasy ewakuacji  

---

## 8. Rejestry HSE (Health, safety & environment)

Wspólny wzorzec: lista + formularz, filtr, eksport **PDF rejestru A4** (gdzie w `MODULE_PDF_REGISTRY`), kosz, opcjonalny **D1 sync**.

| Moduł | Co rejestruje | Obszar regulacyjny / praktyka |
|-------|---------------|-------------------------------|
| **COSHH** | Substancje, oceny ryzyka, SDS | COSHH Regulations |
| **Inspections** | LOLER, PUWER, PSSR, ladder, MEWP, scaffold, harness, lifting, general | Statutory / thorough examination |
| **Incidents** | Incydenty i near miss | RIDDOR prep, investigation |
| **Incident actions** | CAPA z incydentów | Follow-up |
| **Incident map** | Heatmapa na granicach site | Trend analysis |
| **RIDDOR** | Kreator zgłoszeń (F2508-style worksheet) | RIDDOR 2013 (+ notatki 2026) |
| **Emergency** | Kontakty awaryjne | Emergency planning |
| **PPE** | Wydania PPE, stan | PPE at Work |
| **Plant** | Maszyny, przeglądy | PUWER themes |
| **Fire safety** | Inspekcje, ćwiczenia, sprzęt | Fire Safety Order |
| **Hot work** | Rejestr prac gorących | Uzupełnia PTW hot work |
| **Training** | Macierz kompetencji, ważność | Competence |
| **Visitors** | Księga gości | Site access |
| **Toolbox log** | Obecność toolbox talks | H&S communication |
| **First aid** | Apteczki, pierwsza pomoc | First aid regs |
| **Lone working** | Praca samotna, check-in | Lone working policy |
| **Environmental** | Zdarzenia środowiskowe | EMS |
| **Observations** | Obserwacje BBS, zamknięcie | Safety culture |
| **Ladders** | Inspekcje drabin | WAHR |
| **MEWP** | IPAF/MEWP log | WAHR / LOLER |
| **Gate book** | Dostawy, ruch bramą | Logistics / traffic |
| **Asbestos** | Rejestr ACM, survey refs | CAR 2012 |
| **Confined space** | Wejścia do CS | Confined Spaces |
| **LOTO** | Punkty izolacji, lock-off | Isolation / GS38 themes |
| **Electrical (PAT)** | Sprzęt elektryczny, PAT | Electricity at Work |
| **Lifting** | Plany podnoszenia, LOLER | LOLER |
| **DSEAR** | Strefy ATEX / palne | DSEAR |
| **Noise & vibration** | Hałas, HAVS | Noise Regs / HAVS |
| **Scaffold** | Inspekcje rusztowań (7-day) | SG4 / WAHR |
| **Excavations** | Wykopy, permit-to-dig log | HSG47 |
| **Temporary works** | TW design & checks | BS 5975 |
| **Welfare checks** | Toalety, woda, ogrzewanie | CDM welfare |
| **Water hygiene** | Punkty wody, Legionella-style | ACoP L8 themes |
| **Waste register** | WTN, kody EWC | Duty of care |
| **High-care access** | Strefy high-care (food) | Food hygiene zones |
| **CIP sign-off** | Czyszczenie CIP | Food/pharma |
| **Allergen changeovers** | Okna zmian alergenu | Food mfg |
| **GMP deviations** | Odchylenia GMP | Pharma / food GMP |

---

## 9. Insights & reports

| Moduł | Funkcja |
|-------|---------|
| **Analytics** | Ten sam dashboard — KPI cross-module, wykresy, PDF dashboard |
| **Monthly report** | Miesięczne podsumowanie H&S do eksportu |
| **Survey report** | Patrz §6 |
| **Templates** | Szablony dokumentów wielokrotnego użytku |

---

## 10. People (zespół)

- Profile pracowników, role na budowie  
- Certyfikaty z datami ważności (alerty na dashboardzie)  
- CSV export  
- Powiązania: RAMS (operative IDs), timesheety, PPE, training matrix  

**Areas covered:** competence evidence, nie pełny HR/payroll.

---

## 11. AI w produkcie (czerwiec 2026)

| Funkcja | Co robi | Konfiguracja |
|---------|---------|--------------|
| AI RAMS generator | JSON szkic RAMS → prefill builder | `/api/anthropic-messages` + Vercel secrets |
| AI toolbox talk | Punkty toolbox po temacie | j.w. |
| AI photo hazard | Vision — lista zagrożeń ze zdjęcia | j.w. |
| Survey Smart assist | AI polish sekcji raportu | j.w. |
| Permit smart suggest | Sugestia opisu pracy | j.w. |
| RAMS smart fields | Flagi w builderze | j.w. |

**Produkcja:** proxy same-origin, `ANTHROPIC_API_KEY` + `AI_PROXY_SHARED_SECRET` + `VITE_AI_PROXY_SECRET`. Domyślny model: `claude-sonnet-4-6`.  
**Health check:** `GET /api/anthropic-messages` → `{ ok, configured }`.

---

## 12. Chmura, sync, offline

| Warstwa | Technologia | Co synchronizuje |
|---------|-------------|------------------|
| **Lokalnie** | localStorage + IndexedDB outbox | Domyślna baza; działa offline |
| **Service worker** | `public/service-worker.js` | Precache, fallback offline |
| **Supabase** | Auth, org, invites, RLS | Logowanie Google/email, członkostwo org |
| **Supabase backup** | `app_sync` JSON bundle | Ręczny cloud backup per org |
| **Stripe** | Edge Functions | Subskrypcje, portal klienta |
| **Cloudflare D1** | Worker API | ~45 modułów org-scoped, wersjonowanie, konflikt 409 |
| **Cloudflare R2** | Worker upload | Dokumenty, zdjęcia permit evidence |
| **Web Push** | VAPID + Supabase secrets | Powiadomienia permitów itd. |
| **Audit log** | Lokalny ring + D1 chain | Tamper-evident (Business+ tier theme) |

---

## 13. Billing — plany (`billingPlans.js`)

| Plan | Cena | Workers | Projekty | Backup |
|------|------|---------|----------|--------|
| Trial | £0 / 14 dni | 200 | 50 | 10 GB |
| Free | £0 | 3 | 10 | 500 MB |
| Solo (starter) | £19/mo | 5 | 100 | 2 GB |
| Team | £99/mo | 20 | 500 | 10 GB |
| Business | £249/mo | 75 | 2 500 | 50 GB |
| Enterprise | £499/mo | 200 | 10 000 | 200 GB |
| Enterprise Plus | kontakt | ∞ | ∞ | ∞ |

**Stripe:** starter, team, business, enterprise.  
**Dodatki tier:** Industrial Sector Pack (Team+), audit chain (Business+), group MI / subdomain (Enterprise).

---

## 14. Role i admin

### Role w org (uproszczenie)
- **Admin** — pełny dostęp, billing, invites, automation  
- **Supervisor** — issue/approve permitty, review RAMS (zależnie od policy)  
- **Worker** — wypełnianie formularzy, induction, ograniczony zapis  

### Organisation settings
- Branding (logo, kolory) → PDF exports  
- Ukrywanie modułów, profile branżowe  
- Reguły automatyzacji (gates: PTW wymaga RAMS, survey final gate…)  
- Developer feature flags  

### Platform owner (`superadmin`)
- Statystyki platformy, orgs, Stripe conversion  
- Eksport CSV/JSON, health integracji  
- Provisioning FESS Group (RPC)  

---

## 15. Strony publiczne

| URL | Treść |
|-----|-------|
| `/` | Landing, readiness check, FAQ, blog teaser |
| `/blog` | 18 artykułów UK construction H&S |
| `/login`, `/reset-password`, `/accept-invite` | Auth |
| `/privacy`, `/terms`, `/cookies`, `/dpa` | Legal |
| `/docs`, `/status`, `/security` | Dokumentacja, status, Cyber Essentials alignment |
| `/app` | Aplikacja (chroniona) |

---

## 16. Mapa integracji (skrót)

```
Projects
 ├── Playbooks → RAMS, Survey, PTW, Method Statement
 ├── Drawings → Permit overlay, Site map
 ├── Daily briefing → Site presence
 ├── Geo-photos → Survey, Snags
 ├── RAMS ↔ Permits (automation gate)
 ├── Incidents ↔ Permit incidents ↔ Actions / Map
 ├── People → RAMS, Timesheets, PPE, Training
 ├── Client / Subcontractor portals
 └── CDM per project

Backup / D1 / Supabase → dane org
Audit log → mutacje
Bin → soft delete recovery
```

---

## 17. Obszary regulacyjne UK — podsumowanie „area covered”

| Obszar | Gdzie w MySafeOps |
|--------|-------------------|
| CDM 2015 / reform 2026 | Moduł CDM, CPP, notifiability |
| RAMS / method statement | RAMS builder, Method statement |
| Permit to Work | 15 typów PTW + hot work register |
| WAHR | Height PTW, ladders, scaffold, MEWP, roof |
| LOLER | Lifting PTW + lifting register |
| PUWER / PSSR | Inspections, plant |
| COSHH | COSHH register |
| DSEAR / ATEX | DSEAR register |
| Confined spaces | PTW + log |
| LOTO / electrical | Electrical PTW, LOTO, PAT |
| RIDDOR | Wizard (nie składa online za użytkownika) |
| PAS 128 | Survey report, RAMS surveying, DXF |
| Asbestos | Register + CDM CPP |
| Temporary works | TW register |
| Fire | Fire log + hot work |
| Waste duty of care | Waste register (EWC) |
| Water / Legionella themes | Water hygiene log |
| Noise / HAVS | Noise register |
| Food / pharma / GMP | Allergen, high-care, CIP, GMP deviations |
| Radiography | Radiography PTW |
| Utility strike | Excavation PTW, PAS128, geo-photos |
| Visitor / induction | Visitors, QR induction, visitor PTW |

**Disclaimer aplikacji:** użytkownik odpowiada za formalne zgłoszenia (RIDDOR online), porady prawne i aktualność procedur.

---

## 18. Czego produkt świadomie NIE robi (granice scope)

- CRM, pipeline sprzedaży, renewals kontraktów  
- Job costing, PO, faktury, integracja z Sage/Xero  
- Pełny scheduling zasobów / Gantt  
- Board KPI / EBITDA mostek dla grupy  
- Org chart firmy, wielopoziomowe delegowane approvale poza permit/RAMS workflow  
- Public API dla integratorów (poza wewnętrznymi workerami)  
- Automatyczne składanie RIDDOR do HSE online  

---

## 19. Ostatnia aktualizacja techniczna (czerwiec 2026)

- Naprawiono podgląd druku A4 (sandbox iframe — sanityzacja `<script>`)  
- Proxy AI na produkcji: secrets Vercel + health `GET /api/anthropic-messages`  
- Model domyślny: `claude-sonnet-4-6`  
- Deploy produkcyjny: commit `8ea82e8` na `main`  

---

*Koniec notatnika. Aktualizuj po każdej większej zmianie modułów lub nawigacji.*
