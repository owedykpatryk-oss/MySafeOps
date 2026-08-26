/** @typedef {import("./markets").MarketId} MarketId */

import { assessCdmF10Notification } from "../utils/cdmF10Assessment";

/** @typedef {{
 *   moduleId: string;
 *   viewIds: string[];
 *   badgeText: string;
 *   title: string;
 *   lead: string;
 *   exportModuleLabel: string;
 *   newPackLabel: string;
 *   emptyLabel: string;
 *   infoBanner: string;
 *   packNoun: string;
 *   planShort: string;
 *   planFull: string;
 *   checklistLabel: string;
 *   notificationTitle: string;
 *   notificationBody: string;
 *   notifiableBadge: string;
 *   submittedBadge: string;
 *   locale: string;
 *   dutyholders: string[];
 *   planSections: { key: string; label: string; placeholder: string }[];
 *   dutyholderChecks: { k: string; label: string; sub: string }[];
 *   tabs: [string, string][];
 *   printFooter: string;
 * }} CompliancePackContent */

const UK_CDM = /** @type {CompliancePackContent} */ ({
  moduleId: "cdm",
  viewIds: ["cdm"],
  badgeText: "CDM",
  title: "CDM 2015 compliance",
  lead: "Construction Phase Plan, dutyholder checklist, F10 tracking, and CDM 2026 readiness fields (PCI / H&S File / role).",
  exportModuleLabel: "CDM register",
  newPackLabel: "+ New CDM pack",
  emptyLabel: "No CDM packs created yet.",
  infoBanner:
    "CDM 2015 applies to all construction projects. A Construction Phase Plan is required before any construction begins. Projects exceeding 30 working days (with 20+ simultaneous workers) or 500 person-days must be notified to HSE via F10.",
  packNoun: "CDM pack",
  planShort: "CPP",
  planFull: "Construction Phase Plan",
  checklistLabel: "CDM checklist",
  notificationTitle: "HSE F10 notification thresholds",
  notificationBody:
    "A project is notifiable to HSE if: construction phase will last longer than 30 working days with more than 20 workers simultaneously, OR exceeds 500 person-days of construction work. CDM 2026 reform may adjust thresholds — keep your F10 assessment under review.",
  notifiableBadge: "Notifiable",
  submittedBadge: "F10 submitted",
  locale: "en-GB",
  dutyholders: ["Client", "Principal Designer", "Principal Contractor", "Designer", "Contractor"],
  planSections: [
    { key: "projectDesc", label: "Project description and programme", placeholder: "Describe the construction works, phasing and programme…" },
    { key: "clientArrangements", label: "Client's management arrangements", placeholder: "Describe how the client will manage CDM duties, communication channels…" },
    { key: "pdArrangements", label: "Principal Designer's management arrangements", placeholder: "How will design risks be managed and communicated to contractors…" },
    { key: "pcArrangements", label: "Principal Contractor's management arrangements", placeholder: "Site management structure, supervision, competence assessment…" },
    { key: "siteRules", label: "Site rules", placeholder: "Access control, PPE requirements, permit to work system, welfare…" },
    { key: "welfare", label: "Welfare facilities", placeholder: "Toilets, washing, rest areas, drinking water, changing facilities…" },
    { key: "firstAid", label: "First aid arrangements", placeholder: "First aider name(s), first aid kit locations, nearest A&E…" },
    { key: "fire", label: "Fire and emergency arrangements", placeholder: "Evacuation procedure, muster points, emergency contacts…" },
    { key: "hazards", label: "Key project hazards and control measures", placeholder: "List significant hazards identified during design and pre-construction phase…" },
    { key: "asbestos", label: "Asbestos information", placeholder: "Summary of asbestos survey findings, location of register, management plan…" },
    { key: "services", label: "Existing services and underground hazards", placeholder: "Known utility services, results of service searches, safe dig procedures…" },
    { key: "trafficManagement", label: "Traffic management plan", placeholder: "Vehicle and pedestrian segregation, delivery management, banksman requirements…" },
    { key: "coordination", label: "Coordination between contractors", placeholder: "How multiple contractors will coordinate their activities, interface management…" },
    { key: "healthSurveillance", label: "Health surveillance", placeholder: "Any health monitoring required for specific hazards (silica, HAVs, asbestos, noise)…" },
  ],
  dutyholderChecks: [
    { k: "clientBriefed", label: "Client briefed on CDM 2015 duties", sub: "Client understands their duty to appoint PD and PC, provide pre-construction info" },
    { k: "pdAppointed", label: "Principal Designer formally appointed in writing", sub: "Written appointment before design work begins on notifiable projects" },
    { k: "pcAppointed", label: "Principal Contractor formally appointed in writing", sub: "Written appointment before construction phase begins" },
    { k: "preConInfoProvided", label: "Pre-construction information provided to all designers and contractors", sub: "Includes existing services, asbestos, ground conditions, constraints" },
    { k: "cppPrepared", label: "Construction Phase Plan prepared before construction begins", sub: "PC responsible; must be suitable and sufficient" },
    { k: "hsfPlanningStarted", label: "Health & Safety File planning commenced", sub: "PD responsible; to be handed to client on project completion" },
    { k: "f10Filed", label: "HSE F10 notification submitted (if notifiable)", sub: "Required 1+ weeks before construction phase begins on notifiable projects" },
    { k: "welfarePlanned", label: "Welfare facilities planned and confirmed adequate", sub: "Toilets, washing, rest area, drinking water before workers arrive on site" },
    { k: "siteRulesIssued", label: "Site rules issued to all contractors and visitors", sub: "PPE requirements, access, permit to work, emergency procedures" },
    { k: "competenceChecked", label: "Competence of all contractors checked", sub: "CSCS cards, qualifications, insurance, references reviewed" },
  ],
  tabs: [
    ["project", "Project"],
    ["dutyholders", "Dutyholders"],
    ["checklist", "CDM checklist"],
    ["cpp", "Construction Phase Plan"],
    ["preview", "Preview"],
  ],
  printFooter: "Generated by MySafeOps · CDM 2015 Regulations",
});

