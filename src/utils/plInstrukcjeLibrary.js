/**
 * Instrukcje stanowiskowe BHP — gotowe instrukcje dla maszyn, urządzeń i rodzajów prac.
 *
 * Instrukcja stanowiskowa to trzeci polski dokument obok IBWR i ORZ: IBWR opisuje konkretne
 * roboty, ORZ opisuje ryzyko na stanowisku, a instrukcja mówi pracownikowi wprost, co zrobić
 * przed pracą, w trakcie, po zakończeniu i czego robić nie wolno. Kodeks pracy (art. 2374 § 2)
 * wymaga udostępnienia instrukcji dotyczących stosowanych w zakładzie procesów i maszyn.
 *
 * Układ sekcji jest ten sam we wszystkich instrukcjach, bo tak wyglądają druki, które
 * inspektor i pracownik znają: uwagi ogólne, przed pracą, w trakcie, po pracy, zabronione,
 * awaria. Dzięki temu instrukcje da się drukować jednym szablonem.
 */

/**
 * @typedef {{
 *   key: string,
 *   tytul: string,
 *   grupa: string,
 *   opis: string,
 *   uprawnienia: string[],
 *   soi: string[],
 *   uwagiOgolne: string[],
 *   przedPraca: string[],
 *   wTrakcie: string[],
 *   poPracy: string[],
 *   zabronione: string[],
 *   awaria: string[],
 *   podstawa: string[],
 *   pytania?: string[],
 * }} PlInstrukcja
 */

/** Wspólne wymagania dopuszczeniowe — powtarzają się w każdej instrukcji stanowiskowej. */
const DOPUSZCZENIE = [
  "Ukończone 18 lat i aktualne orzeczenie lekarskie o braku przeciwwskazań do pracy na stanowisku",
  "Odbyte szkolenie wstępne BHP (instruktaż ogólny i stanowiskowy) oraz aktualne szkolenie okresowe",
  "Zapoznanie z oceną ryzyka zawodowego na stanowisku, potwierdzone podpisem",
  "Znajomość instrukcji obsługi producenta urządzenia i niniejszej instrukcji stanowiskowej",
];

const AWARIA_BAZA = [
  "W razie awarii, uszkodzenia lub nietypowego zachowania urządzenia — natychmiast wyłączyć i odłączyć zasilanie",
  "Zabezpieczyć miejsce zdarzenia i nie dopuszczać osób postronnych",
  "Powiadomić bezpośredniego przełożonego; nie naprawiać samodzielnie urządzenia bez uprawnień",
  "Przy wypadku udzielić pierwszej pomocy, wezwać pomoc (112 lub 999) i nie zmieniać stanu miejsca zdarzenia do czasu oględzin",
];

