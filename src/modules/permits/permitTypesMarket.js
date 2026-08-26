import { PERMIT_TYPES } from "./permitTypes";
import { anhangIIItemsForPermit } from "../../config/deAnhangII";

/** Partial overrides for Australian WHS-aligned PTW checklists. */
export const AU_PERMIT_TYPE_OVERRIDES = {
  electrical: {
    checklist: [
      "Isolation point identified and confirmed",
      "Isolation carried out by authorised person",
      "Lock-out/tag-out device applied and padlock secured",
      "Warning notice posted at isolation point",
      "Voltage indicator tested on known live source",
      "System proved dead with approved voltage tester (AS/NZS 3012)",
      "Tester re-proved on known live source after proving dead",
      "All connected equipment confirmed de-energised",
      "Permit held by the person performing the work",
    ],
  },
  work_at_height: {
    checklist: [
      "Access equipment inspected and signed off before use",
      "Scaffold: handover / inspection tag reviewed and current",
      "EWP/MEWP: daily pre-use check; operator holds relevant EWPA or HRWL ticket",
      "Edge protection confirmed in place at all open edges",
      "Harness and lanyard inspected; attached to rated anchor point",
      "Exclusion zone established below work area",
      "Weather conditions assessed — not commenced in high winds or wet/icy conditions",
      "Rescue plan in place for EWP/rope access operations",
      "Overhead hazards (power lines, structures) identified and communicated",
    ],
  },
  confined_space: {
    checklist: [
      "Confined space risk assessment reviewed and current",
      "Atmospheric test completed: O₂ (19.5–23.5%), toxic gases within limits, LEL (<5% before entry)",
      "Continuous monitoring in use during occupation",
      "Mechanical ventilation provided and confirmed operational",
      "Stand-by person briefed and in position outside space",
      "Rescue equipment (tripod, winch, harness) rigged and ready",
      "Emergency rescue plan confirmed with stand-by person",
      "All energy sources isolated (LOTO) before entry",
      "Communication system tested between entrant and stand-by",
      "Maximum occupancy and time in space agreed",
    ],
  },
  excavation: {
    description: "Any excavation or ground disturbance — utility strike prevention (Dial Before You Dig)",
    checklist: [
      "Dial Before You Dig (DBYD) enquiry completed and plans on site",
      "Utility locators (EM + GPR) survey completed where required",
      "Survey results marked on ground before breaking (potholing if needed)",
      "Hand dig zone around marked services confirmed",
      "Excavation supervisor nominated and briefed",
      "Shoring / benching confirmed if depth exceeds safe angle (typically 1.5m+)",
      "Safe means of access and egress provided",
      "Spoil stored minimum 1m from excavation edge",
      "Barriers and covers in place over open excavation",
      "Adjacent structures assessed for undermining risk",
      "Emergency contact 000 and utility strike contacts briefed",
    ],
    extraFields: [
      { key: "catScanBy", label: "Utility locate carried out by", type: "text" },
      { key: "knownServices", label: "Known services in area", type: "text" },
      { key: "excavationDepth", label: "Maximum excavation depth (m)", type: "number" },
      { key: "dbydRef", label: "DBYD enquiry reference", type: "text" },
      { key: "surveyDrawingRef", label: "Utility survey / drawing reference", type: "text" },
      { key: "utilityStrikeContacts", label: "Utility strike emergency contacts", type: "text" },
    ],
  },
  lifting: {
    description: "Crane lifts, EWP lifts, rigging — WHS plant and lifting operations",
    checklist: [
      "Lift plan prepared by competent person",
      "Lifting plant within current inspection / registration requirements",
      "Dogman/rigger competent for the lift",
      "Rigging plan reviewed — correct sling type, rating and angle",
      "Load weight confirmed — does not exceed SWL of any component",
      "Exclusion zone established below and around lift",
      "Banksman / dogger in position with agreed signal system",
      "Ground conditions checked — stable, level, adequate bearing capacity",
      "Overhead hazards (power lines, structures) confirmed clear",
      "Weather / wind speed assessed and within limits",
    ],
  },
  ground_disturbance: {
    checklist: [
      "Ground investigation report reviewed — soil type, contamination, voids",
      "Dial Before You Dig (DBYD) enquiry completed",
      "Utility locators survey completed and marked",
      "Archaeological or heritage assessment completed where required",
      "Ground disturbance method approved by competent person",
      "Vibration monitoring on adjacent structures where required",
      "Pre-work condition survey of adjacent structures photographed",
      "Groundwater monitoring in place if dewatering required",
      "Environmental controls for waterways / sensitive areas confirmed",
    ],
  },
};

