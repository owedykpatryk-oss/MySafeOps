/** @typedef {import("../config/markets").MarketId} MarketId */

import { AU_PLAN_PRICE_LABELS } from "../config/auPricing";
import { PL_PLAN_PRICE_LABELS } from "../config/plPricing";
import { getMarketLabelPack } from "../config/marketLabelPacks";

/** @typedef {{ price: string; suffix?: string; subtitle: string; tag: string; features: string[] }} LandingPricingTier */

/** @type {Record<MarketId, {
 *   title: string;
 *   description: string;
 *   heroBadge: string;
 *   heroLeadFull: string;
 *   heroLeadShort: string;
 *   trustPills: string[];
 *   ramsLabel: string;
 *   footerBlurb: string;
 *   complianceBadge: string;
 *   complianceTitle: string;
 *   complianceIntro: string;
 *   complianceBadgeCode: string;
 *   complianceItems: [string, string][];
 *   pricingFootnote: string;
 *   pricingDisclaimer: string;
 *   incidentFeature: string;
 *   faqLegalRef: string;
 *   faqRegulator: string;
 *   roiDefaultRate: number;
 *   pricing: {
 *     trial: LandingPricingTier;
 *     starter: LandingPricingTier;
 *     team: LandingPricingTier;
 *     business: LandingPricingTier;
 *     enterprise: LandingPricingTier;
 *     enterprisePlus: LandingPricingTier;
 *   };
 * }>} */
