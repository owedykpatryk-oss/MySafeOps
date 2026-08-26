/**
 * Ocena ryzyka zawodowego (ORZ) — karty dla stanowisk pracy, wg skali trójstopniowej PN-N-18002.
 *
 * ORZ to osobny dokument od IBWR i planu BIOZ: IBWR opisuje konkretne roboty, ORZ opisuje
 * stanowisko pracy. Kodeks pracy (art. 226) wymaga oceny i udokumentowania ryzyka zawodowego
 * oraz poinformowania pracownika — stąd oświadczenie o zapoznaniu się z ryzykiem.
 */

/** Prawdopodobieństwo wystąpienia zdarzenia — skala trójstopniowa PN-N-18002. */
export const ORZ_PROBABILITY = ["mało prawdopodobne", "prawdopodobne", "wysoce prawdopodobne"];

/** Ciężkość następstw. */
export const ORZ_SEVERITY = ["mała", "średnia", "duża"];

/**
 * Macierz PN-N-18002 — [ciężkość][prawdopodobieństwo].
 * @type {Record<string, Record<string, "małe" | "średnie" | "duże">>}
 */
const ORZ_MATRIX = {
  mała: { "mało prawdopodobne": "małe", prawdopodobne: "małe", "wysoce prawdopodobne": "średnie" },
  średnia: { "mało prawdopodobne": "małe", prawdopodobne: "średnie", "wysoce prawdopodobne": "duże" },
  duża: { "mało prawdopodobne": "średnie", prawdopodobne: "duże", "wysoce prawdopodobne": "duże" },
};

/**
 * Poziom ryzyka dla pary prawdopodobieństwo / ciężkość.
 * @param {string} probability
 * @param {string} severity
 */
export function orzRiskLevel(probability, severity) {
  return ORZ_MATRIX[severity]?.[probability] || null;
}

/**
 * Dopuszczalność ryzyka — duże ryzyko jest niedopuszczalne, praca nie może być prowadzona
 * do czasu jego obniżenia.
 * @param {string} level
 */
export function orzRiskAcceptable(level) {
  return level === "małe" || level === "średnie";
}

/** Zalecane działanie dla poziomu ryzyka (PN-N-18002). */
export function orzRiskAction(level) {
  if (level === "duże") return "Niedopuszczalne — praca nie może być rozpoczęta ani kontynuowana do czasu obniżenia ryzyka";
  if (level === "średnie") return "Dopuszczalne — zaleca się zaplanowanie działań obniżających ryzyko";
  if (level === "małe") return "Dopuszczalne — konieczne utrzymanie istniejących środków ochrony";
  return "Brak oceny";
}

const BADANIA = "Badania profilaktyczne — orzeczenie lekarskie o braku przeciwwskazań";
const BADANIA_WYS = "Badania profilaktyczne z orzeczeniem o zdolności do pracy na wysokości powyżej 3 m";
const SZKOLENIE_WSTEPNE = "Szkolenie wstępne BHP: instruktaż ogólny i stanowiskowy";
const SZKOLENIE_OKRESOWE = "Szkolenie okresowe BHP dla stanowisk robotniczych (co 3 lata)";
const SZKOLENIE_OKRESOWE_KIER = "Szkolenie okresowe BHP dla kierowników (co 5 lat)";
const PIERWSZA_POMOC = "Przeszkolenie z udzielania pierwszej pomocy";

const PPE_BUDOWA = [
  "Hełm ochronny z paskiem podbródkowym",
  "Odzież ostrzegawcza",
  "Obuwie ochronne z podnoskiem",
  "Rękawice ochronne",
  "Okulary ochronne",
];

/**
 * @typedef {{
 *   czynnik: string,
 *   zrodlo: string,
 *   skutki: string,
 *   prawdopodobienstwo: string,
 *   ciezkosc: string,
 *   srodki: string[],
 * }} OrzHazard
 */