/**
 * @param {Record<string, import("./permitTypes").PermitTypeDef>} base
 * @param {Record<string, Partial<import("./permitTypes").PermitTypeDef>>} overrides
 */
export function mergePermitMarketOverrides(base, overrides) {
  const out = { ...base };
  for (const [key, patch] of Object.entries(overrides)) {
    if (!out[key]) continue;
    out[key] = {
      ...out[key],
      ...patch,
      extraFields: patch.extraFields ?? out[key].extraFields,
      checklist: patch.checklist ?? out[key].checklist,
    };
  }
  return out;
}

const PL_PERMIT_TYPE_OVERRIDES = {
  hot_work: {
    label: "Zezwolenie na prace niebezpieczne pożarowo",
    description: "Spawanie, szlifowanie, cięcie, lutowanie — prace z otwartym ogniem lub iskrzeniem",
    checklist: [
      "Strefa oczyszczona z materiałów palnych w promieniu 10 m",
      "2 × gaśnica 6 kg (ABC) i koc gaśniczy na stanowisku",
      "Sprzęt do prac gorących sprawny — przegląd potwierdzony",
      "Czujki i instalacja SSP wyłączone w strefie za zgodą osoby odpowiedzialnej",
      "Tryskacze i głowice zabezpieczone, jeśli występują",
      "Wyznaczona i przeszkolona osoba do zabezpieczenia (asekuracja pożarowa)",
      "Kanały, kratki, otwory i przepusty zabezpieczone przed przedostaniem iskier",
      "Uprawnienia spawalnicze wykonawcy sprawdzone",
      "Czas obowiązywania zezwolenia ustalony — maksymalnie 8 godzin",
      "Kontrola strefy po zakończeniu prac — po 1 h i ponownie po 8 h",
    ],
  },
  cold_work: {
    label: "Zezwolenie na prace zimne",
    description: "Prace utrzymaniowe bez źródeł ognia — wymagane odłączenie zasilania i LOTO",
    checklist: [
      "Zidentyfikowane wszystkie źródła energii (elektryczna, pneumatyczna, hydrauliczna, grawitacja, ciśnienie)",
      "LOTO założone na wszystkich punktach odłączenia",
      "Instalacja rozprężona — potwierdzony brak ciśnienia",
      "Energia zakumulowana (sprężyny, przeciwwagi) bezpiecznie rozładowana",
      "Kłódki pod wyłączną kontrolą wystawiającego zezwolenie",
      "Próba rozruchu wykonana — potwierdzony brak ruchu urządzenia",
      "Urządzenia sąsiadujące odłączone lub potwierdzone jako niezależne",
      "Zabezpieczenie wycieków i odprowadzenia mediów przygotowane",
    ],
  },
  electrical: {
    label: "Zezwolenie na odłączenie i pracę przy instalacji elektrycznej",
    description: "Odłączenie, LOTO i prace przy urządzeniach elektrycznych — wymagane uprawnienia SEP",
    checklist: [
      "Punkt odłączenia zidentyfikowany na schemacie",
      "Odłączenie wykonane przez osobę z ważnym świadectwem kwalifikacyjnym SEP (E)",
      "Kłódka LOTO założona i tablica ostrzegawcza zawieszona",
      "Wskaźnik napięcia sprawdzony na źródle pod napięciem przed pomiarem",
      "Potwierdzony brak napięcia na wszystkich żyłach",
      "Wskaźnik ponownie sprawdzony po pomiarze",
      "Uziemienie robocze założone tam, gdzie wymagane",
      "Polecenie pisemne wystawione, jeśli praca w warunkach szczególnego zagrożenia",
      "Zezwolenie w posiadaniu osoby wykonującej pracę",
    ],
  },
  work_at_height: {
    label: "Zezwolenie na pracę na wysokości",
    description: "Prace powyżej 1 m — rusztowania, podesty, drabiny, dachy i krawędzie",
    checklist: [
      "Aktualne orzeczenie lekarskie o zdolności do pracy na wysokości (powyżej 3 m)",
      "Rusztowanie odebrane protokolarnie — tabliczka z datą odbioru na miejscu",
      "Podesty ruchome i żurawie — ważna decyzja UDT oraz uprawnienia operatora",
      "Balustrady (poręcz 1,1 m, przechwyt, bortnica) na wszystkich krawędziach",
      "Szelki i lonże skontrolowane przed użyciem; punkt kotwiczenia o znanej nośności",
      "Strefa niebezpieczna pod robotami wygrodzona i oznakowana",
      "Warunki atmosferyczne ocenione — brak prac przy wietrze powyżej 10 m/s, oblodzeniu i burzy",
      "Plan ewakuacji z podestu / z zawieszenia w szelkach uzgodniony",
      "Bezpośredni nadzór wyznaczony — praca szczególnie niebezpieczna",
    ],
  },
  confined_space: {
    label: "Zezwolenie na wejście do przestrzeni zamkniętej",
    description: "Studnie, zbiorniki, komory i kanały — pomiar atmosfery, asekuracja i ratownictwo",
    checklist: [
      "Ocena ryzyka dla przestrzeni zamkniętej zaktualizowana",
      "Pomiar atmosfery wykonany: O₂ 19,5–23%, CO poniżej 20 ppm, H₂S poniżej 1 ppm, LEL poniżej 10%",
      "Pomiar ciągły prowadzony przez cały czas przebywania w przestrzeni",
      "Wentylacja mechaniczna uruchomiona i sprawdzona",
      "Asekurujący przeszkolony i obecny na zewnątrz przez cały czas",
      "Sprzęt ratowniczy (trójnóg, wciągarka, szelki) rozstawiony i gotowy",
      "Plan ratunkowy omówiony — bez wchodzenia asekurującego do środka",
      "Wszystkie media odcięte i zabezpieczone (LOTO) przed wejściem",
      "Łączność między wchodzącym a asekurującym sprawdzona",
      "Liczba osób i maksymalny czas przebywania ustalone i zapisane",
    ],
  },
  excavation: {
    label: "Zezwolenie na roboty ziemne / wykop",
    description: "Wykop lub naruszenie gruntu — mapa uzbrojenia terenu i zabezpieczenie ścian",
    checklist: [
      "Mapa uzbrojenia terenu / uzgodnienia z gestorami sieci pozyskane przed rozpoczęciem",
      "Trasowanie i lokalizacja sieci wykonane; wyniki dostępne na budowie",
      "Przekopy kontrolne wykonane ręcznie w strefach niepewnych",
      "Zabezpieczenie ścian wykopu (obudowa, szalunek lub skarpowanie) zgodne z projektem",
      "Zejście do wykopu co najwyżej co 20 m; drabiny wystające 0,75 m ponad krawędź",
      "Odkład urobku co najmniej 0,6 m od krawędzi wykopu",
      "Strefa niebezpieczna wygrodzona i oznakowana; przejścia z balustradami",
      "Bezpieczny dostęp i drogi ewakuacji z wykopu zapewnione",
      "Praca w wykopie powyżej 1,5 m tylko pod bezpośrednim nadzorem",
      "Kontrola wykopu po deszczu, mrozie i przed każdą zmianą",
      "Kierownik budowy / koordynator BHP poinformowany przed rozpoczęciem",
      "Postępowanie przy odkryciu niezinwentaryzowanej sieci omówione z brygadą",
    ],
  },
  lifting: {
    label: "Zezwolenie na prace transportowe i podnoszenie",
    description: "Żurawie, podesty i zawiesia — plan pracy, UDT i wygrodzenie strefy",
    checklist: [
      "Plan pracy żurawia sporządzony przez osobę uprawnioną",
      "Ważna decyzja zezwalająca UDT na eksploatację urządzenia",
      "Operator z ważnymi uprawnieniami UDT na daną kategorię",
      "Zawiesia z aktualnym przeglądem, dobrane do masy i kąta rozwarcia",
      "Masa ładunku potwierdzona — nie przekracza DOR żadnego elementu",
      "Strefa niebezpieczna pod ładunkiem i wokół pracy żurawia wygrodzona",
      "Sygnalista / hakowy z uprawnieniami, ustalony system sygnałów",
      "Podłoże sprawdzone — nośne, wypoziomowane, podpory na płytach",
      "Brak kolizji z linią napowietrzną — zachowana odległość bezpieczna",
      "Warunki wietrzne ocenione i mieszczące się w limicie producenta",
    ],
  },
  line_break: {
    label: "Zezwolenie na rozszczelnienie instalacji",
    description: "Otwarcie rurociągu lub aparatu — media, ciśnienie i zabezpieczenie wycieku",
    checklist: [
      "Instalacja odcięta, rozprężona i potwierdzona na ciśnieniu atmosferycznym",
      "Zawartość zidentyfikowana — karta charakterystyki przeanalizowana",
      "Punkt spustu / odpowietrzenia w pełni otwarty przed rozłączeniem",
      "ŚOI dobrane do medium (odzież kwasoodporna, osłona twarzy) w użyciu",
      "Wanny wychwytowe lub obwałowanie ustawione pod miejscem pracy",
      "Instalacje sąsiadujące odcięte — brak możliwości ponownego zaciśnienia",
      "Wystawiający zezwolenie posiada wszystkie protokoły odcięcia",
      "Pierwsze rozszczelnienie wykonywane powoli, z asekuracją",
      "Sorbenty i oczomyjka / natrysk dostępne w miejscu pracy",
    ],
  },
  roof_access: {
    label: "Zezwolenie na wejście na dach",
    description: "Prace na dachu — pokrycia kruche, świetliki i krawędzie",
    checklist: [
      "Przegląd stanu dachu wykonany przed wejściem",
      "Materiały kruche (świetliki, płyty faliste, eternit) zidentyfikowane i oznakowane",
      "Balustrady lub inne zabezpieczenie krawędzi w miejscu",
      "Trasa dojścia uzgodniona — bez chodzenia po pokryciach kruchych",
      "Pomosty / trapy dostępne do przechodzenia nad pokryciem kruchym",
      "Warunki pogodowe ocenione — brak prac przy oblodzeniu, śniegu i wietrze powyżej 10 m/s",
      "Maksymalna liczba osób na dachu ustalona i przestrzegana",
      "Materiały zabezpieczone przed zsunięciem i zdmuchnięciem",
      "Narzędzia i materiały nie pozostawiane przy krawędzi bez nadzoru",
      "Kontrola dachu po zakończeniu prac przed zamknięciem zezwolenia",
    ],
  },
  night_works: {
    label: "Zezwolenie na prace nocne i poza godzinami",
    description: "Prace w porze nocnej — oświetlenie, łączność i praca jednoosobowa",
    checklist: [
      "Kierownik budowy / przedstawiciel inwestora zaakceptował prace poza godzinami",
      "Kontakt alarmowy do osoby odpowiedzialnej za obiekt potwierdzony",
      "Zasady dozoru i dostępu na teren uzgodnione z ochroną",
      "Ocena ryzyka pracy jednoosobowej wykonana, jeśli dotyczy",
      "Osoba przeszkolona w pierwszej pomocy dostępna na zmianie",
      "Brygada poinstruowana o postępowaniu awaryjnym w porze nocnej",
      "Oświetlenie stanowisk i dróg komunikacyjnych sprawdzone przed startem",
      "Ograniczenia hałasu w porze nocnej ustalone i zakomunikowane",
      "System meldowania wejścia i wyjścia z terenu wdrożony",
    ],
  },
  valve_isolation: {
    label: "Zezwolenie na odcięcie armatury",
    description: "Manipulacje zaworami — skutki przełączeń, potwierdzenie odcięcia",
    checklist: [
      "Schemat technologiczny (P&ID) przeanalizowany — armatura do przestawienia wskazana",
      "Stan instalacji przed i za odcięciem potwierdzony",
      "Skutki przestawienia ocenione (utrata produktu, wzrost ciśnienia, przepływ zwrotny)",
      "Obsługa instalacji poinformowana przed przestawieniem",
      "Położenie zaworu potwierdzone przed i po operacji",
      "Odcięcie potwierdzone brakiem przepływu tam, gdzie to możliwe",
      "Różnica ciśnień na odcięciu oceniona jako bezpieczna",
      "Zaślepka / korek zastosowany tam, gdzie wymagane odcięcie pewne",
      "Operacja odnotowana w dzienniku ruchu / dzienniku budowy",
    ],
  },
  visitor_access: {
    label: "Zezwolenie na wejście gościa / podwykonawcy",
    description: "Wejście osób spoza brygady — instruktaż, ŚOI i opieka na terenie",
    checklist: [
      "Tożsamość gościa potwierdzona i wpis do rejestru wejść",
      "Instruktaż ogólny / szkolenie informacyjne przeprowadzone lub potwierdzone jako aktualne",
      "Wymagane ŚOI przekazane i założone",
      "Osoba towarzysząca wyznaczona na czas pobytu",
      "Strefy zamknięte wskazane — bez wejścia bez opieki",
      "Zasady alarmowania i drogi ewakuacyjne omówione",
      "Dane kontaktowe gościa zapisane",
      "Cel wizyty odnotowany",
      "Wyjście z terenu potwierdzone wpisem",
    ],
  },
  radiography: {
    label: "Zezwolenie na prace radiograficzne",
    description: "Badania izotopowe i RTG — strefa kontrolowana i ochrona radiologiczna",
    checklist: [
      "Inspektor ochrony radiologicznej zatwierdził prace na piśmie",
      "Zezwolenie / zgłoszenie do PAA aktualne dla wykonawcy",
      "Strefa kontrolowana wygrodzona i oznakowana znakami ostrzegawczymi",
      "Wszystkie osoby w pobliżu poinformowane — strefa ma pozostać pusta",
      "Pomiar mocy dawki wykonany; granice strefy potwierdzone",
      "Dawkomierze wydane wszystkim pracownikom kategorii A i B",
      "Pojemnik transportowy źródła sprawdzony — szczelność potwierdzona",
      "Procedura awaryjna omówiona z całą obsługą",
      "Pomiar po ekspozycji wykonany; źródło potwierdzone w pojemniku",
      "Ewidencja dawek uzupełniona po zakończeniu prac",
    ],
  },
  ground_disturbance: {
    label: "Zezwolenie na naruszenie gruntu",
    description: "Naruszenie powierzchni gruntu — uzbrojenie, niewybuchy i zabytki",
    checklist: [
      "Dokumentacja geotechniczna przeanalizowana — grunt, zanieczyszczenia, pustki, obiekty podziemne",
      "Mapa uzbrojenia i uzgodnienia branżowe pozyskane; lokalizacja wykonana lokalizatorem",
      "Zakres i metoda lokalizacji sieci zapisane w zezwoleniu",
      "Nadzór archeologiczny lub konserwatorski uzgodniony tam, gdzie wymagany",
      "Ryzyko niewybuchów ocenione — oczyszczenie saperskie, jeśli wymagane",
      "Metoda robót zaakceptowana przez uprawnionego geotechnika",
      "Monitoring drgań obiektów sąsiednich z ustalonymi progami alarmowymi",
      "Inwentaryzacja stanu obiektów sąsiednich wykonana i udokumentowana zdjęciami",
      "Monitoring wód gruntowych, jeśli prowadzone jest odwodnienie",
      "Ochrona wód — brak robót przy cieku bez uzgodnienia z Wodami Polskimi",
    ],
  },
  line_clearance: {
    label: "Zezwolenie na pracę przy linii produkcyjnej",
    description: "Prace przy otwartej linii — zatrzymanie produkcji i zabezpieczenie produktu",
    checklist: [
      "Zgoda kierownika produkcji — linia zatrzymana i opróżniona",
      "Produkt zabezpieczony — brak otwartego produktu w strefie prac",
      "Przezbrojenie alergenowe wykonane przy przejściu między strefami",
      "Narzędzia i materiały sprawdzone pod kątem ciał obcych (szkło, luźne elementy)",
      "Rejestr szkła i twardego plastiku zaktualizowany o wniesione przedmioty",
      "LOTO założone i zweryfikowane",
      "Procedura bariery higienicznej i zmiany obuwia zachowana",
      "Odprawa przed ponownym uruchomieniem linii zaplanowana",
    ],
  },
  rail_corridor_access: {
    label: "Zezwolenie na wejście w obszar kolejowy",
    description: "Prace w torze i przy torze — zamknięcie toru, autoryzacja i osłona",
    checklist: [
      "Zamknięcie toru lub regulamin tymczasowy prowadzenia ruchu potwierdzony na piśmie",
      "Uzgodnienie z zarządcą infrastruktury i dyżurnym ruchu wykonane",
      "Pracownicy przeszkoleni i dopuszczeni do pracy w obszarze kolejowym; badania aktualne",
      "Kierujący pracami i osoby osłonowe (sygnaliści) wyznaczeni i wyposażeni",
      "Odcięcie sieci trakcyjnej potwierdzone tam, gdzie prace w strefie niebezpiecznej",
      "Droga ewakuacji i miejsce schronienia wskazane przed rozpoczęciem",
      "Materiały i sprzęt składowane poza skrajnią budowli",
      "Odbiór toru i przekazanie do ruchu udokumentowane przed otwarciem",
    ],
  },
  ole_isolation: {
    label: "Zezwolenie na wyłączenie sieci trakcyjnej",
    description: "Wyłączenie i uziemienie sieci trakcyjnej przed pracami w strefie niebezpiecznej",
    checklist: [
      "Polecenie wyłączenia wydane przez dyspozytora zasilania i potwierdzone",
      "Granice wyłączenia i miejsca uziemienia uzgodnione na piśmie",
      "Uziemiacze przenośne założone przez osobę uprawnioną i odnotowane",
      "Brak napięcia potwierdzony na odcinku objętym pracami",
      "Strefa niebezpieczna przy częściach pod napięciem oznakowana i omówiona",
      "Zakaz podnoszenia elementów przewodzących poza granicą wyłączenia",
      "Sąsiednie tory i układ powrotny prądu potwierdzone przez zarządcę",
      "Uziemiacze zdejmowane i wyłączenie zwracane wyłącznie przez wystawiającego",
    ],
  },
  on_track_plant: {
    label: "Zezwolenie na pracę maszyn dwudrogowych (RRV)",
    description: "Maszyny szynowo-drogowe i podbijarki — punkt wjazdu, kierujący i strefa obrotu",
    checklist: [
      "Kierujący maszyną (operator osłony) wyznaczony i poinstruowany",
      "Punkt wjazdu na tor uzgodniony i sprawdzony przed najazdem",
      "Dokumenty maszyny, decyzja UDT i uprawnienia operatora zweryfikowane",
      "Ograniczniki obrotu ustawione względem statusu toru sąsiedniego",
      "Strefa niebezpieczna wokół maszyny utrzymywana — nikt w zasięgu obrotu",
      "Prace dźwigowe objęte planem pracy i nadzorem osoby uprawnionej",
      "Zestaw sorbentowy dostępny w punkcie wjazdu",
      "Zjazd z toru i sprawdzenie terenu odnotowane przed przekazaniem toru",
    ],
  },
  marine_hydrographic: {
    label: "Zezwolenie na pomiary hydrograficzne",
    description: "Pomiary z jednostki pływającej — bezpieczeństwo na wodzie i uzgodnienia",
    checklist: [
      "Ocena ryzyka prac na wodzie i procedura „człowiek za burtą” omówione",
      "Uprawnienia sternika i ubezpieczenie jednostki zweryfikowane",
      "Limity pogodowe, prądu i stanu wody ustalone — kryteria przerwania prac",
      "Kamizelki asekuracyjne obowiązkowe przy wszystkich pracach pokładowych",
      "Zgłoszenie do administracji wodnej / kapitanatu tam, gdzie wymagane",
      "Kontakt alarmowy na brzegu i plan ratunkowy ustalone",
      "Sprzęt pomiarowy zabezpieczony przed wypadnięciem za burtę",
      "Paliwo i chemikalia przechowywane zgodnie z kartami charakterystyki",
    ],
  },
  aerial_survey_coordination: {
    label: "Zezwolenie na loty pomiarowe (BSP)",
    description: "Drony i statki powietrzne — przestrzeń powietrzna, uprawnienia i strefa naziemna",
    checklist: [
      "Plan lotu i ocena ryzyka zatwierdzone przez kierownika prac",
      "Operator wpisany do ewidencji ULC; pilot z kompetencjami A1/A3 lub A2 (albo NSTS)",
      "Zgłoszenie lotu w systemie PansaUTM i zgoda na wlot w strefę wykonane",
      "Właściciel terenu i inwestor poinformowani o przelotach na małej wysokości",
      "Strefa naziemna pod trasą lotu wygrodzona i kontrolowana",
      "Limity pogodowe (wiatr, widzialność, opady) ustalone",
      "Miejsce awaryjnego lądowania wskazane",
      "Kontrola sprzętu po locie i bezpieczne przechowanie akumulatorów",
    ],
  },
  general: {
    label: "Ogólne zezwolenie na pracę",
    description: "Prace nieobjęte odrębnym rodzajem zezwolenia",
    checklist: [
      "Zakres prac jasno określony i przekazany całej brygadzie",
      "Zagrożenia zidentyfikowane, środki ograniczające wdrożone",
      "Wymagane ŚOI wydane i stosowane",
      "Zasady alarmowania i drogi ewakuacyjne omówione",
      "Organizacja pierwszej pomocy potwierdzona",
      "Strefa prac wyznaczona, dostęp kontrolowany",
    ],
  },
};