/** @type {PlInstrukcja[]} */
export const PL_INSTRUKCJE = [
  {
    key: "szlifierka_katowa",
    tytul: "Szlifierka kątowa",
    grupa: "Narzędzia z napędem",
    opis: "Cięcie i szlifowanie metalu, betonu i kamienia szlifierką ręczną.",
    uprawnienia: ["Instruktaż stanowiskowy", "Szkolenie okresowe BHP"],
    soi: ["Okulary lub gogle ochronne", "Osłona twarzy przy cięciu", "Ochronniki słuchu", "Rękawice", "Półmaska FFP3 przy pyleniu"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Szlifierka może być używana wyłącznie z zamontowaną, sprawną osłoną tarczy",
      "Tarcza musi być dobrana do materiału i do prędkości obrotowej urządzenia",
    ],
    przedPraca: [
      "Sprawdzić stan przewodu zasilającego, wtyczki i obudowy — sprzęt uszkodzony oznakować i wycofać",
      "Sprawdzić osłonę tarczy, uchwyt boczny i blokadę wrzeciona",
      "Obejrzeć tarczę: brak pęknięć, wyszczerbień i przekroczonej daty ważności",
      "Sprawdzić działanie wyłącznika — musi samoczynnie wyłączać urządzenie po zwolnieniu",
      "Usunąć materiały palne ze strefy iskrzenia; przy pracach pożarowo niebezpiecznych uzyskać zezwolenie",
      "Zabezpieczyć obrabiany element przed przemieszczeniem",
    ],
    wTrakcie: [
      "Trzymać szlifierkę obiema rękami, stać stabilnie, poza płaszczyzną obrotu tarczy",
      "Odczekać do osiągnięcia pełnych obrotów przed zetknięciem tarczy z materiałem",
      "Prowadzić narzędzie równomiernie, bez dociskania i bez klinowania tarczy w rzazie",
      "Przy cięciu materiałów pylących stosować odciąg lub pracę na mokro",
      "Kierować snop iskier z dala od ludzi, butli, instalacji i materiałów palnych",
      "Przy przerwie w pracy odłożyć narzędzie dopiero po całkowitym zatrzymaniu tarczy",
    ],
    poPracy: [
      "Wyłączyć urządzenie i wyjąć wtyczkę z gniazda",
      "Sprawdzić strefę pod kątem zarzewia ognia; przy pracach gorących wykonać kontrolę po 1 h i po 8 h",
      "Oczyścić narzędzie i stanowisko, uporządkować przewody",
      "Zgłosić przełożonemu każde zauważone uszkodzenie sprzętu",
    ],
    zabronione: [
      "Praca bez osłony tarczy lub z osłoną zdemontowaną",
      "Stosowanie tarcz do cięcia jako tarcz do szlifowania powierzchnią boczną",
      "Hamowanie tarczy ręką lub o materiał",
      "Blokowanie wyłącznika w pozycji włączonej",
      "Praca w rękawicach luźnych, w odzieży z luźnymi elementami lub bez ochrony oczu",
      "Pozostawianie włączonego urządzenia bez nadzoru",
    ],
    awaria: [...AWARIA_BAZA, "Przy pęknięciu tarczy nie uruchamiać ponownie — wycofać urządzenie do przeglądu"],
    podstawa: [
      "Kodeks pracy art. 2374 § 2",
      "Rozporządzenie MG z 30.10.2002 (minimalne wymagania — użytkowanie maszyn)",
      "Instrukcja obsługi producenta",
    ],
    pytania: [
      "Co zrobisz, jeżeli osłona tarczy jest uszkodzona?",
      "Kiedy wolno odłożyć szlifierkę po zakończeniu cięcia?",
      "Jakie środki ochrony są obowiązkowe przy cięciu betonu?",
    ],
  },
  {
    key: "wiertarka_udarowa",
    tytul: "Wiertarka udarowa / młotowiertarka",
    grupa: "Narzędzia z napędem",
    opis: "Wiercenie i kucie w betonie, cegle i kamieniu.",
    uprawnienia: ["Instruktaż stanowiskowy", "Szkolenie okresowe BHP"],
    soi: ["Okulary ochronne", "Ochronniki słuchu", "Rękawice antywibracyjne", "Półmaska FFP3 przy pyleniu"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Przed wierceniem w przegrodzie należy ustalić przebieg instalacji elektrycznych i sanitarnych",
      "Czas pracy narzędziem udarowym ograniczać ze względu na ekspozycję na drgania",
    ],
    przedPraca: [
      "Sprawdzić przewód zasilający, wtyczkę, obudowę i uchwyt narzędziowy",
      "Zlokalizować instalacje w przegrodzie wykrywaczem; w razie wątpliwości wykonać przekop kontrolny lub odciąć zasilanie",
      "Dobrać wiertło lub dłuto do materiału i sprawdzić jego stan",
      "Zamontować uchwyt boczny — praca bez niego grozi skręceniem nadgarstka przy zakleszczeniu",
      "Zapewnić stabilną pozycję i oświetlenie stanowiska",
    ],
    wTrakcie: [
      "Trzymać narzędzie obiema rękami, przewód prowadzić za sobą",
      "Wiercić prostopadle, bez nadmiernego docisku; przy zakleszczeniu natychmiast zwolnić wyłącznik",
      "Stosować odciąg pyłu lub odkurzacz klasy M przy wierceniu w betonie",
      "Robić przerwy w ekspozycji na drgania zgodnie z ustaleniami w ocenie ryzyka",
      "Przy pracy na wysokości zabezpieczyć narzędzie linką przed upadkiem",
    ],
    poPracy: [
      "Wyłączyć i odłączyć narzędzie od zasilania",
      "Wyjąć wiertło po ostygnięciu, oczyścić uchwyt",
      "Uprzątnąć pył na mokro lub odkurzaczem — bez zamiatania i przedmuchiwania",
      "Zgłosić uszkodzenia i przekazać narzędzie do przeglądu",
    ],
    zabronione: [
      "Wiercenie w przegrodzie bez ustalenia przebiegu instalacji",
      "Praca bez uchwytu bocznego przy wierceniu otworów o dużej średnicy",
      "Chwytanie za wiertło lub dłuto bezpośrednio po pracy",
      "Przenoszenie narzędzia trzymając za przewód zasilający",
      "Przedmuchiwanie otworów sprężonym powietrzem bez ochrony oczu",
    ],
    awaria: [...AWARIA_BAZA, "Przy natrafieniu na kabel pod napięciem nie dotykać narzędzia — odciąć zasilanie obwodu"],
    podstawa: [
      "Kodeks pracy art. 2374 § 2",
      "Rozporządzenie MG z 30.10.2002",
      "Rozporządzenie MGiP z 5.08.2005 (hałas i drgania)",
    ],
    pytania: [
      "Jak sprawdzasz przebieg instalacji przed wierceniem?",
      "Co robisz, gdy wiertło się zakleszczy?",
    ],
  },
  {
    key: "pila_tarczowa",
    tytul: "Pilarka tarczowa stołowa i ręczna",
    grupa: "Narzędzia z napędem",
    opis: "Cięcie drewna i materiałów drewnopochodnych pilarką tarczową.",
    uprawnienia: ["Instruktaż stanowiskowy", "Szkolenie okresowe BHP"],
    soi: ["Okulary ochronne", "Ochronniki słuchu", "Półmaska przeciwpyłowa", "Obuwie ochronne"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Pilarka musi mieć sprawną osłonę tarczy, klin rozszczepiający i popychacz",
      "Pył drzewny jest czynnikiem szkodliwym — stanowisko wymaga odciągu",
    ],
    przedPraca: [
      "Sprawdzić osłonę górną i dolną tarczy oraz klin rozszczepiający",
      "Sprawdzić stan tarczy: brak pękniętych i wyłamanych zębów, właściwy kierunek obrotu",
      "Sprawdzić stan stołu, prowadnicy i wyłącznika awaryjnego",
      "Uruchomić odciąg pyłu i sprawdzić drożność króćca",
      "Uprzątnąć stanowisko z odpadów i zapewnić miejsce na odbiór ciętego materiału",
    ],
    wTrakcie: [
      "Prowadzić materiał równomiernie, przy prowadnicy, bez wyrywania",
      "Do dosuwania krótkich elementów używać wyłącznie popychacza",
      "Nie sięgać rękami w strefę tarczy — także przy usuwaniu odpadu",
      "Przy cięciu długich elementów zapewnić podparcie lub pomoc drugiej osoby",
      "Zwracać uwagę na odrzut materiału — stać poza linią cięcia",
    ],
    poPracy: [
      "Wyłączyć pilarkę i odczekać do zatrzymania tarczy przed opuszczeniem stanowiska",
      "Odłączyć zasilanie przy dłuższej przerwie i przy wymianie tarczy",
      "Oczyścić stanowisko i odciąg z trocin",
      "Zgłosić uszkodzenia tarczy lub osłon",
    ],
    zabronione: [
      "Praca ze zdemontowaną osłoną lub klinem rozszczepiającym",
      "Hamowanie tarczy materiałem lub ręką",
      "Usuwanie odpadów spod tarczy w czasie pracy urządzenia",
      "Cięcie materiału o nieznanym pochodzeniu, z gwoździami lub zabrudzeniami",
      "Praca w rękawicach przy pilarce stołowej — grozi wciągnięciem dłoni",
    ],
    awaria: [...AWARIA_BAZA, "Przy odrzucie materiału przerwać pracę i sprawdzić ustawienie klina i prowadnicy"],
    podstawa: ["Kodeks pracy art. 2374 § 2", "Rozporządzenie MG z 30.10.2002", "Instrukcja obsługi producenta"],
    pytania: ["Do czego służy klin rozszczepiający?", "Czym dosuwasz krótkie elementy do tarczy?"],
  },
  {
    key: "rusztowanie",
    tytul: "Użytkowanie rusztowania",
    grupa: "Praca na wysokości",
    opis: "Praca z pomostu rusztowania ramowego lub modułowego po odbiorze.",
    uprawnienia: ["Orzeczenie — praca na wysokości powyżej 3 m", "Instruktaż stanowiskowy"],
    soi: ["Kask z paskiem podbródkowym", "Obuwie ochronne", "Odzież ostrzegawcza", "Szelki przy pracy poza balustradą"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Rusztowanie może być użytkowane wyłącznie po odbiorze potwierdzonym protokołem i tabliczką",
      "Montaż, przebudowę i demontaż wykonują wyłącznie osoby z uprawnieniami do montażu rusztowań",
    ],
    przedPraca: [
      "Sprawdzić tabliczkę odbioru: data, dopuszczalne obciążenie pomostu, brak adnotacji o wyłączeniu z użytku",
      "Obejrzeć rusztowanie: komplet pomostów, balustrady, bortnice, stężenia, zakotwienia, piony komunikacyjne",
      "Sprawdzić podłoże i stopy regulowane pod konstrukcją",
      "Ocenić warunki atmosferyczne — wiatr, oblodzenie, burza",
      "Sprawdzić odległość od linii napowietrznych i zabezpieczenie strefy poniżej",
    ],
    wTrakcie: [
      "Wchodzić i schodzić wyłącznie pionami komunikacyjnymi, twarzą do drabiny, z wolnymi rękami",
      "Nie przekraczać dopuszczalnego obciążenia pomostu; materiał rozkładać równomiernie",
      "Utrzymywać pomost w czystości, usuwać materiał i narzędzia na bieżąco",
      "Nie demontować balustrad ani elementów konstrukcji; przy konieczności — zgłosić przełożonemu",
      "Przy pracy poza balustradą stosować szelki wpięte do wskazanego punktu kotwiczenia",
    ],
    poPracy: [
      "Zabrać materiał i narzędzia z pomostu lub zabezpieczyć przed zdmuchnięciem",
      "Sprawdzić kompletność balustrad po zakończeniu prac",
      "Zgłosić przełożonemu każde uszkodzenie lub zmianę w konstrukcji",
    ],
    zabronione: [
      "Wchodzenie na rusztowanie bez tabliczki odbioru lub z adnotacją o wyłączeniu",
      "Wspinanie się po konstrukcji zamiast pionem komunikacyjnym",
      "Ustawianie drabin, skrzynek i podestów na pomoście dla zwiększenia zasięgu",
      "Zrzucanie materiału i gruzu z rusztowania",
      "Praca na rusztowaniu przy wietrze powyżej 10 m/s, burzy i oblodzeniu",
    ],
    awaria: [
      "Przy stwierdzeniu uszkodzenia lub przechylenia konstrukcji natychmiast opuścić rusztowanie i wygrodzić strefę",
      "Powiadomić kierownika budowy; ponowne dopuszczenie wyłącznie po przeglądzie i odbiorze",
      ...AWARIA_BAZA.slice(3),
    ],
    podstawa: [
      "Rozporządzenie MI z 6.02.2003 (BHP przy robotach budowlanych) — rozdział o rusztowaniach",
      "Rozporządzenie — ogólne przepisy BHP",
      "Instrukcja montażu producenta rusztowania",
    ],
    pytania: [
      "Skąd wiesz, że rusztowanie zostało odebrane?",
      "Co zrobisz, gdy brakuje fragmentu balustrady?",
      "Kiedy trzeba przerwać pracę ze względu na wiatr?",
    ],
  },
  {
    key: "drabina",
    tytul: "Praca z drabiny",
    grupa: "Praca na wysokości",
    opis: "Dojście i prace krótkotrwałe z drabiny przystawnej lub rozstawnej.",
    uprawnienia: ["Orzeczenie — praca na wysokości powyżej 3 m", "Instruktaż stanowiskowy"],
    soi: ["Kask", "Obuwie ochronne z podeszwą antypoślizgową"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Drabina służy przede wszystkim jako dojście; do prac dłuższych stosuje się rusztowanie lub podest",
      "Drabina musi mieć oznakowanie producenta i nie może być prowizoryczna",
    ],
    przedPraca: [
      "Sprawdzić stan szczebli, stopek, okuć i mechanizmu blokującego",
      "Ustawić drabinę na stabilnym, równym podłożu, pod kątem 65–75°",
      "Zapewnić wystawanie drabiny co najmniej 0,75 m ponad poziom wejścia",
      "Zabezpieczyć drabinę przed przesunięciem — stopki antypoślizgowe, przywiązanie lub asekuracja drugiej osoby",
      "Sprawdzić brak linii energetycznych w zasięgu; w strefie ruchu wygrodzić stanowisko",
    ],
    wTrakcie: [
      "Wchodzić i schodzić twarzą do drabiny, trzymając się obiema rękami",
      "Utrzymywać trzy punkty podparcia; narzędzia transportować w torbie lub podawać z dołu",
      "Nie stawać na trzech najwyższych szczeblach drabiny przystawnej",
      "Pracować w obrębie zasięgu ramion, bez wychylania się poza obrys drabiny",
      "Na drabinie może przebywać tylko jedna osoba",
    ],
    poPracy: [
      "Złożyć i odstawić drabinę w wyznaczone miejsce",
      "Zgłosić uszkodzenia — drabina uszkodzona zostaje oznakowana i wycofana z użytku",
    ],
    zabronione: [
      "Praca z drabiny przy użyciu narzędzi wymagających dużej siły lub obu rąk",
      "Ustawianie drabiny na skrzynkach, paletach, rusztowaniu lub innym niestabilnym podłożu",
      "Przemieszczanie drabiny z osobą lub materiałem",
      "Praca z drabiny nad otworami i schodami bez dodatkowego zabezpieczenia",
      "Używanie drabiny uszkodzonej lub prowizorycznej",
    ],
    awaria: [...AWARIA_BAZA],
    podstawa: ["Rozporządzenie — ogólne przepisy BHP § 105–110", "Rozporządzenie MI z 6.02.2003"],
    pytania: ["Pod jakim kątem ustawia się drabinę przystawną?", "Ile osób może przebywać na drabinie?"],
  },
  {
    key: "podest_ruchomy",
    tytul: "Podest ruchomy przejezdny (PRL)",
    grupa: "Praca na wysokości",
    opis: "Praca z kosza podnośnika nożycowego lub przegubowego.",
    uprawnienia: ["Uprawnienia UDT — podesty ruchome (I P / II P)", "Orzeczenie — praca na wysokości"],
    soi: ["Kask z paskiem", "Szelki bezpieczeństwa z lonżą krótką", "Obuwie ochronne", "Odzież ostrzegawcza"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Podest musi mieć ważną decyzję zezwalającą UDT na eksploatację i aktualny wpis w dzienniku konserwacji",
      "Obsługa wyłącznie przez osobę z uprawnieniami UDT właściwej kategorii",
    ],
    przedPraca: [
      "Sprawdzić decyzję UDT i dziennik konserwacji urządzenia",
      "Wykonać przegląd codzienny: układ jezdny, hydraulika, sterowanie, wyłącznik awaryjny, barierki kosza",
      "Sprawdzić nośność i równość podłoża; rozstawić podpory na płytach",
      "Sprawdzić przeszkody i linie napowietrzne nad stanowiskiem",
      "Wygrodzić strefę pracy podestu i sprawdzić działanie sterowania awaryjnego z poziomu terenu",
    ],
    wTrakcie: [
      "Wpiąć lonżę krótką do punktu kotwiczenia w koszu i pozostać w koszu przez cały czas pracy",
      "Nie przekraczać dopuszczalnego udźwigu i liczby osób w koszu",
      "Przejazdy z podniesionym koszem wykonywać tylko tam, gdzie dopuszcza to producent",
      "Obserwować otoczenie kosza — brak kolizji z konstrukcją i instalacjami",
      "Przerwać pracę przy wietrze przekraczającym limit producenta",
    ],
    poPracy: [
      "Opuścić kosz do pozycji transportowej, wyłączyć urządzenie i zabezpieczyć przed użyciem przez osoby nieuprawnione",
      "Wpisać uwagi do dziennika konserwacji",
      "Uprzątnąć strefę i zdjąć wygrodzenie",
    ],
    zabronione: [
      "Wychodzenie z kosza na wysokości i wchodzenie na barierki kosza",
      "Podnoszenie ładunków zawieszonych na barierkach kosza",
      "Praca bez wpięcia lonży i bez sprawnego wyłącznika awaryjnego",
      "Obsługa przez osobę bez uprawnień UDT",
      "Wyłączanie lub blokowanie układów zabezpieczających",
    ],
    awaria: [
      "Przy awarii podnoszenia użyć sterowania awaryjnego i sprowadzić kosz na poziom terenu",
      "Nie opuszczać kosza samodzielnie na wysokości — czekać na zorganizowaną ewakuację",
      ...AWARIA_BAZA.slice(2),
    ],
    podstawa: ["Ustawa o dozorze technicznym", "Rozporządzenie MG z 30.10.2002", "Instrukcja obsługi producenta"],
    pytania: ["Kiedy wolno wyjść z kosza podestu?", "Co sprawdzasz przed rozstawieniem podpór?"],
  },
  {
    key: "wozek_widlowy",
    tytul: "Wózek jezdniowy podnośnikowy",
    grupa: "Transport i maszyny",
    opis: "Transport i piętrzenie ładunków wózkiem widłowym.",
    uprawnienia: ["Uprawnienia UDT — wózki jezdniowe podnośnikowe", "Badania profilaktyczne"],
    soi: ["Kask w strefach wymaganych", "Obuwie ochronne", "Odzież ostrzegawcza"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Obsługa wyłącznie przez osobę z ważnymi uprawnieniami UDT i imiennym upoważnieniem pracodawcy",
      "Wózek musi mieć aktualną decyzję UDT i sprawne układy zabezpieczające",
    ],
    przedPraca: [
      "Wykonać przegląd zmianowy: hamulce, układ kierowniczy, sygnał dźwiękowy, oświetlenie, widły, maszt, opony",
      "Sprawdzić poziomy płynów oraz stan i mocowanie akumulatora lub butli gazowej",
      "Sprawdzić czytelność tabliczki udźwigu i stan pasa bezpieczeństwa",
      "Ocenić trasy przejazdu: nawierzchnia, oświetlenie, przeszkody, ruch pieszych",
      "Zgłosić usterki przed rozpoczęciem pracy — wózek niesprawny wycofać z ruchu",
    ],
    wTrakcie: [
      "Zapiąć pas bezpieczeństwa; jechać z ładunkiem opuszczonym nisko i masztem odchylonym do tyłu",
      "Dostosować prędkość do warunków, zwolnić na skrzyżowaniach i w bramach, sygnalizować dźwiękiem",
      "Przy ograniczonej widoczności jechać tyłem lub korzystać z pomocy sygnalisty",
      "Nie przekraczać udźwigu wynikającego z tabliczki i wykresu obciążeń",
      "Zachować bezpieczną odległość od pieszych; ustępować pierwszeństwa pieszym",
    ],
    poPracy: [
      "Odstawić wózek w wyznaczone miejsce, opuścić widły do podłoża, zaciągnąć hamulec postojowy",
      "Wyłączyć zasilanie i zabrać kluczyk",
      "Uzupełnić kartę pracy i zgłosić zauważone usterki",
    ],
    zabronione: [
      "Przewożenie osób na widłach, na palecie i w kabinie poza miejscem dla operatora",
      "Podnoszenie osób bez atestowanego kosza i bez zabezpieczenia",
      "Jazda z podniesionym ładunkiem oraz gwałtowne manewry z ładunkiem",
      "Pozostawianie wózka z podniesionymi widłami lub z kluczykiem w stacyjce",
      "Obsługa przez osobę bez uprawnień lub po spożyciu alkoholu",
    ],
    awaria: [...AWARIA_BAZA, "Przy wywróceniu wózka pozostać w kabinie, trzymać kierownicę i odchylić się od strony upadku"],
    podstawa: ["Ustawa o dozorze technicznym", "Rozporządzenie MG z 30.10.2002", "Instrukcja obsługi producenta"],
    pytania: ["Co sprawdzasz podczas przeglądu zmianowego?", "Jak jedziesz przy ograniczonej widoczności?"],
  },
  {
    key: "betoniarka",
    tytul: "Betoniarka wolnospadowa",
    grupa: "Transport i maszyny",
    opis: "Przygotowanie mieszanki betonowej i zapraw na budowie.",
    uprawnienia: ["Instruktaż stanowiskowy", "Szkolenie okresowe BHP"],
    soi: ["Rękawice ochronne", "Okulary ochronne", "Obuwie gumowe", "Półmaska przy zasypywaniu cementu"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Cement i mieszanki są żrące — kontakt ze skórą powoduje oparzenia chemiczne",
      "Betoniarka musi być ustawiona stabilnie i podłączona przez rozdzielnicę z zabezpieczeniem różnicowoprądowym",
    ],
    przedPraca: [
      "Sprawdzić stan przewodu zasilającego, wtyczki i osłon napędu",
      "Sprawdzić stabilność ustawienia i zabezpieczenie przed przesunięciem",
      "Sprawdzić działanie wyłącznika i mechanizmu obrotu bębna",
      "Uprzątnąć stanowisko i zapewnić dojście bez przeszkód",
      "Przygotować wodę do przemywania oczu i skóry",
    ],
    wTrakcie: [
      "Zasypywać składniki przy pracującym bębnie, z boku, bez wkładania narzędzi do wnętrza",
      "Utrzymywać stanowisko w czystości — usuwać rozlaną mieszankę na bieżąco",
      "Chronić skórę przed kontaktem z zaprawą; przy zabrudzeniu natychmiast spłukać wodą",
      "Przy zasypywaniu cementu ograniczać pylenie i stosować półmaskę",
    ],
    poPracy: [
      "Wyłączyć i odłączyć betoniarkę od zasilania przed czyszczeniem",
      "Wymyć bęben i stanowisko; wodę popłuczną zagospodarować zgodnie z zasadami placu budowy",
      "Zgłosić uszkodzenia i zabezpieczyć urządzenie przed użyciem przez osoby nieuprawnione",
    ],
    zabronione: [
      "Wkładanie rąk, łopat i narzędzi do obracającego się bębna",
      "Czyszczenie i naprawa urządzenia bez odłączenia zasilania",
      "Praca ze zdjętymi osłonami napędu",
      "Podłączanie betoniarki bez zabezpieczenia różnicowoprądowego",
    ],
    awaria: [...AWARIA_BAZA, "Przy oparzeniu zaprawą płukać skórę lub oczy wodą przez co najmniej 15 minut i wezwać pomoc"],
    podstawa: ["Rozporządzenie MG z 30.10.2002", "Rozporządzenie MI z 6.02.2003", "Karta charakterystyki cementu"],
    pytania: ["Dlaczego cement jest niebezpieczny dla skóry?", "Kiedy wolno czyścić bęben?"],
  },
  {
    key: "spawanie",
    tytul: "Spawanie elektryczne",
    grupa: "Prace pożarowo niebezpieczne",
    opis: "Spawanie łukowe elektrodą otuloną i metodą MIG/MAG.",
    uprawnienia: ["Uprawnienia spawalnicze", "Szkolenie — prace niebezpieczne pożarowo"],
    soi: ["Przyłbica spawalnicza", "Rękawice spawalnicze", "Odzież trudnopalna", "Obuwie ochronne", "Ochrona dróg oddechowych przy dymach"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Prace spawalnicze poza wyznaczonym stanowiskiem wymagają pisemnego zezwolenia na prace niebezpieczne pożarowo",
      "Dymy spawalnicze są czynnikiem szkodliwym — stanowisko wymaga wentylacji lub odciągu miejscowego",
    ],
    przedPraca: [
      "Uzyskać zezwolenie na prace pożarowo niebezpieczne i wyznaczyć osobę do zabezpieczenia prac",
      "Usunąć materiały palne w promieniu 10 m lub zabezpieczyć je osłonami niepalnymi",
      "Zabezpieczyć kratki, kanały i otwory przed przedostaniem się iskier",
      "Sprawdzić stan przewodów spawalniczych, uchwytu, zacisku masy i osłon urządzenia",
      "Rozstawić sprzęt gaśniczy i sprawdzić drogi ewakuacji",
      "Uruchomić wentylację lub odciąg dymów spawalniczych",
    ],
    wTrakcie: [
      "Zacisk masy mocować bezpośrednio przy miejscu spawania, nigdy przez konstrukcję obcą",
      "Stosować przesłony chroniące otoczenie przed promieniowaniem łuku",
      "Kontrolować otoczenie pod kątem zarzewia ognia przez cały czas trwania prac",
      "Nie spawać zbiorników i instalacji bez potwierdzenia opróżnienia i przewietrzenia",
      "Przy pracy w przestrzeni zamkniętej zapewnić wentylację i asekurację z zewnątrz",
    ],
    poPracy: [
      "Wyłączyć urządzenie, odłączyć zasilanie i uporządkować przewody",
      "Skontrolować strefę po 1 godzinie i ponownie po 8 godzinach od zakończenia prac",
      "Zamknąć zezwolenie na prace pożarowo niebezpieczne wpisem o wyniku kontroli",
      "Uprzątnąć odpady spawalnicze i ostudzone elementy",
    ],
    zabronione: [
      "Spawanie bez zezwolenia poza stałym stanowiskiem spawalniczym",
      "Spawanie zbiorników po substancjach palnych bez ich oczyszczenia i przewietrzenia",
      "Praca bez przyłbicy, w odzieży zaolejonej lub z tworzyw topliwych",
      "Prowadzenie przewodu masy przez rusztowanie, instalacje i konstrukcje obce",
      "Pozostawienie stanowiska bez kontroli bezpośrednio po zakończeniu spawania",
    ],
    awaria: [
      "Przy zapaleniu się materiału gasić gaśnicą; przy braku kontroli nad pożarem ewakuować się i wezwać straż (112)",
      ...AWARIA_BAZA.slice(1),
    ],
    podstawa: [
      "Rozporządzenie MSWiA z 7.06.2010 (ochrona przeciwpożarowa budynków)",
      "Rozporządzenie — ogólne przepisy BHP",
      "Rozporządzenie MRPiPS z 12.06.2018 (NDS i NDN — dymy spawalnicze)",
    ],
    pytania: [
      "Kiedy potrzebne jest zezwolenie na prace pożarowo niebezpieczne?",
      "Po jakim czasie od zakończenia spawania kontroluje się strefę?",
    ],
  },
  {
    key: "prace_wysokosc_szelki",
    tytul: "Praca na wysokości w szelkach bezpieczeństwa",
    grupa: "Praca na wysokości",
    opis: "Prace przy krawędziach i na konstrukcjach z indywidualnym zabezpieczeniem przed upadkiem.",
    uprawnienia: ["Orzeczenie — praca na wysokości powyżej 3 m", "Szkolenie z użytkowania środków ochrony indywidualnej"],
    soi: ["Szelki bezpieczeństwa", "Lonża z amortyzatorem lub urządzenie samohamowne", "Kask z paskiem podbródkowym", "Obuwie ochronne"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Środki ochrony indywidualnej stosuje się dopiero wtedy, gdy nie można zastosować ochron zbiorowych",
      "Przed rozpoczęciem prac musi być ustalony plan ewakuacji osoby wiszącej w szelkach",
    ],
    przedPraca: [
      "Sprawdzić datę przeglądu szelek, lonży i amortyzatora oraz brak uszkodzeń taśm i szwów",
      "Ustalić z osobą uprawnioną punkt kotwiczenia i potwierdzić jego nośność",
      "Obliczyć wolną przestrzeń pod stanowiskiem z uwzględnieniem wydłużenia amortyzatora",
      "Wygrodzić strefę poniżej stanowiska i zabezpieczyć narzędzia przed upadkiem",
      "Sprawdzić warunki atmosferyczne i przerwać prace przy wietrze powyżej 10 m/s, burzy i oblodzeniu",
    ],
    wTrakcie: [
      "Wpinać się do punktu kotwiczenia przed wejściem w strefę zagrożenia upadkiem",
      "Utrzymywać lonżę możliwie krótko i powyżej punktu wpięcia, ograniczając współczynnik odpadnięcia",
      "Nie przepinać się jednocześnie oboma zaczepami tam, gdzie wymagane jest ciągłe zabezpieczenie",
      "Obserwować stan liny i punktu kotwiczenia w trakcie przemieszczania się",
    ],
    poPracy: [
      "Wypiąć się dopiero po opuszczeniu strefy zagrożenia upadkiem",
      "Oczyścić i odwiesić sprzęt w miejscu chronionym przed wilgocią i słońcem",
      "Sprzęt, który powstrzymał upadek, wycofać z użytku i przekazać do oceny",
    ],
    zabronione: [
      "Praca bez wpięcia w strefie zagrożenia upadkiem",
      "Kotwiczenie do instalacji, rurociągów, drabin i elementów o nieznanej nośności",
      "Stosowanie sprzętu bez aktualnego przeglądu lub z widocznymi uszkodzeniami",
      "Samodzielne skracanie i modyfikowanie lonży i amortyzatorów",
      "Pozostawienie osoby wiszącej w szelkach bez natychmiastowej akcji ratunkowej",
    ],
    awaria: [
      "Osobę wiszącą w szelkach ewakuować niezwłocznie — trauma zawieszenia rozwija się w ciągu kilkunastu minut",
      "Po ewakuacji ułożyć poszkodowanego zgodnie z instrukcją pierwszej pomocy i wezwać pomoc (112)",
      ...AWARIA_BAZA.slice(2),
    ],
    podstawa: ["Rozporządzenie — ogólne przepisy BHP § 105–110", "Rozporządzenie MI z 6.02.2003", "Instrukcja producenta ŚOI"],
    pytania: [
      "Jak sprawdzasz, czy pod stanowiskiem jest wystarczająca wolna przestrzeń?",
      "Co robisz ze sprzętem, który powstrzymał upadek?",
    ],
  },
  {
    key: "reczne_prace_transportowe",
    tytul: "Ręczne prace transportowe",
    grupa: "Prace ogólne",
    opis: "Podnoszenie, przenoszenie i przemieszczanie ładunków bez użycia urządzeń mechanicznych.",
    uprawnienia: ["Instruktaż stanowiskowy", "Badania profilaktyczne"],
    soi: ["Rękawice ochronne", "Obuwie ochronne z podnoskiem", "Kask w strefach wymaganych"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Dopuszczalna masa przy pracy stałej: 12 kg dla kobiet i 30 kg dla mężczyzn; przy pracy dorywczej odpowiednio 20 kg i 50 kg",
      "Tam, gdzie to możliwe, ręczny transport zastępuje się środkami pomocniczymi",
    ],
    przedPraca: [
      "Ocenić masę, kształt i stabilność ładunku oraz sprawdzić brak ostrych krawędzi",
      "Sprawdzić drogę transportu: przeszkody, oświetlenie, nawierzchnia, różnice poziomów",
      "Dobrać środki pomocnicze: wózek, uchwyty, pasy, rolki",
      "Ustalić sposób transportu zespołowego i osobę kierującą, jeśli ładunek jest ciężki lub długi",
    ],
    wTrakcie: [
      "Podnosić z pozycji kucznej, plecami prostymi, ładunek trzymać blisko tułowia",
      "Nie skręcać tułowia z ładunkiem — zmieniać kierunek krokami",
      "Utrzymywać widoczność drogi ponad ładunkiem",
      "Przy transporcie zespołowym wykonywać ruchy na komendę osoby kierującej",
      "Robić przerwy przy powtarzalnym dźwiganiu",
    ],
    poPracy: [
      "Odstawić ładunek na stabilne podłoże, bez blokowania dróg ewakuacyjnych",
      "Uprzątnąć środki pomocnicze i drogę transportu",
      "Zgłosić dolegliwości bólowe kręgosłupa przełożonemu",
    ],
    zabronione: [
      "Przekraczanie dopuszczalnych mas określonych przepisami",
      "Przenoszenie ładunku po drabinie i po oblodzonej nawierzchni bez zabezpieczenia",
      "Rzucanie i zrzucanie materiału z wysokości",
      "Transport ładunku zasłaniającego drogę",
    ],
    awaria: [...AWARIA_BAZA.slice(2)],
    podstawa: [
      "Rozporządzenie MPiPS z 14.03.2000 (ręczne prace transportowe)",
      "Rozporządzenie — ogólne przepisy BHP",
    ],
    pytania: ["Jaka jest dopuszczalna masa przy pracy stałej?", "Jak zmieniasz kierunek z ładunkiem w rękach?"],
  },
  {
    key: "myjka_cisnieniowa",
    tytul: "Myjka wysokociśnieniowa",
    grupa: "Higiena i utrzymanie",
    opis: "Mycie ciśnieniowe posadzek, urządzeń i konstrukcji.",
    uprawnienia: ["Instruktaż stanowiskowy", "Szkolenie okresowe BHP"],
    soi: ["Gogle ochronne", "Rękawice", "Obuwie gumowe antypoślizgowe", "Odzież wodoodporna", "Ochronniki słuchu"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Strumień pod wysokim ciśnieniem może przeciąć skórę i wstrzyknąć zanieczyszczenia pod powłoki — to uraz wymagający natychmiastowej pomocy",
      "Urządzenie zasilać wyłącznie z gniazda z zabezpieczeniem różnicowoprądowym",
    ],
    przedPraca: [
      "Sprawdzić stan węża, lancy, złączy i przewodu zasilającego — brak przetarć i wycieków",
      "Sprawdzić działanie spustu z samopowrotem i blokady lancy",
      "Wygrodzić i oznakować strefę mycia; usunąć z niej osoby postronne",
      "Zabezpieczyć instalacje elektryczne, gniazda i szafy sterownicze przed zalaniem",
      "Ustalić sposób odprowadzenia wody i zabezpieczenia wpustów",
    ],
    wTrakcie: [
      "Trzymać lancę obiema rękami, stać stabilnie, kierować strumień od siebie i od innych osób",
      "Rozpoczynać mycie od najniższego skutecznego ciśnienia",
      "Zwracać uwagę na śliską posadzkę i na odbicie strumienia od powierzchni",
      "Przy myciu środkami chemicznymi stosować stężenia z instrukcji i sprawdzić karty charakterystyki",
    ],
    poPracy: [
      "Zwolnić ciśnienie w układzie przed odłączeniem węża",
      "Wyłączyć urządzenie, odłączyć zasilanie i zwinąć przewody",
      "Osuszyć posadzkę lub oznakować mokrą strefę do czasu wyschnięcia",
      "Zgłosić uszkodzenia węża lub złączy — element uszkodzony wycofać z użytku",
    ],
    zabronione: [
      "Kierowanie strumienia na ludzi, zwierzęta, instalacje elektryczne i gniazda",
      "Blokowanie spustu lancy w pozycji otwartej",
      "Odłączanie węża pod ciśnieniem",
      "Mycie urządzeń pod napięciem bez ich wcześniejszego odłączenia i zabezpieczenia",
    ],
    awaria: [
      "Przy zranieniu strumieniem natychmiast przerwać pracę i zapewnić pomoc medyczną — nawet mała rana wymaga oceny lekarza",
      ...AWARIA_BAZA.slice(1),
    ],
    podstawa: ["Rozporządzenie MG z 30.10.2002", "Rozporządzenie — ogólne przepisy BHP", "Instrukcja obsługi producenta"],
    pytania: ["Dlaczego drobna rana od strumienia jest groźna?", "Co robisz przed odłączeniem węża?"],
  },
  {
    key: "chemia_myjaca",
    tytul: "Praca ze środkami myjącymi i dezynfekującymi",
    grupa: "Higiena i utrzymanie",
    opis: "Stosowanie ługów, kwasów i preparatów dezynfekcyjnych w strefach produkcyjnych.",
    uprawnienia: ["Instruktaż stanowiskowy", "Szkolenie GHP/GMP", "Badania profilaktyczne"],
    soi: ["Gogle ochronne", "Rękawice chemoodporne", "Fartuch kwasoodporny", "Obuwie gumowe", "Półmaska z pochłaniaczem przy oparach"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Przed pierwszym użyciem środka należy zapoznać się z jego kartą charakterystyki",
      "Środki przechowuje się wyłącznie w oryginalnych, oznakowanych opakowaniach",
    ],
    przedPraca: [
      "Sprawdzić dostępność karty charakterystyki i oznakowania opakowania",
      "Dobrać środki ochrony indywidualnej zgodnie z kartą charakterystyki",
      "Sprawdzić sprawność oczomyjki i natrysku bezpieczeństwa w strefie",
      "Przygotować roztwór w podanym stężeniu — dodawać koncentrat do wody, nigdy odwrotnie",
      "Zapewnić wentylację pomieszczenia i wygrodzić strefę mycia",
    ],
    wTrakcie: [
      "Nie mieszać środków różnych typów — mieszanina kwasu z podchlorynem uwalnia chlor",
      "Zachować podany czas kontaktu środka z powierzchnią",
      "Unikać rozpylania w kierunku twarzy i w stronę innych osób",
      "Przy zabrudzeniu skóry natychmiast przerwać pracę i spłukać wodą",
    ],
    poPracy: [
      "Spłukać powierzchnie wodą zdatną do spożycia i potwierdzić brak pozostałości środka",
      "Zamknąć i odstawić opakowania w wyznaczone miejsce",
      "Umyć i osuszyć środki ochrony indywidualnej wielokrotnego użytku",
      "Uzupełnić protokół mycia i dezynfekcji",
    ],
    zabronione: [
      "Mieszanie różnych środków chemicznych",
      "Przelewanie środków do opakowań po żywności i napojach",
      "Praca bez gogli i rękawic chemoodpornych",
      "Pozostawienie roztworu bez oznakowania w strefie produkcyjnej",
    ],
    awaria: [
      "Przy kontakcie z oczami płukać oczomyjką co najmniej 15 minut i wezwać pomoc medyczną",
      "Przy rozlaniu zabezpieczyć strefę, zastosować sorbent i postępować zgodnie z kartą charakterystyki",
      ...AWARIA_BAZA.slice(2),
    ],
    podstawa: [
      "Rozporządzenie — ogólne przepisy BHP",
      "Ustawa o substancjach chemicznych i ich mieszaninach",
      "Karty charakterystyki stosowanych środków",
    ],
    pytania: [
      "Dlaczego nie wolno mieszać kwasu z podchlorynem?",
      "Jak przygotowujesz roztwór — co dodajesz do czego?",
    ],
  },
  {
    key: "chlodnia_mroznia",
    tytul: "Praca w chłodni i mroźni",
    grupa: "Higiena i utrzymanie",
    opis: "Prace serwisowe i transport w komorach chłodniczych i mroźniczych.",
    uprawnienia: ["Instruktaż stanowiskowy", "Badania profilaktyczne"],
    soi: ["Odzież ciepłochronna", "Rękawice ocieplane", "Czapka pod kask", "Obuwie ocieplane antypoślizgowe"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Instalacje chłodnicze mogą zawierać amoniak — jego uwolnienie zagraża życiu",
      "Praca w mroźni odbywa się z ograniczeniem czasu przebywania i przerwami na ogrzanie",
    ],
    przedPraca: [
      "Sprawdzić działanie otwierania drzwi komory od wewnątrz i sygnalizacji alarmowej",
      "Sprawdzić sprawność detekcji amoniaku i znajomość dróg ewakuacji",
      "Założyć odzież ciepłochronną i ustalić czas przebywania z przełożonym",
      "Poinformować drugą osobę o wejściu do komory i ustalić kontrolę czasową",
    ],
    wTrakcie: [
      "Nie przebywać w komorze samodzielnie bez ustalonego nadzoru i kontaktu",
      "Zwracać uwagę na oblodzenie posadzki i na ograniczoną przyczepność obuwia",
      "Przerywać pracę i wychodzić na ogrzanie zgodnie z ustalonym rytmem przerw",
      "Przy wyczuciu charakterystycznego zapachu amoniaku natychmiast opuścić strefę",
    ],
    poPracy: [
      "Zamknąć komorę, sprawdzić brak pozostawionych osób i narzędzi",
      "Zgłosić oblodzenia, nieszczelności i nieprawidłowości w pracy instalacji",
      "Odwiesić i osuszyć odzież ciepłochronną",
    ],
    zabronione: [
      "Blokowanie drzwi komory i wyłączanie sygnalizacji alarmowej",
      "Samodzielna praca przy instalacji amoniakalnej bez uprawnień i bez odcięcia",
      "Przekraczanie ustalonego czasu przebywania w mroźni",
      "Wnoszenie do komory otwartych źródeł ognia",
    ],
    awaria: [
      "Przy uwolnieniu amoniaku natychmiast ewakuować się pod wiatr, uruchomić alarm i nie wracać do strefy bez sprzętu ochrony dróg oddechowych",
      "Przy uwięzieniu w komorze użyć sygnalizacji alarmowej i pozostać w ruchu do czasu przybycia pomocy",
      ...AWARIA_BAZA.slice(2),
    ],
    podstawa: [
      "Rozporządzenie — ogólne przepisy BHP",
      "Rozporządzenie MG z 30.10.2002",
      "Instrukcja bezpieczeństwa instalacji chłodniczej zakładu",
    ],
    pytania: ["Co robisz po wyczuciu zapachu amoniaku?", "Jak sprawdzasz drzwi komory przed wejściem?"],
  },
  {
    key: "zageszczarka",
    tytul: "Zagęszczarka i ubijak wibracyjny",
    grupa: "Transport i maszyny",
    opis: "Zagęszczanie gruntu i podbudowy sprzętem wibracyjnym.",
    uprawnienia: ["Instruktaż stanowiskowy", "Badania profilaktyczne (drgania)"],
    soi: ["Ochronniki słuchu", "Rękawice antywibracyjne", "Okulary ochronne", "Obuwie ochronne", "Odzież ostrzegawcza"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Sprzęt wibracyjny jest źródłem drgań miejscowych i ogólnych — czas pracy podlega ograniczeniu",
      "Spalinowy sprzęt nie może pracować w pomieszczeniach zamkniętych bez wentylacji",
    ],
    przedPraca: [
      "Sprawdzić poziom paliwa i oleju oraz szczelność układu",
      "Sprawdzić stan płyty, uchwytów antywibracyjnych i osłon",
      "Ocenić teren: nośność podłoża, krawędzie wykopu, przeszkody, instalacje płytko ułożone",
      "Wygrodzić strefę pracy i ustalić trasę przemieszczania sprzętu",
    ],
    wTrakcie: [
      "Prowadzić maszynę z boku, nie stawać przed płytą",
      "Zachować bezpieczną odległość od krawędzi wykopu i skarp",
      "Robić przerwy w ekspozycji na drgania zgodnie z oceną ryzyka",
      "Tankowanie wykonywać przy wyłączonym i ostudzonym silniku, poza strefą prac gorących",
    ],
    poPracy: [
      "Wyłączyć silnik i odstawić sprzęt na stabilnym podłożu",
      "Oczyścić płytę i sprawdzić stan uchwytów antywibracyjnych",
      "Zgłosić usterki i zabezpieczyć sprzęt przed użyciem przez osoby nieuprawnione",
    ],
    zabronione: [
      "Praca sprzętem spalinowym w wykopie i pomieszczeniu bez wentylacji",
      "Zagęszczanie bezpośrednio nad płytko ułożonymi instalacjami bez uzgodnienia",
      "Tankowanie przy pracującym lub gorącym silniku",
      "Podnoszenie maszyny bez pomocy drugiej osoby lub urządzenia dźwigowego",
    ],
    awaria: [...AWARIA_BAZA, "Przy objawach mrowienia i drętwienia rąk przerwać pracę i zgłosić to przełożonemu"],
    podstawa: [
      "Rozporządzenie MG z 20.09.2001 (maszyny do robót ziemnych, budowlanych i drogowych)",
      "Rozporządzenie MGiP z 5.08.2005 (hałas i drgania)",
    ],
    pytania: ["Dlaczego nie wolno pracować zagęszczarką spalinową w wykopie?", "Kiedy przerywasz pracę z powodu drgań?"],
  },
  {
    key: "prace_ziemne_reczne",
    tytul: "Ręczne roboty ziemne w wykopie",
    grupa: "Prace ogólne",
    opis: "Prace w wykopie wąskoprzestrzennym i przy odkrywkach instalacji.",
    uprawnienia: ["Instruktaż stanowiskowy", "Badania profilaktyczne"],
    soi: ["Kask", "Obuwie ochronne", "Odzież ostrzegawcza", "Rękawice"],
    uwagiOgolne: [
      ...DOPUSZCZENIE,
      "Praca w wykopie o głębokości powyżej 1,5 m odbywa się pod bezpośrednim nadzorem",
      "Przed rozpoczęciem prac musi być znany przebieg uzbrojenia podziemnego",
    ],
    przedPraca: [
      "Zapoznać się z IBWR i zezwoleniem na roboty ziemne oraz z mapą uzbrojenia",
      "Sprawdzić zabezpieczenie ścian wykopu i stan obudowy po opadach i mrozie",
      "Sprawdzić zejście do wykopu — drabina wystająca 0,75 m ponad krawędź, co najwyżej co 20 m",
      "Sprawdzić wygrodzenie i oznakowanie wykopu oraz oświetlenie po zmroku",
    ],
    wTrakcie: [
      "Nie przebywać w zasięgu pracy maszyny ani pod podniesioną łyżką",
      "Odkład urobku utrzymywać co najmniej 0,6 m od krawędzi wykopu",
      "Przy odkryciu niezinwentaryzowanej instalacji przerwać pracę i powiadomić przełożonego",
      "Obserwować ściany wykopu — osypywanie się gruntu jest sygnałem do natychmiastowego wyjścia",
      "Przy pracy w wodzie i błocie stosować obuwie gumowe i pomosty",
    ],
    poPracy: [
      "Wyjść z wykopu wyznaczonym zejściem, uprzątnąć narzędzia",
      "Sprawdzić wygrodzenie, oznakowanie i przykrycie wykopu na czas przerwy",
      "Zgłosić przełożonemu zauważone uszkodzenia obudowy",
    ],
    zabronione: [
      "Wchodzenie do wykopu bez zabezpieczenia ścian tam, gdzie jest ono wymagane",
      "Podkopywanie ścian wykopu i praca pod nawisem gruntu",
      "Zeskakiwanie do wykopu i wychodzenie po obudowie",
      "Składowanie materiału i postój maszyn przy krawędzi wykopu",
    ],
    awaria: [
      "Przy oznakach osuwania się ścian natychmiast opuścić wykop i wygrodzić strefę",
      "Przy zasypaniu osoby nie wchodzić do wykopu bez zabezpieczenia — wezwać pomoc (112) i służby ratownicze",
      ...AWARIA_BAZA.slice(2),
    ],
    podstawa: ["Rozporządzenie MI z 6.02.2003 — roboty ziemne", "Rozporządzenie — ogólne przepisy BHP"],
    pytania: [
      "Jak daleko od krawędzi wykopu może leżeć urobek?",
      "Co robisz po odkryciu niezinwentaryzowanego kabla?",
    ],
  },
];

