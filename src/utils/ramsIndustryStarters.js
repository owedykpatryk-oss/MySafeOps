/**
 * Trade RAMS starter packs — keyed by orgIndustryPacks.ramsStarterKey.
 * Surveying keys (e.g. utility_mapping_survey) are handled in RAMSTemplateBuilder SURVEYING_PACKS.
 */

import { INDUSTRY_PACKS, normalizeIndustryPackId } from "./industryPackCatalog";
import { loadOrgSettingsRaw } from "./orgSettingsStorage";
import { getOrgMarketId } from "./orgMarket";

/** @typedef {{ key: string, label: string, scope: string, method: string, hazardTokens: string[], categories?: string[] }} TradeRamsStarter */

/** @type {Record<string, TradeRamsStarter>} */
export const TRADE_RAMS_STARTERS = {
  general: {
    key: "general",
    label: "General construction",
    scope:
      "General construction and maintenance activities with CDM coordination, permit interfaces, and daily briefing before start.",
    method:
      "1. Pre-start briefing and permit checks.\n\n2. Set exclusion zones and pedestrian/plant segregation.\n\n3. Verify tools, PPE and competence for the task.\n\n4. Execute work under supervisor control with stop-work authority.\n\n5. Close-out inspection and handover notes.",
    hazardTokens: [
      "manual handling",
      "slips",
      "trip",
      "work at height",
      "moving plant",
      "pedestrian",
      "noise",
      "dust",
      "adverse weather",
    ],
    categories: ["General", "Groundworks", "Access"],
  },
  electrical: {
    key: "electrical",
    label: "Electrical & M&E",
    scope:
      "Electrical isolation, verification and controlled maintenance with LOTO, test-before-touch and permit interfaces.",
    method:
      "1. Confirm isolation plan and competent persons.\n\n2. Apply LOTO and verify dead before work.\n\n3. Test-before-touch and prove dead where required.\n\n4. Control hot work and fire watch interfaces.\n\n5. Re-energisation only under authorised procedure.",
    hazardTokens: [
      "electrical",
      "live cable",
      "switchgear",
      "isolation",
      "loto",
      "hot work",
      "arc",
      "test-before-touch",
      "manual handling",
    ],
    categories: ["Electrical", "Hot works", "General"],
  },
  refurb_build: {
    key: "refurb_build",
    label: "Building & refurbishment",
    scope:
      "Refurbishment and fit-out in occupied or live buildings — dust, noise, access, snagging and client interface controls.",
    method:
      "1. Walk-round and client/site induction.\n\n2. Set dust/noise controls and protected routes.\n\n3. Sequence intrusive works with isolation checks.\n\n4. Log snags and defects during progress inspections.\n\n5. Handover with snag close-out evidence.",
    hazardTokens: [
      "refurb",
      "fit-out",
      "dust",
      "noise",
      "manual handling",
      "work at height",
      "slips",
      "trip",
      "occupied",
      "hot work",
    ],
    categories: ["General", "Access", "Hot works"],
  },
  groundworks: {
    key: "groundworks",
    label: "Groundworks & excavation",
    scope:
      "Excavation, groundworks and demolition interfaces with permit-to-dig, buried services and temporary works controls.",
    method:
      "1. Verify utility records and scan proof before dig.\n\n2. Mark tolerance zones and establish banksman controls.\n\n3. Excavate in stages with edge protection.\n\n4. Record exposures and temporary works checks.\n\n5. Backfill/reinstate and close permit.",
    hazardTokens: [
      "excavation",
      "dig",
      "buried",
      "utility",
      "permit-to-dig",
      "plant",
      "collapse",
      "manual handling",
      "traffic",
    ],
    categories: ["Groundworks", "General", "Plant"],
  },
  utilities: {
    key: "utilities",
    label: "Utilities (water, gas, electric, telecom)",
    scope:
      "Utility installation, repair and mapping with permit-to-dig, isolation, pressure testing and streetworks controls.",
    method:
      "1. Obtain utility records and agree isolation points.\n\n2. CAT/Genny scan and mark services before breaking ground.\n\n3. Execute works under permit with competent operatives.\n\n4. Pressure test / commission per network operator procedure.\n\n5. Reinstate and issue handover records.",
    hazardTokens: [
      "utility",
      "water main",
      "gas",
      "sewer",
      "jetting",
      "cable",
      "fibre",
      "excavation",
      "confined",
      "traffic",
    ],
    categories: ["Utilities — Water & Sewer", "Utilities — Gas & Electric", "Groundworks & Excavation"],
  },
  highways: {
    key: "highways",
    label: "Highways & streetworks",
    scope:
      "Road and footway works with Chapter 8 traffic management, NRSWA notices and live-traffic interface controls.",
    method:
      "1. Agree TM plan and NRSWA/streetworks notices.\n\n2. Deploy signing, lighting and barriers before work starts.\n\n3. Maintain TM throughout; check after setup and hourly.\n\n4. Coordinate plant movements with banksman.\n\n5. Remove TM and reinstate to spec.",
    hazardTokens: ["traffic", "chapter 8", "nrswa", "surfacing", "live traffic", "pedestrian", "plant"],
    categories: ["Highways & Streetworks", "Chapter 8 Traffic Management"],
  },
  rail: {
    key: "rail",
    label: "Rail & trackside",
    scope:
      "Trackside and station works with PTS competence, possession rules and OLE/third-rail awareness.",
    method:
      "1. Confirm possession / isolation and site-specific rail induction.\n\n2. Brief team on OLE/third-rail and exclusion zones.\n\n3. Execute works under COSS/ES supervision as required.\n\n4. Maintain lookout and communication protocols.\n\n5. Hand back and close permits.",
    hazardTokens: ["rail", "trackside", "ole", "pts", "electrified", "possession"],
    categories: ["Rail & Trackside"],
  },
  demolition: {
    key: "demolition",
    label: "Demolition & strip-out",
    scope:
      "Controlled demolition and strip-out with asbestos survey, isolation and sequential dismantling.",
    method:
      "1. Review pre-demolition survey and asbestos register.\n\n2. Isolate services and establish exclusion zones.\n\n3. Dismantle top-down per method statement.\n\n4. Manage dust, noise and waste streams.\n\n5. Final inspection and handover.",
    hazardTokens: ["demolition", "strip-out", "asbestos", "collapse", "dust", "manual handling"],
    categories: ["Demolition & Strip-out", "Asbestos & Hazardous Materials"],
  },
  interiors_fitout: {
    key: "interiors_fitout",
    label: "Interiors & fit-out",
    scope:
      "Drylining, ceilings, flooring and M&E fit-out in occupied or live buildings.",
    method:
      "1. Set segregation and dust/noise controls.\n\n2. Sequence works to minimise occupant interface.\n\n3. Verify isolation before any intrusive M&E.\n\n4. Manage manual handling and work at height access.\n\n5. Snag, clean and hand over.",
    hazardTokens: ["drylining", "fit-out", "dust", "manual handling", "occupied", "work at height"],
    categories: ["Interiors & Fit-Out", "Painting, Decorating & Flooring"],
  },
  plant_operation: {
    key: "plant_operation",
    label: "Plant operation & banksman",
    scope:
      "360, telehandler, dumper/roller and banksman controls on civils sites.",
    method:
      "1. Daily plant checks and competence verification.\n\n2. Mark exclusion zones and pedestrian routes.\n\n3. Banksman for reversing and complex lifts.\n\n4. Permit to dig before excavation bucket work.\n\n5. Fuel and spill controls at compound.",
    hazardTokens: ["excavator", "telehandler", "dumper", "banksman", "reversing", "plant", "rollover"],
    categories: ["Plant & Machinery", "Groundworks & Excavation"],
  },
  confined_space: {
    key: "confined_space",
    label: "Confined space & tank entry",
    scope:
      "Chamber, tank, sewer and vessel entry with gas testing, rescue and permit controls.",
    method:
      "1. Confined space assessment and entry permit.\n\n2. Isolate, purge and test atmosphere.\n\n3. Top-man and rescue plan in place.\n\n4. Continuous monitoring during entry.\n\n5. Close permit and secure area.",
    hazardTokens: ["confined", "tank", "chamber", "manhole", "atmosphere", "rescue", "gas"],
    categories: ["Confined Space", "Confined Space & Tank Entry"],
  },
  energy: {
    key: "energy",
    label: "Energy & renewables",
    scope:
      "Solar PV, BESS, wind turbine and substation works with electrical and WAH controls.",
    method:
      "1. Electrical isolation and LOTO where required.\n\n2. Weather and wind limits per OEM.\n\n3. Lift plans for modules and nacelle components.\n\n4. Exclusion zones and dropped object controls.\n\n5. Commissioning and handover records.",
    hazardTokens: ["solar", "wind", "battery", "bess", "substation", "electrical", "work at height"],
    categories: ["Energy & Renewables", "Solar PV & EV Charging", "Wind Energy Service"],
  },
  facade_roof: {
    key: "facade_roof",
    label: "Facade, cladding & roofing",
    scope:
      "Curtain wall, cladding, glazing and roofing with fragile surface and weather controls.",
    method:
      "1. WAH hierarchy — prefer MEWP/scaffold over ladders.\n\n2. Fragile roof assessment and crawl boards.\n\n3. Wind speed monitoring; stop work limits.\n\n4. Dropped object controls at ground level.\n\n5. Close-out inspection and weathertightness check.",
    hazardTokens: ["facade", "cladding", "roof", "fragile", "glazing", "work at height", "wind"],
    categories: ["Facade & Glazing", "Roofing & Waterproofing"],
  },
  healthcare_fm: {
    key: "healthcare_fm",
    label: "Healthcare & facilities maintenance",
    scope:
      "Works in hospitals, labs and occupied healthcare with IPC, dust and critical services controls.",
    method:
      "1. IPC risk assessment with estates/trust.\n\n2. Negative pressure and HEPA where required.\n\n3. Medical gas and critical power isolation scheme.\n\n4. Agreed hours and patient interface controls.\n\n5. Clean handback and certification.",
    hazardTokens: ["healthcare", "cleanroom", "ipc", "dust", "occupied", "medical gas"],
    categories: ["Healthcare & Cleanroom", "Site Setup & Welfare"],
  },
  timber_frame: {
    key: "timber_frame",
    label: "Timber frame & carpentry",
    scope:
      "Timber frame erection, carpentry fix-out, nail guns and silica-generating cuts.",
    method:
      "1. Panel lift plan and temporary bracing sequence.\n\n2. Wind limits per manufacturer.\n\n3. Nail gun training and sequential triggers.\n\n4. Silica controls on cutting tasks.\n\n5. Scaffold/WAH access for fix-out.",
    hazardTokens: ["timber", "carpentry", "nail gun", "silica", "panel", "bracing", "work at height"],
    categories: ["Timber Frame & Carpentry", "Structural Steel"],
  },
  industrial_shutdown: {
    key: "industrial_shutdown",
    label: "Industrial shutdown & lifting",
    scope:
      "Factory shutdown, LOTO, conveyors and critical lifts during maintenance windows.",
    method:
      "1. Shutdown isolation register and SIMOPS review.\n\n2. LOTO on all energy sources.\n\n3. Lift plans for machinery removal.\n\n4. Confined space and hot work permits as required.\n\n5. Re-energise only under authorised procedure.",
    hazardTokens: ["shutdown", "loto", "conveyor", "lifting", "loler", "confined", "simops"],
    categories: ["Plant & Machinery", "Warehousing & Logistics"],
  },
};

