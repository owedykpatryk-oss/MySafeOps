/** @typedef {import("./markets").MarketId} MarketId */

/** @typedef {{
 *   moduleId: string;
 *   viewIds: string[];
 *   badgeText: string;
 *   title: string;
 *   lead: string;
 *   exportModuleLabel: string;
 *   newReportLabel: string;
 *   emptyLabel: string;
 *   wizardTitle: string;
 *   wizardSubtitle: string;
 *   regulatorName: string;
 *   regulatorUrl: string;
 *   regulatorLinkText: string;
 *   deadlinePrefix: string;
 *   reportedLabel: string;
 *   notReportedBanner: string;
 *   printTitle: string;
 *   printBanner: string;
 *   saveLabel: string;
 *   types: Record<string, { label: string; deadline: number | null; form: string; urgent: boolean; description: string }>;
 *   specifiedInjuries: string[];
 *   dangerousOccurrences: string[];
 * }} NotifiableIncidentsContent */

const UK_RIDDOR = /** @type {NotifiableIncidentsContent} */ ({
  moduleId: "riddor",
  viewIds: ["riddor"],
  badgeText: "RID",
  title: "RIDDOR register",
  lead: "Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013. Deadlines and HSE reporting links below.",
  exportModuleLabel: "RIDDOR register",
  newReportLabel: "+ New RIDDOR report",
  emptyLabel: "No RIDDOR records yet.",
  wizardTitle: "RIDDOR report wizard",
  wizardSubtitle: "Reporting of Injuries, Diseases and Dangerous Occurrences Regulations 2013",
  regulatorName: "HSE",
  regulatorUrl: "https://www.hse.gov.uk/riddor/report.htm",
  regulatorLinkText: "Report on HSE website →",
  deadlinePrefix: "RIDDOR",
  reportedLabel: "Reported to HSE",
  notReportedBanner: "This incident has not yet been reported to HSE. Please report at hse.gov.uk/riddor/report.htm",
  printTitle: "RIDDOR F2508 — draft worksheet",
  printBanner:
    "This is a local worksheet mirroring F2508 fields. Official reporting: hse.gov.uk/riddor/report.htm",
  saveLabel: "Save RIDDOR record",
  types: {
    fatality: {
      label: "Death / fatality",
      deadline: 10,
      form: "F2508",
      urgent: true,
      description: "A worker or member of the public dies as a result of a work-related accident",
    },
    specified: {
      label: "Specified injury (worker)",
      deadline: 10,
      form: "F2508",
      urgent: true,
      description: "Fracture (not finger/toe), amputation, loss of sight, crush injury to head/torso, burn, degloving, loss of consciousness, harm from biological agent",
    },
    over7day: {
      label: "Over-7-day incapacitation",
      deadline: 15,
      form: "F2508",
      urgent: false,
      description: "Worker unable to perform normal duties for more than 7 consecutive days (not counting day of accident)",
    },
    dangerous_occurrence: {
      label: "Dangerous occurrence",
      deadline: 10,
      form: "F2508",
      urgent: true,
      description: "Scaffold collapse, crane overturning, explosion, train collision, building collapse, radiation source uncontrolled",
    },
    gas_incident: {
      label: "Gas incident",
      deadline: 10,
      form: "F2508G",
      urgent: true,
      description: "Flammable gas or vapour explosion or fire, or a gas fitting or appliance causing death or injury",
    },
    disease: {
      label: "Occupational disease",
      deadline: null,
      form: "F2508A",
      urgent: false,
      description: "Doctor notifies employer of occupational disease: carpal tunnel, cramp, dermatitis, occupational asthma, tendinitis, vibration white finger",
    },
    public_injury: {
      label: "Public injury (non-fatal)",
      deadline: 10,
      form: "F2508",
      urgent: false,
      description: "Member of public taken from scene to hospital for treatment as a result of a work-related accident",
    },
  },
  specifiedInjuries: [
    "Fracture (other than finger, thumb or toe)",
    "Amputation of arm, hand, finger, thumb, leg, foot or toe",
    "Loss of sight or reduction in sight",
    "Crush injury to head or torso causing damage to brain or internal organs",
    "Severe burn (covering more than 10% of body, or to face, hands, feet, genitals, major joint)",
    "Degree of hypothermia requiring resuscitation or admission to hospital",
    "Loss of consciousness caused by head injury or asphyxia",
    "Any harm from absorption of any substance by inhalation, ingestion or through the skin",
    "Any degree of harm requiring resuscitation",
    "Hospitalisation for more than 24 hours",
  ],
  dangerousOccurrences: [
    "Collapse, overturning or failure of load-bearing part of any scaffold more than 5 metres high",
    "Explosion or fire causing suspension of normal work for more than 24 hours",
    "Collapse or partial collapse of a building under construction",
    "Accidental release of any substance that may cause injury to any person",
    "Failure of any closed vessel or associated pipework forming part of a pressure system",
    "Electrical short circuit or overload attended by fire or explosion serious enough to stop plant operation",
    "Explosion, collapse or burst of any closed vessel",
    "Train collision or derailment",
    "Unintended collapse of any building",
    "Contact with overhead power line",
  ],
});