const AU_WHS = /** @type {CompliancePackContent} */ ({
  moduleId: "whs-plan",
  viewIds: ["whs-plan", "cdm"],
  badgeText: "WHS",
  title: "WHS management plan",
  lead: "Site WHS management plan, PCBU duty checklist, HRCW coordination, and emergency arrangements for Australian construction.",
  exportModuleLabel: "WHS plan register",
  newPackLabel: "+ New WHS plan",
  emptyLabel: "No WHS management plans created yet.",
  infoBanner:
    "Under the model WHS Act, a PCBU must manage risks to health and safety. For construction projects, prepare a WHS management plan before high-risk construction work starts. Confirm notification requirements with your state or territory regulator — thresholds differ from UK CDM/F10.",
  packNoun: "WHS plan",
  planShort: "WHS plan",
  planFull: "WHS management plan",
  checklistLabel: "WHS checklist",
  notificationTitle: "Regulator notification (guidance)",
  notificationBody:
    "Notification to your WHS regulator may be required for certain incidents and some classes of work. Keep evidence of your assessment — confirm thresholds with Safe Work Australia and your state/territory body (e.g. SafeWork NSW, WorkSafe VIC). This tool does not submit statutory notifications.",
  notifiableBadge: "Review notification",
  submittedBadge: "Regulator notified",
  locale: "en-AU",
  dutyholders: ["PCBU", "Principal contractor", "Officer", "Supervisor", "Subcontractor"],
  planSections: [
    { key: "projectDesc", label: "Project description and programme", placeholder: "Scope, phases, key trades and programme milestones…" },
    { key: "clientArrangements", label: "Client / project owner arrangements", placeholder: "How the client supports WHS, approvals, and communication…" },
    { key: "pdArrangements", label: "Design risk management", placeholder: "How design hazards are identified, eliminated or minimised before construction…" },
    { key: "pcArrangements", label: "Principal contractor arrangements", placeholder: "Site leadership, supervision, induction, subcontractor management…" },
    { key: "siteRules", label: "Site rules and access", placeholder: "PPE, sign-in, PTW, exclusion zones, visitor rules…" },
    { key: "welfare", label: "Welfare facilities", placeholder: "Amenities, drinking water, shade, amenities servicing…" },
    { key: "firstAid", label: "First aid and emergency", placeholder: "First aiders, kits, nearest ED, directions, 000 procedures…" },
    { key: "fire", label: "Fire and emergency response", placeholder: "Evacuation, muster points, warden roles, firefighting equipment…" },
    { key: "hazards", label: "Key hazards and controls", placeholder: "HRCW activities, SWMS references, residual risks…" },
    { key: "asbestos", label: "Asbestos / hazardous materials", placeholder: "Survey results, register, disturbance controls…" },
    { key: "services", label: "Services and DBYD", placeholder: "Dial Before You Dig, utility locates, isolation before excavation…" },
    { key: "trafficManagement", label: "Traffic and pedestrian management", placeholder: "Segregation, deliveries, public interface…" },
    { key: "coordination", label: "Contractor coordination", placeholder: "Interface meetings, simultaneous operations, SWMS exchange…" },
    { key: "healthSurveillance", label: "Health monitoring", placeholder: "Silica, noise, manual handling programmes where required…" },
  ],
  dutyholderChecks: [
    { k: "clientBriefed", label: "PCBU / client WHS duties understood", sub: "Officers and managers aware of due diligence obligations" },
    { k: "pdAppointed", label: "Design WHS risks addressed in pre-construction phase", sub: "Designers eliminate or minimise risks so far as reasonably practicable" },
    { k: "pcAppointed", label: "Principal contractor role confirmed", sub: "Written role for managing the construction project WHS plan" },
    { k: "preConInfoProvided", label: "Site information provided to all contractors", sub: "Drawings, surveys, services, asbestos, ground conditions" },
    { k: "cppPrepared", label: "WHS management plan prepared before work starts", sub: "Plan covers HRCW and site-specific rules" },
    { k: "hsfPlanningStarted", label: "Handover / as-built WHS information planned", sub: "O&M hazards and residual risks for future work" },
    { k: "f10Filed", label: "Regulator notification assessed (if required)", sub: "Document decision — do not rely on this app for statutory submission" },
    { k: "welfarePlanned", label: "Welfare adequate for expected workforce", sub: "Facilities before workers commence on site" },
    { k: "siteRulesIssued", label: "Site rules and induction completed", sub: "White Card, SWMS, PTW and emergency briefing" },
    { k: "competenceChecked", label: "Worker competency verified", sub: "White Card, HRWL, EWPA and trade tickets checked" },
  ],
  tabs: [
    ["project", "Project"],
    ["dutyholders", "Dutyholders"],
    ["checklist", "WHS checklist"],
    ["cpp", "WHS management plan"],
    ["preview", "Preview"],
  ],
  printFooter: "Generated by MySafeOps · Model WHS Act (AU) — confirm state requirements",
});