export const LANDING_MARKET_CONTENT = {
  uk: {
    title: "MySafeOps — RAMS, permits & site safety for UK construction & surveying",
    description:
      "RAMS quick packs, permits to work, PAS128 survey workflows, geo evidence and 40+ registers — browser-first for UK construction, utilities and surveying teams. Flat organisation pricing. 14-day full evaluation.",
    heroBadge: "🇬🇧 UK site teams — construction to survey",
    heroLeadFull:
      "RAMS quick packs, permits, PAS128 survey workflows, geo evidence and hygiene registers — one workspace tuned to your trade. Offline-first core",
    heroLeadShort: "RAMS packs, PAS128 surveys, permits and registers — one workspace for your trade. Offline-first",
    trustPills: ["Offline-capable", "UK registers", "Flat org pricing", "Optional cloud backup"],
    ramsLabel: "RAMS quick packs",
    footerBlurb: "Construction safety workspace for UK sites — RAMS, permits, registers, and evidence in one place.",
    complianceBadge: "UK-focused",
    complianceTitle: "Built for practical compliance evidence",
    complianceIntro:
      "Use MySafeOps to organise site safety records — not as a substitute for legal advice or statutory reporting obligations.",
    complianceBadgeCode: "UK",
    complianceItems: [
      ["CDM 2015", "Construction (Design & Management) Regulations — structured site records and responsibilities."],
      ["HASAWA 1974", "Health and Safety at Work Act — consistent day-to-day controls and evidence trails."],
      ["Work at height", "Plan controls, briefings, and inspections with traceable records."],
      ["Equipment & lifting", "Keep inspection discipline visible — PAT, plant, lifting accessories (as your workflows require)."],
      ["COSHH", "Manage substance records and practical controls alongside site activity."],
      ["RIDDOR", "Support timely internal reporting workflows — follow HSE guidance for statutory reporting."],
    ],
    pricingFootnote:
      "Includes a 14-day evaluation in-product when you sign in (optional +14 day extension once). After trial, subscribe to keep editing — existing data stays viewable and exportable. Not legal advice — always follow your site rules and UK requirements.",
    pricingDisclaimer: "Terms §7.5",
    incidentFeature: "Near misses, injuries, RIDDOR paths. Capture evidence fast and keep follow-up visible.",
    faqLegalRef: "HSE reporting",
    faqRegulator: "RIDDOR",
    roiDefaultRate: 28,
    pricing: {
      trial: { price: "£0", subtitle: "14 days · all modules", tag: "👷 Try before you buy", features: ["Full module library during trial", "One free +14 day extension", "Then subscribe from Solo"] },
      starter: { price: "£19", suffix: "/mo", subtitle: "5 workers · 100 projects · 2GB", tag: "👷 Freelancer / single site", features: ["Full module library", "Cloud backup (when configured)", "Email support"] },
      team: { price: "£99", suffix: "/mo", subtitle: "20 workers · 500 projects · 10GB", tag: "👷 Small contractor", features: ["Full module library", "Invites & role management", "Priority support", "Multi-supervisor sites"] },
      business: { price: "£249", suffix: "/mo", subtitle: "75 workers · 2,500 projects · 50GB", tag: "👷 Multi-site governance", features: ["Tamper-evident audit log", "Dedicated onboarding", "Higher operational headroom"] },
      enterprise: { price: "£499", suffix: "/mo", subtitle: "200 workers · 10,000 projects · 200GB", tag: "👷 Group operations", features: ["Custom subdomain", "Group MI dashboard", "SLA & named support"] },
      enterprisePlus: { price: "Let's talk", subtitle: "150+ people · custom SLA", tag: "👷 Post-acquisition scale", features: ["Unlimited workers & projects", "Custom integrations", "Dedicated account manager"] },
    },
  },
  au: {
    title: "MySafeOps — SWMS, permits & site safety for Australian construction",
    description:
      "SWMS and RAMS packs, permits to work, WHS registers and geo evidence — browser-first for Australian construction, civil and industrial site teams. Flat organisation pricing in AUD. 14-day full evaluation.",
    heroBadge: "🇦🇺 Australian site teams — construction & civil",
    heroLeadFull:
      "SWMS packs, permits to work, WHS registers and geo evidence — one workspace tuned to Australian construction and civil trades. Offline-first core",
    heroLeadShort: "SWMS packs, permits and WHS registers — one workspace for your trade. Offline-first",
    trustPills: ["Offline-capable", "WHS registers", "Flat org pricing", "Optional cloud backup"],
    ramsLabel: "SWMS & RAMS packs",
    footerBlurb: "Construction safety workspace for Australian sites — SWMS, permits, registers, and evidence in one place.",
    complianceBadge: "Australia-focused",
    complianceTitle: "Built for practical WHS evidence",
    complianceIntro:
      "Use MySafeOps to organise site safety records aligned with model WHS laws — not as a substitute for legal advice or state regulator reporting.",
    complianceBadgeCode: "AU",
    complianceItems: [
      ["WHS Act 2011", "Model Work Health and Safety Act — PCBU duties, consultation, and reasonably practicable controls."],
      ["SWMS", "Safe Work Method Statements for high-risk construction work — structured templates and sign-off trails."],
      ["Permits to work", "Hot work, height, confined space, isolation and excavation — live status on site."],
      ["Plant & equipment", "Pre-starts, inspections and maintenance records visible to supervisors."],
      ["Notifiable incidents", "Support internal reporting workflows — follow your state regulator for statutory notification."],
      ["White Card", "Track construction induction and competency alongside site records."],
    ],
    pricingFootnote:
      "Includes a 14-day evaluation in-product when you sign in (optional +14 day extension once). After trial, subscribe to keep editing — existing data stays viewable and exportable. Prices in AUD ex GST unless stated. Not legal advice — follow your site rules and state WHS requirements.",
    pricingDisclaimer: "Terms §7.5",
    incidentFeature: "Near misses, injuries and notifiable incident paths. Capture evidence fast and keep follow-up visible.",
    faqLegalRef: "regulator reporting",
    faqRegulator: "notifiable incidents",
    roiDefaultRate: 45,
    pricing: {
      trial: { price: AU_PLAN_PRICE_LABELS.trial, subtitle: "14 days · all modules", tag: "👷 Try before you buy", features: ["Full module library during trial", "One free +14 day extension", "Then subscribe from Solo"] },
      starter: { price: AU_PLAN_PRICE_LABELS.starter, suffix: "/mo", subtitle: "5 workers · 100 projects · 2GB", tag: "👷 Freelancer / single site", features: ["Full module library", "Cloud backup (when configured)", "Email support"] },
      team: { price: AU_PLAN_PRICE_LABELS.team, suffix: "/mo", subtitle: "20 workers · 500 projects · 10GB", tag: "👷 Small contractor", features: ["Full module library", "Invites & role management", "Priority support", "Multi-supervisor sites"] },
      business: { price: AU_PLAN_PRICE_LABELS.business, suffix: "/mo", subtitle: "75 workers · 2,500 projects · 50GB", tag: "👷 Multi-site governance", features: ["Tamper-evident audit log", "Dedicated onboarding", "Higher operational headroom"] },
      enterprise: { price: AU_PLAN_PRICE_LABELS.enterprise, suffix: "/mo", subtitle: "200 workers · 10,000 projects · 200GB", tag: "👷 Group operations", features: ["Custom subdomain", "Group MI dashboard", "SLA & named support"] },
      enterprisePlus: { price: "Let's talk", subtitle: "150+ people · custom SLA", tag: "👷 Post-acquisition scale", features: ["Unlimited workers & projects", "Custom integrations", "Dedicated account manager"] },
    },
  },
  pl: {
    title: "MySafeOps — IOR, pozwolenia na pracę i BHP dla budownictwa w Polsce",
    description:
      "Pakiety IOR, pozwolenia na pracę, rejestry BHP i dowody z terenu — w przeglądarce, dla polskich firm budowlanych i instalacyjnych. Stała cena za organizację w PLN. 14 dni pełnej ewaluacji.",
    heroBadge: "🇵🇱 Polskie ekipy budowlane i instalacyjne",
    heroLeadFull:
      "Pakiety IOR, pozwolenia na pracę, plany BHP i rejestry — jedno środowisko pod polskie budowy. Rdzeń offline",
    heroLeadShort: "IOR, PTW i rejestry BHP — jedno środowisko dla Twojej budowy. Offline",
    trustPills: ["Działa offline", "Rejestry BHP", "Stała cena org", "Opcjonalna kopia w chmurze"],
    ramsLabel: "Pakiety IOR",
    footerBlurb: "BHP na budowie — IOR, pozwolenia, rejestry i dowody w jednym miejscu.",
    complianceBadge: "Polska",
    complianceTitle: "Dowody BHP na co dzień",
    complianceIntro:
      "MySafeOps porządkuje dokumentację BHP — nie zastępuje porady prawnej ani zgłoszeń do PIP.",
    complianceBadgeCode: "PL",
    complianceItems: [
      ["Kodeks pracy", "Obowiązki pracodawcy, ocena ryzyka, szkolenia BHP."],
      ["IOR", "Instrukcja organizacji robót — szablony i ścieżka zatwierdzenia."],
      ["Pozwolenia na pracę", "Prace szczególnie niebezpieczne — status na budowie."],
      ["Plan BHP", "Plan dla inwestycji budowlanej i koordynacja podwykonawców."],
      ["Zdarzenia PIP", "Wsparcie wewnętrznego raportowania — zgłoszenia ustawowe po Twojej stronie."],
      ["Uprawnienia", "UDT, SEP, szkolenia BHP przy rejestrze pracowników."],
    ],
    pricingFootnote:
      "14 dni ewaluacji po zalogowaniu (+14 dni przedłużenia raz). Po trialu subskrypcja — dane do podglądu i eksportu zostają. Ceny w PLN netto. To nie porada prawna.",
    pricingDisclaimer: "Regulamin §7.5",
    incidentFeature: "Zdarzenia, urazy, ścieżki PIP — szybki zapis i follow-up.",
    faqLegalRef: "zgłoszenia PIP",
    faqRegulator: "PIP",
    roiDefaultRate: 55,
    pricing: {
      trial: { price: PL_PLAN_PRICE_LABELS.trial, subtitle: "14 dni · wszystkie moduły", tag: "👷 Wypróbuj", features: ["Pełna biblioteka w trialu", "Jedno przedłużenie +14 dni", "Potem subskrypcja od Solo"] },
      starter: { price: PL_PLAN_PRICE_LABELS.starter, suffix: "/mies.", subtitle: "5 pracowników · 100 projektów · 2GB", tag: "👷 Freelancer / jedna budowa", features: ["Pełna biblioteka", "Kopia w chmurze (gdy skonfigurowana)", "Wsparcie e-mail"] },
      team: { price: PL_PLAN_PRICE_LABELS.team, suffix: "/mies.", subtitle: "20 pracowników · 500 projektów · 10GB", tag: "👷 Mały wykonawca", features: ["Zaproszenia i role", "Wsparcie priorytetowe", "Wiele brygad"] },
      business: { price: PL_PLAN_PRICE_LABELS.business, suffix: "/mies.", subtitle: "75 pracowników · 2 500 projektów · 50GB", tag: "👷 Wiele budów", features: ["Audyt", "Onboarding", "Większe limity"] },
      enterprise: { price: PL_PLAN_PRICE_LABELS.enterprise, suffix: "/mies.", subtitle: "200 pracowników · 10 000 projektów · 200GB", tag: "👷 Grupa kapitałowa", features: ["Subdomena", "Dashboard grupy", "SLA"] },
      enterprisePlus: { price: "Porozmawiajmy", subtitle: "150+ osób · SLA", tag: "👷 Skala korporacyjna", features: ["Nielimitowani pracownicy", "Integracje", "Opiekun konta"] },
    },
  },
};

