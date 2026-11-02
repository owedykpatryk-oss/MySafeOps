# MySafeOps przygotowanie do App Store i Google Play

Plan wspólnego kodu, synchronizacji danych i aktualizacji na wszystkie platformy: [CROSS_PLATFORM_ARCHITECTURE_PLAN.md](CROSS_PLATFORM_ARCHITECTURE_PLAN.md).

**Aktualizacja 2 listopada 2026:** dodano Capacitor 8.6.0, projekty Android/iOS i osobny build podglądu bez chmury. Aktualne instrukcje, ograniczenia i kolejność dalszych prac: [NATIVE_PREVIEW.md](NATIVE_PREVIEW.md). Poniższe wpisy październikowe są historyczne; stwierdzenia o braku projektów natywnych nie opisują już obecnego repozytorium.

Stan przeglądu: 7 października 2026. Aplikacja jest obecnie web/PWA. W repozytorium nie znaleziono konfiguracji Capacitor ani projektów iOS/Android. Poprawki lokalne i testy przeglądarkowe nie potwierdzają gotowości produkcji lub wersji sklepowej. Opisy wcześniejszych rund QA poniżej zachowano jako historię.

### PWA i transport API — 8 października 2026

- Produkcyjny service worker dostaje z builda listę wszystkich chunków Vite, więc nieodwiedzone moduły mogą uruchomić się offline po zakończonej instalacji. Zapis cache podczas późniejszych żądań jest powiązany z czasem życia zdarzenia. Aktualizacja czeka na wybór użytkownika. Lokalny test Chromium: otwarcie pozwoleń online, następnie RAMS offline i reload RAMS — bez błędów ładowania. To test kodu i cache, nie synchronizacji danych chmurowych.
- `src/utils/appApiUrl.js` zachowuje `/api/...` na webie i używa jawnego `VITE_API_BASE_URL` (sam origin HTTPS) w natywnym WebView. Główne wywołania proxy korzystają z tej funkcji; błędny lub brakujący host natywny kończy się błędem. Testy obejmują także wywołanie postcode z symulowanego środowiska natywnego.
- Serwer nadal sprawdza origin same-site w `api/securityUtils.js` i nie ma pełnej konfiguracji CORS/preflight dla originów Capacitor. Pakiet natywny, auth deep links, trwały magazyn i testy na urządzeniach nadal nie są gotowe. Nie należy włączać natywnej dystrybucji wyłącznie na podstawie tej zmiany klienta.

### Kontrola uzupełniająca — 8 października 2026

Założenie dotyczące kont: każda osoba ma własny adres e-mail i konto; nie planujemy funkcji regularnego przełączania kont na jednym telefonie. Ta sama osoba używa tego samego konta na webie i w aplikacji. Nowy adres to odrębny użytkownik: bez zaproszenia dostaje nową organizację, a do istniejącej firmy dołącza przez zaproszenie administratora. To nie jest automatyczna zmiana e-maila ani przeniesienie starych danych. Izolacja lokalnego cache i kolejki według użytkownika pozostaje wymogiem bezpieczeństwa przy wylogowaniu lub przekazaniu telefonu.

Kolejna kontrola odświeżania firmy wykryła, że ręczne `refreshOrgFromSupabase` mogło zastosować spóźnioną odpowiedź poprzedniego konta po zalogowaniu innej osoby. Test regresji najpierw wykazał błąd; funkcja sprawdza teraz identyfikator sesji przed zastosowaniem odpowiedzi i po dłuższych krokach pobierania ustawień. Celowane testy przeszły 12/12. Pełny Vitest: 1992/1993, z pojedynczym timeoutem niezwiązanego testu renderowania modułu `emergency` przy równoległym buildzie i lincie; powtórzony osobno plik przeszedł 90/90. Build przeszedł, lint ma 0 błędów i 128 wcześniejszych ostrzeżeń. Deployment `dpl_W6QKrXdiYDgnqNvvWiVv8FU3sVff` promowano na `www.mysafeops.com`; produkcyjny smoke test przeszedł 7/7. Nie wykonano testu na dwóch prawdziwych kontach Supabase ani na aplikacji natywnej.