/**
 * Polskie odpowiedniki starterów IBWR. Nakładka na TRADE_RAMS_STARTERS — zmienia nazwę,
 * zakres i metodę, żeby dokument wychodzący na budowę był po polsku. Tokeny zagrożeń
 * i kategorie zostają wspólne, bo dobierają wiersze z biblioteki.
 */
const PL_TRADE_RAMS_STARTERS = {
  general: {
    label: "Roboty ogólnobudowlane",
    scope:
      "Roboty ogólnobudowlane i utrzymaniowe — koordynacja BHP, zezwolenia na prace szczególnie niebezpieczne i odprawa przed rozpoczęciem zmiany.",
    method:
      "1. Odprawa przed rozpoczęciem prac i sprawdzenie zezwoleń.\n\n2. Wyznaczenie stref niebezpiecznych oraz rozdzielenie ruchu pieszych i maszyn.\n\n3. Sprawdzenie narzędzi, ŚOI oraz uprawnień i badań pracowników.\n\n4. Wykonanie robót pod nadzorem, z prawem wstrzymania pracy przy zagrożeniu.\n\n5. Kontrola końcowa, uporządkowanie stanowiska i zapis przekazania.",
  },
  electrical: {
    label: "Instalacje elektryczne i sanitarne",
    scope:
      "Wyłączenia, pomiary i prace przy instalacjach elektrycznych — LOTO, sprawdzenie braku napięcia i powiązanie z zezwoleniem na pracę.",
    method:
      "1. Ustalenie zakresu wyłączenia i osób z uprawnieniami SEP.\n\n2. Wyłączenie, założenie LOTO i wywieszenie tablic ostrzegawczych.\n\n3. Sprawdzenie braku napięcia przyrządem sprawdzonym przed i po pomiarze.\n\n4. Kontrola prac gorących i zabezpieczenia przeciwpożarowego.\n\n5. Załączenie zasilania wyłącznie przez osobę, która je wyłączyła.",
  },
  refurb_build: {
    label: "Remonty i wykończenia",
    scope:
      "Remonty i prace wykończeniowe w obiektach użytkowanych — pylenie, hałas, drogi dojścia, usterki i kontakt z użytkownikiem obiektu.",
    method:
      "1. Obchód obiektu i instruktaż przed wejściem na teren.\n\n2. Wygrodzenie strefy, ograniczenie pylenia i hałasu, wyznaczenie dróg chronionych.\n\n3. Prace ingerujące w instalacje wyłącznie po potwierdzeniu odłączenia.\n\n4. Bieżące zapisywanie usterek podczas kontroli postępu.\n\n5. Przekazanie z potwierdzeniem usunięcia usterek.",
  },
  groundworks: {
    label: "Roboty ziemne i fundamentowe",
    scope:
      "Wykopy, roboty ziemne i rozbiórkowe — mapa uzbrojenia, zabezpieczenie ścian wykopu i roboty tymczasowe.",
    method:
      "1. Pozyskanie mapy uzbrojenia i uzgodnień gestorów przed rozpoczęciem.\n\n2. Trasowanie sieci, oznaczenie stref kolizji i wyznaczenie sygnalisty.\n\n3. Wykop etapami, z zabezpieczeniem ścian i balustradami przy krawędzi.\n\n4. Zapis odkrytych sieci i kontrola zabezpieczeń wykopu.\n\n5. Zasypanie, odtworzenie nawierzchni i zamknięcie zezwolenia.",
  },
  utilities: {
    label: "Sieci: woda, gaz, energetyka, telekomunikacja",
    scope:
      "Budowa, naprawa i inwentaryzacja sieci — zezwolenie na roboty ziemne, odcięcia, próby szczelności i zajęcie pasa drogowego.",
    method:
      "1. Pozyskanie dokumentacji sieci i uzgodnienie punktów odcięcia.\n\n2. Lokalizacja i oznaczenie sieci przed naruszeniem gruntu.\n\n3. Wykonanie robót na podstawie zezwolenia, przez osoby z uprawnieniami.\n\n4. Próby i odbiory zgodnie z procedurą gestora sieci.\n\n5. Odtworzenie terenu i przekazanie dokumentacji odbiorowej.",
  },
  highways: {
    label: "Roboty drogowe i zajęcie pasa",
    scope:
      "Roboty w pasie drogowym — tymczasowa organizacja ruchu, zajęcie pasa i praca przy czynnym ruchu.",
    method:
      "1. Zatwierdzony projekt tymczasowej organizacji ruchu i zgoda na zajęcie pasa.\n\n2. Ustawienie oznakowania, oświetlenia i zapór przed rozpoczęciem robót.\n\n3. Utrzymanie oznakowania przez cały czas robót, z kontrolą po ustawieniu i w trakcie zmiany.\n\n4. Koordynacja ruchu maszyn przez wyznaczonego sygnalistę.\n\n5. Zdjęcie oznakowania i przywrócenie przejezdności po uprzątnięciu odcinka.",
  },
  rail: {
    label: "Roboty kolejowe i przytorowe",
    scope:
      "Prace w torze i przy torze — zamknięcie toru, dopuszczenie do pracy w obszarze kolejowym, sieć trakcyjna i osłona.",
    method:
      "1. Potwierdzenie zamknięcia toru lub regulaminu tymczasowego z zarządcą infrastruktury.\n\n2. Instruktaż o sieci trakcyjnej, skrajni i strefach niebezpiecznych.\n\n3. Roboty pod nadzorem kierującego pracami, z wyznaczonymi sygnalistami.\n\n4. Utrzymanie łączności z dyżurnym ruchu i sygnalizacji ostrzegawczej.\n\n5. Odbiór toru i przekazanie do ruchu przed otwarciem odcinka.",
  },
  demolition: {
    label: "Rozbiórki i demontaże",
    scope:
      "Rozbiórki prowadzone w sposób kontrolowany — inwentaryzacja azbestu, odłączenie mediów i demontaż w ustalonej kolejności.",
    method:
      "1. Analiza projektu rozbiórki i inwentaryzacji materiałów niebezpiecznych.\n\n2. Odłączenie mediów i wygrodzenie strefy niebezpiecznej.\n\n3. Demontaż od góry, zgodnie z projektem rozbiórki.\n\n4. Ograniczenie pylenia i hałasu, segregacja odpadów według kodów.\n\n5. Kontrola końcowa i zabezpieczenie terenu po rozbiórce.",
  },
  interiors_fitout: {
    label: "Prace wykończeniowe wnętrz",
    scope:
      "Zabudowy g-k, sufity, posadzki i instalacje w obiektach użytkowanych lub czynnych.",
    method:
      "1. Wygrodzenie strefy oraz ograniczenie pylenia i hałasu.\n\n2. Ustalenie kolejności robót ograniczającej kontakt z użytkownikiem obiektu.\n\n3. Potwierdzenie odłączenia instalacji przed pracami ingerującymi.\n\n4. Kontrola prac na wysokości i ręcznych prac transportowych.\n\n5. Usunięcie usterek, sprzątanie i przekazanie pomieszczeń.",
  },
  plant_operation: {
    label: "Praca maszyn i sygnalista",
    scope:
      "Koparki, ładowarki, wozidła i walce na budowie — uprawnienia operatorów, strefy niebezpieczne i sygnalista.",
    method:
      "1. Codzienna kontrola maszyn i weryfikacja uprawnień operatorów.\n\n2. Wyznaczenie stref niebezpiecznych i dróg dla pieszych.\n\n3. Sygnalista przy cofaniu i ograniczonej widoczności.\n\n4. Zezwolenie na roboty ziemne przed pracą łyżką w gruncie.\n\n5. Zasady tankowania i zabezpieczenie przed wyciekiem na zapleczu.",
  },
  confined_space: {
    label: "Przestrzenie zamknięte",
    scope:
      "Wejścia do studni, zbiorników, kanałów i komór — pomiary atmosfery, asekuracja i ratownictwo.",
    method:
      "1. Ocena ryzyka dla przestrzeni i pisemne zezwolenie na wejście.\n\n2. Odcięcie mediów, przewietrzenie i pomiar atmosfery.\n\n3. Asekurujący na zewnątrz oraz gotowy sprzęt ratowniczy.\n\n4. Pomiar ciągły przez cały czas przebywania w przestrzeni.\n\n5. Zamknięcie zezwolenia i zabezpieczenie otworu.",
  },
  energy: {
    label: "Energetyka i OZE",
    scope:
      "Instalacje fotowoltaiczne, magazyny energii, farmy wiatrowe i stacje elektroenergetyczne — prace elektryczne i na wysokości.",
    method:
      "1. Wyłączenie i LOTO tam, gdzie jest wymagane.\n\n2. Limity wiatru i warunków pogodowych według wytycznych producenta.\n\n3. Plan pracy dźwigu dla modułów i elementów wielkogabarytowych.\n\n4. Strefy niebezpieczne i zabezpieczenie przed upadkiem przedmiotów.\n\n5. Uruchomienie, pomiary i dokumentacja odbiorowa.",
  },
  facade_roof: {
    label: "Elewacje i dachy",
    scope:
      "Elewacje, okładziny, przeszklenia i pokrycia dachowe — pokrycia kruche i warunki atmosferyczne.",
    method:
      "1. Pierwszeństwo ochron zbiorowych: rusztowanie i podest przed drabiną.\n\n2. Ocena pokrycia dachu i pomosty nad materiałem kruchym.\n\n3. Kontrola prędkości wiatru i kryteria wstrzymania prac.\n\n4. Zabezpieczenie przed upadkiem przedmiotów i wygrodzenie terenu.\n\n5. Kontrola końcowa i sprawdzenie szczelności.",
  },
  healthcare_fm: {
    label: "Obiekty służby zdrowia i utrzymanie ruchu",
    scope:
      "Prace w szpitalach, laboratoriach i obiektach czynnych — zapobieganie zakażeniom, pylenie i instalacje krytyczne.",
    method:
      "1. Ocena ryzyka zakażeń uzgodniona z użytkownikiem obiektu.\n\n2. Wygrodzenie strefy, podciśnienie i filtracja tam, gdzie wymagane.\n\n3. Schemat odcięcia gazów medycznych i zasilania krytycznego.\n\n4. Uzgodnione godziny prac i zasady kontaktu z pacjentami.\n\n5. Sprzątanie, dezynfekcja i protokolarne przekazanie strefy.",
  },
  timber_frame: {
    label: "Konstrukcje drewniane i ciesielstwo",
    scope:
      "Montaż konstrukcji szkieletowych, prace ciesielskie, gwoździarki i cięcie materiałów pylących.",
    method:
      "1. Plan podnoszenia paneli i kolejność stężeń tymczasowych.\n\n2. Limity wiatru zgodnie z wytycznymi producenta.\n\n3. Instruktaż obsługi gwoździarek i praca w trybie sekwencyjnym.\n\n4. Ograniczenie pylenia przy cięciu — praca na mokro lub z odciągiem.\n\n5. Dostęp z rusztowania lub podestu przy pracach wykończeniowych.",
  },
  industrial_shutdown: {
    label: "Postoje remontowe i prace dźwigowe",
    scope:
      "Postój remontowy zakładu, LOTO, przenośniki i prace dźwigowe w oknie serwisowym.",
    method:
      "1. Rejestr odcięć na czas postoju i przegląd prac jednoczesnych.\n\n2. LOTO na wszystkich źródłach energii.\n\n3. Plan pracy dźwigu przy demontażu maszyn.\n\n4. Zezwolenia na przestrzenie zamknięte i prace pożarowo niebezpieczne.\n\n5. Uruchomienie wyłącznie w ustalonej procedurze przez osobę upoważnioną.",
  },
};

