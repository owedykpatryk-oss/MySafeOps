# MySafeOps — scenariusz testu demonstracyjnego

**Cel:** sprawdzić główną ścieżkę pracy na fikcyjnych danych, jakość interfejsu na szerokim i wąskim ekranie oraz kompletność eksportów PDF.

**Stan:** przygotowany do wykonania; test w aplikacji nie został jeszcze przeprowadzony. Dostęp do aplikacji w tej sesji prowadził do ekranu logowania, a wcześniejszy przegląd konta wskazywał tryb tylko do odczytu.

## Zasady danych testowych

- Nazwa projektu: `DEMO TEST ONLY — Northgate Utilities 2026`.
- Używaj wyłącznie fikcyjnych nazw firm i osób. Nie wpisuj prawdziwych danych pracowników, klientów, telefonów ani podpisów.
- Każdy załącznik oznacz `DEMO TEST ONLY` i używaj bezpiecznych plików przykładowych.
- Nie oznaczaj testowych raportów jako dokumentów do rzeczywistego użycia. Finalizację wykonuj tylko na kopii testowej.
- Przed testem zanotuj istniejące rekordy. Po teście usuń wyłącznie utworzone rekordy demonstracyjne zgodnie z dostępną funkcją aplikacji.

## Przebieg i kryteria odbioru

| Etap | Działanie | Oczekiwany wynik | Wynik / uwagi |
|---|---|---|---|
| Projekt | Utwórz projekt demonstracyjny; dodaj fikcyjny adres lub współrzędne i sprawdź podgląd mapy. | Projekt zapisuje się raz, jest widoczny na liście i otwiera właściwy hub. Brak lokalizacji jest czytelnie pokazany. | Nieuruchomione |
| Site operations | Otwórz CDM, Daily briefing, Documents, Drawings, Method statement, QR induction, Signatures, Snags, Timesheets i Geo-photos. W każdym pustym rejestrze użyj Quick start tylko na danych demonstracyjnych. | Każdy skrót otwiera właściwy moduł; zapisany rekord jest przypisany do projektu; puste stany i liczniki aktualizują się po zapisie. | Nieuruchomione |
| Kreatory | Przejdź Construction setup oraz Food & pharma setup; sprawdź walidację, cofanie, zapis i wznowienie. | Postęp jest widoczny; brak wymaganych danych wskazuje konkretne pola; wznowienie nie gubi wpisów ani nie tworzy duplikatów. | Nieuruchomione |
| HSE — rejestry | Sprawdź Quick start/Seed dla COSHH, Legislation, Incidents, Inspections, Emergency, Toolbox log, Training, PPE, Asbestos, Hot work, Excavations i Waste. | Szablony są oznaczone jako przykładowe lub wymagające uzupełnienia; nie wyglądają jak prawdziwe kontrole, wydane PPE, podpisy ani zatwierdzenia. | Nieuruchomione |
| Survey — szkic niekompletny | Utwórz raport demonstracyjny bez QA, zdjęć, kalibracji i podpisu. Otwórz panel QA oraz podgląd. | Każdy brak ma jasny opis i prowadzi do właściwego pola; raport nie pokazuje gotowości do finalizacji, jeśli wymagane kontrole nie są spełnione. | Nieuruchomione |
| Survey — kompletny | Uzupełnij kopię raportu fikcyjnymi danymi, QA, zdjęciami i kalibracją; wygeneruj PDF. | PDF zawiera oczekiwane sekcje, czytelne tabele, marginesy i numerację; nic nie jest ucięte ani zasłonięte. Podziały stron nie rozcinają zdjęć, nagłówków ani wierszy tabel. | Nieuruchomione |
| GPR — braki | Utwórz szkic bez pogody lub lokalizacji. Sprawdź komunikat gotowości i próbę finalizacji. | Brak pogody lub lokalizacji jest widoczny jako blokada; komunikat i przycisk finalizacji zachowują się zgodnie. | Nieuruchomione |
| GPR — kompletny | Uzupełnij kopię testową, dodaj radargram lub panel skanu, sprawdź preview i wygeneruj PDF. | Uwagi QA prowadzą do konkretnych pól; PDF zachowuje wykresy, podpisy zdjęć, tabele i paginację. | Nieuruchomione |
| Eksporty rejestrów | Pobierz PDF z co najmniej jednego wypełnionego rejestru Site operations i HSE oraz pustego rejestru. | Nazwa pliku i treść odpowiadają modułowi; pusty eksport jest opisany jako przewodnik/szablon; wypełniony eksport zawiera właściwy rekord. | Nieuruchomione |
| Wąski ekran | Powtórz przejście po kartach modułów i raportów przy szerokości około 390 px. | Karty nie wychodzą poza ekran; najważniejsze akcje są widoczne; przyciski nie wypychają treści i nie nachodzą na siebie. | Nieuruchomione |

## Kontrola każdego PDF

Otwórz każdą stronę w skali 100% i sprawdź:

1. Czy treść nie jest przycięta przy żadnej krawędzi.
2. Czy nagłówki nie zostają samotnie na dole strony.
3. Czy tabele, zdjęcia, podpisy i wykresy nie są rozdzielone lub nachodzące.
4. Czy marginesy, stopka i numeracja są czytelne i spójne.
5. Czy puste miejsca są celowe (np. okładka), a nie skutkiem błędnego podziału strony.
6. Czy PDF otwiera się po pobraniu i ma poprawną liczbę stron.

## Rejestr usterek

Dla każdego problemu zapisz: identyfikator etapu, moduł/ekran, szerokość ekranu, dokładne kroki odtworzenia, oczekiwany i rzeczywisty wynik, stronę PDF (jeśli dotyczy), ważność oraz zrzut ekranu/PDF bez danych osobowych.

Nie oznaczaj etapu jako zaliczonego na podstawie samego kodu lub podglądu. Wpisz `Zaliczone`, `Niepowodzenie` albo `Zablokowane` dopiero po wykonaniu go w aplikacji.
