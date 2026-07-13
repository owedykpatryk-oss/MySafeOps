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
  lead: "Poważne wypadki przy pracy i zdarzenia potencjalnie wypadkowe — zgłoś niezwłocznie do PIP. Aplikacja nie składa zgłoszeń ustawowych.",
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
    "Zdarzenie nie zostało oznaczone jako zgłoszone do PIP. W razie wątpliwości skontaktuj się z PIP niezwłocznie.",
  printTitle: "Zdarzenie — arkusz roboczy",
  printBanner:
    "Lokalny arkusz — przy wypadku śmiertelnym lub ciężkim zgłoś do PIP zgodnie z przepisami. Nie zastępuje zgłoszenia urzędowego.",
  saveLabel: "Zapisz rekord",
  types: {
    fatality: {
      label: "Śmierć",
      deadline: 1,
      form: "Zgłoszenie PIP",
      urgent: true,
      description: "Śmierć pracownika lub innej osoby w związku z pracą",
    },
    serious_injury: {
      label: "Ciężki uraz",
      deadline: 1,
      form: "Zgłoszenie PIP",
      urgent: true,
      description: "Uraz powodujący ciężkie naruszenie zdrowia, amputację, utratę wzroku, porażenie prądem itp.",
    },
    dangerous_incident: {
      label: "Zdarzenie potencjalnie wypadkowe",
      deadline: 1,
      form: "Zgłoszenie PIP",
      urgent: true,
      description: "Zdarzenie mogące spowodować ciężki uraz — zawalenie, wybuch, upadek z wysokości, uwięzienie",
    },
    occupational_disease: {
      label: "Choroba zawodowa (ocena)",
      deadline: null,
      form: "Zgłoszenie PIP",
      urgent: false,
      description: "Choroba zawodowa — potwierdź obowiązek zgłoszenia z lekarzem i PIP",
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
    "Ciężkie naruszenie zdrowia wymagające hospitalizacji",
    "Amputacja",
    "Poważne oparzenie",
    "Utrata wzroku lub poważne uszkodzenie oczu",
    "Porażenie prądem wymagające leczenia",
    "Wstrząśnienie mózgu / uraz kręgosłupa",
    "Kontakt z substancją niebezpieczną wymagający leczenia",
  ],
  dangerousOccurrences: [
    "Zawalenie lub groźba zawalenia konstrukcji",
    "Wybuch lub pożar",
    "Uwolnienie substancji niebezpiecznej",
    "Upadek przedmiotu z wysokości",
    "Zapadnięcie wykopu",
    "Kolizja maszyn budowlanych",
    "Kontakt z linią energetyczną",
    "Uwięzienie w przestrzeni zamkniętej",
  ],
});

/** @param {MarketId} [marketId] */
export function getNotifiableIncidentsContent(marketId = "uk") {
  if (marketId === "au") return AU_NOTIFIABLE;
  if (marketId === "pl") return PL_NOTIFIABLE;
  return UK_RIDDOR;
}

/** @param {string} viewId @param {MarketId} [marketId] */
export function isNotifiableIncidentsView(viewId, marketId = "uk") {
  return getNotifiableIncidentsContent(marketId).viewIds.includes(viewId);
}

/** Default incident type key for new records. */
export function defaultIncidentTypeKey(marketId = "uk") {
  if (marketId === "au" || marketId === "pl") return "serious_injury";
  return "specified";
}

/** Form field `riddorType` stores the type key for both markets. */
export function getIncidentTypeDef(content, typeKey) {
  return content.types[typeKey] || content.types[Object.keys(content.types)[0]];
}