- Frontend nadal jest jedną aplikacją React/Vite z `BrowserRouter`; backend obejmuje funkcje Vercel `api/`, Supabase Auth/Postgres/Edge Functions oraz Cloudflare D1/R2. Katalog `dist` zawiera tylko frontend. Repozytorium nie ma jeszcze konfiguracji Capacitor ani projektów `android/` i `ios/`.
- Naprawiono wyścig przy inicjalizacji sesji: spóźniony wynik `getSession()` nie może przywrócić poprzedniego użytkownika po zdarzeniu wylogowania lub nadpisać nowszego logowania. Zdarzenie `INITIAL_SESSION` nadal inicjalizuje kontekst organizacji. Dodano testy obu kolejności.
- Naprawiono limit bezczynności po powrocie z tła. Samo pokazanie aplikacji nie jest aktywnością użytkownika; po przekroczeniu limitu sesja wylogowuje się natychmiast po wznowieniu, także gdy edytor GPR pozostał zablokowany. Dodano testy regresji.
- Produkcyjny smoke test web/API przeszedł 7/7, D1 health 200, lokalny security doctor i probe konfiguracji billingowej przeszły. Testy celowane sesji, limitu bezczynności, synchronizacji D1 i magazynu offline przeszły 60/60; pełny Vitest 1990/1990 w 351 plikach. Build Vite przeszedł, a lint ma 0 błędów i 128 istniejących ostrzeżeń. Nie testowano natywnych pakietów, płatności end-to-end ani prawdziwej synchronizacji dwóch zalogowanych telefonów.
- Blokery P0 pozostają: lokalne dane i kolejka starego mechanizmu są podzielone według firmy/kraju, lecz nie użytkownika; scalanie list bazuje na zegarze urządzenia; zapis rekordu i kolejki nie jest jeszcze atomowy w używanym przez RAMS kodzie. Nowy magazyn rekordów z taką transakcją istnieje, ale moduł RAMS jeszcze go nie używa. Nie należy określać danych jako zsynchronizowanych przed potwierdzeniem serwera.
- Przed natywnym prototypem trzeba przenieść wywołania `/api/` na jawny adres HTTPS, dopuścić dokładne originy aplikacji w D1/R2 i API, wdrożyć callbacki logowania oraz odzyskiwania hasła, a następnie adaptery aparatu, plików, GPS i PDF. Tych zmian nie wykonano w tej rundzie, gdyż wymagają wspólnego testowego backendu i identyfikatorów aplikacji.
- Poprawki sesji i limitu bezczynności wdrożono na web przez Vercel deployment `dpl_5zJ7wnniLeeK59AerFU26uob9mbQ`; po przełączeniu domeny `www.mysafeops.com` smoke test ponownie przeszedł 7/7. Logi z tych prób pokazują dwa ostrzeżenia Node `url.parse()` dla postcode/weather, bez błędów HTTP w teście. Sama autoryzacja użytkownika w produkcji nie była automatycznie wykonywana na prawdziwym koncie.

### Dalszy przegląd tego samego dnia: przełączenie konta

- Odtworzono wyścig `ensureUserOrgContext`: dwa różne konta na tym samym kliencie Supabase dostawały tę samą trwającą operację. Spóźniona odpowiedź konta A mogła ustawić jego firmę po zalogowaniu B. Test regresji nie przechodził przed poprawką.
- Przygotowanie firmy jest teraz współdzielone tylko dla tego samego identyfikatora konta. Przed zastosowaniem odpowiedzi, zużyciem zaproszenia i dalszymi krokami ustawień sprawdzana jest aktualna sesja; odrzucona stara operacja nie zmienia aktywnej firmy. Weryfikacja obejmuje również odpowiedź brandingu A po przejściu do B. Login nie kończy spóźnionego przygotowania po zamknięciu jego widoku.
- Przeglądarkowe scenariusze offline przeszły 12/12 w profilach desktop, Pixel 7 i iPhone 13 WebKit. Kolejne 14/14 na profilach Android/iPhone objęło zdjęcia, nieczytelny HEIC, odmowę GPS, podpisy, ponawianie uploadu dokumentu i listę pozwoleń. Testy korzystały z lokalnego środowiska bez chmury; nie dowodzą działania fizycznego aparatu, natywnego WebView ani przełączenia prawdziwych kont Supabase.
- Nadal potrzebna jest migracja starego lokalnego cache i kolejki według właściciela. Ta poprawka usuwa konkretny wyścig sesji; nie rozwiązuje możliwości odczytu starszych danych tej samej firmy przez innego użytkownika urządzenia. Nie przypisano starych wpisów kolejki bieżącemu kontu i niczego z niej nie usunięto.
- Weryfikacja poprawki: regresja najpierw nie przechodziła, później testy celowane przeszły 14/14, także po dodaniu kontroli spóźnionego brandingu; pełny Vitest przed tą ostatnią kontrolą przeszedł 1991/1991. Build i lint po zmianach przeszły (0 błędów, 128 wcześniejszych ostrzeżeń). Wersję web wdrożono jako `dpl_FzCCRa9cgYh1F2NNtuQbZwY5TKJZ`; domena produkcyjna wskazuje ten deployment, smoke test po promocji przeszedł 7/7. Nie wykonano automatycznego testu prawdziwego przełączenia dwóch kont na produkcji.