const PL_BHP = /** @type {CompliancePackContent} */ ({
  moduleId: "bhp-plan",
  viewIds: ["bhp-plan", "cdm"],
  badgeText: "BIOZ",
  title: "Plan BIOZ budowy",
  lead: "Plan BIOZ, lista kontrolna obowiązków, koordynacja podwykonawców i procedury awaryjne na budowie.",
  exportModuleLabel: "Rejestr planów BIOZ",
  newPackLabel: "+ Nowy plan BIOZ",
  emptyLabel: "Brak planów BIOZ — utwórz pierwszy dla inwestycji.",
  infoBanner:
    "Kierownik budowy sporządza plan BIOZ przed rozpoczęciem robót, na podstawie informacji BIOZ od projektanta. Roboty szczególnie niebezpieczne wymagają IBWR, pisemnego zezwolenia i bezpośredniego nadzoru. Zawiadomienia do PIP i prokuratora pozostają obowiązkiem pracodawcy — ta aplikacja ich nie składa.",
  packNoun: "Plan BIOZ",
  planShort: "Plan BIOZ",
  planFull: "Plan bezpieczeństwa i ochrony zdrowia",
  checklistLabel: "Lista kontrolna BIOZ",
  notificationTitle: "Zawiadomienia PIP (informacja)",
  notificationBody:
    "Wypadek śmiertelny, ciężki lub zbiorowy pracodawca zgłasza niezwłocznie okręgowemu inspektorowi pracy i prokuratorowi. Zawiadomienie o zamiarze rozpoczęcia robót składa się do PIP i nadzoru budowlanego, gdy roboty trwają dłużej niż 30 dni roboczych i pracuje przy nich co najmniej 20 osób albo pracochłonność przekracza 500 osobodni. Dokumentuj ocenę — aplikacja nie składa zgłoszeń urzędowych.",
  notifiableBadge: "Sprawdź zgłoszenie",
  submittedBadge: "Zgłoszono do PIP",
  locale: "pl-PL",
  dutyholders: ["Inwestor", "Projektant (informacja BIOZ)", "Kierownik budowy", "Koordynator ds. BHP", "Podwykonawca"],
  planSections: [
    { key: "projectDesc", label: "Zakres i kolejność realizacji robót", placeholder: "Rodzaj robót, etapy, terminy, technologia…" },
    { key: "clientArrangements", label: "Wykaz istniejących obiektów budowlanych", placeholder: "Obiekty na terenie i w sąsiedztwie, ich stan i sposób zabezpieczenia…" },
    { key: "pdArrangements", label: "Elementy zagospodarowania stwarzające zagrożenie", placeholder: "Sieci, skarpy, zbiorniki, linie napowietrzne, ruch drogowy…" },
    { key: "pcArrangements", label: "Przewidywane zagrożenia podczas robót", placeholder: "Rodzaj, skala i miejsce występowania oraz czas trwania zagrożeń…" },
    { key: "siteRules", label: "Sposób prowadzenia instruktażu przed robotami", placeholder: "Instruktaż stanowiskowy, omówienie IBWR, potwierdzenia podpisami…" },
    { key: "hazards", label: "Środki techniczne i organizacyjne zapobiegające zagrożeniom", placeholder: "Ochrony zbiorowe, zezwolenia, nadzór, wygrodzenia stref…" },
    { key: "coordination", label: "Koordynacja robót wielu wykonawców", placeholder: "Koordynator BHP, narady, wymiana IBWR, rozdzielenie robót kolidujących…" },
    { key: "services", label: "Uzbrojenie terenu i media", placeholder: "Mapa uzbrojenia, uzgodnienia gestorów, zasilanie placu budowy…" },
    { key: "trafficManagement", label: "Komunikacja i transport na terenie", placeholder: "Drogi, ciągi piesze, dostawy, strefy pracy maszyn, wjazd/wyjazd…" },
    { key: "welfare", label: "Zaplecze higienicznosanitarne", placeholder: "Szatnie, umywalnie, toalety, jadalnia, woda zdatna do picia…" },
    { key: "firstAid", label: "Pierwsza pomoc i miejsce jej udzielania", placeholder: "Osoby wyznaczone, apteczki, punkt pierwszej pomocy, 112…" },
    { key: "fire", label: "Ochrona przeciwpożarowa i ewakuacja", placeholder: "Sprzęt gaśniczy, drogi ewakuacyjne, punkt zbiórki, prace pożarowo niebezpieczne…" },
    { key: "asbestos", label: "Substancje niebezpieczne i azbest", placeholder: "Inwentaryzacja, karty charakterystyki, zgłoszenia i sposób prowadzenia prac…" },
    { key: "healthSurveillance", label: "Miejsce przechowywania dokumentacji i badania", placeholder: "Gdzie znajduje się plan BIOZ, IBWR, badania i szkolenia; pomiary czynników szkodliwych…" },
  ],
  dutyholderChecks: [
    { k: "clientBriefed", label: "Obowiązki inwestora ustalone", sub: "Zakres, terminy i przekazanie terenu budowy" },
    { k: "pdAppointed", label: "Informacja BIOZ od projektanta otrzymana", sub: "Podstawa do sporządzenia planu BIOZ" },
    { k: "pcAppointed", label: "Kierownik budowy z uprawnieniami wyznaczony", sub: "Oświadczenie o przyjęciu obowiązków w dzienniku budowy" },
    { k: "preConInfoProvided", label: "Koordynator ds. BHP wyznaczony na piśmie", sub: "Gdy na terenie pracuje więcej niż jeden pracodawca" },
    { k: "cppPrepared", label: "Plan BIOZ sporządzony przed rozpoczęciem robót", sub: "Część opisowa i rysunkowa, dostępna na budowie" },
    { k: "hsfPlanningStarted", label: "Wykaz robót szczególnie niebezpiecznych ustalony", sub: "IBWR i zezwolenia przypisane do tych robót" },
    { k: "f10Filed", label: "Zawiadomienie o rozpoczęciu robót ocenione", sub: "PIP i nadzór budowlany — powyżej 30 dni i 20 osób lub 500 osobodni" },
    { k: "welfarePlanned", label: "Zaplecze higienicznosanitarne zapewnione", sub: "Przed dopuszczeniem pracowników na teren" },
    { k: "siteRulesIssued", label: "Instruktaż i regulamin placu budowy wydane", sub: "IBWR, zezwolenia, 112, procedury awaryjne" },
    { k: "competenceChecked", label: "Kwalifikacje, badania i szkolenia zweryfikowane", sub: "UDT, SEP, uprawnienia budowlane, badania profilaktyczne, szkolenia BHP" },
  ],
  tabs: [
    ["project", "Inwestycja"],
    ["dutyholders", "Role"],
    ["checklist", "Lista BIOZ"],
    ["cpp", "Plan BIOZ"],
    ["preview", "Podgląd"],
  ],
  printFooter: "Wygenerowano w MySafeOps · plan BIOZ wg rozporządzenia MI z 23.06.2003 — zweryfikuj zakres dla swojej inwestycji",
});