export const SURVEY_RAMS_STARTER_KEYS = new Set([
  "utility_mapping_survey",
  "site_investigation_campaign",
  "geospatial_intelligence",
]);

/** @param {unknown} key */
export function isSurveyRamsStarterKey(key) {
  return typeof key === "string" && SURVEY_RAMS_STARTER_KEYS.has(key);
}

/** @param {unknown} key */
export function isValidTradeRamsStarterKey(key) {
  return typeof key === "string" && Object.prototype.hasOwnProperty.call(TRADE_RAMS_STARTERS, key);
}

/** @param {unknown} key @returns {TradeRamsStarter | null} */
/**
 * Starter for the workspace's market — Polish workspaces get the Polish wording, because the
 * scope and method text is copied straight into the issued document.
 * @param {unknown} key
 * @param {import("../config/markets").MarketId} [marketId]
 */
export function findTradeStarterByKey(key, marketId = getOrgMarketId()) {
  if (!isValidTradeRamsStarterKey(key)) return null;
  const base = TRADE_RAMS_STARTERS[key];
  if (marketId !== "pl") return base;
  const pl = PL_TRADE_RAMS_STARTERS[key];
  return pl ? { ...base, ...pl } : base;
}

/** @param {unknown} key */
export function getRamsStarterLabel(key, marketId = getOrgMarketId()) {
  if (marketId === "pl") {
    if (key === "geospatial_intelligence") return "Geodezja i pomiary";
    if (key === "site_investigation_campaign") return "Badania podłoża i geotechnika";
    if (isSurveyRamsStarterKey(key)) return "Inwentaryzacja uzbrojenia terenu";
    return findTradeStarterByKey(key, marketId)?.label || "Roboty ogólnobudowlane";
  }
  if (key === "geospatial_intelligence") return "Geospatial & surveying";
  if (key === "site_investigation_campaign") return "Site investigation & geotechnics";
  if (isSurveyRamsStarterKey(key)) return "PAS128 utility mapping survey";
  const starter = findTradeStarterByKey(key, marketId);
  return starter?.label || "General construction";
}