/** @param {MarketId} marketId */
export function getLandingMarketContent(marketId) {
  return LANDING_MARKET_CONTENT[marketId] ?? LANDING_MARKET_CONTENT.uk;
}

/** @param {MarketId} marketId */
export function getLandingFeatures(marketId) {
  const copy = getLandingMarketContent(marketId);
  const pack = getMarketLabelPack(marketId);
  const ramsLabel = marketId === "pl" ? "Kreator IOR" : marketId === "au" ? "SWMS Builder" : "RAMS Builder";
  const ramsDesc =
    marketId === "pl"
      ? "Macierz ryzyka, sugestie zagrożeń i metody pracy. Spójne IOR do weryfikacji na budowie."
      : marketId === "au"
        ? "Clickable risk matrix, hazard suggestions, and method statements. Keep SWMS consistent and easy to review."
        : "Clickable risk matrix, hazard suggestions, and method statements. Keep RAMS consistent and easy to review.";
  return [
    { emoji: "⚠️", bg: "rgba(13,148,136,.1)", t: ramsLabel, d: ramsDesc },
    { emoji: "🔥", bg: "rgba(249,115,22,.1)", t: marketId === "pl" ? "Pozwolenia na pracę" : "Permits to Work", d: marketId === "pl" ? "Prace gorące, na wysokości, w przestrzeni zamkniętej, elektryczne i więcej — status na żywo." : "Hot work, height, confined space, electrical, excavation, lifting, and more — with live/expired visibility." },
    { emoji: "🚨", bg: "rgba(239,68,68,.1)", t: marketId === "pl" ? "Zgłaszanie zdarzeń" : "Incident Reporting", d: copy.incidentFeature },
    { emoji: "👷", bg: "rgba(59,130,246,.1)", t: marketId === "pl" ? "Kompetencje" : "Worker competency", d: marketId === "pl" ? pack.competencyHint + " — ważność i przypomnienia." : marketId === "au" ? "White Card, certificates, training matrix, and expiry awareness — so skills stay current on site." : "Certificates, training matrix, and expiry awareness — so skills stay current on site." },
    { emoji: "📊", bg: "rgba(139,92,246,.1)", t: marketId === "pl" ? "Widoczność operacyjna" : "Operational visibility", d: marketId === "pl" ? "Dashboardy i rejestry pomagają wychwycić luki zanim staną się zdarzeniem." : "Dashboards and registers that help supervisors spot gaps before they become incidents." },
    { emoji: "🗺️", bg: "rgba(34,197,94,.1)", t: marketId === "pl" ? "Plany budowy i zdjęcia" : "Site plans & photos", d: marketId === "pl" ? "Oznacz zagrożenia, punkty zbiórki i wyłączenia — z dowodami łatwymi do odnalezienia." : "Mark hazards, assembly points, and exclusions — with evidence that is easy to find later." },
    { emoji: "📚", bg: "rgba(6,182,212,.1)", t: marketId === "pl" ? "Rejestry" : "Registers & logs", d: marketId === "pl" ? "Substancje, pożar, odpady, goście, inspekcje — bez chaosu w arkuszach." : marketId === "au" ? "Hazardous substances, fire, waste, visitors, inspections — structured records without spreadsheet chaos." : "COSHH, fire, waste, visitors, inspections — structured records without spreadsheet chaos." },
    { emoji: "✅", bg: "rgba(120,113,108,.1)", t: marketId === "pl" ? "Listy kontrolne" : "Inspection checklists", d: marketId === "pl" ? "Przed rozpoczęciem, cotygodniowe, urządzenia — odhacz, opisz i dołącz dowód." : "Pre-starts, weekly checks, equipment inspections — tick, note, and evidence in one flow." },
    { emoji: "🚗", bg: "rgba(168,85,247,.1)", t: marketId === "pl" ? "Pojazdy i sprzęt" : "Vehicle & equipment", d: marketId === "pl" ? "Inspekcje, kalibracje i terminy z przypomnieniami zanim coś przegapisz." : "Track inspections, calibration, and key dates with reminders before things slip." },
  ];
}