const DE_PERMIT_TYPE_OVERRIDES = {
  hot_work: {
    label: "Erlaubnisschein Heißarbeiten",
    description:
      "Schweißen, Schleifen, Trennen, Löten — oft Anhang II (Explosion / Gefahrstoffe). Freigabe vor Start, Brandwache.",
  },
  cold_work: {
    label: "Erlaubnisschein Kaltarbeiten",
    description: "Instandhaltung ohne Heißarbeiten, mit Energiefreischaltung und LOTO",
  },
  line_break: { label: "Erlaubnisschein Leitungsöffnung" },
  roof_access: {
    label: "Erlaubnisschein Dachzugang",
    description: "Dachzugang — typisch Anhang II Absturz; Seitenschutz / PSA und Rettungsplan.",
  },
  night_works: { label: "Erlaubnisschein Nachtarbeit" },
  valve_isolation: { label: "Erlaubnisschein Armaturentrennung" },
  visitor_access: { label: "Erlaubnisschein Besucherzugang" },
  radiography: {
    label: "Erlaubnisschein Durchstrahlungsprüfung",
    description: "Ionisierende Strahlung — Anhang II; Sperrzone und Freigabe der Durchstrahlung.",
  },
  ground_disturbance: {
    label: "Erlaubnisschein Bodeneingriff",
    description: "Bodeneingriff — Verschüttungs- und Leitungsrisiko; Ortung vor dem Aufbruch.",
  },
  line_clearance: {
    label: "Erlaubnisschein Arbeiten in Leitungsnähe",
    description: "Nähe zu Leitungen / Hochspannung — Anhang II HV wo zutreffend.",
  },
  rail_corridor_access: { label: "Erlaubnisschein Bahngebiet" },
  ole_isolation: { label: "Erlaubnisschein Oberleitungsabschaltung" },
  on_track_plant: { label: "Erlaubnisschein Zweiwegefahrzeuge (RRV)" },
  marine_hydrographic: { label: "Erlaubnisschein hydrografische Vermessung" },
  aerial_survey_coordination: { label: "Erlaubnisschein Luftbildvermessung" },
  general: { label: "Allgemeiner Erlaubnisschein" },
  excavation: {
    label: "Erlaubnisschein Aushub / Erdarbeiten",
    description: "Aushub — Anhang II Verschüttung; Leitungspläne und Ortung vor dem Aufbruch",
    checklist: [
      "Leitungsauskunft / Bestandspläne eingeholt",
      "Ortung vor dem Aufbruch auf der Baustelle markiert",
      "Handschachtung in unsicheren Zonen",
      "Grabenverbau / Böschung / Kantensicherung",
      "Sperrzone über der Baugrube",
      "SiGeKo / Aufsicht vor Beginn informiert",
      "Anhang-II-Maßnahmen im SiGe-Plan benannt (falls mehrere Arbeitgeber)",
    ],
  },
  work_at_height: {
    label: "Erlaubnisschein Absturzgefährdung",
    description: "Absturz — Anhang II; Seitenschutz, PSA, Rettung, Sperrzone unter der Arbeitsstelle.",
    checklist: [
      "Gerüst / Bühne geprüft — aktuelle Freigabe",
      "Qualifikation für Hubarbeitsbühne / Kran",
      "Seitenschutz an offenen Kanten",
      "Auffanggurt und Verbindungsmittel vor Gebrauch geprüft",
      "Sperrzone unter den Arbeiten",
      "Windverhältnisse bewertet",
      "Rettungsplan bekannt und materialisiert",
    ],
  },
  electrical: {
    label: "Erlaubnisschein Freischaltung",
    description: "Freischaltung / elektrische Arbeiten — Elektrofachkraft, LOTO, Spannungsfreiheit.",
    checklist: [
      "Trennstelle identifiziert",
      "Freischaltung durch Elektrofachkraft",
      "LOTO-Schloss und Schild",
      "Spannungsfreiheit nachgewiesen",
      "Schein bei der ausführenden Person",
    ],
  },
  confined_space: {
    label: "Erlaubnisschein enge Räume",
    description: "Enge Räume / Behälter — Freimessen, Stand-by, Rettung; oft Anhang II Verschüttung/Gefahrstoffe.",
  },
  lifting: {
    label: "Erlaubnisschein Hebevorgang",
    description: "Kran / Fertigteilmontage — Anhang II Fertigteile wo zutreffend; Hebeplan und Ausschlusszone.",
  },
};