const DE_SIGE = /** @type {CompliancePackContent} */ ({
  moduleId: "sige-plan",
  viewIds: ["sige-plan", "cdm"],
  badgeText: "SiGe",
  title: "SiGe-Plan (BaustellV)",
  lead: "Sicherheits- und Gesundheitsschutzplan, Koordinator-Checkliste, Vorankündigung und Notfallregelungen für deutsche Baustellen.",
  exportModuleLabel: "SiGe-Plan-Register",
  newPackLabel: "+ Neuer SiGe-Plan",
  emptyLabel: "Noch keine SiGe-Pläne angelegt.",
  infoBanner:
    "Die Baustellenverordnung gilt für Baustellen, auf denen Beschäftigte mehrerer Arbeitgeber tätig werden. Ein SiGe-Plan und ein Koordinator (SiGeKo) sind erforderlich, wenn besonders gefährliche Arbeiten nach Anhang II vorliegen oder die Vorankündigungsschwelle erreicht ist. Diese App übermittelt keine behördlichen Meldungen.",
  packNoun: "SiGe-Plan",
  planShort: "SiGe-Plan",
  planFull: "Sicherheits- und Gesundheitsschutzplan",
  checklistLabel: "SiGe-Checkliste",
  notificationTitle: "Vorankündigung nach BaustellV",
  notificationBody:
    "Eine Vorankündigung an die zuständige Behörde ist erforderlich, wenn die voraussichtliche Dauer der Arbeiten mehr als 30 Arbeitstage beträgt und mehr als 20 Beschäftigte gleichzeitig tätig werden, oder wenn das Volumen 500 Personentage überschreitet. Fristen und Formular bei der zuständigen Arbeitsschutzbehörde des Landes prüfen.",
  notifiableBadge: "Vorankündigung prüfen",
  submittedBadge: "Vorankündigung abgegeben",
  locale: "de-DE",
  dutyholders: ["Bauherr", "Koordinator (SiGeKo)", "Arbeitgeber", "Nachunternehmer", "Fachkraft für Arbeitssicherheit"],
  planSections: [
    { key: "projectDesc", label: "Vorhaben und Bauablauf", placeholder: "Leistungen, Phasen, Gewerke, Termine…" },
    { key: "clientArrangements", label: "Regelungen des Bauherrn", placeholder: "Pflichten, Freigaben, Ansprechpartner…" },
    { key: "pdArrangements", label: "Planungsphase / Koordination", placeholder: "Gefahren aus der Planung, SiGeKo Planung, Unterlagen für spätere Arbeiten…" },
    { key: "pcArrangements", label: "Ausführungsphase / Koordination", placeholder: "SiGeKo Ausführung, Aufsicht, Nachunternehmer, Einweisung…" },
    { key: "siteRules", label: "Baustellenordnung", placeholder: "PSA, Zutritt, Erlaubnisscheine, Sperrzonen…" },
    { key: "welfare", label: "Sozialräume und Einrichtungen", placeholder: "Toiletten, Waschen, Pausenraum, Trinkwasser — ArbStättV…" },
    { key: "firstAid", label: "Erste Hilfe", placeholder: "Ersthelfer, Verbandkästen, nächstes Krankenhaus, 112…" },
    { key: "fire", label: "Brandschutz und Evakuierung", placeholder: "Fluchtwege, Sammelplatz, Feuerlöscher…" },
    { key: "hazards", label: "Wesentliche Gefährdungen und Maßnahmen", placeholder: "Besonders gefährliche Arbeiten, Verweise auf GBU…" },
    {
      key: "anhangII",
      label: "Anhang II — besonders gefährliche Arbeiten",
      placeholder:
        "Welche Anhang-II-Arbeiten gelten? (Absturz, Verschüttung, Explosion, Gefahrstoffe, Hochspannung, Abbruch, Fertigteile…) — benannte Maßnahmen, Gewerk, Erlaubnisschein/Freigabe…",
    },
    { key: "asbestos", label: "Asbest / Gefahrstoffe", placeholder: "Erkundung, Verzeichnis, Arbeitsverfahren…" },
    { key: "services", label: "Leitungen und Erdkabel", placeholder: "Bestandspläne, Ortung, Freilegung vor Aushub…" },
    { key: "trafficManagement", label: "Verkehr auf der Baustelle", placeholder: "Anlieferung, Fußgänger, öffentliche Straße…" },
    { key: "coordination", label: "Gewerkekoordination", placeholder: "SiGe-Besprechungen, gleichzeitige Arbeiten, Austausch der GBU…" },
    { key: "healthSurveillance", label: "Arbeitsmedizinische Vorsorge", placeholder: "Lärm, Staub, Hand-Arm-Vibration — soweit vorgeschrieben…" },
  ],
  dutyholderChecks: [
    { k: "clientBriefed", label: "Pflichten des Bauherrn geklärt", sub: "Bestellung SiGeKo, Vorankündigung, Unterlage für spätere Arbeiten" },
    { k: "pdAppointed", label: "Koordinator für die Planungsphase bestellt", sub: "Schriftlich, rechtzeitig vor Aufnahme der Planungsarbeiten" },
    { k: "pcAppointed", label: "Koordinator für die Ausführungsphase bestellt", sub: "Schriftlich vor Beginn der Bauarbeiten" },
    { k: "preConInfoProvided", label: "Unterlagen an Unternehmen übergeben", sub: "Bestand, Asbest, Boden, Leitungen, Randbedingungen" },
    { k: "cppPrepared", label: "SiGe-Plan vor Arbeitsbeginn erstellt", sub: "Besonders gefährliche Arbeiten nach Anhang II berücksichtigt" },
    {
      k: "anhangIIMapped",
      label: "Anhang-II-Arbeiten benannt und mit Freigabe verknüpft",
      sub: "Keine allgemeinen Hinweise — konkrete Maßnahmen, Gewerk und Erlaubnisschein wo nötig",
    },
    { k: "hsfPlanningStarted", label: "Unterlage für spätere Arbeiten geplant", sub: "Übergabe an den Bauherrn nach Fertigstellung" },
    { k: "f10Filed", label: "Vorankündigung bewertet (falls erforderlich)", sub: "Entscheidung dokumentieren — keine Meldung über diese App" },
    { k: "welfarePlanned", label: "Sozialräume vorgesehen", sub: "Vor dem Einsatz der Beschäftigten" },
    { k: "siteRulesIssued", label: "Baustellenordnung und Einweisung", sub: "GBU, Erlaubnisschein, 112, Notfall" },
    { k: "competenceChecked", label: "Qualifikation geprüft", sub: "SCC, SiGeKo, Sifa, Ersthelfer, Geräteführerscheine" },
  ],
  tabs: [
    ["project", "Vorhaben"],
    ["dutyholders", "Pflichtenträger"],
    ["checklist", "SiGe-Checkliste"],
    ["cpp", "SiGe-Plan"],
    ["preview", "Vorschau"],
  ],
  printFooter: "Erstellt mit MySafeOps · BaustellV / ArbSchG — örtliche Anforderungen prüfen",
});