/** Effective RAMS starter for new documents — saved key or profile default. */
export function getOrgRamsStarterKey() {
  const raw = loadOrgSettingsRaw();
  if (typeof raw.ramsStarterKey === "string" && raw.ramsStarterKey) {
    const saved = raw.ramsStarterKey;
    if (isValidTradeRamsStarterKey(saved) || isSurveyRamsStarterKey(saved)) return saved;
  }
  const packId = normalizeIndustryPackId(raw.industryPackId);
  const fromPack = packId && INDUSTRY_PACKS[packId]?.ramsStarterKey;
  if (fromPack === null) return null;
  if (typeof fromPack === "string" && fromPack) return fromPack;
  return "general";
}

/** Short AI / Help context line for the active starter. */
export function getRamsStarterAiHint(starterKey = getOrgRamsStarterKey()) {
  if (starterKey === "geospatial_intelligence") {
    return "Organisation profile: geospatial surveying. Include utility strike (PAS128/AS5488), NDD, aerial LiDAR, laser scan, hydrographic, rail corridor and tunnel hazards where relevant.";
  }
  if (starterKey === "site_investigation_campaign") {
    return "Organisation profile: site investigation & geotechnics. Include trial pits, window sampling, DCP/probing, boreholes, coring, ground gas, contamination and chain-of-custody controls.";
  }
  if (isSurveyRamsStarterKey(starterKey)) {
    return "Organisation profile: surveying / PAS128. Include utility strike, traffic, chamber and scan-validation hazards where relevant.";
  }
  const starter = findTradeStarterByKey(starterKey);
  if (!starter) return "Organisation profile: general construction. Use UK HSE RAMS conventions.";
  return `Organisation profile: ${starter.label}. Prioritise hazards matching: ${starter.hazardTokens.slice(0, 6).join(", ")}.`;
}

/** Match hazard library rows to starter tokens (shared with RAMS builder). */
export function hazardMatchesStarterTokens(h, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return true;
  const hay = `${h?.id || ""} ${h?.category || ""} ${h?.activity || ""} ${h?.hazard || ""}`.toLowerCase();
  return tokens.some((t) => hay.includes(String(t).toLowerCase()));
}

/** @param {string[]} tokens @param {object[]} hazardLibrary @param {number} [limit] */
export function findHazardsForStarterTokens(tokens, hazardLibrary, limit = 14) {
  if (!Array.isArray(hazardLibrary)) return [];
  const matched = hazardLibrary.filter((h) => hazardMatchesStarterTokens(h, tokens));
  return matched.slice(0, limit);
}