const AU_NOTIFIABLE = /** @type {NotifiableIncidentsContent} */ ({
  moduleId: "notifiable-incidents",
  viewIds: ["notifiable-incidents", "riddor"],
  badgeText: "WHS",
  title: "Notifiable incidents",
  lead: "Model WHS Act — deaths, serious injuries/illnesses and dangerous incidents. Notify your state or territory regulator immediately; this tool does not submit statutory notifications.",
  exportModuleLabel: "Notifiable incidents register",
  newReportLabel: "+ New notifiable incident record",
  emptyLabel: "No notifiable incident records yet.",
  wizardTitle: "Notifiable incident wizard",
  wizardSubtitle: "Work Health and Safety Act — notification assessment worksheet",
  regulatorName: "Safe Work Australia",
  regulatorUrl: "https://www.safeworkaustralia.gov.au/law-and-regulation/model-whs-laws/notifiable-incidents",
  regulatorLinkText: "Safe Work Australia guidance →",
  deadlinePrefix: "Notification",
  reportedLabel: "Regulator notified",
  notReportedBanner:
    "This incident has not been marked as notified to your WHS regulator. Confirm immediately with your state/territory body (e.g. SafeWork NSW, WorkSafe VIC).",
  printTitle: "Notifiable incident — draft worksheet",
  printBanner:
    "Local worksheet only — notify your WHS regulator immediately after becoming aware of a notifiable incident. Do not rely on this app for statutory submission.",
  saveLabel: "Save incident record",
  types: {
    fatality: {
      label: "Death",
      deadline: 1,
      form: "Regulator notification",
      urgent: true,
      description: "Death of a person — whether an employee, contractor or member of the public",
    },
    serious_injury: {
      label: "Serious injury or illness",
      deadline: 1,
      form: "Regulator notification",
      urgent: true,
      description: "Immediate hospital treatment, amputation, serious head/eye injury, spinal injury, loss of bodily function, serious laceration, electric shock requiring treatment, etc.",
    },
    dangerous_incident: {
      label: "Dangerous incident",
      deadline: 1,
      form: "Regulator notification",
      urgent: true,
      description: "Near miss with serious risk — uncontrolled collapse, explosion, fall from height, entrapment, uncontrolled machinery, exposure to hazardous substance",
    },
    occupational_disease: {
      label: "Occupational illness (assess notification)",
      deadline: null,
      form: "Regulator notification",
      urgent: false,
      description: "Work-related disease or illness — confirm notification requirements with your regulator",
    },
    public_injury: {
      label: "Public injury (assess notification)",
      deadline: 1,
      form: "Regulator notification",
      urgent: true,
      description: "Member of the public injured in connection with work — assess notifiability with your WHS body",
    },
  },
  specifiedInjuries: [
    "Immediate treatment as an in-patient in a hospital",
    "Amputation of any body part",
    "Serious head or eye injury",
    "Serious burn",
    "Separation of skin from underlying tissue (degloving or scalping)",
    "Loss of bodily function / spinal injury",
    "Serious laceration",
    "Electric shock requiring medical treatment",
    "Any injury requiring immediate treatment for exposure to a substance",
  ],
  dangerousOccurrences: [
    "Uncontrolled collapse or partial collapse of a structure",
    "Explosion or fire",
    "Uncontrolled escape of gas, steam or pressurised substance",
    "Uncontrolled implosion, explosion or fire of gas or vapour",
    "Fall or release from height of plant, substance or thing",
    "Collapse or failure of excavation or shoring",
    "Inrush of water, mud or gas in underground excavation",
    "Collision between two vessels, vehicles or mobile plant",
    "Uncontrolled release of hazardous chemicals",
    "Contact with overhead power lines",
  ],
});