/** @param {MarketId} marketId */
export function getModuleTicker(marketId) {
  const ramsTag = marketId === "pl" ? "⚠️ IOR" : marketId === "au" ? "⚠️ SWMS" : "⚠️ RAMS";
  const substTag = marketId === "pl" ? "☠️ Substancje" : marketId === "au" ? "☠️ Hazardous substances" : "☠️ COSHH";
  const liftTag = marketId === "pl" ? "🏋️ Urządzenia" : marketId === "au" ? "🏋️ Plant & lifting" : "🏋️ LOLER";
  const base = [
    ramsTag,
    marketId === "pl" ? "🔥 Pozwolenia — prace gorące" : "🔥 Hot Work Permits",
    marketId === "pl" ? "🏗️ Prace na wysokości" : "🏗️ Height Permits",
    marketId === "pl" ? "⛑️ Przestrzeń zamknięta" : "⛑️ Confined Space",
    marketId === "pl" ? "⚡ Prace elektryczne" : "⚡ Electrical PTW",
    marketId === "pl" ? "⛏️ Wykopy" : "⛏️ Excavation PTW",
    marketId === "pl" ? "🏋️ Podnoszenie" : "🏋️ Lifting PTW",
    marketId === "pl" ? "📋 Raporty budowy" : "📋 Site Reports",
    marketId === "pl" ? "🚨 Zdarzenia" : "🚨 Incidents",
    substTag,
    marketId === "pl" ? "🪜 Rejestr rusztowań" : "🪜 Scaffold Register",
    liftTag,
    marketId === "pl" ? "🔥 Rejestr pożarowy" : "🔥 Fire Log",
    marketId === "pl" ? "♻️ Rejestr odpadów" : "♻️ Waste Register",
    marketId === "pl" ? "🧑‍💼 Goście" : "🧑‍💼 Visitors",
    marketId === "pl" ? "✅ Listy kontrolne" : "✅ Checklists",
    marketId === "pl" ? "📊 Macierz szkoleń" : "📊 Training Matrix",
    marketId === "pl" ? "🗺️ Plany budowy" : "🗺️ Site Plans",
    marketId === "pl" ? "📸 Dowody" : "📸 Evidence",
  ];
  if (marketId === "uk") {
    base.push("📐 PAS128 surveys", "🛰️ Geo photos", "🧪 GMP & allergen");
  } else if (marketId === "pl") {
    base.push("🛰️ Geo photos", "📋 Przepisy BHP", "🏗️ Plan BHP");
  } else {
    base.push("🛰️ Geo photos", "📋 WHS legislation");
  }
  base.push(
    marketId === "pl" ? "🚗 Pojazdy" : "🚗 Vehicles",
    marketId === "pl" ? "🔧 Sprzęt" : "🔧 Equipment",
    marketId === "pl" ? "🖨️ Eksport PDF" : "🖨️ PDF Export"
  );
  return base;
}