/**
 * @typedef {{
 *   key: string,
 *   stanowisko: string,
 *   branza: string,
 *   opis: string,
 *   badania: string[],
 *   szkolenia: string[],
 *   uprawnienia: string[],
 *   soi: string[],
 *   zagrozenia: OrzHazard[],
 * }} OrzCard
 */

/** @type {OrzCard[]} */
export const PL_ORZ_CARDS = [
  {
    key: "robotnik_budowlany",
    stanowisko: "Robotnik budowlany",
    branza: "Budownictwo",
    opis: "Prace ogólnobudowlane na placu budowy: transport ręczny, prace pomocnicze przy maszynach, porządkowanie stanowisk, prace na poziomie terenu i na rusztowaniu.",
    badania: [BADANIA, BADANIA_WYS],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE],
    uprawnienia: [],
    soi: PPE_BUDOWA,
    zagrozenia: [
      {
        czynnik: "Upadek z wysokości",
        zrodlo: "Praca na rusztowaniu, przy krawędziach stropu i otworach technologicznych",
        skutki: "Złamania, urazy wielonarządowe, śmierć",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Balustrady i zakrycie otworów jako ochrona zbiorowa",
          "Szelki z lonżą tam, gdzie ochrona zbiorowa jest niemożliwa",
          "Rusztowanie użytkowane wyłącznie po odbiorze i z tabliczką",
          "Aktualne orzeczenie o zdolności do pracy na wysokości",
        ],
      },
      {
        czynnik: "Upadek przedmiotu z wysokości",
        zrodlo: "Materiały i narzędzia na rusztowaniu i stropach powyżej stanowiska",
        skutki: "Uraz głowy, złamania, stłuczenia",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: [
          "Wygrodzenie strefy niebezpiecznej i daszki ochronne nad przejściami",
          "Bortnice na pomostach, zabezpieczenie narzędzi linkami",
          "Hełm ochronny z zapiętym paskiem podbródkowym",
        ],
      },
      {
        czynnik: "Potrącenie przez maszyny i pojazdy",
        zrodlo: "Ruch maszyn budowlanych i pojazdów dostawczych po placu budowy",
        skutki: "Ciężkie obrażenia ciała, śmierć",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Rozdzielenie ruchu pieszego i kołowego, wyznaczone ciągi komunikacyjne",
          "Odzież ostrzegawcza, kontakt wzrokowy z operatorem",
          "Zakaz przebywania w strefie pracy maszyny",
        ],
      },
      {
        czynnik: "Obciążenie układu mięśniowo-szkieletowego",
        zrodlo: "Ręczne przenoszenie materiałów, wymuszona pozycja ciała",
        skutki: "Przeciążenie kręgosłupa, dolegliwości przewlekłe",
        prawdopodobienstwo: "wysoce prawdopodobne",
        ciezkosc: "mała",
        srodki: [
          "Przestrzeganie dopuszczalnych mas i przenoszenie zespołowe",
          "Sprzęt pomocniczy: wózki, uchwyty, podnośniki",
          "Instruktaż techniki podnoszenia i przerwy w pracy",
        ],
      },
      {
        czynnik: "Pył zawierający krzemionkę",
        zrodlo: "Cięcie i szlifowanie betonu, cegły i kamienia",
        skutki: "Pylica, przewlekłe choroby układu oddechowego",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Cięcie na mokro lub z odciągiem miejscowym",
          "Półmaska FFP3 z dopasowaniem twarzowym",
          "Pomiary NDS i rejestr narażenia",
        ],
      },
      {
        czynnik: "Hałas",
        zrodlo: "Praca maszyn budowlanych i narzędzi udarowych",
        skutki: "Trwały ubytek słuchu",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Ochronniki słuchu w strefach oznakowanych", "Pomiary hałasu", "Rotacja pracowników"],
      },
    ],
  },
  {
    key: "operator_maszyn_budowlanych",
    stanowisko: "Operator maszyn budowlanych",
    branza: "Budownictwo",
    opis: "Obsługa koparki, koparko-ładowarki, ładowarki lub walca na terenie budowy; przejazdy między stanowiskami, roboty ziemne, załadunek urobku.",
    badania: [BADANIA, "Badania psychotechniczne, jeżeli wymagane dla obsługiwanej maszyny"],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE],
    uprawnienia: ["Uprawnienia operatora maszyn budowlanych — książka operatora, właściwa klasa"],
    soi: [...PPE_BUDOWA, "Ochronniki słuchu"],
    zagrozenia: [
      {
        czynnik: "Wywrócenie lub stoczenie maszyny",
        zrodlo: "Praca na skarpie, przy krawędzi wykopu, na nienośnym podłożu",
        skutki: "Przygniecenie operatora, ciężkie obrażenia, śmierć",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Zachowanie odległości bezpiecznej od krawędzi wykopu",
          "Ocena nośności podłoża przed ustawieniem maszyny",
          "Sprawna konstrukcja ochronna kabiny i zapięte pasy",
        ],
      },
      {
        czynnik: "Potrącenie osoby przez maszynę",
        zrodlo: "Martwe pola widoczności, praca pieszych w strefie maszyny",
        skutki: "Ciężkie obrażenia ciała, śmierć",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Wyznaczenie i wygrodzenie strefy niebezpiecznej maszyny",
          "Sygnalista przy ograniczonej widoczności i przy cofaniu",
          "Sprawna sygnalizacja dźwiękowa cofania i lusterka",
        ],
      },
      {
        czynnik: "Porażenie prądem od linii napowietrznej",
        zrodlo: "Zbliżenie wysięgnika do linii energetycznej",
        skutki: "Porażenie, poparzenie, śmierć",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Ustalenie strefy niebezpiecznej z zarządcą sieci i jej oznakowanie",
          "Ograniczniki wysięgu, bramki ograniczające wysokość",
          "Sygnalista obserwujący zbliżenie do linii",
        ],
      },
      {
        czynnik: "Drgania ogólne",
        zrodlo: "Praca w kabinie maszyny przez całą zmianę",
        skutki: "Dolegliwości kręgosłupa, zespół wibracyjny",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Fotel amortyzowany i prawidłowo ustawiony", "Pomiary drgań i limity ekspozycji", "Przerwy w pracy"],
      },
      {
        czynnik: "Upadek przy wsiadaniu i wysiadaniu",
        zrodlo: "Śliskie stopnie i uchwyty, wyskakiwanie z kabiny",
        skutki: "Skręcenia, złamania",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "mała",
        srodki: ["Zasada trzech punktów podparcia", "Utrzymanie stopni i uchwytów w czystości", "Obuwie o podeszwie antypoślizgowej"],
      },
    ],
  },
  {
    key: "monter_rusztowan",
    stanowisko: "Monter rusztowań",
    branza: "Budownictwo",
    opis: "Montaż, przebudowa i demontaż rusztowań ramowych i modułowych, transport elementów, kotwienie i przekazanie rusztowania do odbioru.",
    badania: [BADANIA, BADANIA_WYS],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE],
    uprawnienia: ["Uprawnienia do montażu i demontażu rusztowań"],
    soi: [...PPE_BUDOWA, "Szelki bezpieczeństwa z lonżą i amortyzatorem"],
    zagrozenia: [
      {
        czynnik: "Upadek z wysokości podczas montażu",
        zrodlo: "Praca na niezabezpieczonym poziomie montażowym",
        skutki: "Urazy wielonarządowe, śmierć",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Asekuracja szelkami do konstrukcji przez cały czas montażu",
          "Montaż zgodnie z instrukcją producenta lub projektem",
          "Zakaz montażu przy wietrze powyżej 10 m/s i przy oblodzeniu",
        ],
      },
      {
        czynnik: "Zawalenie konstrukcji rusztowania",
        zrodlo: "Brak kotwień, nienośne podłoże, przeciążenie",
        skutki: "Upadek z wysokości, przygniecenie, śmierć",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Kotwienie i stężenia zgodne z dokumentacją, kontrolowane na bieżąco",
          "Podstawki i podkłady na nośnym, wypoziomowanym podłożu",
          "Odbiór protokolarny przed dopuszczeniem do użytkowania",
        ],
      },
      {
        czynnik: "Upadek elementu rusztowania",
        zrodlo: "Podawanie elementów między poziomami",
        skutki: "Uraz głowy, złamania",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Wygrodzenie strefy pod montażem", "Podawanie elementów z ręki do ręki lub wciągarką", "Zakaz zrzucania elementów"],
      },
      {
        czynnik: "Obciążenie układu mięśniowo-szkieletowego",
        zrodlo: "Ręczne przenoszenie ram, podestów i stężeń",
        skutki: "Przeciążenia, urazy kręgosłupa",
        prawdopodobienstwo: "wysoce prawdopodobne",
        ciezkosc: "mała",
        srodki: ["Przenoszenie zespołowe cięższych elementów", "Wciągarka do transportu pionowego", "Przerwy i rotacja zadań"],
      },
    ],
  },
  {
    key: "elektryk_budowlany",
    stanowisko: "Elektryk / elektromonter",
    branza: "Budownictwo",
    opis: "Montaż i eksploatacja instalacji elektrycznych, zasilanie placu budowy, rozdzielnice, pomiary i wyłączenia.",
    badania: [BADANIA, BADANIA_WYS],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE, PIERWSZA_POMOC],
    uprawnienia: ["Świadectwo kwalifikacyjne SEP grupy G1 — eksploatacja (E), dozór (D) dla nadzoru"],
    soi: ["Hełm ochronny", "Rękawice dielektryczne", "Osłona twarzy", "Obuwie elektroizolacyjne", "Odzież trudnopalna"],
    zagrozenia: [
      {
        czynnik: "Porażenie prądem elektrycznym",
        zrodlo: "Praca przy instalacji pod napięciem, uszkodzony osprzęt, wilgoć",
        skutki: "Porażenie, zatrzymanie krążenia, śmierć",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Wyłączenie, zabezpieczenie przed załączeniem (LOTO) i sprawdzenie braku napięcia",
          "Praca wyłącznie przez osoby z ważnym świadectwem kwalifikacyjnym",
          "Narzędzia izolowane i przyrządy pomiarowe z aktualnym sprawdzeniem",
        ],
      },
      {
        czynnik: "Łuk elektryczny",
        zrodlo: "Zwarcie w rozdzielnicy podczas prac",
        skutki: "Poparzenia, uraz oczu",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Odzież trudnopalna i osłona twarzy", "Praca przy wyłączonym zasilaniu", "Asekuracja drugiej osoby"],
      },
      {
        czynnik: "Upadek z wysokości",
        zrodlo: "Prace przy oprawach i trasach kablowych z drabiny lub podestu",
        skutki: "Złamania, urazy głowy",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Podest zamiast drabiny przy pracach dłuższych", "Stabilne ustawienie i zabezpieczenie drabiny", "Orzeczenie o pracy na wysokości"],
      },
      {
        czynnik: "Pożar instalacji",
        zrodlo: "Przeciążenie obwodów, uszkodzone przedłużacze",
        skutki: "Poparzenia, zadymienie, straty materialne",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Pomiary ochronne instalacji placu budowy", "Wyłączniki różnicowoprądowe", "Codzienne oględziny przewodów"],
      },
    ],
  },
  {
    key: "cieslazbrojarz",
    stanowisko: "Cieśla szalunkowy / zbrojarz",
    branza: "Budownictwo",
    opis: "Przygotowanie i montaż deskowań, cięcie i gięcie prętów, montaż zbrojenia, rozdeskowanie elementów.",
    badania: [BADANIA, BADANIA_WYS],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE],
    uprawnienia: [],
    soi: [...PPE_BUDOWA, "Rękawice antyprzecięciowe", "Ochronniki słuchu"],
    zagrozenia: [
      {
        czynnik: "Nadzianie się na pręty zbrojeniowe",
        zrodlo: "Wystające pręty przy upadku lub potknięciu",
        skutki: "Rany kłute, urazy penetrujące",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Kapturki ochronne na wystających prętach", "Pomosty robocze zamiast chodzenia po zbrojeniu", "Uprzątnięte drogi komunikacyjne"],
      },
      {
        czynnik: "Skaleczenia i urazy dłoni",
        zrodlo: "Cięcie prętów, gwoździowanie, obsługa pilarki",
        skutki: "Rany cięte, amputacje palców",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Osłony narzędzi w komplecie", "Rękawice antyprzecięciowe", "Instruktaż stanowiskowy dla każdego narzędzia"],
      },
      {
        czynnik: "Upadek z wysokości",
        zrodlo: "Montaż deskowań i zbrojenia stropów oraz ścian",
        skutki: "Złamania, urazy wielonarządowe",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Pomosty i balustrady przy pracy powyżej 1 m", "Zakrycie otworów w stropach", "Szelki tam, gdzie brak ochrony zbiorowej"],
      },
      {
        czynnik: "Zawalenie deskowania",
        zrodlo: "Brak stężeń, przeciążenie mieszanką betonową",
        skutki: "Przygniecenie, urazy wielonarządowe",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Projekt deskowania i stężeń zatwierdzony przez osobę uprawnioną", "Kontrola deskowania przed betonowaniem", "Rozdeskowanie po potwierdzeniu wytrzymałości"],
      },
      {
        czynnik: "Hałas i drgania miejscowe",
        zrodlo: "Pilarki, wiertarki udarowe, wibratory",
        skutki: "Ubytek słuchu, zespół wibracyjny",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Ochronniki słuchu", "Rękawice antywibracyjne i limity czasu pracy", "Pomiary czynników szkodliwych"],
      },
    ],
  },
  {
    key: "kierowca_hds",
    stanowisko: "Kierowca / operator HDS",
    branza: "Transport",
    opis: "Transport materiałów na budowę, rozładunek żurawiem HDS, zabezpieczenie ładunku, praca w pasie drogowym.",
    badania: [BADANIA, "Badania psychologiczne dla kierowców zawodowych"],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE],
    uprawnienia: ["Prawo jazdy właściwej kategorii", "Uprawnienia UDT na żurawie przenośne (HDS)"],
    soi: [...PPE_BUDOWA, "Odzież ostrzegawcza klasy 3"],
    zagrozenia: [
      {
        czynnik: "Upadek ładunku",
        zrodlo: "Nieprawidłowe zawiesie, przeciążenie żurawia",
        skutki: "Przygniecenie, ciężkie obrażenia, śmierć",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Zawiesia z aktualnym przeglądem, dobrane do masy i kąta rozwarcia",
          "Zakaz przenoszenia ładunku nad ludźmi, wygrodzenie strefy",
          "Ważna decyzja UDT i uprawnienia operatora",
        ],
      },
      {
        czynnik: "Wywrócenie pojazdu z HDS",
        zrodlo: "Niewysunięte podpory, nienośne podłoże",
        skutki: "Przygniecenie, ciężkie obrażenia",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Podpory wysunięte i podparte na płytach", "Ocena nośności podłoża przed rozpoczęciem", "Praca w granicach wykresu udźwigu"],
      },
      {
        czynnik: "Potrącenie w pasie drogowym",
        zrodlo: "Rozładunek przy czynnym ruchu drogowym",
        skutki: "Ciężkie obrażenia, śmierć",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Oznakowanie i wygrodzenie miejsca rozładunku", "Odzież ostrzegawcza klasy 3", "Osoba kierująca ruchem pojazdów"],
      },
      {
        czynnik: "Wymuszona pozycja i zmęczenie",
        zrodlo: "Długotrwałe prowadzenie pojazdu",
        skutki: "Dolegliwości kręgosłupa, spadek koncentracji",
        prawdopodobienstwo: "wysoce prawdopodobne",
        ciezkosc: "mała",
        srodki: ["Przestrzeganie czasu pracy kierowcy i przerw", "Prawidłowe ustawienie fotela", "Planowanie tras z zapasem czasu"],
      },
    ],
  },
  {
    key: "spawacz",
    stanowisko: "Spawacz",
    branza: "Budownictwo",
    opis: "Spawanie i cięcie termiczne konstrukcji stalowych i instalacji, prace niebezpieczne pożarowo na budowie.",
    badania: [BADANIA, "Badania okulistyczne zgodnie ze skierowaniem"],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE, "Szkolenie z zakresu prac niebezpiecznych pożarowo"],
    uprawnienia: ["Uprawnienia spawalnicze dla stosowanej metody"],
    soi: ["Przyłbica spawalnicza", "Odzież trudnopalna", "Rękawice spawalnicze", "Obuwie ochronne", "Półmaska z pochłaniaczem dymów"],
    zagrozenia: [
      {
        czynnik: "Pożar i wybuch",
        zrodlo: "Iskry i gorące odpryski w pobliżu materiałów palnych",
        skutki: "Poparzenia, zadymienie, straty materialne",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: [
          "Pisemne zezwolenie na prace niebezpieczne pożarowo",
          "Usunięcie materiałów palnych w promieniu 10 m i zabezpieczenie otworów",
          "Sprzęt gaśniczy i osoba zabezpieczająca; kontrola po 1 h i po 8 h",
        ],
      },
      {
        czynnik: "Promieniowanie łuku spawalniczego",
        zrodlo: "Łuk elektryczny podczas spawania",
        skutki: "Zapalenie spojówek, oparzenia skóry",
        prawdopodobienstwo: "wysoce prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Przyłbica z odpowiednim stopniem zaciemnienia", "Parawany spawalnicze osłaniające otoczenie", "Odzież zakrywająca skórę"],
      },
      {
        czynnik: "Dymy i gazy spawalnicze",
        zrodlo: "Spawanie stali i metali powlekanych",
        skutki: "Podrażnienie dróg oddechowych, gorączka metaliczna",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Odciąg miejscowy lub wentylacja stanowiska", "Półmaska z pochłaniaczem dymów spawalniczych", "Pomiary NDS na stanowisku"],
      },
      {
        czynnik: "Porażenie prądem",
        zrodlo: "Uszkodzone przewody spawalnicze, praca w wilgoci",
        skutki: "Porażenie, poparzenia",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Codzienne oględziny przewodów i uchwytów", "Zasilanie przez wyłącznik różnicowoprądowy", "Sucha i izolująca podłoga stanowiska"],
      },
    ],
  },
  {
    key: "magazynier",
    stanowisko: "Magazynier",
    branza: "Magazyn",
    opis: "Przyjęcie i wydanie materiałów, kompletacja, obsługa wózka jezdniowego, składowanie na regałach.",
    badania: [BADANIA],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE],
    uprawnienia: ["Uprawnienia UDT na wózki jezdniowe podnośnikowe, jeżeli obsługuje wózek"],
    soi: ["Obuwie ochronne z podnoskiem", "Rękawice ochronne", "Odzież ostrzegawcza", "Hełm ochronny w strefie składowania"],
    zagrozenia: [
      {
        czynnik: "Potrącenie przez wózek jezdniowy",
        zrodlo: "Ruch wózków w ciągach komunikacyjnych magazynu",
        skutki: "Złamania, ciężkie obrażenia",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Rozdzielenie ruchu pieszego i wózków", "Ograniczenie prędkości i lustra na skrzyżowaniach", "Odzież ostrzegawcza"],
      },
      {
        czynnik: "Upadek ładunku z regału",
        zrodlo: "Przeciążenie regału, uszkodzone elementy konstrukcji",
        skutki: "Przygniecenie, urazy głowy",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Tabliczki z dopuszczalnym obciążeniem regałów", "Okresowe przeglądy regałów i zgłaszanie uszkodzeń", "Prawidłowe układanie palet"],
      },
      {
        czynnik: "Obciążenie układu mięśniowo-szkieletowego",
        zrodlo: "Ręczna kompletacja i przenoszenie towaru",
        skutki: "Przeciążenia kręgosłupa i stawów",
        prawdopodobienstwo: "wysoce prawdopodobne",
        ciezkosc: "mała",
        srodki: ["Sprzęt pomocniczy do transportu", "Dopuszczalne masy i przenoszenie zespołowe", "Organizacja stanowiska bez sięgania nad głowę"],
      },
      {
        czynnik: "Poślizgnięcie i potknięcie",
        zrodlo: "Zanieczyszczone podłoże, folia i taśmy opakowaniowe",
        skutki: "Skręcenia, złamania",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "mała",
        srodki: ["Bieżące sprzątanie i usuwanie opakowań", "Obuwie o podeszwie antypoślizgowej", "Oznakowanie mokrych powierzchni"],
      },
    ],
  },
  {
    key: "kierownik_budowy",
    stanowisko: "Kierownik budowy / majster",
    branza: "Budownictwo",
    opis: "Organizacja i nadzór nad robotami, koordynacja podwykonawców, prowadzenie dokumentacji budowy, kontrola stanowisk pracy.",
    badania: [BADANIA],
    szkolenia: [SZKOLENIE_WSTEPNE, SZKOLENIE_OKRESOWE_KIER, PIERWSZA_POMOC],
    uprawnienia: ["Uprawnienia budowlane do kierowania robotami w odpowiedniej specjalności"],
    soi: PPE_BUDOWA,
    zagrozenia: [
      {
        czynnik: "Zagrożenia placu budowy podczas kontroli stanowisk",
        zrodlo: "Poruszanie się po terenie budowy, wykopy, rusztowania, ruch maszyn",
        skutki: "Upadki, potrącenia, urazy",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Poruszanie się wyznaczonymi ciągami komunikacyjnymi", "Pełne ŚOI podczas każdego wejścia na teren", "Znajomość aktualnych stref niebezpiecznych"],
      },
      {
        czynnik: "Obciążenie psychiczne i stres",
        zrodlo: "Odpowiedzialność za bezpieczeństwo, presja terminów, sytuacje awaryjne",
        skutki: "Przemęczenie, obniżona koncentracja, skutki zdrowotne",
        prawdopodobienstwo: "wysoce prawdopodobne",
        ciezkosc: "mała",
        srodki: ["Realne planowanie i podział zadań", "Jasny podział odpowiedzialności i zastępstwa", "Przerwy i przestrzeganie czasu pracy"],
      },
      {
        czynnik: "Wypadek komunikacyjny",
        zrodlo: "Dojazdy między budowami samochodem służbowym",
        skutki: "Urazy wielonarządowe",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "duża",
        srodki: ["Planowanie tras z zapasem czasu", "Zakaz obsługi telefonu w trakcie jazdy", "Sprawny technicznie pojazd"],
      },
      {
        czynnik: "Praca przy monitorze ekranowym",
        zrodlo: "Prowadzenie dokumentacji budowy i korespondencji",
        skutki: "Zmęczenie wzroku, dolegliwości kręgosłupa",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "mała",
        srodki: ["Ergonomiczne stanowisko w biurze budowy", "Przerwy 5 minut po każdej godzinie pracy przy monitorze", "Okulary korygujące, jeżeli zalecone przez lekarza"],
      },
    ],
  },
  {
    key: "pracownik_biurowy",
    stanowisko: "Pracownik biurowy",
    branza: "Administracja",
    opis: "Praca administracyjno-biurowa przy monitorze ekranowym w biurze lub biurze budowy.",
    badania: [BADANIA],
    szkolenia: [SZKOLENIE_WSTEPNE, "Szkolenie okresowe BHP dla stanowisk administracyjno-biurowych (co 6 lat)"],
    uprawnienia: [],
    soi: [],
    zagrozenia: [
      {
        czynnik: "Praca przy monitorze ekranowym",
        zrodlo: "Wielogodzinna praca przy komputerze",
        skutki: "Zmęczenie wzroku, bóle kręgosłupa szyjnego, nadgarstka",
        prawdopodobienstwo: "wysoce prawdopodobne",
        ciezkosc: "mała",
        srodki: [
          "Ergonomiczne stanowisko: krzesło regulowane, monitor na wysokości oczu",
          "Przerwa 5 minut po każdej godzinie pracy przy monitorze",
          "Refundacja okularów korygujących, jeżeli zalecone przez lekarza",
        ],
      },
      {
        czynnik: "Porażenie prądem",
        zrodlo: "Uszkodzony sprzęt biurowy i przedłużacze",
        skutki: "Porażenie, poparzenia",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Oględziny sprzętu przed użyciem", "Naprawy wyłącznie przez osoby uprawnione", "Zakaz przeciążania listew zasilających"],
      },
      {
        czynnik: "Poślizgnięcie, potknięcie, upadek",
        zrodlo: "Przewody na podłodze, mokre powierzchnie, schody",
        skutki: "Stłuczenia, skręcenia, złamania",
        prawdopodobienstwo: "prawdopodobne",
        ciezkosc: "mała",
        srodki: ["Prowadzenie przewodów w korytkach", "Oznakowanie mokrych powierzchni", "Utrzymanie porządku na ciągach komunikacyjnych"],
      },
      {
        czynnik: "Pożar w pomieszczeniu biurowym",
        zrodlo: "Instalacja elektryczna, urządzenia grzewcze",
        skutki: "Poparzenia, zadymienie",
        prawdopodobienstwo: "mało prawdopodobne",
        ciezkosc: "średnia",
        srodki: ["Instrukcja bezpieczeństwa pożarowego i oznakowane drogi ewakuacyjne", "Sprawne gaśnice i próbne ewakuacje", "Zakaz stosowania nieatestowanych grzejników"],
      },
    ],
  },
];