const PL_NOTIFIABLE = /** @type {NotifiableIncidentsContent} */ ({
  moduleId: "notifiable-incidents",
  viewIds: ["notifiable-incidents", "riddor"],
  badgeText: "PIP",
  title: "Zdarzenia wymagające zgłoszenia",
  lead: "Wypadek śmiertelny, ciężki lub zbiorowy — pracodawca zawiadamia niezwłocznie okręgowego inspektora pracy i prokuratora. Aplikacja nie składa zgłoszeń ustawowych.",
  exportModuleLabel: "Rejestr zdarzeń PIP",
  newReportLabel: "+ Nowy rekord zdarzenia",
  emptyLabel: "Brak rekordów zdarzeń.",
  wizardTitle: "Kreator zdarzenia PIP",
  wizardSubtitle: "Arkusz oceny zgłoszenia — Kodeks pracy / PIP",
  regulatorName: "Państwowa Inspekcja Pracy",
  regulatorUrl: "https://www.gov.pl/web/pip",
  regulatorLinkText: "Informacje PIP →",
  deadlinePrefix: "Zgłoszenie",
  reportedLabel: "Zgłoszono do PIP",
  notReportedBanner:
    "Zdarzenie nie zostało oznaczone jako zgłoszone. Przy wypadku śmiertelnym, ciężkim lub zbiorowym zawiadom okręgowego inspektora pracy i prokuratora niezwłocznie.",
  printTitle: "Zdarzenie — arkusz roboczy",
  printBanner:
    "Lokalny arkusz roboczy. Zawiadomienie PIP i prokuratora, protokół powypadkowy oraz statystyczna karta wypadku (Z-KW) pozostają obowiązkiem pracodawcy — ten dokument ich nie zastępuje.",
  saveLabel: "Zapisz rekord",
  types: {
    fatality: {
      label: "Wypadek śmiertelny",
      deadline: 1,
      form: "Zawiadomienie PIP i prokuratora",
      urgent: true,
      description: "Śmierć poszkodowanego na miejscu lub w okresie 6 miesięcy od wypadku przy pracy",
    },
    serious_injury: {
      label: "Wypadek ciężki",
      deadline: 1,
      form: "Zawiadomienie PIP i prokuratora",
      urgent: true,
      description:
        "Ciężkie uszkodzenie ciała: utrata wzroku, słuchu, mowy, zdolności rozrodczej, choroba nieuleczalna, trwała choroba psychiczna, znaczne trwałe zeszpecenie lub zniekształcenie ciała",
    },
    collective_accident: {
      label: "Wypadek zbiorowy",
      deadline: 1,
      form: "Zawiadomienie PIP i prokuratora",
      urgent: true,
      description: "Wypadek, któremu w wyniku tego samego zdarzenia uległy co najmniej dwie osoby",
    },
    dangerous_incident: {
      label: "Zdarzenie potencjalnie wypadkowe",
      deadline: 1,
      form: "Zgłoszenie PIP",
      urgent: true,
      description: "Zdarzenie mogące spowodować ciężki uraz — zawalenie, wybuch, upadek z wysokości, uwięzienie",
    },
    occupational_disease: {
      label: "Podejrzenie choroby zawodowej",
      deadline: null,
      form: "Zgłoszenie do PIS i PIP",
      urgent: false,
      description:
        "Podejrzenie choroby zawodowej zgłasza się właściwemu państwowemu inspektorowi sanitarnemu i okręgowemu inspektorowi pracy",
    },
    public_injury: {
      label: "Uraz osoby postronnej (ocena)",
      deadline: 1,
      form: "Zgłoszenie PIP",
      urgent: true,
      description: "Osoba postronna poszkodowana w związku z prowadzoną działalnością",
    },
  },
  specifiedInjuries: [
    "Utrata wzroku, słuchu, mowy lub zdolności rozrodczej",
    "Amputacja lub trwałe uszkodzenie kończyny",
    "Uszkodzenie ciała naruszające czynność narządu na okres powyżej 6 miesięcy",
    "Choroba nieuleczalna lub zagrażająca życiu",
    "Trwała choroba psychiczna",
    "Znaczne trwałe zeszpecenie lub zniekształcenie ciała",
    "Poważne oparzenie wymagające hospitalizacji",
    "Porażenie prądem wymagające leczenia szpitalnego",
    "Kontakt z substancją niebezpieczną wymagający leczenia",
  ],
  dangerousOccurrences: [
    "Zawalenie lub groźba zawalenia konstrukcji albo rusztowania",
    "Wybuch lub pożar",
    "Uwolnienie substancji niebezpiecznej",
    "Upadek przedmiotu z wysokości w strefę ruchu ludzi",
    "Zapadnięcie ścian wykopu",
    "Kolizja lub wywrócenie maszyny budowlanej",
    "Kontakt sprzętu lub ładunku z linią energetyczną",
    "Uwięzienie w przestrzeni zamkniętej",
    "Awaria urządzenia podlegającego dozorowi technicznemu (UDT)",
    "Uszkodzenie sieci gazowej lub kabla wysokiego napięcia",
  ],
});