/** @typedef {{ href: string; label: string; spa?: boolean; compactHide?: boolean }} LandingNavLink */

/** @param {MarketId} marketId */
export function getLandingNavLinks(marketId) {
  if (marketId === "pl") {
    return {
      mobile: [
        { href: "#workflow", label: "Jak to działa" },
        { href: "#profiles", label: "Profile i IOR" },
        { href: "#features", label: "Funkcje" },
        { href: "#readiness", label: "Test gotowości" },
        { href: "#pricing", label: "Cennik" },
        { href: "#faq", label: "FAQ" },
        { href: "/blog", label: "Blog", spa: true },
        { href: "#missing", label: "Zgłoś funkcję" },
      ],
      desktop: [
        { href: "#workflow", label: "Proces" },
        { href: "#features", label: "Funkcje" },
        { href: "#profiles", label: "Profile i IOR" },
        { href: "#modules", label: "Moduły" },
        { href: "#readiness", label: "Gotowość", compactHide: true },
        { href: "#roi", label: "Korzyści", compactHide: true },
        { href: "#roles", label: "Jak to działa", compactHide: true },
        { href: "#pricing", label: "Cennik" },
        { href: "/blog", label: "Blog", spa: true },
        { href: "#faq", label: "FAQ" },
        { href: "#missing", label: "Zgłoś funkcję", compactHide: true },
      ],
      signIn: "Zaloguj się",
      getStarted: "Wypróbuj",
      skipToMain: "Przejdź do treści",
      heroGetStarted: "Wypróbuj →",
      heroSeeProfiles: "Zobacz profile",
      heroQuickCheck: "Szybki test",
    };
  }
  return {
    mobile: [
      { href: "#workflow", label: "How it works" },
      { href: "#profiles", label: "Profiles & RAMS" },
      { href: "#features", label: "Features" },
      { href: "#readiness", label: "Readiness check" },
      { href: "#pricing", label: "Pricing" },
      { href: "#faq", label: "FAQ" },
      { href: "/blog", label: "Blog", spa: true },
      { href: "#missing", label: "Request a feature" },
    ],
    desktop: [
      { href: "#workflow", label: "Workflow" },
      { href: "#features", label: "Features" },
      { href: "#profiles", label: "Profiles & RAMS" },
      { href: "#modules", label: "Modules" },
      { href: "#readiness", label: "Readiness check", compactHide: true },
      { href: "#roi", label: "Value", compactHide: true },
      { href: "#roles", label: "How it works", compactHide: true },
      { href: "#pricing", label: "Pricing" },
      { href: "/blog", label: "Blog", spa: true },
      { href: "#faq", label: "FAQ" },
      { href: "#missing", label: "Request feature", compactHide: true },
    ],
    signIn: "Sign in",
    getStarted: "Get started",
    skipToMain: "Skip to main content",
    heroGetStarted: "Get started →",
    heroSeeProfiles: "See profiles",
    heroQuickCheck: "2-min check",
  };
}