const BY_KEY = Object.fromEntries(PL_INSTRUKCJE.map((i) => [i.key, i]));

/** @param {string} key */
export function findPlInstrukcja(key) {
  return BY_KEY[String(key || "")] || null;
}

/** Grupy instrukcji w kolejności wyświetlania. */
export function listPlInstrukcjaGroups() {
  const seen = [];
  for (const i of PL_INSTRUKCJE) if (!seen.includes(i.grupa)) seen.push(i.grupa);
  return seen;
}

/**
 * Treść oświadczenia o zapoznaniu się z instrukcją — drukowana pod instrukcją do podpisu.
 * @param {string} tytul
 * @param {string} [data]
 */
export function instrukcjaAcknowledgementText(tytul, data = "") {
  return [
    `Oświadczam, że zapoznałem(-am) się z instrukcją stanowiskową BHP: „${tytul}".`,
    "Treść instrukcji jest dla mnie zrozumiała, znam zagrożenia występujące przy tej pracy, wymagane środki ochrony indywidualnej oraz czynności zabronione.",
    "Zobowiązuję się do przestrzegania zasad określonych w instrukcji, a w razie wątpliwości do zwrócenia się do bezpośredniego przełożonego.",
    data ? `Data zapoznania: ${data}` : "",
  ].filter(Boolean);
}

/**
 * Ile osób potwierdziło zapoznanie się z instrukcją i czy ktoś jeszcze zalega.
 * @param {{ zapoznani?: Array<{ imieNazwisko?: string, data?: string }> }} record
 */
export function instrukcjaAcknowledgementSummary(record) {
  const rows = Array.isArray(record?.zapoznani) ? record.zapoznani : [];
  const podpisane = rows.filter((r) => String(r?.imieNazwisko || "").trim() && String(r?.data || "").trim());
  return {
    total: rows.length,
    signed: podpisane.length,
    pending: rows.length - podpisane.length,
    complete: rows.length > 0 && podpisane.length === rows.length,
  };
}

export default PL_INSTRUKCJE;