const AT_SIGE = /** @type {CompliancePackContent} */ ({
  ...DE_SIGE,
  title: "SiGe-Plan (BauKG)",
  lead: "Sicherheits- und Gesundheitsschutzplan, Koordinator-Checkliste, Vorankündigung und Notfallregelungen für österreichische Baustellen.",
  infoBanner:
    "Das BauKG gilt für Baustellen, auf denen Beschäftigte mehrerer Arbeitgeber tätig werden. Ein SiGe-Plan und ein Koordinator (SiGeKo) sind erforderlich, wenn besonders gefährliche Arbeiten vorliegen oder die Vorankündigungsschwelle erreicht ist. Diese App übermittelt keine behördlichen Meldungen.",
  notificationTitle: "Vorankündigung nach BauKG",
  notificationBody:
    "Eine Vorankündigung an die zuständige Behörde ist erforderlich, wenn die voraussichtliche Dauer der Arbeiten mehr als 30 Arbeitstage beträgt und mehr als 20 Beschäftigte gleichzeitig tätig werden, oder wenn das Volumen 500 Personentage überschreitet. Fristen und Formular bei der zuständigen Behörde prüfen.",
  locale: "de-AT",
  planSections: DE_SIGE.planSections.map((section) => {
    if (section.key === "anhangII") {
      return {
        ...section,
        label: "Besonders gefährliche Arbeiten (BauKG)",
        placeholder:
          "Welche besonders gefährlichen Arbeiten gelten? (Absturz, Verschüttung, Explosion, Gefahrstoffe, Hochspannung, Abbruch, Fertigteile…) — benannte Maßnahmen, Gewerk, Arbeitsfreigabe…",
      };
    }
    if (section.key === "hazards") {
      return { ...section, placeholder: "Wesentliche Gefährdungen und Maßnahmen — Verweise auf Evaluierung…" };
    }
    if (section.key === "coordination") {
      return { ...section, placeholder: "SiGe-Besprechungen, gleichzeitige Arbeiten, Austausch der Evaluierungen…" };
    }
    if (section.key === "welfare") {
      return { ...section, placeholder: "Toiletten, Waschen, Pausenraum, Trinkwasser — AStV…" };
    }
    return section;
  }),
  dutyholderChecks: DE_SIGE.dutyholderChecks.map((row) => {
    if (row.k === "cppPrepared") {
      return { ...row, sub: "Besonders gefährliche Arbeiten nach BauKG berücksichtigt" };
    }
    if (row.k === "anhangIIMapped") {
      return {
        ...row,
        label: "Besonders gefährliche Arbeiten benannt und mit Freigabe verknüpft",
        sub: "Keine allgemeinen Hinweise — konkrete Maßnahmen, Gewerk und Arbeitsfreigabe wo nötig",
      };
    }
    if (row.k === "siteRulesIssued") {
      return { ...row, sub: "Evaluierung, Erlaubnisschein, 112, Notfall" };
    }
    if (row.k === "competenceChecked") {
      return { ...row, sub: "BauKG-Koordinator, Sicherheitsfachkraft, Ersthelfer, Geräteführerscheine" };
    }
    return row;
  }),
  printFooter: "Erstellt mit MySafeOps · BauKG / ASchG — örtliche Anforderungen prüfen",
});