export const ANHANG_II_STATUTE_LABEL = {
  de: "BaustellV Anhang II",
  at: "BauKG",
  ch: "BauAV",
};

function annotateDePermitsWithAnhangII(types, marketId = "de") {
  const statute = ANHANG_II_STATUTE_LABEL[marketId] || ANHANG_II_STATUTE_LABEL.de;
  const out = { ...types };
  for (const [typeId, def] of Object.entries(out)) {
    const links = anhangIIItemsForPermit(typeId);
    if (!links.length || !def) continue;
    const tag = links.map((i) => i.short).join(", ");
    const hint = links[0]?.gbuHint;
    out[typeId] = {
      ...def,
      description: def.description
        ? `${def.description} · ${statute}: ${tag}.`
        : `${statute}: ${tag}.${hint ? ` ${hint}` : ""}`,
    };
  }
  return out;
}

/** CH uses "Freigabe" rather than "Erlaubnisschein" — same substance, Swiss term. */
function toChFreigabeLabels(types) {
  const out = {};
  for (const [typeId, def] of Object.entries(types)) {
    out[typeId] = def?.label
      ? { ...def, label: def.label.replace(/^Erlaubnisschein\b/, "Freigabe").replace(/^Allgemeiner Erlaubnisschein$/, "Allgemeine Freigabe") }
      : def;
  }
  return out;
}

/** @param {import("../../config/markets").MarketId} marketId */
export function getPermitTypesForMarket(marketId = "uk") {
  if (marketId === "au") return mergePermitMarketOverrides(PERMIT_TYPES, AU_PERMIT_TYPE_OVERRIDES);
  if (marketId === "pl") return mergePermitMarketOverrides(PERMIT_TYPES, PL_PERMIT_TYPE_OVERRIDES);
  if (marketId === "de" || marketId === "at") {
    return annotateDePermitsWithAnhangII(mergePermitMarketOverrides(PERMIT_TYPES, DE_PERMIT_TYPE_OVERRIDES), marketId);
  }
  if (marketId === "ch") {
    return annotateDePermitsWithAnhangII(
      toChFreigabeLabels(mergePermitMarketOverrides(PERMIT_TYPES, DE_PERMIT_TYPE_OVERRIDES)),
      marketId
    );
  }
  return PERMIT_TYPES;
}

/** @param {string} type @param {import("../../config/markets").MarketId} marketId */
export function checklistStringsForMarket(type, marketId = "uk") {
  return getPermitTypesForMarket(marketId)[type]?.checklist || [];
}