const DE_NOTIFIABLE = /** @type {NotifiableIncidentsContent} */ ({
  moduleId: "notifiable-incidents",
  viewIds: ["notifiable-incidents", "riddor"],
  badgeText: "BG",
  title: "Meldepflichtige Ereignisse",
  lead: "Unfälle und schwere Ereignisse — unverzüglich der Berufsgenossenschaft und bei Bedarf der Arbeitsschutzbehörde anzeigen. Die App übermittelt keine gesetzlichen Meldungen.",
  exportModuleLabel: "Register meldepflichtiger Ereignisse",
  newReportLabel: "+ Neuer Ereignisdatensatz",
  emptyLabel: "Keine Ereignisdatensätze.",
  wizardTitle: "Unfallanzeige — Assistent",
  wizardSubtitle: "Bewertungsbogen — SGB VII / DGUV, keine behördliche Übermittlung",
  regulatorName: "BG BAU / Unfallversicherungsträger",
  regulatorUrl: "https://www.bgbau.de/service/angebote/unfallanzeige/",
  regulatorLinkText: "Unfallanzeige BG BAU →",
  deadlinePrefix: "Anzeige",
  reportedLabel: "Beim UVT angezeigt",
  notReportedBanner:
    "Dieses Ereignis ist noch nicht als angezeigt markiert. Tödliche und schwere Unfälle unverzüglich der Berufsgenossenschaft und der zuständigen Arbeitsschutzbehörde mitteilen.",
  printTitle: "Ereignis — Arbeitsblatt",
  printBanner:
    "Lokales Arbeitsblatt — ersetzt nicht die Unfallanzeige nach § 193 SGB VII. Tödliche Unfälle unverzüglich anzeigen.",
  saveLabel: "Datensatz speichern",
  types: {
    fatality: {
      label: "Tödlicher Unfall",
      deadline: 1,
      form: "Unfallanzeige UVT",
      urgent: true,
      description: "Tod einer beschäftigten oder anderen Person im Zusammenhang mit der Arbeit",
    },
    serious_injury: {
      label: "Schwerer Unfall",
      deadline: 3,
      form: "Unfallanzeige UVT",
      urgent: true,
      description: "Unfall mit Arbeitsunfähigkeit von mehr als drei Tagen, Amputation, Verlust des Sehvermögens, Stromunfall u. a.",
    },
    dangerous_incident: {
      label: "Beinaheunfall / gefährliches Ereignis",
      deadline: 3,
      form: "Interne Aufnahme",
      urgent: true,
      description: "Ereignis mit ernstem Risiko — Einsturz, Explosion, Absturz, Einschluss",
    },
    occupational_disease: {
      label: "Berufskrankheit (prüfen)",
      deadline: null,
      form: "Anzeige BK",
      urgent: false,
      description: "Verdacht auf Berufskrankheit — Anzeigepflicht mit Betriebsarzt und UVT klären",
    },
    public_injury: {
      label: "Verletzung Dritter (prüfen)",
      deadline: 1,
      form: "Anzeige prüfen",
      urgent: true,
      description: "Unbeteiligte Person durch die Arbeiten verletzt — Meldepflicht prüfen",
    },
  },
  specifiedInjuries: [
    "Arbeitsunfähigkeit von mehr als drei Kalendertagen",
    "Amputation",
    "Schwere Verbrennung",
    "Verlust oder schwere Schädigung des Sehvermögens",
    "Stromunfall mit Behandlungsbedarf",
    "Schädel-Hirn-Trauma / Wirbelsäulenverletzung",
    "Kontakt mit Gefahrstoff mit Behandlungsbedarf",
  ],
  dangerousOccurrences: [
    "Einsturz oder drohender Einsturz eines Bauwerks",
    "Explosion oder Brand",
    "Freisetzung eines Gefahrstoffs",
    "Herabfallen von Lasten",
    "Einsturz einer Baugrube",
    "Kollision von Baumaschinen",
    "Kontakt mit Freileitung",
    "Einschluss in einem engen Raum",
  ],
});