const CH_SIKO = /** @type {CompliancePackContent} */ ({
  ...DE_SIGE,
  title: "SiKo (BauAV Art. 4)",
  lead: "Sicherheits- und Gesundheitsschutzkonzept, Notfallorganisation und Prüfungen für Schweizer Baustellen — vor Baubeginn erforderlich.",
  infoBanner:
    "Die BauAV verlangt für jede Baustelle ein schriftliches Sicherheits- und Gesundheitsschutzkonzept (SiKo) vor Baubeginn, inklusive Notfallorganisation (Art. 4). Suva kann die Umsetzung kontrollieren. Diese App übermittelt keine behördlichen Meldungen.",
  notificationTitle: "SiKo vor Baubeginn",
  notificationBody:
    "Ein schriftliches SiKo muss vor Baubeginn vorliegen — unabhängig von der Anzahl Arbeitgeber auf der Baustelle. Es deckt Gefährdungen, Massnahmen und die Notfallorganisation ab. Es gibt keine Meldeschwelle wie bei einer Vorankündigung; die Verantwortung liegt durchgehend beim Arbeitgeber.",
  notifiableBadge: "SiKo prüfen",
  submittedBadge: "SiKo erstellt",
  locale: "de-CH",
  dutyholders: ["Bauherrschaft", "Bauleitung", "Arbeitgeber", "Nachunternehmer", "Sicherheitsbeauftragter"],
  planSections: DE_SIGE.planSections.map((section) => {
    if (section.key === "anhangII") {
      return {
        ...section,
        label: "Besonders gefährliche Arbeiten (BauAV)",
        placeholder:
          "Welche besonders gefährlichen Arbeiten gelten? (Absturz, Verschüttung, Explosion, Gefahrstoffe, Hochspannung, Abbruch, Fertigteile…) — benannte Massnahmen, Gewerk, Freigabe…",
      };
    }
    if (section.key === "hazards") {
      return { ...section, placeholder: "Wesentliche Gefährdungen und Massnahmen — Verweise auf Gefährdungsermittlung…" };
    }
    if (section.key === "coordination") {
      return { ...section, placeholder: "Baustellensitzungen, gleichzeitige Arbeiten, Austausch der Gefährdungsermittlungen…" };
    }
    if (section.key === "welfare") {
      return { ...section, placeholder: "Toiletten, Waschen, Pausenraum, Trinkwasser — ArGV…" };
    }
    if (section.key === "siteRules") {
      return { ...section, placeholder: "PSA, Zutritt, Freigaben, Sperrzonen…" };
    }
    if (section.key === "firstAid") {
      return { ...section, placeholder: "Ersthelfer, Verbandkästen, nächstes Spital, 112/144…" };
    }
    return section;
  }),
  dutyholderChecks: DE_SIGE.dutyholderChecks.map((row) => {
    if (row.k === "clientBriefed") {
      return { ...row, label: "Pflichten der Bauherrschaft geklärt", sub: "SiKo vor Baubeginn, Notfallorganisation" };
    }
    if (row.k === "pdAppointed" || row.k === "pcAppointed") {
      return { ...row, label: "Bauleitung für die Phase bestimmt", sub: "Schriftlich vor Beginn der jeweiligen Phase" };
    }
    if (row.k === "cppPrepared") {
      return { ...row, label: "SiKo vor Arbeitsbeginn erstellt", sub: "Besonders gefährliche Arbeiten nach BauAV berücksichtigt" };
    }
    if (row.k === "anhangIIMapped") {
      return {
        ...row,
        label: "Besonders gefährliche Arbeiten benannt und mit Freigabe verknüpft",
        sub: "Keine allgemeinen Hinweise — konkrete Massnahmen, Gewerk und Freigabe wo nötig",
      };
    }
    if (row.k === "f10Filed") {
      return { ...row, label: "SiKo-Umfang geprüft", sub: "Keine behördliche Meldung über diese App — Suva kann kontrollieren" };
    }
    if (row.k === "siteRulesIssued") {
      return { ...row, sub: "Gefährdungsermittlung, Freigabe, 112/144, Notfallorganisation" };
    }
    if (row.k === "competenceChecked") {
      return { ...row, sub: "Sicherheitsbeauftragter, Suva-anerkannte Fachperson, Ersthelfer, Geräteführerscheine" };
    }
    return row;
  }),
  tabs: [
    ["project", "Vorhaben"],
    ["dutyholders", "Pflichtenträger"],
    ["checklist", "SiKo-Checkliste"],
    ["cpp", "SiKo"],
    ["preview", "Vorschau"],
  ],
  printFooter: "Erstellt mit MySafeOps · BauAV Art. 4 / EKAS — örtliche Anforderungen prüfen",
});

