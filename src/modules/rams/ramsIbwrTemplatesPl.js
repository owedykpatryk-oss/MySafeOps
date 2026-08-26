/**
 * Gotowe IBWR dla typowych robót — treść, którą na budowie i tak przepisuje się z pliku do pliku.
 *
 * Układ odwzorowuje formularz IBWR używany na polskich budowach: etap pracy, sposób wykonania,
 * zidentyfikowane zagrożenia oraz działania minimalizujące rozdzielone na stronę pracodawcy
 * i stronę pracownika, a na końcu wykaz środków ochrony.
 *
 * Każdy etap staje się wierszem biblioteki zagrożeń, więc wchodzi w istniejący kreator i pakiety
 * szybkie bez osobnego ekranu. Podział „Pracodawca / Pracownik” zostaje w treści środków, żeby
 * przetrwał do wydruku.
 */

/** Domyślna tabela wpływu warunków atmosferycznych — pole formularza IBWR. */
export const PL_IBWR_WEATHER_FACTORS = [
  { factor: "Temperatura", affects: "Samopoczucie i dokładność wykonania robót", note: "Powyżej 28 °C i poniżej −10 °C — przerwy regeneracyjne" },
  { factor: "Wiatr", affects: "Stateczność maszyn, praca na wysokości, transport ładunku", note: "Wstrzymanie prac powyżej 10 m/s" },
  { factor: "Opady", affects: "Poślizgnięcia, osuwanie skarp, widoczność", note: "Ulewny deszcz, śnieg, gołoledź" },
  { factor: "Widoczność", affects: "Kolizje pojazdów i maszyn, widoczność pracowników", note: "Gęsta mgła, zmrok — oświetlenie stanowisk" },
  { factor: "Inne", affects: "Wyładowania atmosferyczne przy pracy maszyn i na wysokości", note: "Burza — przerwanie prac i zejście ze stanowisk" },
];

/** Telefony alarmowe drukowane w IBWR. */
export const PL_EMERGENCY_NUMBERS = [
  { label: "Telefon alarmowy", number: "112" },
  { label: "Straż pożarna", number: "998" },
  { label: "Pogotowie ratunkowe", number: "999" },
  { label: "Policja", number: "997" },
];

/** Stałe sekcje formularza IBWR — do wypełnienia dla konkretnej budowy. */
export const PL_IBWR_FORM_SECTIONS = [
  { key: "rodzajRobot", label: "Rodzaj robót" },
  { key: "inwestycja", label: "Nazwa i adres inwestycji" },
  { key: "wykonawca", label: "Wykonawca / generalny wykonawca" },
  { key: "termin", label: "Planowany termin robót (od–do, przerwy, dzień/noc)" },
  { key: "miejsce", label: "Miejsce wykonywania robót i wpływ na otoczenie" },
  { key: "dostep", label: "Sposób dotarcia do miejsca pracy" },
  { key: "ewakuacja", label: "Droga ewakuacji i miejsce zbiórki" },
  { key: "warunki", label: "Wpływ warunków atmosferycznych" },
  { key: "etapy", label: "Zakres i kolejność wykonywania robót" },
  { key: "substancje", label: "Substancje i materiały niebezpieczne (karty charakterystyki, kody odpadów)" },
  { key: "kontakty", label: "Kierownik budowy, kierownik robót, majster, służba BHP" },
  { key: "zapoznanie", label: "Lista pracowników zapoznanych z IBWR" },
];

const PPE_BAZOWE = [
  "Hełm ochronny z paskiem podbródkowym",
  "Kamizelka ostrzegawcza",
  "Obuwie robocze ochronne",
  "Rękawice ochronne",
  "Okulary ochronne",
];

const NADZOR = "Pracodawca — stały nadzór kierownika robót, majstra lub brygadzisty nad przebiegiem prac";
const ZAPOZNANIE = "Pracodawca — zapoznanie brygady z IBWR i ORZ przed rozpoczęciem, potwierdzone podpisami";
const BADANIA = "Pracodawca — weryfikacja aktualnych badań lekarskich, szkoleń BHP i wymaganych uprawnień";
const SOI_PRACOWNIK = "Pracownik — stosowanie przydzielonych środków ochrony indywidualnej przez cały czas pracy";
const OSTROZNOSC = "Pracownik — wzmożona uwaga, praca wyłącznie według instruktażu stanowiskowego";
const STOP = "Pracownik — wstrzymanie pracy i powiadomienie przełożonego przy stwierdzeniu zagrożenia";

/**
 * @typedef {{
 *   etap: string,
 *   sposob: string,
 *   zagrozenia: string[],
 *   pracodawca: string[],
 *   pracownik: string[],
 *   ppe?: string[],
 *   risk?: { L: number, S: number },
 *   revised?: { L: number, S: number },
 * }} IbwrStage
 */

/**
 * @typedef {{
 *   key: string,
 *   label: string,
 *   packDescription: string,
 *   regs: string[],
 *   permitTypes: string[],
 *   requiredCerts: string[],
 *   stages: IbwrStage[],
 * }} IbwrJob
 */