const AT_NOTIFIABLE = /** @type {NotifiableIncidentsContent} */ ({
  ...DE_NOTIFIABLE,
  badgeText: "AUVA",
  lead: "Unfälle und schwere Ereignisse — unverzüglich der AUVA und bei Bedarf der zuständigen Behörde anzeigen. Die App übermittelt keine gesetzlichen Meldungen.",
  wizardSubtitle: "Bewertungsbogen — ASVG / AUVA, keine behördliche Übermittlung",
  regulatorName: "AUVA",
  regulatorUrl: "https://www.auva.at/",
  regulatorLinkText: "AUVA Unfallmeldung →",
  reportedLabel: "Bei der AUVA angezeigt",
  notReportedBanner:
    "Dieses Ereignis ist noch nicht als angezeigt markiert. Tödliche und schwere Unfälle unverzüglich der AUVA und der zuständigen Behörde mitteilen.",
  printBanner:
    "Lokales Arbeitsblatt — ersetzt nicht die Unfallanzeige an die AUVA. Tödliche Unfälle unverzüglich anzeigen.",
});

const CH_NOTIFIABLE = /** @type {NotifiableIncidentsContent} */ ({
  ...DE_NOTIFIABLE,
  badgeText: "Suva",
  lead: "Unfälle und schwere Ereignisse — unverzüglich der Suva (oder dem zuständigen Unfallversicherer) und bei Bedarf dem kantonalen Arbeitsinspektorat melden. Die App übermittelt keine gesetzlichen Meldungen.",
  wizardSubtitle: "Bewertungsbogen — UVG / Suva, keine behördliche Übermittlung",
  regulatorName: "Suva",
  regulatorUrl: "https://www.suva.ch/",
  regulatorLinkText: "Suva Unfallmeldung →",
  reportedLabel: "Bei der Suva gemeldet",
  notReportedBanner:
    "Dieses Ereignis ist noch nicht als gemeldet markiert. Tödliche und schwere Unfälle unverzüglich der Suva und dem kantonalen Arbeitsinspektorat mitteilen.",
  printBanner:
    "Lokales Arbeitsblatt — ersetzt nicht die Unfallmeldung an die Suva. Tödliche Unfälle unverzüglich melden.",
});

/** @param {MarketId} [marketId] */
export function getNotifiableIncidentsContent(marketId = "uk") {
  if (marketId === "au") return AU_NOTIFIABLE;
  if (marketId === "pl") return PL_NOTIFIABLE;
  if (marketId === "de") return DE_NOTIFIABLE;
  if (marketId === "at") return AT_NOTIFIABLE;
  if (marketId === "ch") return CH_NOTIFIABLE;
  return UK_RIDDOR;
}

/** @param {string} viewId @param {MarketId} [marketId] */
export function isNotifiableIncidentsView(viewId, marketId = "uk") {
  return getNotifiableIncidentsContent(marketId).viewIds.includes(viewId);
}

/** Default incident type key for new records. */
export function defaultIncidentTypeKey(marketId = "uk") {
  if (marketId === "au" || marketId === "pl" || marketId === "de" || marketId === "at" || marketId === "ch") return "serious_injury";
  return "specified";
}

/** Form field `riddorType` stores the type key for both markets. */
export function getIncidentTypeDef(content, typeKey) {
  return content.types[typeKey] || content.types[Object.keys(content.types)[0]];
}