/** @param {MarketId} [marketId] */
export function getCompliancePackContent(marketId = "uk") {
  if (marketId === "au") return AU_WHS;
  if (marketId === "pl") return PL_BHP;
  if (marketId === "de") return DE_SIGE;
  if (marketId === "at") return AT_SIGE;
  if (marketId === "ch") return CH_SIKO;
  return UK_CDM;
}

/** @param {string} viewId @param {MarketId} [marketId] */
export function isCompliancePackView(viewId, marketId = "uk") {
  const content = getCompliancePackContent(marketId);
  return content.viewIds.includes(viewId);
}

function num(value) {
  const n = parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

/** Country notification flag — mirrors UK F10 assessment shape for UI badges. */
export function assessComplianceNotification(form, marketId = "uk") {
  if (marketId === "uk") {
    return assessCdmF10Notification(form);
  }
  const workers = num(form?.estimatedWorkers);
  const personDays = num(form?.estimatedPersonDays);
  const workingDays = num(form?.calendarPhaseDays);
  const reasons = [];
  if (marketId === "pl") {
    if (workingDays > 30 && workers >= 20) {
      reasons.push(`${workingDays} dni roboczych i ${workers} pracowników jednocześnie — zawiadomienie PIP i plan BIOZ wymagają sprawdzenia`);
    }
    if (personDays > 500) {
      reasons.push(`${personDays} osobodni — próg zawiadomienia PIP i planu BIOZ został przekroczony`);
    }
  } else if (marketId === "de" || marketId === "at") {
    const statute = marketId === "at" ? "BauKG" : "BaustellV";
    if (workers > 20 && workingDays > 30) {
      reasons.push(`${workingDays} Arbeitstage mit ${workers} Beschäftigten gleichzeitig — Vorankündigung nach ${statute} prüfen`);
    }
    if (personDays > 500) {
      reasons.push(`${personDays} Personentage — Vorankündigungsschwelle nach ${statute} prüfen`);
    }
  } else if (marketId === "ch") {
    // BauAV Art. 4 has no Vorankündigung-style threshold — SiKo is required before
    // Baubeginn regardless of headcount. Flag scale for the SiKo itself, not a filing.
    if (workers >= 20) {
      reasons.push(`${workers} Beschäftigte gleichzeitig — SiKo-Umfang und Notfallorganisation prüfen`);
    }
    if (personDays >= 500) {
      reasons.push(`${personDays} Personentage — SiKo-Umfang und Koordination mit Nachunternehmern prüfen`);
    }
    if (workingDays > 30 && workers > 10) {
      reasons.push(`${workingDays} Arbeitstage mit ${workers} Beschäftigten — SiKo aktuell halten`);
    }
  } else {
    if (workers >= 20) {
      reasons.push(`${workers} simultaneous workers — confirm notification rules with your regulator`);
    }
    if (personDays >= 500) {
      reasons.push(`${personDays} person-days — confirm project notification thresholds`);
    }
    if (workingDays > 30 && workers > 20) {
      reasons.push(`${workingDays} calendar days with ${workers} workers`);
    }
  }
  const notifiable = reasons.length > 0;
  const f10Submitted = Boolean(form?.f10Submitted);
  const f10Date = form?.f10Date ? String(form.f10Date).slice(0, 10) : null;
  return {
    notifiable,
    personDays,
    workingDays,
    maxWorkers: workers,
    reasons,
    f10Required: notifiable,
    f10Submitted,
    f10Date,
  };
}