/** @param {MarketId} marketId */
export function getLandingFaqCopy(marketId) {
  const copy = getLandingMarketContent(marketId);
  if (marketId === "pl") {
    return {
      heading: "Najczęstsze pytania",
      intro: "Krótkie odpowiedzi — w aplikacji zobaczysz limity i funkcje swojego planu.",
      legalQuestion: "Czy MySafeOps to porada prawna lub zgłoszenia do PIP?",
      legalAnswer:
        "Nie. Pomaga porządkować IOR, pozwolenia, rejestry i dowody. Za zgłoszenia ustawowe i zasady na budowie odpowiadasz Ty.",
      regulator: copy.faqRegulator,
      regionQuestion: "Czy MySafeOps obejmuje polskie przepisy BHP?",
      regionAnswer:
        "Szablony są pod kodeks pracy, rozporządzenia BHP i praktykę PIP. Zawsze zweryfikuj wymagania inwestora i branży.",
    };
  }
  if (marketId === "au") {
    return {
      heading: "Common questions",
      intro: "Short answers — open the app for live limits and features on your plan.",
      legalQuestion: "Is MySafeOps legal advice or regulator reporting?",
      legalAnswer:
        "No. It helps you organise SWMS, permits, registers, and evidence. You remain responsible for statutory reporting (e.g. notifiable incidents) and site-specific rules.",
      regulator: copy.faqRegulator,
      regionQuestion: "Does MySafeOps cover every Australian state?",
      regionAnswer:
        "Templates align with model WHS laws and Safe Work Australia codes of practice. State regulators (NSW, VIC, QLD, etc.) may have additional requirements — always verify against your jurisdiction.",
    };
  }
  return {
    heading: "Common questions",
    intro: "Short answers — open the app for live limits and features on your plan.",
    legalQuestion: "Is MySafeOps legal advice or HSE reporting?",
    legalAnswer:
      "No. It helps you organise RAMS, permits, registers, and evidence. You remain responsible for statutory reporting (e.g. RIDDOR) and site-specific rules.",
    regulator: copy.faqRegulator,
    regionQuestion: null,
    regionAnswer: null,
  };
}