/** @type {IbwrJob[]} */
export const PL_IBWR_JOBS = [
  {
    key: "roboty_ziemne",
    label: "Roboty ziemne",
    packDescription: "Praca koparki, wykop, załadunek urobku i przejazdy między stanowiskami.",
    regs: [
      "Rozporządzenie MI z 6.02.2003 — roboty ziemne",
      "Rozporządzenie MG z 20.09.2001 — maszyny do robót ziemnych",
      "Rozporządzenie — ogólne przepisy BHP",
    ],
    permitTypes: ["excavation", "ground_disturbance"],
    requiredCerts: ["operator_maszyn", "bhp_okresowe", "badania_profilaktyczne"],
    stages: [
      {
        etap: "Przygotowanie sprzętu do pracy",
        sposob: "Oględziny maszyny, sprawdzenie DTR i książki maszyny, zapoznanie z wytycznymi kierownika budowy",
        zagrozenia: [
          "Potknięcie i upadek na tym samym poziomie oraz przy pokonywaniu różnicy poziomów",
          "Uderzenie o elementy wyposażenia stanowiska",
          "Potrącenie przez poruszające się pojazdy",
        ],
        pracodawca: [
          "Pracodawca — dopuszczenie do pracy wyłącznie sprzętu sprawnego technicznie, z aktualnym przeglądem",
          "Pracodawca — wyznaczenie i oznakowanie stref niebezpiecznych przed rozpoczęciem",
          BADANIA,
        ],
        pracownik: [
          "Pracownik — kontrola stanu maszyny przed rozruchem i zgłoszenie usterek",
          "Pracownik — niedopuszczanie do maszyny osób nieupoważnionych",
          SOI_PRACOWNIK,
        ],
        risk: { L: 3, S: 4 },
        revised: { L: 2, S: 3 },
      },
      {
        etap: "Przejazd maszyny na stanowisko i wygrodzenie miejsca pracy",
        sposob: "Przejazd z zachowaniem szczególnej ostrożności, sygnalizacja świetlna i dźwiękowa włączona, ustawienie znaków o liniach napowietrznych",
        zagrozenia: [
          "Najechanie lub potrącenie pracownika i osób postronnych",
          "Kolizja maszyn i pojazdów na budowie",
          "Zbliżenie wysięgnika do napowietrznej linii energetycznej",
        ],
        pracodawca: [
          "Pracodawca — wyznaczenie trasy przejazdu i lokalizacji stanowiska",
          "Pracodawca — oznakowanie linii napowietrznych i ustalenie stref ograniczonej wysokości",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — jazda z prędkością pozwalającą na zatrzymanie, przy włączonej sygnalizacji",
          "Pracownik — obserwacja otoczenia i sygnalisty przy ograniczonej widoczności",
          SOI_PRACOWNIK,
        ],
        risk: { L: 4, S: 5 },
        revised: { L: 2, S: 4 },
      },
      {
        etap: "Ustawienie maszyny i parametrów robót",
        sposob: "Ustawienie maszyny i parametrów zgodnie z wytycznymi kierownika budowy lub osoby upoważnionej",
        zagrozenia: [
          "Stoczenie lub wywrócenie maszyny na nierównym podłożu",
          "Upadek przy wsiadaniu i wysiadaniu z maszyny",
          "Praca zbyt blisko krawędzi wykopu",
        ],
        pracodawca: [
          "Pracodawca — sprawdzenie nośności podłoża i wyznaczenie odległości bezpiecznej od krawędzi wykopu",
          "Pracodawca — instruktaż stanowiskowy dla operatora na danym stanowisku",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — ustawienie parametrów zgodnie z wytycznymi i DTR maszyny",
          "Pracownik — korzystanie z trzech punktów podparcia przy wsiadaniu i wysiadaniu",
          OSTROZNOSC,
        ],
        risk: { L: 3, S: 5 },
        revised: { L: 2, S: 4 },
      },
      {
        etap: "Wykonanie robót ziemnych",
        sposob: "Wykonanie wykopu zgodnie z rzędnymi i parametrami działki roboczej, z zachowaniem szczególnej ostrożności",
        zagrozenia: [
          "Przysypanie pracownika przy obsunięciu ściany wykopu",
          "Uderzenie naczyniem roboczym maszyny",
          "Uszkodzenie niezinwentaryzowanej sieci podziemnej",
          "Zaprószenie oczu i zapylenie",
        ],
        pracodawca: [
          "Pracodawca — mapa uzbrojenia i uzgodnienia gestorów sieci dostępne na budowie",
          "Pracodawca — zabezpieczenie ścian wykopu obudową lub skarpowaniem zgodnie z dokumentacją",
          "Pracodawca — zakaz przebywania ludzi w strefie pracy maszyny, wygrodzenie i oznakowanie",
          ZAPOZNANIE,
        ],
        pracownik: [
          "Pracownik — brak wejścia w strefę pracy naczynia roboczego bez zatrzymania maszyny",
          "Pracownik — przerwanie prac i powiadomienie przełożonego po odkryciu sieci lub niewybuchu",
          STOP,
        ],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Załadunek urobku i przejazd na kolejne stanowisko",
        sposob: "Załadunek na pojazd transportowy i przejazd maszyny na kolejne stanowisko z wyznaczeniem nowej strefy niebezpiecznej",
        zagrozenia: [
          "Wysypanie się urobku i uderzenie",
          "Potrącenie kierowcy pojazdu przebywającego w strefie",
          "Stoczenie maszyny przy przejeździe",
        ],
        pracodawca: [
          "Pracodawca — ustalenie zasad postoju pojazdów i miejsca oczekiwania kierowców poza strefą",
          "Pracodawca — wyznaczenie nowej strefy niebezpiecznej przed wznowieniem prac",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — kierowca opuszcza kabinę i oczekuje poza strefą pracy maszyny",
          "Pracownik — załadunek bez przenoszenia naczynia nad kabiną pojazdu",
          SOI_PRACOWNIK,
        ],
        risk: { L: 3, S: 5 },
        revised: { L: 2, S: 4 },
      },
    ],
  },
  {
    key: "rozladunek",
    label: "Rozładunek i transport materiałów",
    packDescription: "Przyjęcie dostawy, rozładunek HDS lub ręczny, składowanie na budowie.",
    regs: [
      "Rozporządzenie MI z 6.02.2003",
      "Rozporządzenie MPiPS z 14.03.2000 — ręczne prace transportowe",
      "Ustawa o dozorze technicznym",
    ],
    permitTypes: ["lifting", "general"],
    requiredCerts: ["udt_zurawie", "slinger_signaller", "manual_handling"],
    stages: [
      {
        etap: "Przygotowanie stanowiska do rozładunku",
        sposob: "Wyznaczenie miejsca rozładunku o równym podłożu, wygrodzenie strefy niebezpiecznej pracy maszyny",
        zagrozenia: [
          "Najechanie pracownika przez pojazdy i maszyny",
          "Kolizja pojazdu z maszyną budowlaną",
          "Upadek, poślizgnięcie, skręcenie",
        ],
        pracodawca: [
          "Pracodawca — wyznaczenie miejsca rozładunku z dostępem do drogi wewnętrznej i zapasem miejsca",
          "Pracodawca — wygrodzenie strefy niebezpiecznej pracy maszyny",
          ZAPOZNANIE,
          BADANIA,
        ],
        pracownik: ["Pracownik — praca według instruktażu stanowiskowego", SOI_PRACOWNIK, OSTROZNOSC],
        risk: { L: 4, S: 4 },
        revised: { L: 2, S: 3 },
      },
      {
        etap: "Dostarczenie materiału na stanowisko rozładunku",
        sposob: "Podjechanie pojazdu w wyznaczone miejsce pod kierunkiem osoby odpowiedzialnej za kierowanie ruchem",
        zagrozenia: [
          "Najechanie na pracownika kierującego manewrem",
          "Kolizja pojazdu z maszynami na budowie",
          "Przewrócenie ładunku podczas manewru",
        ],
        pracodawca: [
          "Pracodawca — wyznaczenie przeszkolonej osoby kierującej ruchem pojazdów dostawczych",
          "Pracodawca — zapoznanie dostawcy z zasadami ruchu na budowie (karta szkolenia kierowcy)",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — kierowanie manewrem z pozycji widocznej dla kierowcy",
          "Pracownik — brak przebywania między pojazdem a przeszkodą",
          SOI_PRACOWNIK,
        ],
        risk: { L: 4, S: 5 },
        revised: { L: 2, S: 4 },
      },
      {
        etap: "Rozładunek mechaniczny (HDS / żuraw)",
        sposob: "Podnoszenie i przemieszczanie ładunku zgodnie z instrukcją, przy użyciu sprawnych zawiesi i sygnalizacji hakowego",
        zagrozenia: [
          "Upadek ładunku z wysokości",
          "Uderzenie ładunkiem lub zerwanym zawiesiem",
          "Wywrócenie pojazdu z HDS przy niewysuniętych podporach",
        ],
        pracodawca: [
          "Pracodawca — ważna decyzja UDT i uprawnienia operatora oraz hakowego zweryfikowane",
          "Pracodawca — zawiesia z aktualnym przeglądem, dobrane do masy i kąta rozwarcia",
          "Pracodawca — zakaz przenoszenia ładunku nad ludźmi ustalony i egzekwowany",
        ],
        pracownik: [
          "Pracownik — wysunięcie i podparcie podpór na płytach przed rozpoczęciem podnoszenia",
          "Pracownik — brak przebywania pod ładunkiem i w strefie jego przemieszczania",
          STOP,
        ],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Rozładunek ręczny",
        sposob: "Ręczne przenoszenie materiału z zachowaniem dopuszczalnych mas i techniki podnoszenia",
        zagrozenia: [
          "Uraz kręgosłupa przy podnoszeniu",
          "Przygniecenie palców i stóp",
          "Poślizgnięcie na nierównym lub mokrym podłożu",
        ],
        pracodawca: [
          "Pracodawca — przestrzeganie dopuszczalnych mas: praca stała 12 kg (kobiety) i 30 kg (mężczyźni)",
          "Pracodawca — zapewnienie sprzętu pomocniczego (wózki, uchwyty, podnośniki)",
          "Pracodawca — utrzymanie dróg transportu w czystości i bez przeszkód",
        ],
        pracownik: [
          "Pracownik — przenoszenie zespołowe elementów o dużej masie lub wymiarach",
          "Pracownik — technika podnoszenia z ugiętych nóg, bez skręcania tułowia",
          SOI_PRACOWNIK,
        ],
        risk: { L: 4, S: 3 },
        revised: { L: 2, S: 2 },
      },
      {
        etap: "Składowanie materiału i uporządkowanie stanowiska",
        sposob: "Składowanie na wyznaczonym placu, w stosach o dopuszczalnej wysokości, z zabezpieczeniem przed przewróceniem",
        zagrozenia: [
          "Przewrócenie stosu i przygniecenie",
          "Zawalenie się źle ułożonego materiału",
          "Potknięcie o pozostawiony materiał",
        ],
        pracodawca: [
          "Pracodawca — wyznaczenie i oznakowanie placu składowego z dopuszczalną wysokością stosu",
          "Pracodawca — kontrola stanu składowiska na koniec zmiany",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — układanie materiału na przekładkach, bez przekraczania wysokości stosu",
          "Pracownik — uporządkowanie stanowiska i dróg komunikacyjnych po zakończeniu",
          OSTROZNOSC,
        ],
        risk: { L: 3, S: 4 },
        revised: { L: 2, S: 3 },
      },
    ],
  },
  {
    key: "rusztowania",
    label: "Rusztowania i praca na wysokości",
    packDescription: "Montaż, odbiór, użytkowanie i demontaż rusztowania oraz prace na krawędziach.",
    regs: [
      "Rozporządzenie MI z 6.02.2003 — rusztowania",
      "Rozporządzenie — ogólne przepisy BHP § 105–110",
      "Rozporządzenie MZiOS z 30.05.1996 — badania profilaktyczne",
    ],
    permitTypes: ["work_at_height", "roof_access"],
    requiredCerts: ["rusztowania", "badania_wysokosc", "working_at_height"],
    stages: [
      {
        etap: "Przygotowanie montażu rusztowania",
        sposob: "Sprawdzenie podłoża, kompletności i stanu elementów, zapoznanie z instrukcją producenta lub projektem",
        zagrozenia: [
          "Osiadanie rusztowania na nienośnym podłożu",
          "Użycie elementów uszkodzonych lub niekompletnych",
          "Uraz przy ręcznym przenoszeniu elementów",
        ],
        pracodawca: [
          "Pracodawca — instrukcja producenta lub projekt rusztowania dostępne na budowie",
          "Pracodawca — kontrola i wycofanie elementów uszkodzonych przed montażem",
          BADANIA,
        ],
        pracownik: [
          "Pracownik — sprawdzenie nośności i wypoziomowania podłoża oraz podstawek",
          "Pracownik — zgłaszanie braków i uszkodzeń przed rozpoczęciem montażu",
          SOI_PRACOWNIK,
        ],
        risk: { L: 3, S: 4 },
        revised: { L: 2, S: 3 },
      },
      {
        etap: "Montaż rusztowania",
        sposob: "Montaż kolejnymi poziomami przez osoby z uprawnieniami, z bieżącym kotwieniem i zabezpieczeniem monterów",
        zagrozenia: [
          "Upadek montera z wysokości",
          "Upadek elementu na osoby poniżej",
          "Utrata stateczności konstrukcji w trakcie montażu",
        ],
        pracodawca: [
          "Pracodawca — montaż wyłącznie przez osoby z uprawnieniami do montażu rusztowań",
          "Pracodawca — wygrodzenie strefy niebezpiecznej pod montażem",
          "Pracodawca — kotwienie i stężenia zgodne z dokumentacją, kontrolowane na bieżąco",
        ],
        pracownik: [
          "Pracownik — asekuracja szelkami do konstrukcji na każdym etapie montażu",
          "Pracownik — podawanie elementów bez zrzucania ich z wysokości",
          STOP,
        ],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Odbiór rusztowania",
        sposob: "Odbiór protokolarny przez kierownika budowy, oznakowanie tabliczką z dopuszczalnym obciążeniem",
        zagrozenia: [
          "Dopuszczenie do użytkowania rusztowania bez odbioru",
          "Przeciążenie pomostu ponad dopuszczalne obciążenie",
          "Brak lub niekompletne balustrady",
        ],
        pracodawca: [
          "Pracodawca — protokolarny odbiór rusztowania i tabliczka z dopuszczalnym obciążeniem",
          "Pracodawca — fizyczne zablokowanie wejść do czasu odbioru",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — sprawdzenie tabliczki odbioru przed wejściem na rusztowanie",
          "Pracownik — brak wchodzenia na rusztowanie nieodebrane lub oznaczone zakazem",
          OSTROZNOSC,
        ],
        risk: { L: 3, S: 6 },
        revised: { L: 1, S: 5 },
      },
      {
        etap: "Użytkowanie rusztowania podczas robót",
        sposob: "Praca z pomostów pełnych, z balustradami i bortnicą, z materiałem podawanym mechanicznie",
        zagrozenia: [
          "Upadek z pomostu przy niekompletnych balustradach",
          "Upadek materiału lub narzędzia poza bortnicę",
          "Utrata stateczności przy silnym wietrze",
        ],
        pracodawca: [
          "Pracodawca — kontrola rusztowania po wietrze, opadach i po przerwie w pracy dłuższej niż 10 dni",
          "Pracodawca — wstrzymanie prac przy wietrze powyżej 10 m/s, oblodzeniu i burzy",
          "Pracodawca — daszki ochronne nad ciągami pieszych utrzymywanymi w ruchu",
        ],
        pracownik: [
          "Pracownik — zabezpieczenie narzędzi linkami i brak składowania przy krawędzi pomostu",
          "Pracownik — zgłaszanie brakujących elementów zabezpieczeń zamiast pracy bez nich",
          SOI_PRACOWNIK,
        ],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Demontaż rusztowania",
        sposob: "Demontaż w kolejności odwrotnej do montażu, z zachowaniem kotwień do ostatniej fazy",
        zagrozenia: [
          "Zawalenie konstrukcji przy przedwczesnym zdjęciu kotwień",
          "Upadek elementów w strefę ruchu",
          "Upadek montera przy zdemontowanych balustradach",
        ],
        pracodawca: [
          "Pracodawca — kolejność demontażu ustalona i omówiona przed rozpoczęciem",
          "Pracodawca — wygrodzenie i dozór strefy niebezpiecznej przez cały demontaż",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — brak zrzucania elementów, opuszczanie ich w sposób kontrolowany",
          "Pracownik — asekuracja szelkami przy pracy na niezabezpieczonych poziomach",
          STOP,
        ],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
    ],
  },
  {
    key: "zbrojenie_beton",
    label: "Zbrojenie i betonowanie",
    packDescription: "Przygotowanie zbrojenia, deskowanie, podawanie i układanie mieszanki betonowej.",
    regs: ["Rozporządzenie MI z 6.02.2003", "Rozporządzenie — ogólne przepisy BHP", "Rozporządzenie MG z 30.10.2002"],
    permitTypes: ["general", "work_at_height"],
    requiredCerts: ["bhp_okresowe", "badania_profilaktyczne", "manual_handling"],
    stages: [
      {
        etap: "Przygotowanie i transport zbrojenia",
        sposob: "Cięcie i gięcie prętów na wyznaczonym stanowisku, transport wiązek dźwigiem lub zespołowo",
        zagrozenia: [
          "Skaleczenia i przekłucia prętami zbrojeniowymi",
          "Uraz kręgosłupa przy przenoszeniu wiązek",
          "Odrzucenie odłamka przy cięciu",
        ],
        pracodawca: [
          "Pracodawca — wyznaczenie stanowiska zbrojarskiego poza ciągami komunikacyjnymi",
          "Pracodawca — sprawny sprzęt do cięcia i gięcia z kompletem osłon",
          BADANIA,
        ],
        pracownik: [
          "Pracownik — nakładanie kapturków na wystające pręty w strefie ruchu ludzi",
          "Pracownik — transport wiązek zespołowo lub mechanicznie, nie pojedynczo",
          SOI_PRACOWNIK,
        ],
        ppe: [...PPE_BAZOWE, "Rękawice antyprzecięciowe", "Ochronniki słuchu"],
        risk: { L: 4, S: 3 },
        revised: { L: 2, S: 2 },
      },
      {
        etap: "Montaż zbrojenia i deskowania",
        sposob: "Montaż zgodnie z projektem, z zapewnieniem bezpiecznych dojść i pomostów roboczych",
        zagrozenia: [
          "Upadek z wysokości lub do wykopu",
          "Nadzianie się na pręty przy upadku",
          "Zawalenie deskowania przy braku stężeń",
        ],
        pracodawca: [
          "Pracodawca — projekt deskowania i stężeń zatwierdzony przez osobę uprawnioną",
          "Pracodawca — pomosty robocze i balustrady przy pracy powyżej 1 m",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — poruszanie się wyłącznie po pomostach, nie po zbrojeniu",
          "Pracownik — zabezpieczenie wystających prętów na czas montażu",
          OSTROZNOSC,
        ],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Podawanie mieszanki betonowej",
        sposob: "Podawanie pompą lub pojemnikiem przy zachowaniu łączności między operatorem a brygadą",
        zagrozenia: [
          "Uderzenie końcówką węża pompy przy zatorze",
          "Uderzenie pojemnikiem przenoszonym dźwigiem",
          "Wywrócenie pompy przy niewysuniętych podporach",
        ],
        pracodawca: [
          "Pracodawca — sprawdzenie ustawienia i podparcia pompy przed rozpoczęciem podawania",
          "Pracodawca — ustalenie sygnałów i łączności między operatorem a brygadą",
          "Pracodawca — wygrodzenie strefy pracy wysięgnika",
        ],
        pracownik: [
          "Pracownik — brak przebywania przed wylotem węża przy rozruchu i przy zatorze",
          "Pracownik — prowadzenie końcówki oburącz, z pozycji stabilnej",
          STOP,
        ],
        risk: { L: 4, S: 5 },
        revised: { L: 2, S: 4 },
      },
      {
        etap: "Układanie i zagęszczanie betonu",
        sposob: "Układanie warstwami, zagęszczanie wibratorem wgłębnym zgodnie z instrukcją",
        zagrozenia: [
          "Poparzenie skóry i oczu zaczynem cementowym",
          "Zespół wibracyjny przy pracy wibratorem",
          "Porażenie prądem od uszkodzonego wibratora",
        ],
        pracodawca: [
          "Pracodawca — sprzęt zasilany przez wyłącznik różnicowoprądowy, z aktualnymi pomiarami",
          "Pracodawca — limity czasu pracy wibratorem i rotacja pracowników",
          "Pracodawca — punkt do przemywania oczu i skóry dostępny na stanowisku",
        ],
        pracownik: [
          "Pracownik — stosowanie rękawic i okularów przy kontakcie z mieszanką",
          "Pracownik — natychmiastowe spłukanie skóry po kontakcie z zaczynem",
          SOI_PRACOWNIK,
        ],
        ppe: [...PPE_BAZOWE, "Rękawice chemoodporne", "Obuwie gumowe", "Rękawice antywibracyjne"],
        risk: { L: 4, S: 4 },
        revised: { L: 2, S: 3 },
      },
      {
        etap: "Pielęgnacja betonu i rozdeskowanie",
        sposob: "Pielęgnacja zgodnie z technologią, rozdeskowanie po osiągnięciu wymaganej wytrzymałości",
        zagrozenia: [
          "Zawalenie elementu przy przedwczesnym rozdeskowaniu",
          "Upadek elementów deskowania",
          "Potknięcie o materiał pozostawiony po rozdeskowaniu",
        ],
        pracodawca: [
          "Pracodawca — zgoda kierownika robót na rozdeskowanie po potwierdzeniu wytrzymałości",
          "Pracodawca — wygrodzenie strefy pod rozdeskowywanym elementem",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — opuszczanie elementów w sposób kontrolowany, bez zrzucania",
          "Pracownik — bieżące usuwanie materiału z dróg komunikacyjnych",
          OSTROZNOSC,
        ],
        risk: { L: 3, S: 5 },
        revised: { L: 2, S: 4 },
      },
    ],
  },
  {
    key: "prace_elektryczne",
    label: "Prace elektryczne na budowie",
    packDescription: "Zasilanie placu budowy, rozdzielnice, wyłączenia i prace przy instalacjach.",
    regs: [
      "Rozporządzenie MKiŚ z 1.07.2022 — kwalifikacje przy eksploatacji urządzeń",
      "Rozporządzenie — ogólne przepisy BHP",
      "Rozporządzenie MI z 6.02.2003",
    ],
    permitTypes: ["electrical", "cold_work"],
    requiredCerts: ["sep_e", "electrical_loto", "badania_profilaktyczne"],
    stages: [
      {
        etap: "Przygotowanie do prac i uzgodnienie wyłączenia",
        sposob: "Ustalenie zakresu, punktów odłączenia i sposobu zabezpieczenia z osobą dozoru",
        zagrozenia: [
          "Praca na instalacji uznanej błędnie za wyłączoną",
          "Brak uzgodnienia z użytkownikiem obiektu",
          "Nieuprawnione wykonywanie prac",
        ],
        pracodawca: [
          "Pracodawca — weryfikacja świadectw kwalifikacyjnych SEP przed dopuszczeniem do prac",
          "Pracodawca — wydanie polecenia pisemnego dla prac w warunkach szczególnego zagrożenia",
          ZAPOZNANIE,
        ],
        pracownik: [
          "Pracownik — potwierdzenie zakresu prac i granic wyłączenia przed rozpoczęciem",
          "Pracownik — odmowa pracy bez wymaganych uprawnień i polecenia",
          STOP,
        ],
        risk: { L: 3, S: 6 },
        revised: { L: 1, S: 5 },
      },
      {
        etap: "Wyłączenie, zabezpieczenie i sprawdzenie braku napięcia",
        sposob: "Wyłączenie, zablokowanie (LOTO), wywieszenie tablic i sprawdzenie braku napięcia sprawdzonym przyrządem",
        zagrozenia: [
          "Porażenie prądem elektrycznym",
          "Ponowne załączenie zasilania przez osobę trzecią",
          "Łuk elektryczny przy zwarciu",
        ],
        pracodawca: [
          "Pracodawca — zapewnienie kompletu kłódek, blokad i tablic ostrzegawczych",
          "Pracodawca — zasada, że zasilanie przywraca wyłącznie osoba, która je wyłączyła",
          "Pracodawca — przyrządy pomiarowe z aktualnym sprawdzeniem",
        ],
        pracownik: [
          "Pracownik — sprawdzenie przyrządu na źródle pod napięciem przed i po pomiarze",
          "Pracownik — założenie uziemienia roboczego tam, gdzie jest wymagane",
          SOI_PRACOWNIK,
        ],
        ppe: ["Rękawice dielektryczne", "Osłona twarzy", "Obuwie elektroizolacyjne", "Odzież trudnopalna", "Hełm ochronny"],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Wykonanie prac przy instalacji",
        sposob: "Prace przy wyłączonej i zabezpieczonej instalacji, z asekuracją drugiej osoby",
        zagrozenia: [
          "Porażenie od obwodu obcego lub nieodłączonego",
          "Upadek przy pracy na drabinie lub podeście",
          "Uraz oczu przy pracy w rozdzielnicy",
        ],
        pracodawca: [
          "Pracodawca — asekuracja drugiej osoby przy pracach w rozdzielnicach",
          "Pracodawca — zapewnienie podestu zamiast drabiny przy pracach dłuższych",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — traktowanie obwodów niesprawdzonych jako będących pod napięciem",
          "Pracownik — używanie narzędzi izolowanych o odpowiednim napięciu znamionowym",
          OSTROZNOSC,
        ],
        risk: { L: 3, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Zasilanie placu budowy i eksploatacja rozdzielnic",
        sposob: "Rozprowadzenie zasilania rozdzielnicami budowlanymi, przewody prowadzone poza drogami komunikacyjnymi",
        zagrozenia: [
          "Porażenie od uszkodzonego przewodu",
          "Zalanie rozdzielnicy i zwarcie",
          "Potknięcie o przewód na drodze komunikacyjnej",
        ],
        pracodawca: [
          "Pracodawca — rozdzielnice budowlane z wyłącznikami różnicowoprądowymi i aktualnymi pomiarami",
          "Pracodawca — harmonogram oględzin instalacji placu budowy",
          "Pracodawca — zakaz stosowania osprzętu domowego na budowie",
        ],
        pracownik: [
          "Pracownik — codzienne oględziny przewodów i wtyczek przed użyciem",
          "Pracownik — prowadzenie przewodów na wysokości lub w osłonach kablowych",
          SOI_PRACOWNIK,
        ],
        risk: { L: 4, S: 5 },
        revised: { L: 2, S: 4 },
      },
      {
        etap: "Zakończenie prac i załączenie zasilania",
        sposob: "Uporządkowanie stanowiska, zdjęcie blokad i załączenie zasilania po sprawdzeniu instalacji",
        zagrozenia: [
          "Załączenie zasilania przy osobach pracujących na instalacji",
          "Pozostawienie odsłoniętych części pod napięciem",
          "Brak potwierdzenia zakończenia prac",
        ],
        pracodawca: [
          "Pracodawca — potwierdzenie zejścia wszystkich osób z instalacji przed załączeniem",
          "Pracodawca — odnotowanie zakończenia prac i przywrócenia zasilania",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — zamknięcie osłon i rozdzielnic przed zgłoszeniem zakończenia",
          "Pracownik — zdjęcie własnej kłódki dopiero po opuszczeniu strefy pracy",
          OSTROZNOSC,
        ],
        risk: { L: 3, S: 6 },
        revised: { L: 1, S: 5 },
      },
    ],
  },
  {
    key: "roboty_drogowe",
    label: "Roboty drogowe przy ruchu",
    packDescription: "Oznakowanie tymczasowe, praca w pasie drogowym, układanie i zagęszczanie nawierzchni.",
    regs: [
      "Rozporządzenie MI z 6.02.2003",
      "Rozporządzenie w sprawie szczegółowych warunków zarządzania ruchem na drogach",
      "Rozporządzenie — ogólne przepisy BHP",
    ],
    permitTypes: ["general", "ground_disturbance", "night_works"],
    requiredCerts: ["bhp_okresowe", "operator_maszyn", "badania_profilaktyczne"],
    stages: [
      {
        etap: "Wprowadzenie tymczasowej organizacji ruchu",
        sposob: "Ustawienie oznakowania zgodnie z zatwierdzonym projektem TOR, od strony nadjeżdżających pojazdów",
        zagrozenia: [
          "Potrącenie przez pojazd podczas ustawiania znaków",
          "Wjazd pojazdu w strefę robót przy niepełnym oznakowaniu",
          "Przewrócenie znaku przez podmuch pojazdu",
        ],
        pracodawca: [
          "Pracodawca — zatwierdzony projekt TOR dostępny na budowie",
          "Pracodawca — ustalenie kolejności ustawiania oznakowania i pojazdu osłonowego",
          BADANIA,
        ],
        pracownik: [
          "Pracownik — ustawianie znaków twarzą do nadjeżdżających pojazdów, poza jezdnią gdy to możliwe",
          "Pracownik — dociążenie znaków i kontrola oznakowania po ustawieniu",
          SOI_PRACOWNIK,
        ],
        ppe: ["Odzież ostrzegawcza klasy 3", "Hełm ochronny", "Obuwie ochronne", "Rękawice"],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Praca w pasie drogowym przy ruchu",
        sposob: "Prace w wygrodzonej strefie, z zachowaniem odległości od jezdni czynnej i łącznością z sygnalistą",
        zagrozenia: [
          "Wjechanie pojazdu w strefę robót",
          "Potrącenie pracownika wychodzącego poza wygrodzenie",
          "Hałas i spaliny od ruchu drogowego",
        ],
        pracodawca: [
          "Pracodawca — kontrola oznakowania na początku zmiany i po każdej zmianie układu robót",
          "Pracodawca — wyznaczenie sygnalisty i zasad wejścia poza wygrodzenie",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — brak wychodzenia poza wygrodzenie bez zgody kierującego robotami",
          "Pracownik — praca zwrócona w stronę ruchu tam, gdzie to możliwe",
          STOP,
        ],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Roboty nawierzchniowe — układanie i zagęszczanie",
        sposob: "Układanie mieszanki rozkładarką, zagęszczanie walcem przy zachowaniu stref bezpieczeństwa maszyn",
        zagrozenia: [
          "Najechanie przez walec lub rozkładarkę",
          "Poparzenie gorącą mieszanką mineralno-asfaltową",
          "Narażenie na opary i hałas maszyn",
        ],
        pracodawca: [
          "Pracodawca — wyznaczenie stref pracy maszyn i zasad poruszania się pieszych",
          "Pracodawca — sprzęt z sygnalizacją cofania i sprawnymi lusterkami",
          "Pracodawca — napoje profilaktyczne przy pracy w wysokiej temperaturze",
        ],
        pracownik: [
          "Pracownik — utrzymywanie kontaktu wzrokowego z operatorem maszyny",
          "Pracownik — odzież zakrywająca skórę przy pracy z gorącą mieszanką",
          SOI_PRACOWNIK,
        ],
        ppe: ["Odzież ostrzegawcza klasy 3", "Obuwie odporne na wysoką temperaturę", "Rękawice termoodporne", "Ochronniki słuchu", "Hełm ochronny"],
        risk: { L: 4, S: 5 },
        revised: { L: 2, S: 4 },
      },
      {
        etap: "Prace w porze nocnej",
        sposob: "Prace przy oświetleniu stanowisk, z odzieżą odblaskową i ograniczeniem hałasu",
        zagrozenia: [
          "Ograniczona widoczność pracowników dla kierowców",
          "Zmęczenie i spadek koncentracji",
          "Potknięcia poza obszarem oświetlonym",
        ],
        pracodawca: [
          "Pracodawca — oświetlenie stanowisk i dróg dojścia bez oślepiania kierowców",
          "Pracodawca — planowanie zmian z przerwami i limitem godzin nocnych",
          "Pracodawca — uzgodnienie ograniczeń hałasu z zarządcą terenu",
        ],
        pracownik: [
          "Pracownik — odzież ostrzegawcza klasy 3 przez cały czas pracy",
          "Pracownik — zgłaszanie zmęczenia bez obawy o konsekwencje",
          OSTROZNOSC,
        ],
        risk: { L: 4, S: 5 },
        revised: { L: 2, S: 4 },
      },
      {
        etap: "Zdjęcie oznakowania i przekazanie odcinka",
        sposob: "Demontaż oznakowania w kolejności odwrotnej do ustawiania, po uporządkowaniu terenu",
        zagrozenia: [
          "Potrącenie podczas zbierania znaków",
          "Pozostawienie sprzętu lub materiału w pasie drogowym",
          "Przedwczesne otwarcie odcinka dla ruchu",
        ],
        pracodawca: [
          "Pracodawca — potwierdzenie uprzątnięcia odcinka przed przywróceniem ruchu",
          "Pracodawca — kolejność zdejmowania oznakowania ustalona przed rozpoczęciem",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — zbieranie znaków od strony ruchu, z pojazdem osłonowym",
          "Pracownik — kontrola terenu pod kątem pozostawionego sprzętu",
          OSTROZNOSC,
        ],
        risk: { L: 4, S: 5 },
        revised: { L: 2, S: 4 },
      },
    ],
  },
  {
    key: "rozbiorki",
    label: "Roboty rozbiórkowe",
    packDescription: "Odłączenie mediów, rozbiórka konstrukcji, usuwanie gruzu i zabezpieczenie otoczenia.",
    regs: ["Rozporządzenie MI z 6.02.2003 — roboty rozbiórkowe", "Prawo budowlane", "Rozporządzenie — ogólne przepisy BHP"],
    permitTypes: ["general", "excavation"],
    requiredCerts: ["bhp_okresowe", "budowlane", "operator_maszyn"],
    stages: [
      {
        etap: "Przygotowanie rozbiórki i odłączenie mediów",
        sposob: "Odłączenie energii, gazu, wody i kanalizacji potwierdzone przez gestorów, wygrodzenie terenu",
        zagrozenia: [
          "Porażenie prądem lub wybuch gazu z nieodłączonej instalacji",
          "Wejście osób postronnych na teren rozbiórki",
          "Nieznane materiały niebezpieczne w obiekcie",
        ],
        pracodawca: [
          "Pracodawca — potwierdzenia odłączenia mediów zebrane przed rozpoczęciem robót",
          "Pracodawca — inwentaryzacja materiałów niebezpiecznych, w tym azbestu",
          "Pracodawca — ogrodzenie i oznakowanie terenu rozbiórki",
        ],
        pracownik: [
          "Pracownik — brak rozpoczęcia prac bez potwierdzenia odłączenia mediów",
          "Pracownik — zgłaszanie podejrzanych materiałów zamiast ich naruszania",
          STOP,
        ],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Rozbiórka konstrukcji",
        sposob: "Rozbiórka w kolejności zgodnej z projektem, od góry, bez podkopywania i naruszania elementów nośnych",
        zagrozenia: [
          "Niekontrolowane zawalenie elementu",
          "Upadek gruzu poza strefę wygrodzoną",
          "Utrata stateczności obiektu sąsiedniego",
        ],
        pracodawca: [
          "Pracodawca — projekt rozbiórki i kolejność demontażu opracowane przez osobę uprawnioną",
          "Pracodawca — monitoring obiektów sąsiednich i progi alarmowe",
          "Pracodawca — zakaz przebywania ludzi w obiekcie podczas pracy sprzętu",
        ],
        pracownik: [
          "Pracownik — praca wyłącznie z pozycji wskazanych w projekcie rozbiórki",
          "Pracownik — natychmiastowe przerwanie prac przy pęknięciach i odkształceniach",
          SOI_PRACOWNIK,
        ],
        ppe: [...PPE_BAZOWE, "Półmaska FFP3", "Ochronniki słuchu"],
        risk: { L: 4, S: 6 },
        revised: { L: 2, S: 5 },
      },
      {
        etap: "Usuwanie gruzu i ograniczenie pylenia",
        sposob: "Transport gruzu rynnami zsypowymi lub mechanicznie, ze zraszaniem strefy",
        zagrozenia: [
          "Upadek gruzu z wysokości",
          "Zapylenie i narażenie na pył krzemionkowy",
          "Zanieczyszczenie wpustów kanalizacyjnych",
        ],
        pracodawca: [
          "Pracodawca — rynny zsypowe lub transport mechaniczny zamiast zrzucania z wysokości",
          "Pracodawca — zraszanie strefy rozbiórki i zabezpieczenie wpustów",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — stosowanie półmaski FFP3 w strefie zapylonej",
          "Pracownik — brak zrzucania gruzu poza rynną zsypową",
          OSTROZNOSC,
        ],
        ppe: [...PPE_BAZOWE, "Półmaska FFP3"],
        risk: { L: 4, S: 4 },
        revised: { L: 2, S: 3 },
      },
      {
        etap: "Segregacja i wywóz odpadów",
        sposob: "Segregacja odpadów według kodów, przekazanie uprawnionemu odbiorcy z kartą przekazania odpadu",
        zagrozenia: [
          "Kontakt z odpadem niebezpiecznym",
          "Przeciążenie kontenera i wysypanie zawartości",
          "Uraz przy ręcznym załadunku",
        ],
        pracodawca: [
          "Pracodawca — wyznaczenie miejsc segregacji z opisem kodów odpadów",
          "Pracodawca — umowa z uprawnionym odbiorcą i karty przekazania odpadu",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — brak przekraczania poziomu załadunku kontenera",
          "Pracownik — zgłaszanie odpadów niebezpiecznych zamiast mieszania ich z gruzem",
          SOI_PRACOWNIK,
        ],
        risk: { L: 3, S: 3 },
        revised: { L: 2, S: 2 },
      },
      {
        etap: "Zabezpieczenie terenu po rozbiórce",
        sposob: "Uporządkowanie terenu, zabezpieczenie wykopów i pozostałości fundamentów",
        zagrozenia: [
          "Upadek do niezabezpieczonego wykopu lub piwnicy",
          "Wejście osób postronnych na nieuporządkowany teren",
          "Wystające pręty i elementy konstrukcji",
        ],
        pracodawca: [
          "Pracodawca — utrzymanie ogrodzenia do czasu zakończenia robót",
          "Pracodawca — odbiór terenu po zakończeniu rozbiórki z zapisem w dzienniku budowy",
          NADZOR,
        ],
        pracownik: [
          "Pracownik — zabezpieczenie lub oznakowanie otworów i wykopów na koniec zmiany",
          "Pracownik — usunięcie lub zagięcie wystających prętów",
          OSTROZNOSC,
        ],
        risk: { L: 3, S: 5 },
        revised: { L: 2, S: 4 },
      },
    ],
  },
];

const BY_KEY = Object.fromEntries(PL_IBWR_JOBS.map((j) => [j.key, j]));

/** @param {string} key */
export function findIbwrJob(key) {
  return BY_KEY[String(key || "")] || null;
}

/** @param {IbwrJob} job */
export function ibwrCategory(job) {
  return `PL — IBWR: ${job.label}`;
}

export const PL_IBWR_CATEGORIES = PL_IBWR_JOBS.map(ibwrCategory);

/**
 * Rozwija etapy IBWR w wiersze biblioteki zagrożeń — jeden wiersz na etap pracy.
 * @returns {object[]}
 */
export function buildIbwrHazardRows() {
  const rows = [];
  for (const job of PL_IBWR_JOBS) {
    job.stages.forEach((stage, i) => {
      const initial = stage.risk || { L: 4, S: 4 };
      const revised = stage.revised || { L: 2, S: 3 };
      rows.push({
        id: `pl_ibwr_${job.key}_${String(i + 1).padStart(2, "0")}`,
        market: "pl",
        sector: "construction",
        category: ibwrCategory(job),
        activity: `Etap ${i + 1}: ${stage.etap} — ${stage.sposob}`,
        hazard: stage.zagrozenia.join("; "),
        initialRisk: { ...initial, RF: initial.L * initial.S },
        controlMeasures: [...stage.pracodawca, ...stage.pracownik],
        revisedRisk: { ...revised, RF: revised.L * revised.S },
        ppeRequired: stage.ppe || PPE_BAZOWE,
        regs: job.regs,
        permitTypes: job.permitTypes,
        requiredCerts: job.requiredCerts,
      });
    });
  }
  return rows;
}

/** Definicje pakietów szybkich — jeden pakiet na rodzaj robót. */
export function buildIbwrPackDefs() {
  return PL_IBWR_JOBS.map((job) => ({
    id: `builtin_pl_ibwr_${job.key}`,
    name: `IBWR — ${job.label}`,
    sector: "construction",
    pinned: true,
    description: job.packDescription,
    hazardIds: job.stages.map((_, i) => `pl_ibwr_${job.key}_${String(i + 1).padStart(2, "0")}`),
  }));
}

export default buildIbwrHazardRows();
