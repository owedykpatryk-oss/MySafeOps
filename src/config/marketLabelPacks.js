/** @typedef {import("./markets").MarketId} MarketId */

/**
 * @typedef {{
 *   ramsShort: string;
 *   ramsLong: string;
 *   ramsBuilderTitle: string;
 *   emergencyServices: string;
 *   emergencyNumber: string;
 *   hospitalHeading: string;
 *   competencyHint: string;
 *   legislationSeedLabel: string;
 *   legislationSeedHint: string;
 *   cdmStepLabel: string;
 *   cdmStepHint: string;
 *   firstRamsStepLabel: string;
 *   firstRamsStepHint: string;
 *   hazardPacksStepLabel: string;
 *   permitStepLabel: string;
 *   permitStepHint: string;
 *   briefingStepLabel: string;
 *   briefingStepHint: string;
 *   postcodeHint: string;
 *   postcodeExample: string;
 *   geoLookupSuccess: string;
 *   registersLabel: string;
 *   moduleLabels?: Record<string, string>;
 * }} MarketLabelPack
 */

/** @type {Record<MarketId, MarketLabelPack>} */
export const MARKET_LABEL_PACKS = {
  uk: {
    ramsShort: "RAMS",
    ramsLong: "Risk Assessment & Method Statement (RAMS)",
    ramsBuilderTitle: "RAMS builder",
    emergencyServices: "nearest A&E",
    emergencyNumber: "999",
    hospitalHeading: "Nearest A&E / hospital",
    competencyHint: "e.g. CSCS, IPAF",
    legislationSeedLabel: "Load UK legislation register",
    legislationSeedHint: "CDM 2015, HASAWA, PUWER, COSHH — review applicability.",
    cdmStepLabel: "CDM compliance pack started",
    cdmStepHint: "CDM module → create CPP / pre-construction pack for your project.",
    firstRamsStepLabel: "First site RAMS issued",
    firstRamsStepHint: "RAMS Builder → apply construction quick pack and issue to site.",
    hazardPacksStepLabel: "Seed construction RAMS quick packs",
    permitStepLabel: "First permit to work issued",
    permitStepHint: "Permits → hot work, height or excavation — link to project RAMS.",
    briefingStepLabel: "Daily briefing recorded",
    briefingStepHint: "Capture weather, scope and signed attendance before work starts.",
    postcodeHint: "Enter a UK postcode, then use Lookup coordinates.",
    postcodeExample: "KT22 7SH",
    geoLookupSuccess: "Coordinates from UK postcode lookup.",
    registersLabel: "HSE",
  },
  au: {
    ramsShort: "SWMS",
    ramsLong: "Safe Work Method Statement (SWMS)",
    ramsBuilderTitle: "SWMS builder",
    emergencyServices: "nearest ED",
    emergencyNumber: "000",
    hospitalHeading: "Nearest ED / hospital",
    competencyHint: "e.g. White Card, EWPA, HRWL",
    legislationSeedLabel: "Load WHS legislation register",
    legislationSeedHint: "WHS Act, model codes, construction work — review applicability by state.",
    cdmStepLabel: "WHS management plan started",
    cdmStepHint: "WHS / CDM module → create site WHS management plan for your project.",
    firstRamsStepLabel: "First site SWMS issued",
    firstRamsStepHint: "SWMS Builder → apply construction quick pack and issue to site.",
    hazardPacksStepLabel: "Seed construction SWMS quick packs",
    permitStepLabel: "First permit to work issued",
    permitStepHint: "Permits → hot work, height or excavation — link to project SWMS.",
    briefingStepLabel: "Daily briefing recorded",
    briefingStepHint: "Capture weather, scope and signed attendance before work starts.",
    postcodeHint: "Enter an Australian postcode (e.g. 2000), then use Lookup coordinates.",
    postcodeExample: "2000",
    geoLookupSuccess: "Coordinates from Australian postcode lookup.",
    registersLabel: "WHS",
    moduleLabels: {
      rams: "SWMS",
      "whs-plan": "WHS management plan",
      "notifiable-incidents": "Notifiable incidents",
      coshh: "Hazardous substances",
      legislation: "WHS legislation",
      "construction-setup": "Construction setup (AU)",
    },
  },
  pl: {
    ramsShort: "IOR",
    ramsLong: "Instrukcja organizacji robót (IOR)",
    ramsBuilderTitle: "Kreator IOR",
    emergencyServices: "najbliższy SOR",
    emergencyNumber: "112",
    hospitalHeading: "Najbliższy SOR / szpital",
    competencyHint: "np. UDT, SEP, uprawnienia budowlane, BHP",
    legislationSeedLabel: "Załaduj rejestr przepisów BHP",
    legislationSeedHint: "Kodeks pracy, rozporządzenia BHP, PIP — zweryfikuj zakres na budowie.",
    cdmStepLabel: "Plan BHP rozpoczęty",
    cdmStepHint: "Moduł Plan BHP → utwórz plan BHP dla inwestycji.",
    firstRamsStepLabel: "Pierwsza IOR na budowie",
    firstRamsStepHint: "Kreator IOR → zastosuj pakiet szybki i wydaj na plac budowy.",
    hazardPacksStepLabel: "Załaduj pakiety IOR budowlane",
    permitStepLabel: "Pierwsze pozwolenie na pracę",
    permitStepHint: "Pozwolenia → prace gorące, wysokość lub wykopy — powiąż z IOR projektu.",
    briefingStepLabel: "Zapis odprawy dziennej",
    briefingStepHint: "Pogoda, zakres i obecność przed rozpoczęciem pracy.",
    postcodeHint: "Wpisz kod pocztowy (np. 00-001), potem wyszukaj współrzędne.",
    postcodeExample: "00-001",
    geoLookupSuccess: "Współrzędne z wyszukiwania kodu pocztowego (PL).",
    registersLabel: "BHP",
    moduleLabels: {
      rams: "IOR",
      "bhp-plan": "Plan BHP",
      "notifiable-incidents": "Zdarzenia wymagające zgłoszenia",
      coshh: "Substancje niebezpieczne",
      legislation: "Przepisy BHP",
      "construction-setup": "Konfiguracja budowy",
      permits: "Pozwolenia",
      dashboard: "Panel",
      projects: "Projekty",
      people: "Pracownicy",
      more: "Więcej",
      bin: "Kosz",
      "daily-briefing": "Odprawa dzienna",
      incidents: "Zdarzenia",
      "incident-actions": "Działania po zdarzeniu",
      "incident-map": "Mapa zdarzeń",
      inspections: "Kontrole",
      "project-drawings": "Rysunki",
      "method-statement": "Instrukcja techniczna",
      induction: "Indukcja QR",
      signatures: "Podpisy",
      timesheets: "Karty pracy",
      snags: "Usterki",
      "geo-photos": "Zdjęcia geo",
      documents: "Dokumenty",
      "client-portal": "Portal klienta",
      subcontractor: "Podwykonawcy",
      emergency: "Ratunkowe",
      ppe: "OOP",
      plant: "Urządzenia",
      fire: "Pożar",
      "hot-work": "Prace gorące",
      training: "Szkolenia",
      visitors: "Goście",
      "toolbox-reg": "Odprawy",
      "first-aid": "Pierwsza pomoc",
      "lone-working": "Praca samotna",
      environmental: "Środowisko",
      observations: "Obserwacje",
      ladders: "Drabiny",
      mewp: "Podesty ruchome",
      gate: "Księga bramy",
      asbestos: "Azbest",
      "confined-space": "Przestrzeń zamknięta",
      loto: "LOTO",
      "electrical-pat": "Elektryczne",
      lifting: "Podnoszenie",
      noise: "Hałas i wibracje",
      scaffold: "Rusztowania",
      excavation: "Wykopy",
      "temp-works": "Roboty tymczasowe",
      welfare: "Sanitariaty",
      "water-hygiene": "Woda",
      waste: "Odpady",
      analytics: "Analityka",
      "monthly-report": "Raport miesięczny",
      templates: "Szablony",
      backup: "Kopia zapasowa",
      audit: "Dziennik audytu",
      help: "Pomoc",
      settings: "Ustawienia",
      "dynamic-ra": "Ocena ryzyka",
    },
  },
};

/** @param {MarketId} [marketId] */
export function getMarketLabelPack(marketId = "uk") {
  return MARKET_LABEL_PACKS[marketId] ?? MARKET_LABEL_PACKS.uk;
}