## Przegląd kodu przed wersją sklepową — 7 października

**Wniosek:** obecny podział na moduły i React/Vite można zachować. Zalecana ścieżka to lokalnie spakowany frontend w Capacitor (`webDir: dist`) oraz istniejące usługi backendowe. Przepisywanie RAMS, pozwoleń i ankiet do React Native nie jest konieczne do rozpoczęcia tej drogi. To rekomendacja architektoniczna, a nie potwierdzenie działania aplikacji natywnej. [Capacitor: dodanie do istniejącej aplikacji](https://capacitorjs.com/docs), [konfiguracja](https://capacitorjs.com/docs/config).

### Poprawione lokalnie

- `src/utils/publicAppUrl.js` oddziela publiczny adres linku od lokalnego adresu WebView. Podłączono linki indukcji QR, udostępniania i wydruku RAMS, potwierdzania i statusu pozwoleń, portali klientów/podwykonawców, akcji FESS oraz zaproszeń. Ścieżka workspace to `/app`, niezależnie od tego, czy pakiet wystartuje pod `/index.html`.
- W zwykłej przeglądarce linki zachowują aktualną domenę, również localhost i deployment testowy. Natywny wariant korzysta z HTTPS `VITE_PUBLIC_SITE_URL`, domyślnie `https://mysafeops.com`. W buildzie do natywnego QA należy jawnie ustawić domenę środowiska testowego. Błędna wartość, HTTP lub URL z danymi logowania nie trafia do linków; następuje powrót do domeny domyślnej.
- `src/utils/appRuntime.js` rozpoznaje natywne środowisko przez most Capacitor, bez mylenia mobilnej przeglądarki czy PWA z aplikacją natywną. `src/offline/offlineManager.js` pomija rejestrację i aktywację service workera w tym środowisku. Web/PWA zachowuje aktualny mechanizm aktualizacji. Celem jest uniknięcie podawania starych plików PWA po aktualizacji pakietu.
- Zmiana adresu linku nie dodaje publicznego dostępu do danych. Dotychczasowe ograniczenia synchronizacji, uprawnień i linków działających tylko z dostępnymi danymi nadal obowiązują. Nie jest to również obsługa Universal Links ani callbacków logowania.

### Pozostałe blokery i miejsca w kodzie

| Obszar | Dowód w kodzie | Praca wymagana przed natywnym QA |
| --- | --- | --- |
| Backend HTTP | `src/utils/bgsGeologyClient.js`, `postcodeLookup.js`, `weatherSummary.js`, `gprEvidenceAiClient.js`, `src/modules/gprReport/gprReportSmart.js` i `GprReport.jsx` używają `/api/...`; `gprHistoricImagery.js` tworzy takie URL-e kafelków | Wspólny adres API dla builda natywnego oraz migracja wszystkich wywołań i URL-i obrazów. Pliki `api/` i middleware Vite nie znajdą się w pakiecie `dist`. D1/R2 już mają oddzielne URL-e konfiguracyjne. |
| CORS i AI | `cloudflare/workers/d1-api/index.mjs`, `cloudflare/workers/r2-upload/index.mjs`, `api/anthropic-messages.js`; `src/utils/anthropicClient.js` odrzuca zewnętrzny proxy URL w produkcji | Spójnie dopuścić konkretne originy natywne na serwerze i obsłużyć preflight, zachowując JWT i kontrolę organizacji. Sama zamiana `/api` na HTTPS nie wystarczy. Nie usuwać zabezpieczeń ani nie rozszerzać CORS na `*`. Wszystkie `VITE_*` są publiczną konfiguracją, nie magazynem sekretów. |
| Logowanie i powrót do aplikacji | `src/lib/authRedirect.js`, `src/pages/LoginPage.jsx`, `src/components/CloudAccount.jsx` budują callbacki z `window.location.origin`; `src/lib/supabase.js` używa PKCE | Systemowa sesja logowania, zweryfikowany callback, bezpieczna wymiana kodu PKCE i zachowany verifier. Obsłużyć start zamkniętej aplikacji oraz powrót do działającej; reset hasła, potwierdzenie emaila i zaproszenia. Zarejestrować dokładne redirect URLs. [Supabase](https://supabase.com/docs/guides/auth/native-mobile-deep-linking). |
| Trwałość i migracja danych | `src/utils/orgStorage.js`: localStorage; `src/lib/d1SyncOutbox.js`: IndexedDB; szkice i zdjęcia również używają IndexedDB | Przed zmianą magazynu dodać adapter i migrację z zachowaniem izolacji organizacji/krajów. Osobno trwałe pliki/zdjęcia, rekordy i sesja. Dane web/PWA nie pojawią się automatycznie w nowym WebView: potrzebna potwierdzona synchronizacja lub eksport/import. [Capacitor Storage](https://capacitorjs.com/docs/guides/storage). |
| Aparat, pliki, GPS, PDF | `src/components/geoPhotos/GeoPhotoCaptureModal.jsx`, `src/components/PrintPreviewFrame.jsx`, `src/utils/htmlEscape.js`, `src/modules/DocumentLibrary.jsx`, `src/modules/QRInduction.jsx` | Adaptery urządzenia, udostępnianie/zapis PDF w systemie, test anulowania, odmowy uprawnień i wznowienia po zamknięciu procesu przez system. Nie zakładać, że popup, `download` lub `window.print()` wystarczą w WebView. |
| Uruchomienie i nawigacja | `src/App.jsx` używa BrowserRouter i pod `/` otwiera landing; brak projektów `android/` i `ios/` | Natywny start do logowania/workspace, obsługa Android Back (najpierw dialog, później historia), klawiatury i powrotu z tła; Universal Links/App Links z publicznym fallbackiem. Zachować ścieżki web. |
| Powiadomienia | `src/offline/pushNotifications.js` używa Notification API, PushManager i service workera | Osobna implementacja natywnych push/local notifications oraz rejestracji tokenów urządzeń. Harmonogram JS nie gwarantuje przypomnienia po zamknięciu aplikacji. |
| Konto i sklepy | W przeglądanych `src/` i `supabase/functions/` nie znaleziono kompletnego flow usuwania konta; login Google jest obecny, zakup jest oparty o Stripe | Usuwanie konta z retencją dokumentów firmy, decyzja o modelu płatności i zasadach alternatywnego logowania. Szczegóły i źródła w sekcjach poniżej. |

Nie zmieniono jeszcze transportu API, logowania, magazynu danych ani płatności. Wymagają spójnej implementacji klienta, backendu i pakietu natywnego oraz testów na urządzeniach. Częściowa zamiana adresów lub automatyczna migracja danych podczas końcowego QA web zwiększyłaby ryzyko regresji.

### Co przygotować organizacyjnie

1. Konta firmowe Apple Developer i Google Play Console, dane podmiotu do weryfikacji i właściciela kont. Ustalić stały Bundle ID / Application ID oraz sposób bezpiecznego przechowywania kluczy podpisu.
2. Środowisko testowe backendu i osobną konfigurację builda mobilnego. iOS wymaga środowiska Apple z Xcode (lokalnie lub na CI), Android — odpowiedniego SDK/JDK. [Środowisko Capacitor](https://capacitorjs.com/docs/getting-started/environment-setup).
3. Wybrać model pierwszej wersji: dostęp pracowników do istniejących kont firmowych albo sprzedaż w aplikacji. Zweryfikować kwalifikację w danym sklepie i regionie; obecny Stripe checkout nie jest automatycznie zgodny ze sklepami. [Apple](https://developer.apple.com/app-store/review/guidelines/), [Google](https://support.google.com/googleplay/android-developer/answer/10281818?hl=en).
4. Przygotować politykę prywatności, in-app usuwanie konta i stronę żądania usunięcia, deklaracje danych zgodne z użytymi SDK, opisy uprawnień, ikonę, zrzuty i konto demo dla review. [Usuwanie kont Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).
5. Po QA web: osobna gałąź integracji Capacitor, najpierw testy wewnętrzne Android i TestFlight, następnie publikacja. Kryteria: instalacja i aktualizacja bez utraty danych, dwa urządzenia/organizacje, synchronizacja po utracie sieci, restart procesu podczas zdjęcia i zapisu, callback logowania, odczyt QR na drugim urządzeniu, zapis/udostępnienie PDF. Ostatni krok to ponowna kontrola bieżących wymagań SDK i sklepów.

### Weryfikacja tej rundy

- 32 testy w 7 plikach przeszły: rozróżnienie web/native, linki QR i tokeny, generowany QR w wydruku RAMS, aktualizacje PWA, istniejące wydruki pozwoleń i preferencje powiadomień. Logi: `output/mobile-store-readiness-unit.log`, `output/mobile-store-readiness-native-print.log`.
- `npm run lint`: 0 błędów, 128 ostrzeżeń w repozytorium. Log: `output/mobile-store-readiness-lint.log`.
- Produkcyjny build Vite przeszedł do osobnego katalogu `output/mobile-store-build`; upload sourcemap Sentry był wyłączony. Log: `output/mobile-store-readiness-build.log`. Nie wykonywano deploya ani publikacji w sklepach.
- Playwright (desktop, Pixel 7, iPhone 13/WebKit): lista pozwoleń, okno wydruku i indukcja z QR — 8/9 przeszło w pierwszej rundzie. Android QR przekroczył 5-sekundowe oczekiwanie na komunikat innej organizacji; zapis błędu zawiera już prawidłowy komunikat. Dwa powtórzenia tego scenariusza przeszły bez zmian kodu ani testu. Wskazuje to na opóźnienie ładowania, nie na potwierdzoną regresję; pierwszego przebiegu nie uznano za całkowicie zielony. Logi: `output/mobile-store-readiness-e2e.log`, `output/mobile-store-readiness-qr-recheck.log`.
- Profile Playwright są emulacją przeglądarek, nie testem natywnego pakietu. Chmura była wyłączona w konfiguracji testowej. Nie uruchomiono SDK/emulatorów ani fizycznego iPhone/Android i nie potwierdzono działania natywnego backendu.

## Naprawy i zmiany wyglądu w tym przeglądzie

- Dashboard pokazuje aktywność budowy na pierwszym ekranie telefonu. Eksport, branding i personalizacja są dostępne w rozwijanym „Export & customise”.
- Wyszukiwanie przekazuje identyfikator i akcję konkretnego projektu, RAMS, survey, snagu lub zdjęcia. Wynik osoby otwiera jej formularz. Ponowne wyszukanie rekordu w już otwartym module również uruchamia jego otwarcie.
- Usunięte rekordy i rekordy ukrytych modułów nie trafiają do wyników. Niepoprawny zapis tablicy lub puste elementy nie przerywają wyszukiwania.
- Wyszukiwarka ma przycisk zamknięcia, zatrzymuje fokus klawiatury w dialogu i oddaje go po zamknięciu. Pole ma 16 px, aby uniknąć typowego automatycznego zoomu formularza na iOS.
- Certyfikaty na dashboardzie prowadzą do People. Data jest obliczana przy renderowaniu, zamiast pozostawać datą uruchomienia modułu.
- Podpowiedzi konfiguracji nie są przedstawiane jako pilne alarmy. Ich przyciski otwierają odpowiedni moduł lub filtr More.
- Dashboard pomija usunięte rekordy w licznikach i alarmach; niezapisane podpisy wydanych RAMS zachowują odpowiedni poziom ostrzeżenia.
- Certyfikat lub snag z datą „dzisiaj” nie jest uznawany za przeterminowany od północy. Termin pozwolenia z konkretną godziną nadal zachowuje dokładność czasową.
- Przyciski szybkich akcji w More są oddzielone od przycisku otwierającego kafelek. Nieznany lub ukryty `?view=` pokazuje komunikat i przejście do wyszukiwania.

## Co blokuje wersję sklepową

### Pakiet natywny i przechowywanie danych

Propozycja techniczna: zachować React/Vite i dodać [Capacitor](https://capacitorjs.com/docs) po zamknięciu QA web. To pozwala wykorzystać istniejący interfejs i dodać obsługę urządzenia. Nie jest to jeszcze wdrożone ani zweryfikowane na telefonach.

Dodano pierwszy etap magazynu zdjęć: odzyskiwanie szkicu przez IndexedDB oraz lokalną kopię bajtów zdjęć wysłanych do R2. Podgląd Geo-photos i jego PDF wykorzystują tę kopię bez połączenia ze storage. Obrazy w cache są zapisane jako bajty i typ MIME, a podgląd tworzy z nich nowy Blob. Zapis zostaje potwierdzony dopiero po zakończeniu transakcji. Jeśli cache nie zapisze obrazu, rekord zachowuje obraz osadzony.

Szkice i cache są rozdzielone według organizacji i kraju. „Close” zachowuje szkic; „Discard draft” go usuwa. Udany zapis rekordu usuwa szkic. Późne odpowiedzi dla poprzedniego zdjęcia są pomijane. Podgląd używa data URL w pamięci, co usuwa problem ładowania cached JPEG przez adres blob w sprawdzanym WebKit. Nie tworzy już adresów blob wymagających późniejszego zwalniania. Gdy trwały zapis szkicu zawiedzie, formularz informuje o braku odzyskiwania po zamknięciu przeglądarki.

To nie jest jeszcze pełna migracja zdjęć offline, dokumentów i kolejki do magazynu natywnego. Starsze oraz zapisane bez chmury zdjęcia nadal mogą zawierać base64 w localStorage. Nie potwierdzono wszystkich importów i eksportów mapowych offline ani działania po zabiciu procesu na fizycznym telefonie. Przeglądarka może usunąć IndexedDB przy czyszczeniu danych lub presji na pamięć. „Zapisano na urządzeniu” i „zsynchronizowano z chmurą” nadal wymagają oddzielnego statusu.

Potrzebne są adaptery aparatu, systemowego wyboru zdjęć, GPS, otwierania dokumentów i udostępniania PDF. Obecne popupy, pobrania i `window.print` wymagają sprawdzenia w natywnym WebView. Android może zakończyć aplikację podczas otwartego aparatu; dokumentacja [Camera](https://capacitorjs.com/docs/apis/camera) opisuje odzyskanie wyniku przez `appRestoredResult`. Należy również obsłużyć powrót z logowania i linków QR.

### Konto i prywatność

W przeglądanych ścieżkach konta i Edge Functions nie znaleziono kompletnego samoobsługowego usuwania konta. Aplikacje umożliwiające tworzenie kont muszą pozwalać rozpocząć jego usuwanie w aplikacji; Google wymaga również działającej ścieżki internetowej. Sam kontakt z supportem nie zastępuje zwykłego flow Apple. Źródła: [Apple](https://developer.apple.com/support/offering-account-deletion-in-your-app/), [Google](https://support.google.com/googleplay/android-developer/answer/13327111?hl=en).

Usuwanie wymaga ponownego uwierzytelnienia oraz określenia retencji dokumentacji firmowej, podpisów i historii audytu. Trzeba rozwiązać przekazanie właściciela organizacji oraz subskrypcję przed usunięciem ostatniego administratora. Usunięcie profilu pracownika nie jest usunięciem konta logowania.

`src/lib/authRedirect.js` używa Google OAuth. Nie znaleziono odpowiednika Apple. Przed publikacją należy sprawdzić zastosowanie punktu 4.8, wdrożyć równoważny zgodny login lub udokumentować właściwy wyjątek dla istniejących kont firmowych. Sam napis „B2B” nie potwierdza wyjątku. [Wytyczne Apple](https://developer.apple.com/app-store/review/guidelines/).

App Privacy i Data safety muszą odpowiadać faktycznym danym: zdjęciom, lokalizacji, osobom, podpisom i diagnostyce. Uprawnienia należy prosić dopiero przy użyciu funkcji, zapewniając zapis bez GPS i możliwość anulowania wyboru zdjęcia.

### Subskrypcje i limity

Obecny Stripe checkout jest ścieżką web. Dla wersji sklepowej trzeba osobno ustalić model: dostęp do zakupionej subskrypcji firmowej, aplikacja towarzysząca bez zakupu i kierowania do zakupu albo zakupy sklepowe. Nie należy po prostu osadzać obecnego checkoutu w WebView i zakładać akceptacji. Zasady i wyjątki zależą od modelu sprzedaży i rynku. Źródła: [Apple 3.1.3](https://developer.apple.com/app-store/review/guidelines/), [Google Payments](https://support.google.com/googleplay/android-developer/answer/9858738?hl=en).

Przed pełnym QA nadal potrzebne są: rzeczywisty pomiar i egzekwowanie wykorzystania cloud storage, test checkoutu i webhooków, odnowienie, nieudana płatność, downgrade, anulowanie, zwrot i izolacja organizacji/krajów. Jeśli zostaną dodane zakupy sklepowe, potrzebne będą także weryfikacja transakcji po stronie serwera oraz odtworzenie zakupów bez podwójnej subskrypcji.

## Kolejne ulepszenia dające widoczny efekt

Proponowana kolejność, jeszcze niewdrożona:

1. Widok projektu z mapą zdjęć, otwartymi pozwoleniami, osobami i trzema najważniejszymi zadaniami; liczby prowadzą do właściwego filtra.
2. Jedno krótkie wejście „Dodaj” do zdjęcia, snagu, podpisu i briefingu, z zachowaniem wybranego projektu.
3. Czytelny status synchronizacji każdego zapisu: lokalny, oczekujący, w chmurze, wymagający ponowienia. Ten status ma wynikać z potwierdzenia zapisu.
4. Spójne PDF z brandingiem firmy, zdjęciami i kompletnymi polami; możliwość udostępnienia przez system telefonu.
5. Przyjazne puste ekrany i dyskretne podpowiedzi konfiguracji. Przykładowe dane muszą być oznaczone jako demonstracyjne; nie powinny być warunkiem „zdrowego” workspace.

## Warunki zamknięcia QA

Testować co najmniej fizyczny iPhone i telefon Android, oprócz profili Playwright. Scenariusze obejmują świeżą instalację, ponowne logowanie, aparat i bibliotekę zdjęć, HEIC/JPEG, odmowę GPS, GPS przybliżony, obrót, klawiaturę, mały ekran, duży tekst, powrót z tła i zabicie procesu podczas zapisu.

Osobna próba na testowej chmurze musi potwierdzić zapis na telefonie i odczyt na drugim urządzeniu, utratę sieci, wznowienie, konflikt równoległych zmian, usunięcie i zmianę firmy. Dotychczasowe lokalne testy z wyłączoną chmurą nie dowodzą synchronizacji produkcyjnej.

Do zgłoszenia przygotować podpisane pakiety, konto demonstracyjne dla review, politykę prywatności, ścieżkę usuwania konta, deklaracje danych, ikony i zrzuty ekranów. Budowa i podpisanie iOS wymagają środowiska Apple. Nie rozpoczęto publikacji w sklepach. Wersję web wdrożono produkcyjnie 5 października; szczegóły poniżej.

## Wyniki lokalnej weryfikacji

Runda Documents, 5 października:

- Lista plików została podłączona do istniejącej synchronizacji D1. Testy sprawdzają odczyt listy z symulowanego drugiego urządzenia, zapis nowego wpisu i oddzielny klucz kraju. Usunięcie wpisu zachowuje znacznik usunięcia, aby starsza odpowiedź z chmury nie przywracała rekordu. Sam plik w R2 pozostaje — przycisk i potwierdzenie mówią o usunięciu z listy.
- Upload, odczyt folderu i pobieranie są chronione przed zmianą organizacji lub kraju w trakcie operacji. Powtórny wybór pliku podczas uploadu nie uruchamia drugiej kopii tej samej operacji.
- Gdy plik dotrze do R2, ale wpis biblioteki nie zapisze się na urządzeniu, można ponowić zapis wpisu bez ponownego uploadu. Mała lista odzyskiwania trafia do sessionStorage i wraca po odświeżeniu w tej samej sesji. Gdy przeglądarka blokuje również ten zapis, pozostaje ponowienie w otwartym widoku; interfejs prosi o zachowanie strony do zakończenia zapisu.
- „Open file” pobiera plik przez autoryzowany endpoint również wtedy, gdy brakuje aktywnego linku publicznego lub podpisanego. Gotowy plik ma nazwany przycisk pobrania. Dialog obsługuje Escape i fokus klawiatury. Błędy odczytu są widoczne i pozwalają ponowić próbę.
- Nieudany zapis notatek lub tagów zachowuje wpisane wartości i pokazuje „Retry saving details”. Nieudane usunięcie wpisu pozostawia go w widoku. Niepoprawne rekordy biblioteki nie przerywają renderowania.
- Widok telefonu i desktopu używa wspólnej listy plików, czytelnych nazw i przycisków co najmniej 44 px. Surowe klucze storage zostały usunięte z widoku.
- 33 testy w 6 plikach przeszły, w tym rzeczywisty hook synchronizacji z symulowanym API i odnowienie sesji po odpowiedzi 401 podczas pobierania. Log: `output/documents-unit-final.log`.
- 9 scenariuszy przeglądarkowych przeszło na desktopie, Pixel 7 i iPhone 13 WebKit: nieudany upload i ponowienie, zapis wpisu po odświeżeniu bez drugiego uploadu oraz zmiana firmy w trakcie uploadu. D1 i rzeczywista autoryzacja chmury są wyłączone w tych scenariuszach. Log: `output/documents-mobile-final.log`.
- Build i kontrola hooks JSX przeszły; lint zmienionych plików nie zgłosił błędów ani ostrzeżeń. Logi: `output/documents-build-final.log`, `output/documents-lint-qa.log`. Widok lokalny: `output/documents-desktop-qa.png`.

Synchronizacja listy i prywatne pobranie nadal wymagają próby na dwóch rzeczywistych kontach/urządzeniach w testowej chmurze. Zmiany wdrożono produkcyjnie 5 października. Pobranie dokumentu wymaga obecnie połączenia; nie dodano magazynu dokumentów do pracy offline ani natywnego udostępniania.

Runda trwałego zapisu zdjęć, 5 października:

- 197 testów Geo-photos w 18 plikach przeszło. Obejmują transakcje przerwane, brak IndexedDB, odzyskanie szkicu bez sessionStorage, izolację workspace, kolejność zapis/usunięcie, podgląd po zmianie zdjęcia oraz zachowanie osadzonego obrazu przy odpowiedzi z chmury z tym samym kluczem. Log: `output/photo-durable-unit-final.log`.
- Końcowe 6 scenariuszy uploadu przeszło na desktopie, Pixel 7 i iPhone 13 WebKit: upload, odświeżenie, widoczna miniatura oraz pobranie PDF przy niedostępnym endpointcie storage; wariant z IndexedDB i wariant bez niego. Upload jest odpowiedzią lokalnego mocka, nie produkcyjnego R2. Log: `output/photo-durable-upload-confirm.log`.
- Osobno potwierdzono odzyskanie szkicu po zamknięciu karty, „Close” i „Discard draft” na wszystkich profilach. Większa runda obejmowała również odmowę GPS, późną odpowiedź GPS, zmianę firmy podczas uploadu, nieczytelny HEIC oraz nieudany zapis i ponowienie. Wykryła błąd miniatury WebKit, który poprawiono i potwierdzono końcową rundą uploadu.
- Build i kontrola hooks JSX przeszły. Lint zmienionych plików: 0 błędów i 2 wcześniejsze ostrzeżenia w GeoPhotos.jsx. Logi: `output/photo-durable-build.log`, `output/photo-durable-lint.log`.

Wyniki wcześniejszej rundy, sprzed zmian magazynu zdjęć:

- Vitest: 1761 testów w 332 plikach przeszło. Log: `output/wow-full-vitest-final.log`.
- Ostatnia runda Playwright: 18 scenariuszy przeszło na desktopie, w profilu Pixel 7 i w profilu iPhone 13 z WebKit. Obejmuje nowy dashboard, wyszukiwanie konkretnych rekordów, More, usunięte rekordy i terminy dzisiejsze, ponowienie zapisu zdjęcia oraz limit pracowników. Log: `output/wow-mobile-final.log`.
- W większym wcześniejszym przebiegu sprawdzono również aparat/wybór zdjęcia przez input, brak GPS, późną odpowiedź GPS, zmianę firmy w czasie uploadu, podpisy, Documents, permity i PDF. Wystąpiły trzy problemy przygotowania lub oczekiwania w testach; po poprawieniu ich wszystkie objęte nimi scenariusze powtórzono w ostatniej rundzie.
- Build produkcyjny i kontrola cyklicznych chunków przeszły. Lint: 0 błędów, 129 ostrzeżeń istniejących w repozytorium. Kontrola hooks JSX przeszła.

Zrzuty: [desktop](../output/wow-dashboard-desktop-final.png), [Android](../output/wow-dashboard-android-final.png), [iPhone WebKit](../output/wow-dashboard-iphone-webkit-final.png). Są to widoki lokalnej organizacji testowej. Emulacja i input plikowy nie potwierdzają działania fizycznego aparatu, natywnej aplikacji, prawdziwego HEIC ani synchronizacji pomiędzy urządzeniami.

## Wdrożenie web, 5 października 2026

- Vercel: `dpl_CX3RPTRSz944WHPU8UBbqN1P7DQS`, status Ready. Build z produkcyjnymi zmiennymi środowiskowymi; następnie promocja na produkcję. Nowy bundle `index-ClDylBcD.js` potwierdzony pod `https://mysafeops.com` i `https://www.mysafeops.com`.
- Worker D1: `30a76da0-f336-454a-a8f4-5698800ee954`. Worker R2: `5f291d88-61c4-422d-ab6d-79634567fda9`. Oba wdrożone; health D1 odpowiada 200, CORS dla domeny produkcyjnej odpowiada 204, odczyt poprawnego klucza R2 bez autoryzacji odpowiada 401.
- Przed publikacją pełny Vitest: 1790 testów w 336 plikach, wszystkie przeszły. Build lokalny i zdalny przeszły. Lint: 0 błędów, 128 ostrzeżeń. Logi: `output/deploy-vitest.log`, `output/deploy-build.log`, `output/deploy-lint.log`, `output/deploy-vercel.log`.
- Strona główna, `/login` i `/app` pod domeną produkcyjną wyświetlają interfejs MySafeOps na desktopie, Pixel 7 i iPhone 13 WebKit. `/app` bez sesji prowadzi do logowania. W WebKit wystąpił błąd dostępu między domenami w ramce Cloudflare Turnstile; nie potwierdzono ukończenia challenge ani logowania. Początkowy smoke bez asercji marki na chronionym adresie Vercel nie stanowił dowodu działania aplikacji; kontrolę powtórzono na głównej domenie z rozpoznaniem MySafeOps. Nie wykonywano zapisów na kontach produkcyjnych. Log: `output/deploy-production-smoke.log`.
- Dodano `.vercelignore`: pliki środowiskowe, lokalne dokumenty klientów, logi, tymczasowe pliki i raporty QA nie trafiają do wysyłki. Nie tworzono commitów. Nie wykonywano migracji SQL ani wdrożeń Supabase Edge Functions.

Wdrożenie nie stanowi potwierdzenia płatności Stripe, synchronizacji dwóch zalogowanych urządzeń, aparatu/HEIC na fizycznym iPhone ani gotowości App Store/Google Play. Te próby pozostają w kolejnej rundzie QA.
