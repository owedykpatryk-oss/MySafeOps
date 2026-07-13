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
  badgeText: "BHP",
  title: "Plan BHP budowy",
  lead: "Plan BHP, lista kontrolna obowiązków, koordynacja podwykonawców i procedury awaryjne na budowie.",
  exportModuleLabel: "Rejestr planów BHP",
  newPackLabel: "+ Nowy plan BHP",
  emptyLabel: "Brak planów BHP — utwórz pierwszy dla inwestycji.",
  infoBanner:
    "Przy robotach budowlanych pracodawca/koordynator BHP przygotowuje plan BHP przed rozpoczęciem prac. Roboty szczególnie niebezpieczne wymagają IOR i często pozwolenia na pracę. Zgłoszenia do PIP — według przepisów; ta aplikacja nie składa zgłoszeń urzędowych.",
  packNoun: "Plan BHP",
  planShort: "Plan BHP",
  planFull: "Plan bezpieczeństwa i higieny pracy",
  checklistLabel: "Lista kontrolna BHP",
  notificationTitle: "Zgłoszenia PIP (informacja)",
  notificationBody:
    "Poważne wypadki przy pracy i niektóre zdarzenia wymagają niezwłocznego zgłoszenia do Państwowej Inspekcji Pracy. Dokumentuj ocenę — nie polegaj na tej aplikacji przy zgłoszeniu ustawowym.",
  notifiableBadge: "Sprawdź zgłoszenie",
  submittedBadge: "Zgłoszono do PIP",
  locale: "pl-PL",
  dutyholders: ["Inwestor", "Koordynator BHP", "Kierownik budowy", "Podwykonawca", "Pracodawca usługowy"],
  planSections: [
    { key: "projectDesc", label: "Opis inwestycji i harmonogram", placeholder: "Zakres robót, etapy, kluczowe branże…" },
    { key: "clientArrangements", label: "Ustalenia z inwestorem", placeholder: "Kontakt, decyzje, zatwierdzenia dokumentów BHP…" },
    { key: "pdArrangements", label: "Zagrożenia projektowe", placeholder: "Identyfikacja i minimalizacja ryzyka na etapie projektu…" },
    { key: "pcArrangements", label: "Organizacja prac na budowie", placeholder: "Nadzór, kwalifikacje, podwykonawcy, szkolenia wstępne…" },
    { key: "siteRules", label: "Regulamin placu budowy", placeholder: "PPE, meldunek, PTW, strefy wyłączone…" },
    { key: "welfare", label: "Sanitariaty i zaplecze", placeholder: "Toalety, woda, ogrzewanie/ochrona przed słońcem…" },
    { key: "firstAid", label: "Pierwsza pomoc", placeholder: "Osoby wyznaczone, apteczki, SOR, numer 112…" },
    { key: "fire", label: "Pożar i ewakuacja", placeholder: "Trasy ewakuacji, punkty zbiórki, sprzęt gaśniczy…" },
    { key: "hazards", label: "Kluczowe zagrożenia i środki", placeholder: "Roboty szczególnie niebezpieczne, odniesienia do IOR…" },
    { key: "asbestos", label: "Azbest / materiały niebezpieczne", placeholder: "Inwentaryzacja, rejestr, procedury prac…" },
    { key: "services", label: "Uzbrojenie terenu", placeholder: "Mapy sieci, lokalizacja, prace wykopaliskowe…" },
    { key: "trafficManagement", label: "Ruch na budowie", placeholder: "Dostawy, piesi, interfejs z drogą publiczną…" },
    { key: "coordination", label: "Koordynacja branż", placeholder: "Spotkania BHP, jednoczesne roboty, wymiana IOR…" },
    { key: "healthSurveillance", label: "Badania i monitoring zdrowia", placeholder: "Hałas, pył, ręce — gdy wymagane…" },
  ],
  dutyholderChecks: [
    { k: "clientBriefed", label: "Obowiązki inwestora/pracodawcy omówione", sub: "Znajomość odpowiedzialności za BHP na budowie" },
    { k: "pdAppointed", label: "Zagrożenia projektowe zidentyfikowane", sub: "Dokumentacja przekazana wykonawcom przed startem" },
    { k: "pcAppointed", label: "Koordynator/kierownik BHP wyznaczony", sub: "Pisemne pełnienie funkcji koordynacji" },
    { k: "preConInfoProvided", label: "Informacja o placu budowy przekazana", sub: "Geotechnika, uzbrojenie, azbest, warunki gruntowe" },
    { k: "cppPrepared", label: "Plan BHP przygotowany przed robotami", sub: "Uwzględnia roboty szczególnie niebezpieczne" },
    { k: "hsfPlanningStarted", label: "Dokumentacja powykonawcza BHP zaplanowana", sub: "Przekazanie informacji o pozostałych zagrożeniach" },
    { k: "f10Filed", label: "Ocena zgłoszenia do PIP (jeśli dotyczy)", sub: "Zapis decyzji — brak zgłoszenia w aplikacji" },
    { k: "welfarePlanned", label: "Sanitariaty zapewnione", sub: "Przed dopuszczeniem pracowników na teren" },
    { k: "siteRulesIssued", label: "Regulamin i szkolenie wstępne", sub: "IOR, PTW, 112, procedury awaryjne" },
    { k: "competenceChecked", label: "Kwalifikacje zweryfikowane", sub: "UDT, SEP, uprawnienia budowlane, szkolenia BHP" },
  ],
  tabs: [
    ["project", "Inwestycja"],
    ["dutyholders", "Role"],
    ["checklist", "Lista BHP"],
    ["cpp", "Plan BHP"],
    ["preview", "Podgląd"],
  ],
  printFooter: "Wygenerowano w MySafeOps · przepisy BHP PL — zweryfikuj lokalne wymagania",
});

/** @param {MarketId} [marketId] */
export function getCompliancePackContent(marketId = "uk") {
  if (marketId === "au") return AU_WHS;
  if (marketId === "pl") return PL_BHP;
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

/** Simplified AU/PL notification flag — mirrors UK F10 assessment shape for UI badges. */
export function assessComplianceNotification(form, marketId = "uk") {
  if (marketId === "uk") {
    return assessCdmF10Notification(form);
  }
  const workers = num(form?.estimatedWorkers);
  const personDays = num(form?.estimatedPersonDays);
  const workingDays = num(form?.calendarPhaseDays);
  const reasons = [];
  if (marketId === "pl") {
    if (workers >= 20) {
      reasons.push(`${workers} pracowników jednocześnie — sprawdź wymogi planu BHP i zgłoszenia PIP`);
    }
    if (personDays >= 500) {
      reasons.push(`${personDays} osobodni — oceń obowiązki dokumentacyjne na budowie`);
    }
    if (workingDays > 30 && workers > 10) {
      reasons.push(`${workingDays} dni kalendarzowych, ${workers} pracowników — potwierdź plan BHP`);
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
