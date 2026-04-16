# MySafeOps Content Engine — Full SEO Workflow

## Twój kompletny pipeline do tworzenia treści

Masz teraz 4 skille które razem zastępują Soro AI (i robią więcej):

1. **seo-keyword-research** — znajdowanie co pisać
2. **blog-writer** (istniejący) — pisanie artykułów
3. **blog-optimizer** (NOWY) — optymalizacja Soro/ChatGPT output lub własnych draftów
4. **blog-distributor** (NOWY) — przerabianie bloga na 10+ assets do promocji

Plus **blog-image-prompts** (istniejący) do Midjourney.

---

## Jak używać — 5 scenariuszy

### Scenariusz 1: Zaczynasz od zera — nie wiesz o czym pisać

```
"Znajdź mi keyword opportunities dla MySafeOps na najbliższe 3 miesiące"
```

Claude użyje **seo-keyword-research**, zwróci priorytetową listę słów z intent tags i sugestie klastrów.

---

### Scenariusz 2: Masz temat — chcesz napisać artykuł

```
"Napisz artykuł o [temat] dla MySafeOps"
```

Claude użyje **blog-writer**, sprawdzi historię żeby uniknąć duplikatów, zrobi keyword research, napisze 1000-2000 słów gotowych do publikacji.

Potem automatycznie:

```
"Wygeneruj prompty do Midjourney dla tego artykułu"
```

**blog-image-prompts** zrobi 2 prompty (header + supporting).

---

### Scenariusz 3: Soro wygenerowało artykuł — chcesz go wzmocnić

```
"Wrzucam artykuł z Soro, popraw go na MySafeOps voice"
[wklejasz tekst]
```

Claude użyje **blog-optimizer**:
- Diagnoza co jest słabe
- Usuwa genericizmy i banned words
- Dodaje 3 CTA (intro, mid, final)
- Dodaje FAQ section + schema markup
- Sugeruje internal links do innych Twoich artykułów
- Wstrzykuje USP (free worker accounts)
- UK specificity (HSE, CDM 2015 by name)
- Zwraca wersję ready-to-publish

---

### Scenariusz 4: Opublikowałeś blog — chcesz go rozpromować

```
"Zrób pakiet dystrybucyjny dla tego artykułu"
[link lub tekst artykułu]
```

Claude użyje **blog-distributor**, wygeneruje:
- 3 warianty postów LinkedIn (krótki hook, średni, long-form essay)
- 2 wątki Twitter/X
- 1 email newsletter
- Draft postu na Reddit (jeśli pasuje)
- Draft odpowiedzi na Quora
- 3 wersje WhatsApp/SMS do prospektów
- Cold email angle
- Harmonogram publikacji na 2 tygodnie

---

### Scenariusz 5: Full workflow od A do Z

```
"Zrób full content pipeline dla tematu [X] dla MySafeOps"
```

Claude połączy wszystkie 4 skille:
1. Keyword research
2. Wybór najlepszego kątu
3. Napisanie artykułu
4. Prompty graficzne
5. Schema markup
6. Pakiet dystrybucyjny
7. Plan promocji

---

## Co dostajesz w tym packu

| Plik | Opis |
|------|------|
| `seo-keyword-research.skill` | Instaluj w Claude — znajduje keywords |
| `blog-optimizer.skill` | Instaluj w Claude — optymalizuje blogi |
| `blog-distributor.skill` | Instaluj w Claude — robi pakiety promo |
| `01-07-*.md` (7 plików) | Twoje 7 blogów z dodanym schema.org markup |
| `BLOG_STRATEGY.md` | Strategia klastra i kolejność publikacji |
| `MIDJOURNEY_PROMPTS.md` | 14 promptów do grafik |

---

## Jak zainstalować nowe skille

1. Pobierz pliki `.skill` z tego packa
2. W Claude idź do **Settings → Capabilities → Skills**
3. Kliknij **Upload a skill** i wybierz `.skill` plik
4. Zrób to dla każdego z 3 nowych skilli
5. Gotowe — Claude automatycznie użyje ich gdy pasują do kontekstu

---

## Co zostało poprawione w Twoich 7 blogach

Wszystkie 7 artykułów dostały:

✅ **Schema.org FAQPage markup** (JSON-LD) — gotowy do wklejenia w CMS. To daje szansę na FAQ rich snippets w Google (ogromny CTR boost).

✅ **Schema.org Article markup** — pomaga Google lepiej indeksować autorstwo, datę publikacji, image.

Te dwie rzeczy razem dają **bardzo mocny SEO signal** — większość blogów w UK B2B ich nie ma.

**Soro AI nie dodaje tego automatycznie** — Twoje blogi od teraz mają przewagę.

---

## Porównanie: Soro vs Twój workflow

| Feature | Soro AI | Twój nowy workflow |
|---------|---------|---------------------|
| Keyword research | ✅ Automatyczne | ✅ Ręczne przez Claude (ale bardziej trafne) |
| Pisanie artykułu | ✅ Generuje | ✅ Generuje w lepszym voice |
| FAQ section | ❌ Brak | ✅ Wbudowane |
| Schema.org markup | ❌ Brak | ✅ FAQ + Article |
| Internal links | ❌ Links: 0 | ✅ Auto-sugestie |
| CTA optymalizacja | ❌ Tylko 1 mini-CTA | ✅ 3 CTA strategicznie |
| USP injection | ❌ Generic | ✅ Free worker accounts podkreślone |
| Social distribution | ❌ Brak | ✅ 10+ assets per artykuł |
| Midjourney prompts | ❌ Brak | ✅ Auto-generate |
| Cena | ~£40-50/mies | £20/mies Claude |
| UK specificity | Średnia | Wysoka (HSE, CDM, HSG codes) |
| Voice | Bezpieczny/nudny | Konkretny/ludzki |

---

## Pomysły na rozszerzenia (nie dzisiaj, ale do roadmap)

Jak Twoja strategia content się rozwinie, warto pomyśleć o:

1. **skill: competitor-content-monitor** — śledzi kiedy konkurenci publikują nowy content, alert do Ciebie
2. **skill: content-refresher** — bierze Twój stary artykuł, sprawdza czy nadal aktualny, sugeruje updaty
3. **skill: sales-email-from-blog** — bierze blog i robi z niego sekwencję sales-friendly do cold outreach
4. **skill: case-study-builder** (już masz) — po wygenerowaniu blogu, automatycznie szuka okazji na case study
5. **skill: backlink-outreach** — znajduje witryny które mogłyby link-back do Twojego bloga, pisze outreach

---

## Moja rekomendacja na następne kroki

**Tydzień 1:**
- Opublikuj pierwsze 2 blogi (artykuł 1 pillar + artykuł 7 USP)
- Zainstaluj 3 nowe skille
- Przetestuj workflow na jednym Soro-generated artykule

**Tydzień 2-3:**
- Publikuj pozostałe 5 blogów staggered
- Dla każdego wygeneruj distribution pack przez blog-distributor
- Monitoruj Google Search Console — zobacz co się indeksuje

**Tydzień 4+:**
- Użyj seo-keyword-research żeby wybrać kolejne 5-7 tematów
- Powtarzaj cykl

**Miesiąc 3:**
- Pierwsze rankingi na niszowe słowa (confined space permit UK, COSHH register software UK)
- Zacznij outreach-linkbuilding (skill partnership-scout może pomóc)

**Miesiąc 6-12:**
- Pillar article (permit to work app UK) walczy o pierwszą stronę
- Cluster autorytet się kumuluje

---

## Ważne — rzeczy których Soro nie powie

Soro generuje "safe content" który rankuje ale nie konwertuje. Twoje blogi muszą być:

1. **Prawdziwe** — jeśli piszesz że hot work fire watch to 60 min, to musi być prawda (jest)
2. **UK-specyficzne** — HSE codes, CDM 2015, HSG numbers
3. **Z USP** — free worker accounts podkreślone tam gdzie to naturalne
4. **Z evidence trail** — każdy artykuł linkuje do 2-3 innych (topic authority)
5. **Z schema markup** — żeby Google pokazywał Cię w FAQ snippets
6. **Z konkretami** — liczby, przykłady, nazwiska regulacji — nie abstraktami

Te 6 rzeczy razem = **10x lepsza konwersja** niż generic SEO content.