const BY_KEY = Object.fromEntries(PL_ORZ_CARDS.map((c) => [c.key, c]));

/** @param {string} key */
export function findOrzCard(key) {
  return BY_KEY[String(key || "")] || null;
}

/** Branże obecne w bibliotece — do podziału na liście wyboru. */
export function listOrzBranze() {
  return [...new Set(PL_ORZ_CARDS.map((c) => c.branza))];
}

/**
 * Karta z policzonym poziomem ryzyka dla każdego zagrożenia i podsumowaniem.
 * @param {OrzCard} card
 */
export function assessOrzCard(card) {
  const zagrozenia = (card?.zagrozenia || []).map((z) => {
    const poziom = orzRiskLevel(z.prawdopodobienstwo, z.ciezkosc);
    return { ...z, poziom, dopuszczalne: orzRiskAcceptable(poziom), dzialanie: orzRiskAction(poziom) };
  });
  const najwyzszy = zagrozenia.some((z) => z.poziom === "duże")
    ? "duże"
    : zagrozenia.some((z) => z.poziom === "średnie")
      ? "średnie"
      : zagrozenia.length
        ? "małe"
        : null;
  return {
    ...card,
    zagrozenia,
    najwyzszePoziomRyzyka: najwyzszy,
    dopuszczalne: najwyzszy ? orzRiskAcceptable(najwyzszy) : true,
  };
}

/** Treść oświadczenia o zapoznaniu się z oceną ryzyka zawodowego. */
export function orzAcknowledgementText(stanowisko, dataOceny = "") {
  const data = dataOceny ? ` z dnia ${dataOceny}` : "";
  return [
    `Oświadczam, że zapoznałem(-am) się z oceną ryzyka zawodowego${data} na stanowisku: ${stanowisko}.`,
    "Zostałem(-am) poinformowany(-a) o zagrożeniach występujących na stanowisku pracy, o skutkach ich wystąpienia oraz o środkach profilaktycznych ograniczających ryzyko zawodowe.",
    "Zobowiązuję się do przestrzegania zasad i przepisów BHP oraz stosowania przydzielonych środków ochrony indywidualnej.",
  ];
}

export default PL_ORZ_CARDS;
