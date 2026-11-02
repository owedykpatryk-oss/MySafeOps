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
    extraFields: [
      { key: "liftingEquipment", label: "Lifting equipment / crane ID", type: "text" },
      { key: "swl", label: "SWL of equipment (tonnes)", type: "number" },
      { key: "appointedPerson", label: "Competent person / lift supervisor", type: "text" },
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
    extraFields: [
      { key: "groundType", label: "Ground type / geology", type: "text" },
      { key: "disturbanceMethod", label: "Method of disturbance", type: "text" },
      { key: "maxDepth", label: "Maximum disturbance depth (m)", type: "number" },
      { key: "dbydRef", label: "DBYD enquiry reference", type: "text" },
      { key: "surveyDrawingRef", label: "Utility survey / drawing reference", type: "text" },
      { key: "utilityStrikeContacts", label: "Utility strike emergency contacts", type: "text" },
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
    label: "Pozwolenie na prace gorące",
    description: "Spawanie, szlifowanie, cięcie, lutowanie i inne prace powodujące powstawanie ciepła lub iskier",
    checklist: [
      "Usunięto materiały palne w promieniu 10 metrów",
      "2 × gaśnice 9 kg i koc gaśniczy na stanowisku",
      "Sprzęt do prac gorących sprawdzony i sprawny",
      "Sygnalizacja pożaru odizolowana w strefie prac (za zgodą nadzoru)",
      "Głowice tryskaczy zabezpieczone tam, gdzie dotyczy",
      "Wyznaczono i poinstruowano osobę na dyżurze pożarowym",
      "Wszystkie wpusty, kanały i otwory uszczelnione przed iskrami",
      "Stanowisko zwilżone tam, gdzie to uzasadnione",
      "Uzgodniono czas trwania pozwolenia — maksymalnie 8 godzin",
      "Uzgodniono inspekcję po pracy po minimum 1 godzinie",
    ],
    extraFields: [
      { key: "equipment", label: "Sprzęt do użycia", type: "text" },
      { key: "fireWatcher", label: "Osoba na dyżurze pożarowym", type: "text" },
      { key: "postInspectionTime", label: "Czas inspekcji po pracy", type: "datetime-local" },
    ],
  },
  cold_work: {
    label: "Pozwolenie na prace zimne",
    description: "Prace utrzymaniowe bez prac gorących, z wymaganym odłączeniem energii i procedurą LOTO",
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
    extraFields: [
      { key: "authorisedPerson", label: "Osoba uprawniona (odłączenie)", type: "text" },
      { key: "equipmentTag", label: "Oznaczenie / nr urządzenia", type: "text" },
      { key: "isolationPoints", label: "Liczba punktów odłączenia", type: "number" },
      { key: "lotoKeyHolder", label: "Osoba z kluczem LOTO", type: "text" },
    ],
  },
  electrical: {
    label: "Pozwolenie na odłączenie elektryczne",
    description: "Bezpieczne odłączenie obwodów elektrycznych, LOTO, prace pod napięciem",
    checklist: [
      "Punkt izolacji zidentyfikowany",
      "Izolacja przez osobę z uprawnieniami SEP",
      "Kłódka LOTO i tabliczka",
      "Potwierdzenie braku napięcia",
      "Pozwolenie u osoby wykonującej pracę",
    ],
    extraFields: [
      { key: "circuitRef", label: "Oznaczenie obwodu / rozdzielnicy", type: "text" },
      { key: "lockoutRef", label: "Numer kłódki LOTO", type: "text" },
      { key: "authorisedPerson", label: "Osoba uprawniona (odłączenie)", type: "text" },
    ],
  },
  work_at_height: {
    label: "Pozwolenie na pracę na wysokości",
    description: "Rusztowania, podesty, drabiny, dostęp linowy — prace z ryzykiem upadku",
    checklist: [
      "Sprawdzenie rusztowań / podestów — aktualna dopuszczalność",
      "Uprawnienia UDT dla podestów i żurawi",
      "Barierki na krawędziach",
      "Szelki i linki — kontrola przed użyciem",
      "Strefa pod robotami wyłączona",
      "Warunki wiatrowe ocenione",
    ],
    extraFields: [
      { key: "accessEquipment", label: "Sprzęt dostępu / nr", type: "text" },
      { key: "maxHeight", label: "Maksymalna wysokość pracy (m)", type: "number" },
      { key: "rescuePlan", label: "Numer planu ratowniczego", type: "text" },
    ],
  },
  confined_space: {
    label: "Pozwolenie na wejście do przestrzeni zamkniętej",
    description: "Wejście do zbiorników, kanałów, pustek — przestrzeń o ograniczonej wymianie powietrza",
    checklist: [
      "Ocena ryzyka przestrzeni zamkniętej aktualna i sprawdzona",
      "Pomiar atmosfery: O₂ (19,5–23,5%), gazy toksyczne w granicach, LEL (<10% przed wejściem)",
      "Monitoring ciągły podczas przebywania w przestrzeni",
      "Wentylacja mechaniczna potwierdzona i sprawna",
      "Osoba asekurująca poinformowana i na stanowisku na zewnątrz",
      "Sprzęt ratowniczy (trójnóg, wciągarka, szelki) przygotowany",
      "Plan ewakuacji potwierdzony z osobą asekurującą",
      "Wszystkie źródła energii odłączone (LOTO) przed wejściem",
      "Łączność między wchodzącym a asekurującym sprawdzona",
      "Uzgodniono maksymalną liczbę osób i czas przebywania",
    ],
    extraFields: [
      { key: "spaceDescription", label: "Opis / lokalizacja przestrzeni", type: "text" },
      { key: "standByPerson", label: "Osoba asekurująca", type: "text" },
      { key: "atmosphericReadings", label: "Wstępne pomiary atmosfery", type: "text" },
    ],
  },
  excavation: {
    label: "Pozwolenie na wykop / prace ziemne",
    description: "Wykop lub naruszenie gruntu — mapy uzbrojenia (CPD / geodeta)",
    checklist: [
      "Zlecenie mapy uzbrojenia terenu (geodeta / CPD)",
      "Wyniki zapisane na placu budowy przed rozpoczęciem wykopu",
      "Ręczne wykopy w strefach niepewnych",
      "Stabilizacja ścian wykopu / zabezpieczenie krawędzi",
      "Strefa wyłączona nad wykopem",
      "Koordynator BHP poinformowany przed startem",
    ],
    extraFields: [
      { key: "catScanBy", label: "Lokalizacja uzbrojenia wykonana przez", type: "text" },
      { key: "knownServices", label: "Znane uzbrojenie w rejonie", type: "text" },
      { key: "excavationDepth", label: "Maksymalna głębokość wykopu (m)", type: "number" },
      { key: "surveyDrawingRef", label: "Numer mapy uzbrojenia / rysunku", type: "text" },
      { key: "utilityStrikeContacts", label: "Kontakty awaryjne przy uszkodzeniu uzbrojenia", type: "text" },
    ],
  },
  lifting: {
    label: "Pozwolenie na operacje podnoszenia",
    description: "Żurawie, podesty, zawiesia — operacje podnoszenia zgodnie z wymaganiami UDT",
    checklist: [
      "Plan podnoszenia przygotowany przez osobę kompetentną",
      "Urządzenie dźwigowe z aktualnym badaniem UDT",
      "Operator z uprawnieniami UDT do danego urządzenia",
      "Dobór zawiesi — typ, udźwig i kąt pracy",
      "Masa ładunku potwierdzona — nie przekracza DOR żadnego elementu",
      "Strefa wyłączona pod i wokół podnoszenia",
      "Sygnalista na stanowisku z uzgodnionym systemem znaków",
      "Warunki podłoża sprawdzone — stateczność, poziom, nośność",
      "Przeszkody nad głową (linie, konstrukcje) potwierdzone jako wolne",
      "Warunki wiatrowe ocenione i w dopuszczalnych granicach",
    ],
    extraFields: [
      { key: "liftingEquipment", label: "Urządzenie dźwigowe / nr żurawia", type: "text" },
      { key: "swl", label: "DOR urządzenia (tony)", type: "number" },
      { key: "appointedPerson", label: "Osoba kompetentna nadzorująca podnoszenie", type: "text" },
    ],
  },
  line_break: {
    label: "Pozwolenie na rozszczelnienie instalacji",
    description: "Otwieranie rurociągu, zbiornika lub instalacji pod ciśnieniem z cieczą, gazem lub chemikaliami",
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
    extraFields: [
      { key: "authorisedPerson", label: "Osoba uprawniona (odłączenie)", type: "text" },
      { key: "pipeContents", label: "Zawartość rurociągu", type: "text" },
      { key: "workingPressure", label: "Ciśnienie robocze (bar)", type: "number" },
      { key: "temperature", label: "Temperatura medium (°C)", type: "number" },
    ],
  },
  roof_access: {
    label: "Pozwolenie na wejście na dach",
    description: "Wejście na dach — płaski, spadzisty, kruchy lub inny",
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
    extraFields: [
      { key: "roofType", label: "Rodzaj dachu (płaski/spadzisty/kruchy)", type: "text" },
      { key: "accessMethod", label: "Sposób dostępu (drabina/rusztowanie/właz)", type: "text" },
      { key: "maxPersons", label: "Maksymalna liczba osób na dachu", type: "number" },
    ],
  },
  night_works: {
    label: "Pozwolenie na prace nocne",
    description: "Prace poza normalnymi godzinami — noc, weekend, święto",
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
    extraFields: [
      { key: "siteContact", label: "Kontakt poza godzinami / telefon", type: "text" },
      { key: "securityCode", label: "Ustalenia ochrony / alarmu", type: "text" },
      { key: "loneworkingArrangement", label: "Interwał meldunku przy pracy samotnej", type: "text" },
    ],
  },
  valve_isolation: {
    label: "Pozwolenie na odłączenie armatury",
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
    label: "Pozwolenie na dostęp gości",
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
    label: "Pozwolenie na badania radiograficzne",
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
    label: "Pozwolenie na naruszenie gruntu",
    description: "Pale, kotwy, słupy — naruszenie gruntu poza głębokością lokalizacji uzbrojenia",
    checklist: [
      "Raport geotechniczny sprawdzony — rodzaj gruntu, zanieczyszczenia, pustki",
      "Zlecenie mapy uzbrojenia terenu (geodeta / CPD)",
      "Lokalizacja uzbrojenia oznaczona na placu przed rozpoczęciem prac",
      "Ocena archeologiczna / konserwatorska tam, gdzie wymagana",
      "Metoda naruszenia gruntu zatwierdzona przez osobę kompetentną",
      "Monitoring drgań sąsiednich konstrukcji tam, gdzie wymagany",
      "Inwentaryzacja stanu sąsiednich obiektów ze zdjęciami",
      "Monitoring wód gruntowych przy odwodnieniu",
      "Zabezpieczenia środowiskowe przy ciekach / obszarach wrażliwych",
    ],
    extraFields: [
      { key: "groundType", label: "Rodzaj gruntu / geologia", type: "text" },
      { key: "disturbanceMethod", label: "Metoda naruszenia gruntu", type: "text" },
      { key: "maxDepth", label: "Maksymalna głębokość naruszenia (m)", type: "number" },
      { key: "surveyDrawingRef", label: "Numer mapy uzbrojenia / rysunku", type: "text" },
      { key: "utilityStrikeContacts", label: "Kontakty awaryjne przy uszkodzeniu uzbrojenia", type: "text" },
    ],
  },
  line_clearance: {
    label: "Pozwolenie na pracę w pobliżu linii",
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
    label: "Pozwolenie na dostęp do obszaru kolejowego",
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
    label: "Pozwolenie na pomiary hydrograficzne",
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
    label: "Pozwolenie na koordynację nalotu pomiarowego",
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
    label: "Ogólne pozwolenie na pracę",
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
      ? {
          ...def,
          label: def.label
            .replace(/^Erlaubnisschein\b/, "Freigabe")
            .replace(/^Allgemeiner Erlaubnisschein$/, "Allgemeine Freigabe"),
        }
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
